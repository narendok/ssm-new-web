-- Lifecycle task defaults may target a department role. The current person
-- assigned to that role is resolved when each new task is generated.
CREATE OR REPLACE FUNCTION private.validate_lifecycle_task_assignee_roles(
  p_organization uuid,
  p_definition jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  stage_row jsonb;
  task_row jsonb;
  selected_role uuid;
  department_id uuid;
  holder_count integer;
BEGIN
  FOR stage_row IN SELECT value FROM jsonb_array_elements(p_definition->'stages') LOOP
    FOR task_row IN SELECT value FROM jsonb_array_elements(coalesce(stage_row->'tasks','[]'::jsonb)) LOOP
      IF nullif(task_row->>'assigneeRoleId','') IS NULL THEN CONTINUE; END IF;
      selected_role := (task_row->>'assigneeRoleId')::uuid;
      SELECT d.id INTO department_id
      FROM public.departments d
      WHERE d.organization_id=p_organization AND d.code=task_row->>'department'
        AND d.active AND d.code<>'CLIENT';
      SELECT count(DISTINCT m.id) INTO holder_count
      FROM public.department_roles r
      JOIN public.department_role_assignments a ON a.role_id=r.id AND a.active
      JOIN public.organization_members m ON m.id=a.member_id AND m.organization_id=p_organization
        AND m.active AND m.role IN ('department_lead','member')
      WHERE r.id=selected_role AND r.organization_id=p_organization
        AND r.department_id=department_id AND r.active;
      IF department_id IS NULL OR holder_count<>1 THEN
        RAISE EXCEPTION 'LIFECYCLE_TASK_ROLE_REQUIRES_ONE_ACTIVE_HOLDER: %', task_row->>'department';
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_lifecycle_task_assignee_roles(uuid,jsonb) FROM PUBLIC,anon,authenticated;

-- Replace the previous person-ID validation with org-chart role validation.
DO $patch$
DECLARE definition text; needle text;
BEGIN
  definition:=pg_get_functiondef('public.mutate_lifecycle_workspace(text,jsonb,uuid)'::regprocedure);
  needle:='PERFORM private.validate_lifecycle_task_assignees(a.organization_id,definition);';
  IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'LIFECYCLE_ROLE_VALIDATION_PATCH_PRECONDITION'; END IF;
  definition:=replace(definition,needle,'PERFORM private.validate_lifecycle_task_assignee_roles(a.organization_id,definition);');
  EXECUTE definition;
END;
$patch$;

-- Resolve the configured role's sole active holder at generation time; keep
-- Department lead (automatic) behavior when no role is selected.
DO $patch$
DECLARE definition text; needle text; replacement text;
BEGIN
  definition:=pg_get_functiondef('private.sync_pinned_lifecycle_work()'::regprocedure);
  needle:='  assignee uuid;';
  IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'LIFECYCLE_ROLE_GENERATOR_VARIABLE_PATCH_PRECONDITION'; END IF;
  definition:=replace(definition,needle,needle||E'\n  holder_count integer;');

  needle:=$old$
    assignee:=nullif(task->>'assigneeMemberId','')::uuid;
    IF assignee IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.organization_members m
      WHERE m.id=assignee AND m.organization_id=NEW.organization_id AND m.active
        AND m.role IN ('department_lead','member')
        AND (
          EXISTS(SELECT 1 FROM public.departments d WHERE d.id=dept AND d.lead_member_id=m.id)
          OR EXISTS(
            SELECT 1 FROM public.department_role_assignments a
            JOIN public.department_roles r ON r.id=a.role_id AND r.active
            WHERE a.member_id=m.id AND a.active AND r.organization_id=NEW.organization_id
              AND r.department_id=dept
          )
        )
    ) THEN RAISE EXCEPTION 'LIFECYCLE_TASK_ASSIGNEE_NOT_IN_DEPARTMENT'; END IF;
$old$;
  replacement:=$new$
    IF nullif(task->>'assigneeRoleId','') IS NOT NULL THEN
      SELECT count(DISTINCT m.id), min(m.id::text)::uuid INTO holder_count,assignee
      FROM public.department_roles r
      JOIN public.department_role_assignments a ON a.role_id=r.id AND a.active
      JOIN public.organization_members m ON m.id=a.member_id AND m.organization_id=NEW.organization_id
        AND m.active AND m.role IN ('department_lead','member')
      WHERE r.id=(task->>'assigneeRoleId')::uuid AND r.organization_id=NEW.organization_id
        AND r.department_id=dept AND r.active;
      IF holder_count<>1 THEN RAISE EXCEPTION 'LIFECYCLE_TASK_ROLE_REQUIRES_ONE_ACTIVE_HOLDER'; END IF;
    ELSE
      assignee:=NULL;
    END IF;
$new$;
  IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'LIFECYCLE_ROLE_GENERATOR_ASSIGNMENT_PATCH_PRECONDITION'; END IF;
  definition:=replace(definition,needle,replacement);
  EXECUTE definition;
END;
$patch$;

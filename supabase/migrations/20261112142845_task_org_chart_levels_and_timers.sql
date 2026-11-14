-- Store the four configurable org-chart levels used by task assignment.
ALTER TABLE public.department_roles
  ADD COLUMN IF NOT EXISTS hierarchy_level smallint;
ALTER TABLE public.department_roles
  DROP CONSTRAINT IF EXISTS department_roles_hierarchy_level_check;
ALTER TABLE public.department_roles
  ADD CONSTRAINT department_roles_hierarchy_level_check
  CHECK (hierarchy_level IS NULL OR hierarchy_level BETWEEN 1 AND 4);

-- A task's cost/time plan is an estimate; these fields separately record actual work.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS actual_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timer_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS timer_started_by uuid REFERENCES public.organization_members(id);
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_actual_seconds_nonnegative;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_actual_seconds_nonnegative CHECK (actual_seconds >= 0);

CREATE OR REPLACE FUNCTION public.get_shared_department_role_configuration()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a record;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client OR NOT private.is_shared_test_org(a.organization_id) THEN
  RAISE EXCEPTION 'ROLE_CONFIGURATION_READ_DENIED';
 END IF;
 RETURN jsonb_build_object(
  'canManage',a.role='admin',
  'departments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'name',d.name,'active',d.active,'leadMemberId',d.lead_member_id) ORDER BY d.sort_order,d.name) FROM public.departments d WHERE d.organization_id=a.organization_id AND d.active AND d.code<>'CLIENT'),'[]'::jsonb),
  'members',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',COALESCE(m.display_name,'Unnamed member'),'role',m.role,'departmentId',private.shared_test_member_department(m.id)) ORDER BY m.display_name,m.id) FROM public.organization_members m WHERE m.organization_id=a.organization_id AND m.active AND m.role IN ('department_lead','member')),'[]'::jsonb),
  'roles',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',r.id,'departmentId',d.id,'departmentCode',d.code,'departmentName',d.name,'name',r.name,'roleKey',r.role_key,'active',r.active,'updatedAt',r.updated_at,
    'hierarchyLevel',r.hierarchy_level,
    'permissions',COALESCE((SELECT jsonb_agg(p.permission_key ORDER BY p.permission_key) FROM public.role_permissions p WHERE p.role_id=r.id AND p.allowed),'[]'::jsonb),
    'memberIds',COALESCE((SELECT jsonb_agg(ra.member_id ORDER BY ra.member_id) FROM public.department_role_assignments ra WHERE ra.role_id=r.id AND ra.active),'[]'::jsonb)
   ) ORDER BY d.sort_order,r.hierarchy_level NULLS LAST,r.name)
   FROM public.department_roles r JOIN public.departments d ON d.id=r.department_id AND d.organization_id=r.organization_id
   WHERE r.organization_id=a.organization_id AND d.code<>'CLIENT'),'[]'::jsonb)
 );
END $$;
REVOKE ALL ON FUNCTION public.get_shared_department_role_configuration() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_shared_department_role_configuration() TO authenticated;

-- Extend the existing Admin save function without changing its permission model.
DO $role_level$
DECLARE d text; old text; replacement text;
BEGIN
 d:=pg_get_functiondef('public.save_shared_department_role(jsonb)'::regprocedure);
 old:='permission_keys text[];'; replacement:='permission_keys text[]; role_hierarchy smallint;';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_LEVEL_DECLARATION_PATCH_FAILED'; END IF;
 d:=replace(d,old,replacement);
 old:='role_name:=trim(p_payload->>''name''); role_key:=trim(p_payload->>''roleKey''); role_active:=(p_payload->>''active'')::boolean;';
 replacement:=old||E'\n role_hierarchy:=NULLIF(p_payload->>''hierarchyLevel'','''')::smallint;\n IF role_hierarchy IS NOT NULL AND role_hierarchy NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION ''INVALID_ROLE_HIERARCHY_LEVEL''; END IF;';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_LEVEL_PARSE_PATCH_FAILED'; END IF;
 d:=replace(d,old,replacement);
 old:='INSERT INTO public.department_roles(organization_id,department_id,name,role_key,active) VALUES(a.organization_id,d.id,role_name,role_key,role_active)';
 replacement:='INSERT INTO public.department_roles(organization_id,department_id,name,role_key,active,hierarchy_level) VALUES(a.organization_id,d.id,role_name,role_key,role_active,role_hierarchy)';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_LEVEL_INSERT_PATCH_FAILED'; END IF;
 d:=replace(d,old,replacement);
 old:='UPDATE public.department_roles SET name=role_name,active=role_active,updated_at=now() WHERE id=r.id RETURNING * INTO r;';
 replacement:='UPDATE public.department_roles SET name=role_name,active=role_active,hierarchy_level=role_hierarchy,updated_at=now() WHERE id=r.id RETURNING * INTO r;';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_LEVEL_UPDATE_PATCH_FAILED'; END IF;
 d:=replace(d,old,replacement);
 EXECUTE d;
END
$role_level$;

-- Validate every configured level against the task's department and level.
CREATE OR REPLACE FUNCTION private.validate_lifecycle_task_assignee_roles(
  p_organization uuid, p_definition jsonb
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE stage_row jsonb; task_row jsonb; level_key text; role_id uuid; department_id uuid;
BEGIN
 FOR stage_row IN SELECT value FROM jsonb_array_elements(p_definition->'stages') LOOP
  FOR task_row IN SELECT value FROM jsonb_array_elements(COALESCE(stage_row->'tasks','[]'::jsonb)) LOOP
   SELECT d.id INTO department_id FROM public.departments d
   WHERE d.organization_id=p_organization AND d.code=task_row->>'department' AND d.active AND d.code<>'CLIENT';
   IF department_id IS NULL THEN RAISE EXCEPTION 'LIFECYCLE_TASK_DEPARTMENT_UNAVAILABLE'; END IF;
   FOR level_key IN SELECT unnest(ARRAY['L1','L2','L3','L4']) LOOP
    role_id:=NULLIF(task_row->'assigneeRoleLevels'->>level_key,'')::uuid;
    IF role_id IS NULL AND level_key='L1' THEN role_id:=NULLIF(task_row->>'assigneeRoleId','')::uuid; END IF;
    IF role_id IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.department_roles r WHERE r.id=role_id AND r.organization_id=p_organization AND r.department_id=department_id AND r.active AND (r.hierarchy_level IS NULL OR r.hierarchy_level=substring(level_key from 2)::smallint)) THEN
      RAISE EXCEPTION 'LIFECYCLE_TASK_ROLE_LEVEL_OR_DEPARTMENT_MISMATCH: %',level_key;
    END IF;
   END LOOP;
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.validate_lifecycle_task_assignee_roles(uuid,jsonb) FROM PUBLIC,anon,authenticated;

-- Resolve each new task from L4 upward, skipping empty/ambiguous profiles.
DO $task_ladder$
DECLARE d text; old text; replacement text;
BEGIN
 d:=pg_get_functiondef('private.sync_pinned_lifecycle_work()'::regprocedure);
 old:='  holder_count integer;'; replacement:=old||E'\n  role_level text;\n  selected_role uuid;';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'TASK_LADDER_VARIABLE_PATCH_FAILED'; END IF;
 d:=replace(d,old,replacement);
 old:=$old$
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
$old$;
 replacement:=$new$
    assignee:=NULL;
    FOR role_level IN SELECT unnest(ARRAY['L4','L3','L2','L1']) LOOP
      selected_role:=NULLIF(task->'assigneeRoleLevels'->>role_level,'')::uuid;
      IF selected_role IS NULL AND role_level='L1' THEN selected_role:=NULLIF(task->>'assigneeRoleId','')::uuid; END IF;
      IF selected_role IS NULL THEN CONTINUE; END IF;
      SELECT count(DISTINCT m.id),min(m.id::text)::uuid INTO holder_count,assignee
      FROM public.department_roles r
      JOIN public.department_role_assignments ra ON ra.role_id=r.id AND ra.active
      JOIN public.organization_members m ON m.id=ra.member_id AND m.organization_id=NEW.organization_id AND m.active AND m.role IN ('department_lead','member')
      WHERE r.id=selected_role AND r.organization_id=NEW.organization_id AND r.department_id=dept AND r.active;
      IF holder_count=1 THEN EXIT; END IF;
      assignee:=NULL;
    END LOOP;
    IF assignee IS NULL THEN
      SELECT m.id INTO assignee FROM public.departments d
      JOIN public.organization_members m ON m.id=d.lead_member_id AND m.organization_id=NEW.organization_id
        AND m.active AND m.role IN ('department_lead','member')
      WHERE d.id=dept;
    END IF;
$new$;
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'TASK_LADDER_ASSIGNMENT_PATCH_FAILED'; END IF;
 d:=replace(d,old,replacement);
 EXECUTE d;
END
$task_ladder$;

CREATE OR REPLACE FUNCTION public.mutate_shared_task_timer(p_task uuid,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; t public.tasks%ROWTYPE; now_at timestamptz:=clock_timestamp(); elapsed integer;
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client OR a.role='viewer' THEN RAISE EXCEPTION 'TASK_TIMER_ACCESS_DENIED'; END IF;
 IF p_action NOT IN ('start','stop') THEN RAISE EXCEPTION 'TASK_TIMER_ACTION_INVALID'; END IF;
 SELECT * INTO t FROM public.tasks WHERE id=p_task AND organization_id=a.organization_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_FOUND'; END IF;
 IF t.assignee_id IS DISTINCT FROM a.membership_id THEN RAISE EXCEPTION 'TASK_TIMER_ASSIGNEE_REQUIRED'; END IF;
 IF lower(t.status) IN ('complete','completed','cancelled','archived') THEN RAISE EXCEPTION 'TASK_TIMER_CLOSED'; END IF;
 IF p_action='start' THEN
  IF t.timer_started_at IS NOT NULL THEN RAISE EXCEPTION 'TASK_TIMER_ALREADY_RUNNING'; END IF;
  UPDATE public.tasks SET timer_started_at=now_at,timer_started_by=a.membership_id,status='In Progress',updated_at=now_at WHERE id=t.id RETURNING * INTO t;
 ELSE
  IF t.timer_started_at IS NULL OR t.timer_started_by IS DISTINCT FROM a.membership_id THEN RAISE EXCEPTION 'TASK_TIMER_NOT_OWNED'; END IF;
  elapsed:=GREATEST(0,(extract(epoch FROM now_at-t.timer_started_at))::integer);
  UPDATE public.tasks SET actual_seconds=actual_seconds+elapsed,timer_started_at=NULL,timer_started_by=NULL,updated_at=now_at WHERE id=t.id RETURNING * INTO t;
 END IF;
 INSERT INTO public.audit_events(organization_id,actor_id,entity_type,entity_id,action,detail)
 VALUES(a.organization_id,auth.uid(),'task',t.id,'Task timer '||p_action,jsonb_build_object('elapsed_seconds',CASE WHEN p_action='stop' THEN elapsed ELSE 0 END));
 RETURN to_jsonb(t);
END $$;
REVOKE ALL ON FUNCTION public.mutate_shared_task_timer(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_shared_task_timer(uuid,text) TO authenticated;

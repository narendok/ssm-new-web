-- A task template selects one intended organization-chart profile. Resolve only
-- that profile, and leave the new task unassigned when the profile is absent,
-- ambiguous, or has no unique active holder. Never fall back to another level
-- or silently assign the department lead. Existing tasks are not rewritten.
DO $strict_task_profile_validation$
DECLARE
  definition text;
  old_fragment text;
  new_fragment text;
BEGIN
  definition := pg_get_functiondef('private.validate_lifecycle_task_assignee_roles(uuid,jsonb)'::regprocedure);
  IF strpos(definition, 'target_department_id uuid;') = 0
    OR strpos(definition, 'LIFECYCLE_TASK_DEPARTMENT_UNAVAILABLE') = 0 THEN
    RAISE EXCEPTION 'STRICT_TASK_PROFILE_VALIDATION_PRECONDITION_FAILED';
  END IF;
  IF strpos(definition, 'LIFECYCLE_TASK_MULTIPLE_ASSIGNEE_PROFILES') > 0 THEN
    RAISE EXCEPTION 'STRICT_TASK_PROFILE_VALIDATION_ALREADY_PRESENT';
  END IF;

  old_fragment := 'target_department_id uuid;';
  new_fragment := old_fragment || ' profile_count integer;';
  definition := replace(definition, old_fragment, new_fragment);

  old_fragment := 'IF target_department_id IS NULL THEN RAISE EXCEPTION ''LIFECYCLE_TASK_DEPARTMENT_UNAVAILABLE''; END IF;';
  new_fragment := old_fragment || E'\n'
    || '   SELECT count(*) INTO profile_count FROM (' || E'\n'
    || '    SELECT entry.key AS level_key, entry.value AS role_id FROM jsonb_each_text(CASE WHEN jsonb_typeof(task_row->''assigneeRoleLevels'')=''object'' THEN task_row->''assigneeRoleLevels'' ELSE ''{}''::jsonb END) entry' || E'\n'
    || '    WHERE entry.key IN (''L1'',''L2'',''L3'',''L4'') AND nullif(entry.value,'''') IS NOT NULL' || E'\n'
    || '    UNION ALL' || E'\n'
    || '    SELECT ''L1'', task_row->>''assigneeRoleId''' || E'\n'
    || '    WHERE nullif(task_row->>''assigneeRoleId'','''') IS NOT NULL' || E'\n'
    || '      AND task_row->''assigneeRoleLevels''->>''L1'' IS DISTINCT FROM task_row->>''assigneeRoleId''' || E'\n'
    || '   ) configured_profiles;' || E'\n'
    || '   IF profile_count > 1 THEN RAISE EXCEPTION ''LIFECYCLE_TASK_MULTIPLE_ASSIGNEE_PROFILES''; END IF;';
  IF strpos(definition, old_fragment) = 0 THEN
    RAISE EXCEPTION 'STRICT_TASK_PROFILE_VALIDATION_INSERT_PRECONDITION_FAILED';
  END IF;
  EXECUTE replace(definition, old_fragment, new_fragment);
END
$strict_task_profile_validation$;

-- Replace the historical L4-to-L1 assignment ladder and department-lead
-- fallback at the task-generation boundary. Fail closed if the active function
-- no longer contains the expected implementation.
DO $strict_task_profile_resolver$
DECLARE
  definition text;
  old_fragment text;
  new_fragment text;
BEGIN
  definition := pg_get_functiondef('private.sync_pinned_lifecycle_work()'::regprocedure);
  IF strpos(definition, 'profile_count integer;') > 0 THEN
    RAISE EXCEPTION 'STRICT_TASK_PROFILE_RESOLVER_ALREADY_PRESENT';
  END IF;
  old_fragment := 'selected_role uuid;';
  new_fragment := old_fragment || E'\n      profile_count integer;\n      selected_role_text text;';
  IF strpos(definition, old_fragment) = 0 THEN
    RAISE EXCEPTION 'STRICT_TASK_PROFILE_RESOLVER_DECLARATION_PRECONDITION_FAILED';
  END IF;
  definition := replace(definition, old_fragment, new_fragment);

  old_fragment := $profile_ladder_pattern$(?s)assignee:=NULL;\s+FOR role_level IN SELECT unnest\(ARRAY\['L4','L3','L2','L1'\]\) LOOP.*?WHERE d\.id=dept;\s+END IF;$profile_ladder_pattern$;
  new_fragment := $new$
    assignee:=NULL;
    selected_role:=NULL;
    selected_role_text:=NULL;
    role_level:=NULL;
    SELECT count(*),min(configured.level_key),min(configured.role_id)
      INTO profile_count,role_level,selected_role_text
    FROM (
      SELECT entry.key AS level_key, entry.value AS role_id
      FROM jsonb_each_text(CASE WHEN jsonb_typeof(task->'assigneeRoleLevels')='object' THEN task->'assigneeRoleLevels' ELSE '{}'::jsonb END) entry
      WHERE entry.key IN ('L1','L2','L3','L4') AND nullif(entry.value,'') IS NOT NULL
      UNION ALL
      SELECT 'L1',task->>'assigneeRoleId'
      WHERE nullif(task->>'assigneeRoleId','') IS NOT NULL
        AND task->'assigneeRoleLevels'->>'L1' IS DISTINCT FROM task->>'assigneeRoleId'
    ) configured;
    IF profile_count=1 THEN
      selected_role:=selected_role_text::uuid;
      SELECT count(DISTINCT m.id),min(m.id::text)::uuid INTO holder_count,assignee
      FROM public.department_roles r
      JOIN public.department_role_assignments ra ON ra.role_id=r.id AND ra.active
      JOIN public.organization_members m ON m.id=ra.member_id AND m.organization_id=NEW.organization_id AND m.active AND m.role IN ('department_lead','member')
      WHERE r.id=selected_role AND r.organization_id=NEW.organization_id AND r.department_id=dept AND r.active
        AND r.hierarchy_level=substring(role_level from 2)::smallint;
      IF holder_count<>1 THEN assignee:=NULL; END IF;
    END IF;
$new$;
  IF definition !~ old_fragment THEN
    RAISE EXCEPTION 'STRICT_TASK_PROFILE_RESOLVER_PATCH_PRECONDITION_FAILED';
  END IF;
  EXECUTE regexp_replace(definition, old_fragment, new_fragment, '');
END
$strict_task_profile_resolver$;

-- Level-based task assignments must point to an explicitly classified L1-L4
-- department role. Unclassified roles remain valid for other role permissions.
DO $strict_task_role_levels$
DECLARE
  definition text;
  old_fragment text;
  new_fragment text;
BEGIN
  definition := pg_get_functiondef('private.validate_lifecycle_task_assignee_roles(uuid,jsonb)'::regprocedure);
  IF strpos(definition, 'role_id uuid; department_id uuid;') = 0
    OR strpos(definition, 'INTO department_id') = 0
    OR strpos(definition, 'IF department_id IS NULL') = 0
    OR strpos(definition, 'r.department_id=department_id') = 0 THEN
    RAISE EXCEPTION 'TASK_ROLE_DEPARTMENT_VARIABLE_PATCH_FAILED';
  END IF;
  definition := replace(definition, 'role_id uuid; department_id uuid;', 'role_id uuid; target_department_id uuid;');
  definition := replace(definition, 'INTO department_id', 'INTO target_department_id');
  definition := replace(definition, 'IF department_id IS NULL', 'IF target_department_id IS NULL');
  definition := replace(definition, 'r.department_id=department_id', 'r.department_id=target_department_id');
  old_fragment := '(r.hierarchy_level IS NULL OR r.hierarchy_level=substring(level_key from 2)::smallint)';
  new_fragment := '(r.hierarchy_level=substring(level_key from 2)::smallint)';
  IF strpos(definition, old_fragment) = 0 THEN
    RAISE EXCEPTION 'STRICT_TASK_ROLE_VALIDATION_PATCH_FAILED';
  END IF;
  EXECUTE replace(definition, old_fragment, new_fragment);

  -- Also defend the task-creation resolver if saved configuration predates
  -- validation or is written through a path that bypasses the settings UI.
  definition := pg_get_functiondef('private.sync_pinned_lifecycle_work()'::regprocedure);
  old_fragment := 'WHERE r.id=selected_role AND r.organization_id=NEW.organization_id AND r.department_id=dept AND r.active;';
  new_fragment := 'WHERE r.id=selected_role AND r.organization_id=NEW.organization_id AND r.department_id=dept AND r.active AND r.hierarchy_level=substring(role_level from 2)::smallint;';
  IF strpos(definition, old_fragment) = 0 THEN
    RAISE EXCEPTION 'STRICT_TASK_ROLE_RESOLVER_PATCH_FAILED';
  END IF;
  EXECUTE replace(definition, old_fragment, new_fragment);
END
$strict_task_role_levels$;

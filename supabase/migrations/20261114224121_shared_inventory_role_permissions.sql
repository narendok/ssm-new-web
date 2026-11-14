-- Allow organization Admins to configure the inventory permissions already enforced
-- by the Shared TEST inventory ledger. No existing role assignment or permission is
-- granted by this migration; Admin-only inventory adjustments remain unchanged.
DO $shared_inventory_role_permissions$
DECLARE
  function_definition text;
  old_last_permission text;
  replacement_permissions text;
BEGIN
  function_definition := pg_get_functiondef('public.save_shared_department_role(jsonb)'::regprocedure);
  old_last_permission := $old$'documents:approve'$old$;
  replacement_permissions := $new$'documents:approve','inventory:issue','inventory:receive','inventory:hold','inventory:release_hold'$new$;

  IF strpos(function_definition, old_last_permission) = 0
    OR strpos(function_definition, 'inventory:issue') > 0 THEN
    RAISE EXCEPTION 'SHARED_INVENTORY_ROLE_PERMISSION_PATCH_PRECONDITION';
  END IF;

  function_definition := replace(function_definition, old_last_permission, replacement_permissions);
  EXECUTE function_definition;
END
$shared_inventory_role_permissions$;

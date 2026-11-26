-- Allow only department leads and admins to set or clear a shared task review due date.
-- Preserve the existing SECURITY DEFINER RPC and its task/department authorization.
DO $patch$
DECLARE
  definition text;
  old text;
  replacement text;
BEGIN
  definition := pg_get_functiondef(
    'private.mutate_workspace_before_lifecycle_start(text,jsonb,uuid)'::regprocedure
  );

  old := '  IF p_payload ? ''status'' THEN';
  replacement := '  IF p_payload ? ''due_at'' AND a.role NOT IN (''admin'',''department_lead'') THEN RAISE EXCEPTION ''TASK_DUE_DATE_DENIED''; END IF;' || chr(10) || old;
  IF strpos(definition, old) = 0 THEN
    RAISE EXCEPTION 'TASK_REVIEW_DUE_DATE_AUTH_PATCH_PRECONDITION';
  END IF;
  definition := replace(definition, old, replacement);

  old := '      assignee_id=assignee,';
  replacement := '      assignee_id=assignee,' || chr(10) ||
    '      due_at=CASE WHEN p_payload ? ''due_at'' THEN NULLIF(p_payload->>''due_at'','''')::timestamptz ELSE due_at END,';
  IF strpos(definition, old) = 0 THEN
    RAISE EXCEPTION 'TASK_REVIEW_DUE_DATE_UPDATE_PATCH_PRECONDITION';
  END IF;
  definition := replace(definition, old, replacement);

  EXECUTE definition;
END
$patch$;

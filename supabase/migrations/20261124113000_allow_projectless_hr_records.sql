-- HR and Operations records are department-owned records and do not require a project.
-- Preserve project validation when a project is supplied; all other departments
-- retain the existing project requirement enforced by the shared TEST writer.
DO $patch$
DECLARE
 d text;
 create_pos integer;
 check_pos integer;
 old text := $old$project:=(p_payload->>'project_id')::uuid;
   IF NOT EXISTS(SELECT 1 FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'PROJECT_REQUIRED';
   END IF;$old$;
 replacement text := $new$project:=NULLIF(p_payload->>'project_id','')::uuid;
   IF project IS NULL THEN
    IF NOT EXISTS(
     SELECT 1 FROM departments target
     WHERE target.id=COALESCE(NULLIF(p_payload->>'department_id','')::uuid,dept)
       AND target.organization_id=org AND target.active AND target.code IN ('HR','HROPS')
    ) THEN RAISE EXCEPTION 'PROJECT_REQUIRED'; END IF;
   ELSIF NOT EXISTS(SELECT 1 FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'INVALID_PROJECT';
   END IF;$new$;
BEGIN
 d:=pg_get_functiondef('private.mutate_workspace_before_lifecycle_start(text,jsonb,uuid)'::regprocedure);
 create_pos:=strpos(d,'ELSIF p_action = ''create_record'' THEN');
 IF create_pos=0 THEN RAISE EXCEPTION 'HR_PROJECTLESS_CREATE_RECORD_PRECONDITION'; END IF;
 check_pos:=strpos(substr(d,create_pos),old);
 IF check_pos=0 THEN RAISE EXCEPTION 'HR_PROJECTLESS_PROJECT_GUARD_PRECONDITION'; END IF;
 check_pos:=create_pos+check_pos-1;
 d:=substr(d,1,check_pos-1)||replacement||substr(d,check_pos+length(old));
 IF position('target.code IN (''HR'',''HROPS'')' IN d)=0 THEN RAISE EXCEPTION 'HR_PROJECTLESS_GUARD_PATCH_FAILED'; END IF;
 EXECUTE d;
END $patch$;

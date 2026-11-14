-- An older nine-stage client must not change only the legacy column of a TG-pinned project.
-- Existing legacy aliases/history are retained until an authorized canonical transition.
CREATE FUNCTION private.guard_pinned_stage_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD.record_type='Project' AND nullif(OLD.fields->>'lifecycleBaseline','') IS NOT NULL
  AND NEW.stage IS DISTINCT FROM OLD.stage AND NEW.stage IS DISTINCT FROM NEW.fields->>'currentStage' THEN
  RAISE EXCEPTION 'USE_PINNED_STAGE_WORKFLOW: Open the project workspace and its completion review';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_pinned_stage_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_pinned_stage_identity BEFORE UPDATE ON public.operational_records FOR EACH ROW EXECUTE FUNCTION private.guard_pinned_stage_identity();

DO $patch$
DECLARE d text;
BEGIN
 d:=pg_get_functiondef('public.mutate_lifecycle_workspace(text,jsonb,uuid)'::regprocedure);
 d:=replace(d,'IF NOT FOUND OR NOT private.shared_test_record_visible(parent.source_project) THEN',
  'IF NOT FOUND OR NOT private.shared_test_record_visible(parent.source_project) OR NOT EXISTS(SELECT 1 FROM public.documents pd WHERE pd.id=parent.document_id AND private.shared_test_scope(a.organization_id,pd.department_id)) THEN');
 EXECUTE d;
END $patch$;

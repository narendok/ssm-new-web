-- Reviewed project-specific tailoring. Never rewrite completed tasks or mark omitted work complete.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
CREATE TABLE private.project_lifecycle_decisions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 project_id uuid NOT NULL REFERENCES public.operational_records(id), action text NOT NULL,
 previous_baseline text, next_baseline text, stage_code text, reason text NOT NULL CHECK(length(trim(reason))>=10),
 created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), transaction_id bigint NOT NULL DEFAULT txid_current()
);
ALTER TABLE private.project_lifecycle_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.project_lifecycle_decisions FROM PUBLIC,anon,authenticated;
CREATE INDEX project_lifecycle_decisions_project_idx ON private.project_lifecycle_decisions(project_id,created_at);

CREATE FUNCTION public.get_project_lifecycle_decisions(p_project uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a record;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.is_client OR NOT private.is_shared_test_org(a.organization_id) OR NOT EXISTS(SELECT 1 FROM public.operational_records WHERE id=p_project AND organization_id=a.organization_id AND private.shared_test_record_visible(id)) THEN RAISE EXCEPTION 'PROJECT_DENIED'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'action',d.action,'stageCode',d.stage_code,'reason',d.reason,'createdAt',d.created_at,'actor',m.display_name,'previousRevision',CASE WHEN d.previous_baseline IS NOT NULL THEN d.previous_baseline::jsonb->>'id' END,'nextRevision',CASE WHEN d.next_baseline IS NOT NULL THEN d.next_baseline::jsonb->>'id' END) ORDER BY d.created_at DESC)
 FROM private.project_lifecycle_decisions d LEFT JOIN public.organization_members m ON m.user_id=d.created_by AND m.organization_id=d.organization_id WHERE d.project_id=p_project AND d.organization_id=a.organization_id),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.get_project_lifecycle_decisions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_project_lifecycle_decisions(uuid) TO authenticated;

CREATE FUNCTION private.project_stage_prerequisites(p_project uuid,p_stage text,p_track text) RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.operational_records%ROWTYPE; s jsonb; canonical text[]; required text[];
BEGIN
 SELECT * INTO r FROM public.operational_records WHERE id=p_project;
 canonical:=public.resolve_canonical_stage_prerequisites(p_stage,p_track);
 IF nullif(r.fields->>'lifecycleBaseline','') IS NOT NULL THEN
  SELECT value INTO s FROM jsonb_array_elements((r.fields->>'lifecycleBaseline')::jsonb->'stages') WHERE value->>'code'=p_stage;
  IF s IS NULL THEN RAISE EXCEPTION 'PINNED_STAGE_MISSING'; END IF;
  IF s->'prerequisites' IS DISTINCT FROM (SELECT to_jsonb(prerequisites) FROM public.canonical_stage_templates WHERE stage_code=p_stage) THEN
   canonical:=ARRAY(SELECT jsonb_array_elements_text(s->'prerequisites'));
  END IF;
 END IF;
 required:=ARRAY(SELECT code FROM unnest(canonical) code WHERE public.is_stage_applicable_to_track(code,p_track) AND NOT coalesce(r.fields->'omittedStages','{}'::jsonb) ? code);
 RETURN required;
END $$;
REVOKE ALL ON FUNCTION private.project_stage_prerequisites(uuid,text,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.configure_project_lifecycle(p_payload jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; r public.operational_records%ROWTYPE; replay record; digest text; result jsonb; definition jsonb; stage jsonb; code text; action text; reason text; next_pin text; decision uuid;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.is_client OR a.role NOT IN ('admin','department_lead') OR NOT private.is_shared_test_org(a.organization_id) THEN RAISE EXCEPTION 'PROJECT_CONFIGURATION_DENIED'; END IF;
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>16384 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.organization_id::text,410));
 digest:=encode(sha256(convert_to('configure_project_lifecycle'||p_payload::text,'UTF8')),'hex');
 SELECT * INTO replay FROM private.shared_test_requests WHERE organization_id=a.organization_id AND actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN IF replay.request_hash<>digest THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF; RETURN replay.response; END IF;
 SELECT * INTO r FROM public.operational_records WHERE id=(p_payload->>'projectId')::uuid AND organization_id=a.organization_id AND record_type='Project' AND archived_at IS NULL AND private.shared_test_record_visible(id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_DENIED'; END IF;
 IF r.updated_at IS DISTINCT FROM (p_payload->>'expectedUpdatedAt')::timestamptz OR nullif(p_payload->>'expectedUpdatedAt','') IS NULL THEN RAISE EXCEPTION 'STALE_PROJECT'; END IF;
 reason:=trim(p_payload->>'reason');action:=p_payload->>'action';code:=p_payload->>'stageCode';
 IF reason IS NULL OR length(reason)<10 THEN RAISE EXCEPTION 'DECISION_REASON_REQUIRED'; END IF;
 IF action='migrate_baseline' THEN
  IF a.role<>'admin' THEN RAISE EXCEPTION 'BASELINE_MIGRATION_ADMIN_REQUIRED'; END IF;
  SELECT l.definition INTO definition FROM private.lifecycle_revisions l WHERE l.id=(p_payload->>'revisionId')::uuid AND l.organization_id=a.organization_id;
  IF definition IS NULL THEN RAISE EXCEPTION 'LIFECYCLE_REVISION_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(definition->'stages') s WHERE s->>'code'=coalesce(r.fields->>'currentStage',r.stage,'CM_01')) THEN RAISE EXCEPTION 'CURRENT_STAGE_MISSING_FROM_TARGET'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(r.fields->'completedStages','[]'::jsonb)) completed WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(definition->'stages') s WHERE s->>'code'=completed)) THEN RAISE EXCEPTION 'COMPLETED_HISTORY_MISSING_FROM_TARGET'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(coalesce(r.fields->'omittedStages','{}'::jsonb)) omitted WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(definition->'stages') s WHERE s->>'code'=omitted AND s->>'optional'='true')) THEN RAISE EXCEPTION 'EXISTING_OMISSION_NOT_OPTIONAL_IN_TARGET'; END IF;
  next_pin:=definition::text;
  IF next_pin IS NOT DISTINCT FROM r.fields->>'lifecycleBaseline' THEN RAISE EXCEPTION 'BASELINE_ALREADY_CURRENT'; END IF;
 ELSIF action='omit_optional' THEN
  IF nullif(r.fields->>'lifecycleBaseline','') IS NULL THEN RAISE EXCEPTION 'PINNED_BASELINE_REQUIRED'; END IF;
  definition:=(r.fields->>'lifecycleBaseline')::jsonb;
  SELECT value INTO stage FROM jsonb_array_elements(definition->'stages') WHERE value->>'code'=code;
  IF stage IS NULL OR stage->>'optional' IS DISTINCT FROM 'true' OR NOT public.is_stage_applicable_to_track(code,coalesce(r.fields->>'track',r.fields->>'projectTrack')) THEN RAISE EXCEPTION 'ONLY_APPLICABLE_OPTIONAL_STAGE_CAN_BE_OMITTED'; END IF;
  IF a.role<>'admin' AND a.department_code IS DISTINCT FROM stage->>'department' THEN RAISE EXCEPTION 'STAGE_OWNER_REQUIRED'; END IF;
  IF code=coalesce(r.fields->>'currentStage',r.stage) OR coalesce(r.fields->'completedStages','[]'::jsonb) ? code OR EXISTS(SELECT 1 FROM public.tasks WHERE record_id=r.id AND stage_code=code) OR EXISTS(SELECT 1 FROM public.canonical_stage_reviews WHERE project_id=r.id AND stage_code=code) THEN RAISE EXCEPTION 'STARTED_STAGE_CANNOT_BE_OMITTED'; END IF;
  IF coalesce(r.fields->'omittedStages','{}'::jsonb) ? code THEN RAISE EXCEPTION 'OMISSION_ALREADY_RECORDED'; END IF;
 ELSE RAISE EXCEPTION 'UNKNOWN_CONFIGURATION_ACTION'; END IF;
 INSERT INTO private.project_lifecycle_decisions(organization_id,project_id,action,previous_baseline,next_baseline,stage_code,reason,created_by)
 VALUES(a.organization_id,r.id,action,r.fields->>'lifecycleBaseline',next_pin,code,reason,auth.uid()) RETURNING id INTO decision;
 UPDATE public.operational_records SET fields=fields||CASE WHEN action='migrate_baseline' THEN jsonb_build_object('lifecycleBaseline',next_pin,'lifecycleMigrationDecision',decision)
  ELSE jsonb_build_object('omittedStages',coalesce(fields->'omittedStages','{}'::jsonb)||jsonb_build_object(code,jsonb_build_object('reason',reason,'decisionId',decision,'decidedBy',a.membership_id,'decidedAt',now()))) END,
  updated_at=now(),updated_by=auth.uid() WHERE id=r.id;
 INSERT INTO public.audit_events(organization_id,actor_id,entity_type,entity_id,action,detail) VALUES(a.organization_id,auth.uid(),'project',r.id,action,jsonb_build_object('decisionId',decision,'stage',code,'reason',reason));
 result:=jsonb_build_object('id',decision,'projectId',r.id,'action',action);
 INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response) VALUES(a.organization_id,auth.uid(),p_request_id,digest,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.configure_project_lifecycle(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.configure_project_lifecycle(jsonb,uuid) TO authenticated;

CREATE FUNCTION private.guard_direct_project_lifecycle_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND NEW.record_type='Project' AND (
  NEW.fields->'currentStage' IS DISTINCT FROM OLD.fields->'currentStage' OR NEW.fields->'completedStages' IS DISTINCT FROM OLD.fields->'completedStages'
  OR NEW.fields->'lifecycleBaseline' IS DISTINCT FROM OLD.fields->'lifecycleBaseline' OR NEW.fields->'omittedStages' IS DISTINCT FROM OLD.fields->'omittedStages') THEN RAISE EXCEPTION 'USE_REVIEWED_LIFECYCLE_RPC'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_direct_project_lifecycle_changes() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_direct_project_lifecycle_changes BEFORE UPDATE ON public.operational_records FOR EACH ROW EXECUTE FUNCTION private.guard_direct_project_lifecycle_changes();

-- Refine existing working approval machinery instead of replacing its receipts/RACI paths.
DO $patch$
DECLARE d text;
BEGIN
 d:=pg_get_functiondef('private.sync_pinned_lifecycle_work()'::regprocedure);
 IF strpos(d,'BASELINE_MIGRATION_REQUIRES_REVIEW')=0 THEN RAISE EXCEPTION 'PINNED_ENGINE_PATCH_PRECONDITION'; END IF;
 d:=replace(d,'IF NEW.fields->>''lifecycleBaseline'' IS DISTINCT FROM OLD.fields->>''lifecycleBaseline'' THEN RAISE EXCEPTION ''BASELINE_MIGRATION_REQUIRES_REVIEW''; END IF;',
 'IF NEW.fields->>''lifecycleBaseline'' IS DISTINCT FROM OLD.fields->>''lifecycleBaseline'' AND NOT EXISTS(SELECT 1 FROM private.project_lifecycle_decisions d WHERE d.project_id=NEW.id AND d.action=''migrate_baseline'' AND d.previous_baseline IS NOT DISTINCT FROM OLD.fields->>''lifecycleBaseline'' AND d.next_baseline=NEW.fields->>''lifecycleBaseline'' AND d.created_by=auth.uid() AND d.transaction_id=txid_current()) THEN RAISE EXCEPTION ''BASELINE_MIGRATION_REQUIRES_REVIEW''; END IF;');
 d:=replace(d,'FOR prerequisite IN SELECT jsonb_array_elements_text(prerequisites) LOOP','FOR prerequisite IN SELECT unnest(private.project_stage_prerequisites(NEW.id,target,track)) LOOP');
 d:=replace(d,'title,task_type,status,priority,stage_code,is_custom,order_index,template_task_key,created_by)','title,description,task_type,status,priority,stage_code,is_custom,order_index,template_task_key,created_by)');
 d:=replace(d,'task->>''title'',''Lifecycle''','task->>''title'',coalesce(task->>''description'',''''),''Lifecycle''');
 EXECUTE d;
 d:=pg_get_functiondef('private.activate_canonical_stage(jsonb)'::regprocedure);
 IF strpos(d,'req:=resolve_canonical_stage_prerequisites(requested_stage,track);')=0 THEN RAISE EXCEPTION 'ACTIVATION_PATCH_PRECONDITION'; END IF;
 d:=replace(d,'req:=resolve_canonical_stage_prerequisites(requested_stage,track);','req:=private.project_stage_prerequisites(r.id,requested_stage,track); IF coalesce(r.fields->''omittedStages'',''{}''::jsonb) ? requested_stage THEN RAISE EXCEPTION ''STAGE_MARKED_NOT_APPLICABLE''; END IF;');
 EXECUTE d;
 d:=pg_get_functiondef('private.request_canonical_stage_review(jsonb)'::regprocedure);
 IF strpos(d,'req:=resolve_canonical_stage_prerequisites(stage,track);')=0 THEN RAISE EXCEPTION 'REVIEW_PATCH_PRECONDITION'; END IF;
 d:=replace(d,'req:=resolve_canonical_stage_prerequisites(stage,track);','req:=private.project_stage_prerequisites(r.id,stage,track); IF coalesce(r.fields->''omittedStages'',''{}''::jsonb) ? stage THEN RAISE EXCEPTION ''STAGE_MARKED_NOT_APPLICABLE''; END IF;');
 EXECUTE d;
 d:=pg_get_functiondef('private.canonical_stage_department(uuid,text,text)'::regprocedure);
 IF strpos(d,'COALESCE(p_task_owner,default_owner)')=0 THEN RAISE EXCEPTION 'STAGE_OWNER_PATCH_PRECONDITION'; END IF;
 d:=replace(d,'COALESCE(p_task_owner,default_owner)','COALESCE(p_task_owner,(SELECT s->>''department'' FROM jsonb_array_elements(CASE WHEN nullif(r.fields->>''lifecycleBaseline'','''') IS NOT NULL THEN (r.fields->>''lifecycleBaseline'')::jsonb->''stages'' ELSE ''[]''::jsonb END) s WHERE s->>''code''=p_stage),default_owner)');
 EXECUTE d;
 d:=pg_get_functiondef('private.require_binary_stage_exit()'::regprocedure);
 d:=replace(d,'firmware binary|production binary','firmware (binary|release)|production binary');
 EXECUTE d;
END $patch$;

-- The previous completion snapshot required exactly two LC2 tasks. Pinned stages use their actual defaults.
ALTER FUNCTION private.canonical_stage_work_snapshot(uuid,text) RENAME TO canonical_stage_work_snapshot_before_pinned;
DO $$ BEGIN EXECUTE replace(pg_get_functiondef('private.canonical_stage_work_snapshot_before_pinned(uuid,text)'::regprocedure),'to_jsonb(t)','(to_jsonb(t)-''description'')'); END $$;
CREATE FUNCTION private.canonical_stage_work_snapshot(p_project uuid,p_stage text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.operational_records%ROWTYPE; revision jsonb; stage jsonb; task_data jsonb; expected jsonb; template text; legacy jsonb;
BEGIN
 SELECT * INTO r FROM public.operational_records WHERE id=p_project FOR UPDATE;
 IF nullif(r.fields->>'lifecycleBaseline','') IS NULL THEN RETURN private.canonical_stage_work_snapshot_before_pinned(p_project,p_stage); END IF;
 revision:=(r.fields->>'lifecycleBaseline')::jsonb;
 -- Existing work retains the template that actually spawned it after a reviewed project migration.
 SELECT l.definition INTO expected FROM private.lifecycle_revisions l WHERE l.organization_id=r.organization_id AND EXISTS(
  SELECT 1 FROM public.tasks t WHERE t.record_id=r.id AND t.stage_code=p_stage AND t.template_task_key LIKE 'LC-TG:'||(l.definition->>'id')||':'||p_stage||':%') ORDER BY l.version LIMIT 1;
 IF expected IS NOT NULL THEN revision:=expected; END IF;
 SELECT value INTO stage FROM jsonb_array_elements(revision->'stages') WHERE value->>'code'=p_stage;
 IF stage IS NULL THEN RAISE EXCEPTION 'PINNED_STAGE_MISSING'; END IF;
 IF EXISTS(SELECT 1 FROM public.tasks WHERE record_id=r.id AND stage_code=p_stage AND template_task_key LIKE 'LC2-2026-10-28:%') AND EXISTS(SELECT 1 FROM private.project_lifecycle_decisions WHERE project_id=r.id AND action='migrate_baseline') THEN
  legacy:=private.canonical_stage_work_snapshot_before_pinned(p_project,p_stage);
  RETURN legacy||jsonb_build_object('project_lifecycle_baseline',r.fields->>'lifecycleBaseline');
 END IF;
 IF coalesce(r.fields->'omittedStages','{}'::jsonb) ? p_stage THEN RAISE EXCEPTION 'STAGE_MARKED_NOT_APPLICABLE'; END IF;
 PERFORM id FROM public.tasks WHERE record_id=r.id AND stage_code=p_stage ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(stage->'tasks') d WHERE NOT EXISTS(SELECT 1 FROM public.tasks t WHERE t.record_id=r.id AND t.stage_code=p_stage AND t.template_task_key='LC-TG:'||(revision->>'id')||':'||p_stage||':'||(d->>'id'))) THEN RAISE EXCEPTION 'STAGE_TASKS_NOT_ACTIVATED'; END IF;
 IF jsonb_array_length(stage->'tasks')=0 AND coalesce(r.fields->>'currentStage',r.stage) IS DISTINCT FROM p_stage AND NOT coalesce(r.fields->'completedStages','[]'::jsonb) ? p_stage THEN RAISE EXCEPTION 'STAGE_TASKS_NOT_ACTIVATED'; END IF;
 IF EXISTS(SELECT 1 FROM public.tasks WHERE record_id=r.id AND stage_code=p_stage AND status<>'Complete') THEN RAISE EXCEPTION 'STAGE_WORK_INCOMPLETE'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]'::jsonb) INTO task_data FROM public.tasks t WHERE t.record_id=r.id AND t.stage_code=p_stage;
 RETURN jsonb_build_object('tasks',task_data,'template',stage,'project_revision',r.fields->>'revision','track',coalesce(r.fields->>'track',r.fields->>'projectTrack'),'activation_baseline',revision->>'id');
END $$;
REVOKE ALL ON FUNCTION private.canonical_stage_work_snapshot(uuid,text),private.canonical_stage_work_snapshot_before_pinned(uuid,text) FROM PUBLIC,anon,authenticated;

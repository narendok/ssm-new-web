-- Additive follow-up to 20261028120000. Generated using migration new, ordered after its dependency.
-- Completion is an evidence-bound approval, not a side effect of starting another stage.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS template_task_key text;
CREATE UNIQUE INDEX IF NOT EXISTS canonical_task_instance_key
ON public.tasks(organization_id, record_id, template_task_key) WHERE template_task_key IS NOT NULL;

ALTER TABLE public.canonical_stage_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS canonical_templates_authenticated_read ON public.canonical_stage_templates;
CREATE POLICY canonical_templates_authenticated_read ON public.canonical_stage_templates
FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.canonical_stage_templates FROM anon;

CREATE TABLE public.canonical_stage_reviews (
  record_id uuid PRIMARY KEY REFERENCES public.operational_records(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  project_id uuid NOT NULL REFERENCES public.operational_records(id),
  stage_code text NOT NULL REFERENCES public.canonical_stage_templates(stage_code),
  task_snapshot jsonb NOT NULL,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.canonical_stage_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.canonical_stage_reviews FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.canonical_stage_department(p_project uuid,p_stage text,p_task_owner text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r operational_records%ROWTYPE; owner_code text; owner_id uuid;
BEGIN
 SELECT * INTO r FROM operational_records WHERE id=p_project AND archived_at IS NULL AND record_type='Project';
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
 SELECT COALESCE(p_task_owner,default_owner) INTO owner_code FROM canonical_stage_templates WHERE stage_code=p_stage;
 IF owner_code IS NULL THEN RAISE EXCEPTION 'INVALID_STAGE_CODE'; END IF;
 IF lower(COALESCE(r.fields->>'scope',''))='internal'
    AND (p_stage LIKE 'CM_%' OR p_stage IN ('INT_03','RM_01','CL_02','CL_03')) THEN
   owner_id:=r.department_id;
 ELSIF p_stage='INT_01' AND COALESCE(r.fields->>'track',r.fields->>'projectTrack')='firmware_software_existing_hardware'
       AND owner_code='EHW' THEN
   SELECT id INTO owner_id FROM departments WHERE organization_id=r.organization_id AND code='FW' AND active;
 ELSE
   SELECT id INTO owner_id FROM departments WHERE organization_id=r.organization_id AND code=owner_code AND active;
 END IF;
 IF owner_id IS NULL OR NOT EXISTS(SELECT 1 FROM departments WHERE id=owner_id AND organization_id=r.organization_id AND active AND code<>'CLIENT') THEN
   RAISE EXCEPTION 'STAGE_OWNER_REQUIRED: Configure the responsible department before activation';
 END IF;
 RETURN owner_id;
END $$;

CREATE OR REPLACE FUNCTION private.ensure_canonical_stage_tasks(p_project uuid,p_stage text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r operational_records%ROWTYPE; s canonical_stage_templates%ROWTYPE; task_title text; task_owner text;
 n integer; key text; existing_id uuid; owner_id uuid;
BEGIN
 SELECT * INTO r FROM operational_records WHERE id=p_project FOR UPDATE;
 SELECT * INTO s FROM canonical_stage_templates WHERE stage_code=p_stage;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_STAGE_CODE'; END IF;
 FOR n IN 1..2 LOOP
   task_title:=CASE n WHEN 1 THEN s.t01_title ELSE s.t02_title END;
   task_owner:=CASE n WHEN 1 THEN s.t01_owner ELSE s.t02_owner END;
   key:='LC2-2026-10-28:'||p_stage||':T0'||n;
   owner_id:=private.canonical_stage_department(p_project,p_stage,task_owner);
   -- Adopt only an exact existing generated task; never overwrite another user's work or cancellation.
   SELECT id INTO existing_id FROM tasks WHERE organization_id=r.organization_id AND record_id=r.id
     AND stage_code=p_stage AND NOT is_custom AND template_task_key IS NULL AND title=task_title AND order_index=n
     ORDER BY created_at,id LIMIT 1 FOR UPDATE;
   IF existing_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tasks WHERE organization_id=r.organization_id AND record_id=r.id AND template_task_key=key) THEN
     UPDATE tasks SET template_task_key=key WHERE id=existing_id;
   END IF;
   INSERT INTO tasks(organization_id,department_id,record_id,title,priority,stage_code,is_custom,order_index,status,created_by,template_task_key)
   VALUES(r.organization_id,owner_id,r.id,task_title,'Normal',p_stage,false,n,'Open',auth.uid(),key)
   ON CONFLICT (organization_id,record_id,template_task_key) WHERE template_task_key IS NOT NULL DO NOTHING;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.canonical_stage_work_snapshot(p_project uuid,p_stage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r operational_records%ROWTYPE; s canonical_stage_templates%ROWTYPE; task_data jsonb; n integer;
BEGIN
 SELECT * INTO r FROM operational_records WHERE id=p_project FOR UPDATE;
 SELECT * INTO s FROM canonical_stage_templates WHERE stage_code=p_stage;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_STAGE_CODE'; END IF;
 PERFORM id FROM tasks WHERE organization_id=r.organization_id AND record_id=r.id AND stage_code=p_stage ORDER BY id FOR UPDATE;
 SELECT count(*) INTO n FROM tasks WHERE organization_id=r.organization_id AND record_id=r.id AND stage_code=p_stage
   AND template_task_key IN ('LC2-2026-10-28:'||p_stage||':T01','LC2-2026-10-28:'||p_stage||':T02');
 IF n<>2 THEN RAISE EXCEPTION 'STAGE_TASKS_NOT_ACTIVATED: Start this stage before requesting completion'; END IF;
 IF EXISTS(SELECT 1 FROM tasks WHERE organization_id=r.organization_id AND record_id=r.id AND stage_code=p_stage AND status<>'Complete') THEN
   RAISE EXCEPTION 'STAGE_WORK_INCOMPLETE: Finish the stage tasks; cancellation is not a release waiver';
 END IF;
 SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) INTO task_data FROM tasks t
 WHERE t.organization_id=r.organization_id AND t.record_id=r.id AND t.stage_code=p_stage;
 RETURN jsonb_build_object('tasks',task_data,'template',to_jsonb(s),'project_revision',r.fields->>'revision',
   'track',COALESCE(r.fields->>'track',r.fields->>'projectTrack'));
END $$;

CREATE OR REPLACE FUNCTION private.request_canonical_stage_review(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; r operational_records%ROWTYPE; stage text; owner_id uuid; review_id uuid; snap jsonb; req text[];
 track text; completed text[];
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 IF auth.uid() IS NULL OR a.role NOT IN ('admin','department_lead') THEN RAISE EXCEPTION 'STAGE_REVIEW_DENIED'; END IF;
 SELECT * INTO r FROM operational_records WHERE id=(p_payload->>'project_id')::uuid AND organization_id=a.organization_id
   AND record_type='Project' AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
 IF NULLIF(p_payload->>'expected_updated_at','') IS NULL THEN RAISE EXCEPTION 'EXPECTED_UPDATED_AT_REQUIRED'; END IF;
 IF r.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN RAISE EXCEPTION 'STALE_WRITE'; END IF;
 stage:=trim(COALESCE(p_payload->>'stage_code',r.stage,''));
 IF NOT is_valid_canonical_stage(stage) THEN RAISE EXCEPTION 'INVALID_STAGE_CODE'; END IF;
 track:=COALESCE(NULLIF(r.fields->>'track',''),NULLIF(r.fields->>'projectTrack',''));
 IF track IS NULL OR NOT is_stage_applicable_to_track(stage,track) THEN RAISE EXCEPTION 'STAGE_NOT_APPLICABLE_TO_TRACK'; END IF;
 IF r.fields->>'declined'='true' OR r.fields->>'status'='declined' THEN RAISE EXCEPTION 'STAGE_GATE_BLOCKED'; END IF;
 owner_id:=private.canonical_stage_department(r.id,stage);
 IF a.role<>'admin' AND private.shared_test_member_department(a.membership_id) IS DISTINCT FROM owner_id THEN RAISE EXCEPTION 'STAGE_REVIEW_DENIED'; END IF;
 completed:=ARRAY(SELECT jsonb_array_elements_text(COALESCE(r.fields->'completedStages','[]'::jsonb)));
 req:=resolve_canonical_stage_prerequisites(stage,track);
 IF NOT req<@completed THEN RAISE EXCEPTION 'PREREQUISITES_NOT_MET'; END IF;
 PERFORM private.ensure_canonical_stage_tasks(r.id,stage);
 snap:=private.canonical_stage_work_snapshot(r.id,stage);
 SELECT sr.record_id INTO review_id FROM canonical_stage_reviews sr JOIN approvals ap ON ap.record_id=sr.record_id
 WHERE sr.organization_id=a.organization_id AND sr.project_id=r.id AND sr.stage_code=stage AND sr.task_snapshot=snap
   AND ap.outcome IN ('pending','approved') ORDER BY sr.created_at DESC LIMIT 1;
 IF review_id IS NOT NULL THEN RETURN review_id; END IF;
 review_id:=gen_random_uuid();
 INSERT INTO operational_records(id,organization_id,department_id,area,record_type,reference,title,stage,status,fields,notes,is_demo,created_by,updated_by)
 VALUES(review_id,a.organization_id,owner_id,(SELECT lower(code) FROM departments WHERE id=owner_id),'Stage completion',
  'HLPL-GEN-'||(SELECT code FROM departments WHERE id=owner_id)||'-STG-'||upper(replace(review_id::text,'-',''))||'-01',
  r.reference||' · '||stage||' completion review',stage,'in_review',
  jsonb_build_object('revision','01','project_id',r.id,'stage_code',stage,'template_version','LC2-2026-10-28'),
  COALESCE(p_payload->>'notes',''),true,auth.uid(),auth.uid());
 INSERT INTO canonical_stage_reviews(record_id,organization_id,project_id,stage_code,task_snapshot,requested_by)
 VALUES(review_id,a.organization_id,r.id,stage,snap,auth.uid());
 INSERT INTO record_links(organization_id,source_record_id,target_record_id,relationship,created_by)
 VALUES(a.organization_id,r.id,review_id,'stage_completion',auth.uid());
 INSERT INTO approvals(organization_id,department_id,record_id,reviewer_department_id,title,outcome,evidence_revision,created_by)
 VALUES(a.organization_id,owner_id,review_id,owner_id,'Review '||r.reference||' · '||stage,'pending','01',auth.uid());
 RETURN review_id;
END $$;

CREATE OR REPLACE FUNCTION private.decide_canonical_stage_review(p_approval uuid,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; review canonical_stage_reviews%ROWTYPE; ap approvals%ROWTYPE; r operational_records%ROWTYPE; completed text[]; choice text;
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 SELECT * INTO review FROM canonical_stage_reviews WHERE record_id=(SELECT record_id FROM approvals WHERE id=p_approval AND organization_id=a.organization_id);
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO r FROM operational_records WHERE id=review.project_id AND organization_id=a.organization_id AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
 SELECT * INTO ap FROM approvals WHERE id=p_approval AND organization_id=a.organization_id FOR UPDATE;
 IF a.role<>'admin' AND NOT (a.role='department_lead' AND private.shared_test_member_department(a.membership_id)=ap.reviewer_department_id) THEN RAISE EXCEPTION 'SIGNING_AUTHORITY_DENIED'; END IF;
 IF auth.uid()=review.requested_by THEN RAISE EXCEPTION 'SELF_APPROVAL_DENIED: Another authorized lead or Admin must review'; END IF;
 IF NULLIF(p_payload->>'expected_updated_at','') IS NULL THEN RAISE EXCEPTION 'EXPECTED_UPDATED_AT_REQUIRED'; END IF;
 IF ap.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN RAISE EXCEPTION 'STALE_WRITE'; END IF;
 IF ap.outcome<>'pending' THEN RAISE EXCEPTION 'ALREADY_DECIDED'; END IF;
 choice:=p_payload->>'outcome';
 IF choice IS NULL OR choice NOT IN ('approved','rejected','returned') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
 IF choice<>'approved' AND length(trim(COALESCE(p_payload->>'notes','')))<5 THEN RAISE EXCEPTION 'DECISION_REASON_REQUIRED'; END IF;
 IF choice='approved' THEN
   IF review.task_snapshot IS DISTINCT FROM private.canonical_stage_work_snapshot(r.id,review.stage_code) THEN RAISE EXCEPTION 'STAGE_REVIEW_STALE: Work changed after submission'; END IF;
   IF r.fields->>'declined'='true' THEN RAISE EXCEPTION 'STAGE_GATE_BLOCKED'; END IF;
   completed:=ARRAY(SELECT DISTINCT x FROM jsonb_array_elements_text(COALESCE(r.fields->'completedStages','[]'::jsonb)||jsonb_build_array(review.stage_code)) x);
   UPDATE operational_records SET fields=jsonb_set(fields,'{completedStages}',to_jsonb(completed)),updated_at=now(),updated_by=auth.uid() WHERE id=r.id;
 END IF;
 UPDATE approvals SET outcome=choice::approval_outcome,decision_notes=COALESCE(p_payload->>'notes',''),decided_by=auth.uid(),decided_at=now(),updated_at=now() WHERE id=ap.id;
 UPDATE operational_records SET status=CASE WHEN choice='approved' THEN 'approved'::portal_record_status ELSE 'draft'::portal_record_status END,
   updated_at=now(),updated_by=auth.uid() WHERE id=review.record_id;
 RETURN review.record_id;
END $$;

CREATE OR REPLACE FUNCTION private.activate_canonical_stage(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; r operational_records%ROWTYPE; requested_stage text; owner_id uuid; completed text[]; req text[]; track text; sr record;
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 IF auth.uid() IS NULL OR a.role NOT IN ('admin','department_lead') THEN RAISE EXCEPTION 'STAGE_ADVANCE_DENIED'; END IF;
 SELECT * INTO r FROM operational_records WHERE id=(p_payload->>'project_id')::uuid AND organization_id=a.organization_id AND record_type='Project' AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
 IF NULLIF(p_payload->>'expected_updated_at','') IS NULL THEN RAISE EXCEPTION 'EXPECTED_UPDATED_AT_REQUIRED'; END IF;
 IF r.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN RAISE EXCEPTION 'STALE_WRITE'; END IF;
 requested_stage:=trim(COALESCE(p_payload->>'target_stage',''));
 IF NOT is_valid_canonical_stage(requested_stage) THEN RAISE EXCEPTION 'INVALID_STAGE_CODE'; END IF;

 IF r.fields->>'declined'='true' OR r.fields->>'status'='declined' THEN RAISE EXCEPTION 'STAGE_GATE_BLOCKED'; END IF;
 track:=COALESCE(NULLIF(r.fields->>'track',''),NULLIF(r.fields->>'projectTrack',''));
 IF track IS NULL OR NOT is_stage_applicable_to_track(requested_stage,track) THEN RAISE EXCEPTION 'STAGE_NOT_APPLICABLE_TO_TRACK'; END IF;
 owner_id:=private.canonical_stage_department(r.id,requested_stage);
 IF a.role<>'admin' AND private.shared_test_member_department(a.membership_id) IS DISTINCT FROM owner_id THEN RAISE EXCEPTION 'STAGE_ADVANCE_DENIED'; END IF;
 completed:=ARRAY(SELECT jsonb_array_elements_text(COALESCE(r.fields->'completedStages','[]'::jsonb)));
 req:=resolve_canonical_stage_prerequisites(requested_stage,track);
 IF NOT req<@completed THEN RAISE EXCEPTION 'PREREQUISITES_NOT_MET: Required stages must be completed and reviewed'; END IF;
 -- Recheck approval snapshots for prerequisites completed under this contract.
 FOR sr IN SELECT DISTINCT ON (cr.stage_code) cr.* FROM canonical_stage_reviews cr JOIN approvals ap ON ap.record_id=cr.record_id AND ap.outcome='approved'
   WHERE cr.organization_id=a.organization_id AND cr.project_id=r.id AND cr.stage_code=ANY(req) ORDER BY cr.stage_code,cr.created_at DESC LOOP
   IF sr.task_snapshot IS DISTINCT FROM private.canonical_stage_work_snapshot(r.id,sr.stage_code) THEN RAISE EXCEPTION 'STAGE_REVIEW_STALE'; END IF;
 END LOOP;
 PERFORM private.ensure_canonical_stage_tasks(r.id,requested_stage);
 UPDATE operational_records SET stage=requested_stage,fields=fields||jsonb_build_object('currentStage',requested_stage,'lastStageTransitionAt',now(),
   'lastStageTransitionBy',auth.uid(),'stageRemark',COALESCE(p_payload->>'notes','')),updated_at=now(),updated_by=auth.uid() WHERE id=r.id;
 RETURN r.id;
END $$;

-- Patch only the shared lifecycle entry points; keep the latest Sales/master/financial contracts intact.
DO $patch$
DECLARE definition text; start_pos integer; end_pos integer;
BEGIN
 definition:=pg_get_functiondef('public.mutate_shared_test_workspace(text,jsonb,uuid)'::regprocedure);
 definition:=replace(definition,' IF p_action=''create_project'' THEN',
  ' IF p_action=''request_stage_completion'' THEN entity:=private.request_canonical_stage_review(p_payload); ELSIF p_action=''create_project'' THEN');
 start_pos:=strpos(definition,' ELSIF p_action=''advance_stage'' THEN');
 end_pos:=strpos(definition,' ELSIF p_action IN (''update_record'',''request_approval'',''create_document'') THEN');
 IF start_pos=0 OR end_pos<=start_pos THEN RAISE EXCEPTION 'LIFECYCLE_PATCH_PRECONDITION_FAILED'; END IF;
 definition:=substr(definition,1,start_pos-1)||' ELSIF p_action=''advance_stage'' THEN entity:=private.activate_canonical_stage(p_payload);'||chr(10)||substr(definition,end_pos);
 -- Stage reviews use the ordinary approval queue, with stronger evidence and non-self checks.
 definition:=replace(definition,' ELSIF p_action=''decide_approval'' THEN',
  ' ELSIF p_action=''decide_approval'' AND EXISTS(SELECT 1 FROM public.canonical_stage_reviews cr JOIN public.approvals ap ON ap.record_id=cr.record_id WHERE ap.id=(p_payload->>''id'')::uuid AND cr.organization_id=org) THEN entity:=private.decide_canonical_stage_review((p_payload->>''id'')::uuid,p_payload); ELSIF p_action=''decide_approval'' THEN');
 -- A review cannot be forged or edited through generic forms.
 definition:=replace(definition,' rec_type:=trim(COALESCE(p_payload->>''record_type'',''''));',
  ' IF p_action=''create_record'' AND p_payload->>''record_type''=''Stage completion'' THEN RAISE EXCEPTION ''USE_STAGE_COMPLETION_REVIEW''; END IF; rec_type:=trim(COALESCE(p_payload->>''record_type'',''''));');
 definition:=replace(definition,'  IF p_action=''update_record'' THEN',
  '  IF EXISTS(SELECT 1 FROM canonical_stage_reviews WHERE record_id=r.id) THEN RAISE EXCEPTION ''STAGE_REVIEW_IMMUTABLE''; END IF; IF p_action=''update_record'' THEN');
 definition:=replace(definition,' INSERT INTO audit_events(organization_id,actor_id,entity_type,entity_id,action,detail)',
  ' IF p_action=''create_project'' THEN PERFORM private.ensure_canonical_stage_tasks(entity,''CM_01''); END IF; INSERT INTO audit_events(organization_id,actor_id,entity_type,entity_id,action,detail)');
 definition:=replace(definition,' ELSIF p_action=''update_task'' THEN',
  ' ELSIF p_action=''update_task'' THEN IF lower(COALESCE(p_payload->>''status'',''''))=''cancelled'' THEN RAISE EXCEPTION ''USE_CANCEL_TASK''; END IF; IF p_payload ? ''priority'' AND COALESCE(p_payload->>''priority'','''') NOT IN (''Critical'',''High'',''Normal'',''Low'') THEN RAISE EXCEPTION ''INVALID_TASK_PRIORITY''; END IF;');
 definition:=replace(definition,'  DELETE FROM tasks WHERE id=t.id;',
  '  IF t.cancelled_at IS NOT NULL OR lower(t.status)=''cancelled'' OR EXISTS(SELECT 1 FROM canonical_stage_reviews WHERE organization_id=org AND task_snapshot->''tasks'' @> jsonb_build_array(jsonb_build_object(''id'',t.id))) THEN RAISE EXCEPTION ''TASK_HAS_HISTORY: Retain cancelled or reviewed work''; END IF; DELETE FROM tasks WHERE id=t.id;');
 IF strpos(definition,'request_canonical_stage_review')=0 OR strpos(definition,'decide_canonical_stage_review')=0 THEN RAISE EXCEPTION 'LIFECYCLE_PATCH_PRECONDITION_FAILED'; END IF;
 EXECUTE definition;
END $patch$;

REVOKE ALL ON FUNCTION private.canonical_stage_department(uuid,text,text),private.ensure_canonical_stage_tasks(uuid,text),
 private.canonical_stage_work_snapshot(uuid,text),private.request_canonical_stage_review(jsonb),
 private.decide_canonical_stage_review(uuid,jsonb),private.activate_canonical_stage(jsonb) FROM PUBLIC,anon,authenticated;

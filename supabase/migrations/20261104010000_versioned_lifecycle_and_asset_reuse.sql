-- Additive, isolated TEST contract. Existing unpinned projects retain their legacy engine.
CREATE TABLE private.lifecycle_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 version bigint GENERATED ALWAYS AS IDENTITY UNIQUE, definition jsonb NOT NULL, created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.reusable_asset_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 source_project uuid NOT NULL REFERENCES public.operational_records(id), document_id uuid NOT NULL REFERENCES public.documents(id),
 file_id uuid NOT NULL REFERENCES public.controlled_document_files(id), definition jsonb NOT NULL,
 created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id, id)
);
CREATE TABLE private.project_asset_uses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 project_id uuid NOT NULL REFERENCES public.operational_records(id), asset_id uuid NOT NULL REFERENCES private.reusable_asset_revisions(id),
 assessment text NOT NULL CHECK(length(trim(assessment))>0), created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,asset_id)
);
ALTER TABLE private.lifecycle_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.reusable_asset_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.project_asset_uses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.lifecycle_revisions,private.reusable_asset_revisions,private.project_asset_uses FROM PUBLIC,anon,authenticated;
CREATE INDEX lifecycle_revisions_org_idx ON private.lifecycle_revisions(organization_id,version DESC);
CREATE INDEX reusable_assets_org_source_idx ON private.reusable_asset_revisions(organization_id,source_project);
CREATE INDEX project_asset_uses_asset_idx ON private.project_asset_uses(asset_id);
CREATE UNIQUE INDEX reusable_assets_family_revision_idx ON private.reusable_asset_revisions(organization_id,(definition->>'familyId'),(definition->>'revision'));

CREATE FUNCTION private.validate_lifecycle_definition(d jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s jsonb; t jsonb; dependency text;
BEGIN
 IF jsonb_typeof(d)<>'object' OR jsonb_typeof(d->'stages') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'stages') NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'INVALID_LIFECYCLE'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(d->'stages') x GROUP BY x->>'code' HAVING count(*)>1) THEN RAISE EXCEPTION 'DUPLICATE_STAGE'; END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(d->'stages') LOOP
  IF coalesce(s->>'code','')='' OR coalesce(s->>'name','')='' OR coalesce(s->>'gate','')='' OR coalesce(s->>'department','')='' OR coalesce(s->>'phase','') !~ '^TG_[0-9]$'
    OR jsonb_typeof(s->'prerequisites') IS DISTINCT FROM 'array' OR jsonb_typeof(s->'tasks') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'tasks')>50
    THEN RAISE EXCEPTION 'INVALID_STAGE'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.canonical_stage_templates WHERE stage_code=s->>'code') THEN RAISE EXCEPTION 'UNREGISTERED_STAGE'; END IF;
  FOR dependency IN SELECT jsonb_array_elements_text(s->'prerequisites') LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'stages') x WHERE x->>'code'=dependency) THEN RAISE EXCEPTION 'MISSING_PREREQUISITE'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(s->'tasks') x GROUP BY x->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'DUPLICATE_TASK_DEFAULT'; END IF;
  FOR t IN SELECT value FROM jsonb_array_elements(s->'tasks') LOOP
   IF coalesce(t->>'id','')='' OR coalesce(t->>'title','')='' OR coalesce(t->>'department','')='' THEN RAISE EXCEPTION 'INVALID_TASK_DEFAULT'; END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(WITH RECURSIVE edges AS (SELECT x->>'code' src,jsonb_array_elements_text(x->'prerequisites') dst FROM jsonb_array_elements(d->'stages') x), walk AS (
   SELECT src,dst,ARRAY[src,dst] path,src=dst cycle FROM edges
   UNION ALL SELECT w.src,e.dst,w.path||e.dst,e.dst=ANY(w.path) FROM walk w JOIN edges e ON e.src=w.dst WHERE NOT w.cycle
  ) SELECT 1 FROM walk WHERE cycle) THEN RAISE EXCEPTION 'CYCLIC_LIFECYCLE'; END IF;
END $$;
REVOKE ALL ON FUNCTION private.validate_lifecycle_definition(jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.get_lifecycle_workspace() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client OR NOT private.is_shared_test_org(a.organization_id) THEN RAISE EXCEPTION 'LIFECYCLE_READ_DENIED'; END IF;
 RETURN jsonb_build_object(
 'revision', (SELECT jsonb_build_object('id',id,'definition',definition) FROM private.lifecycle_revisions WHERE organization_id=a.organization_id ORDER BY version DESC LIMIT 1),
 'files',coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.id,'documentId',d.id,'title',d.title,'revision',f.revision,'checksum',f.checksum)) FROM public.controlled_document_files f JOIN public.documents d ON d.id=f.document_id WHERE f.organization_id=a.organization_id AND f.superseded_at IS NULL AND f.size_bytes>0 AND f.checksum IS NOT NULL AND private.shared_test_scope(a.organization_id,d.department_id)), '[]'::jsonb),
 'assets',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'sourceProject',r.source_project,'documentId',r.document_id,'fileId',r.file_id,'definition',r.definition,'createdAt',r.created_at)) FROM private.reusable_asset_revisions r WHERE r.organization_id=a.organization_id AND private.shared_test_record_visible(r.source_project) AND EXISTS(SELECT 1 FROM public.documents d WHERE d.id=r.document_id AND private.shared_test_scope(a.organization_id,d.department_id))), '[]'::jsonb),
 'uses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'projectId',u.project_id,'assetRevisionId',u.asset_id,'assessment',u.assessment,'createdAt',u.created_at)) FROM private.project_asset_uses u JOIN private.reusable_asset_revisions r ON r.id=u.asset_id WHERE u.organization_id=a.organization_id AND private.shared_test_record_visible(u.project_id) AND private.shared_test_record_visible(r.source_project)), '[]'::jsonb));
END $$;

CREATE FUNCTION public.mutate_lifecycle_workspace(p_action text,p_payload jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; replay record; digest text; result jsonb; latest uuid; entity uuid; project public.operational_records%ROWTYPE; doc public.documents%ROWTYPE; file public.controlled_document_files%ROWTYPE; asset private.reusable_asset_revisions%ROWTYPE; parent private.reusable_asset_revisions%ROWTYPE; definition jsonb;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client OR a.role='viewer' OR NOT private.is_shared_test_org(a.organization_id) THEN RAISE EXCEPTION 'LIFECYCLE_WRITE_DENIED'; END IF;
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>524288 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.organization_id::text,410));
 digest:=encode(sha256(convert_to(p_action||p_payload::text,'UTF8')),'hex');
 SELECT * INTO replay FROM private.shared_test_requests WHERE organization_id=a.organization_id AND actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN IF replay.request_hash<>digest THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF; RETURN replay.response; END IF;
 IF p_action='save_revision' THEN
  IF a.role<>'admin' THEN RAISE EXCEPTION 'LIFECYCLE_SETTINGS_ADMIN_REQUIRED'; END IF;
  SELECT id INTO latest FROM private.lifecycle_revisions WHERE organization_id=a.organization_id ORDER BY version DESC LIMIT 1;
  IF latest IS DISTINCT FROM nullif(p_payload->>'expectedRevision','')::uuid THEN RAISE EXCEPTION 'STALE_LIFECYCLE_SETTINGS'; END IF;
  definition:=p_payload->'definition'; PERFORM private.validate_lifecycle_definition(definition);
  INSERT INTO private.lifecycle_revisions(organization_id,definition,created_by) VALUES(a.organization_id,definition,auth.uid()) RETURNING id INTO entity;
 ELSIF p_action='publish_asset' THEN
  SELECT * INTO project FROM public.operational_records WHERE id=(p_payload->>'sourceProject')::uuid AND organization_id=a.organization_id AND record_type='Project' AND archived_at IS NULL;
  IF NOT FOUND OR NOT private.shared_test_record_visible(project.id) THEN RAISE EXCEPTION 'SOURCE_PROJECT_DENIED'; END IF;
  SELECT * INTO doc FROM public.documents WHERE id=(p_payload->>'documentId')::uuid AND organization_id=a.organization_id;
  IF NOT FOUND OR NOT private.shared_test_scope(a.organization_id,doc.department_id) THEN RAISE EXCEPTION 'SOURCE_DOCUMENT_DENIED'; END IF;
  IF doc.record_id IS DISTINCT FROM project.id AND NOT EXISTS(SELECT 1 FROM public.operational_records r WHERE r.id=doc.record_id AND r.organization_id=a.organization_id AND r.fields->>'projectId' IN (project.id::text,project.reference)) THEN RAISE EXCEPTION 'DOCUMENT_SOURCE_PROJECT_MISMATCH'; END IF;
  SELECT * INTO file FROM public.controlled_document_files WHERE id=(p_payload->>'fileId')::uuid AND document_id=doc.id AND organization_id=a.organization_id AND superseded_at IS NULL AND checksum IS NOT NULL AND size_bytes>0;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERIFIED_ORIGINAL_REVISION_REQUIRED'; END IF;
  definition:=p_payload->'definition';
  IF nullif(trim(definition->>'title'),'') IS NULL OR nullif(trim(definition->>'compatibility'),'') IS NULL OR nullif(trim(definition->>'originStage'),'') IS NULL OR definition->>'kind' NOT IN ('PCB','Harness','Enclosure / CAD','Firmware / Library','Document') THEN RAISE EXCEPTION 'ASSET_DETAILS_REQUIRED'; END IF;
  IF nullif(definition->>'inventoryItemId','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.operational_records WHERE id=(definition->>'inventoryItemId')::uuid AND organization_id=a.organization_id AND record_type='Part' AND private.shared_test_record_visible(id)) THEN RAISE EXCEPTION 'INVENTORY_ITEM_DENIED'; END IF;
  IF nullif(definition->>'parentRevisionId','') IS NOT NULL THEN
   SELECT * INTO parent FROM private.reusable_asset_revisions WHERE id=(definition->>'parentRevisionId')::uuid AND organization_id=a.organization_id;
   IF NOT FOUND OR NOT private.shared_test_record_visible(parent.source_project) THEN RAISE EXCEPTION 'PARENT_REVISION_DENIED'; END IF;
   definition:=definition||jsonb_build_object('familyId',parent.definition->>'familyId','revision',(parent.definition->>'revision')::int+1);
  ELSE definition:=definition||jsonb_build_object('familyId',gen_random_uuid(),'revision',1); END IF;
  definition:=definition||jsonb_build_object('status','Draft','documentRevision',file.revision,'checksum',file.checksum,'createdBy',a.membership_id);
  INSERT INTO private.reusable_asset_revisions(organization_id,source_project,document_id,file_id,definition,created_by) VALUES(a.organization_id,project.id,doc.id,file.id,definition,auth.uid()) RETURNING id INTO entity;
 ELSIF p_action='link_asset' THEN
  SELECT * INTO project FROM public.operational_records WHERE id=(p_payload->>'projectId')::uuid AND organization_id=a.organization_id AND record_type='Project' AND archived_at IS NULL;
  IF NOT FOUND OR NOT private.shared_test_record_visible(project.id) THEN RAISE EXCEPTION 'CONSUMER_PROJECT_DENIED'; END IF;
  SELECT * INTO asset FROM private.reusable_asset_revisions WHERE id=(p_payload->>'assetRevisionId')::uuid AND organization_id=a.organization_id;
  IF NOT FOUND OR NOT private.shared_test_record_visible(asset.source_project) OR nullif(trim(p_payload->>'assessment'),'') IS NULL OR NOT EXISTS(SELECT 1 FROM public.documents d WHERE d.id=asset.document_id AND private.shared_test_scope(a.organization_id,d.department_id)) THEN RAISE EXCEPTION 'ASSET_USE_DENIED'; END IF;
  INSERT INTO private.project_asset_uses(organization_id,project_id,asset_id,assessment,created_by) VALUES(a.organization_id,project.id,asset.id,p_payload->>'assessment',auth.uid()) ON CONFLICT(project_id,asset_id) DO NOTHING RETURNING id INTO entity;
  IF entity IS NULL THEN SELECT id INTO entity FROM private.project_asset_uses WHERE project_id=project.id AND asset_id=asset.id; END IF;
 ELSE RAISE EXCEPTION 'UNKNOWN_LIFECYCLE_ACTION'; END IF;
 result:=jsonb_build_object('id',entity,'action',p_action);
 INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response) VALUES(a.organization_id,auth.uid(),p_request_id,digest,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_lifecycle_workspace(),public.mutate_lifecycle_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_lifecycle_workspace(),public.mutate_lifecycle_workspace(text,jsonb,uuid) TO authenticated;

CREATE FUNCTION private.pin_new_project_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE revision jsonb; phase text; summary text; current_code text;
BEGIN
 IF NEW.record_type='Project' AND private.is_shared_test_org(NEW.organization_id) THEN
  IF TG_OP='INSERT' THEN
   SELECT definition INTO revision FROM private.lifecycle_revisions WHERE organization_id=NEW.organization_id ORDER BY version DESC LIMIT 1;
   IF revision IS NOT NULL THEN NEW.fields:=NEW.fields||jsonb_build_object('lifecycleBaseline',revision::text); END IF;
  ELSIF nullif(NEW.fields->>'lifecycleBaseline','') IS NOT NULL THEN revision:=(NEW.fields->>'lifecycleBaseline')::jsonb;
  END IF;
  IF revision IS NOT NULL THEN
   current_code:=coalesce(NEW.fields->>'currentStage',NEW.stage,'CM_01');
   SELECT value->>'phase' INTO phase FROM jsonb_array_elements(revision->'stages') WHERE value->>'code'=current_code;
   summary:=CASE WHEN phase IN ('TG_0','TG_1') THEN 'FEASIBILITY_AND_SCOPING' WHEN phase IN ('TG_2','TG_3','TG_4') THEN 'UNDER_DEVELOPMENT' ELSE 'PILOT_AND_VALIDATION' END;
   IF phase IN ('TG_7','TG_8','TG_9') AND coalesce(NEW.fields->'completedStages','[]'::jsonb) ? 'CL_01' THEN summary:='RELEASED_PRODUCTION'; END IF;
   IF NEW.fields->>'portfolioStatus' IN ('ON_HOLD','UNDER_AMENDMENT','ARCHIVED_CLOSED') THEN summary:=NEW.fields->>'portfolioStatus'; END IF;
   NEW.fields:=NEW.fields||jsonb_build_object('companyPhase',phase,'portfolioStatus',summary);
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.pin_new_project_lifecycle() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER pin_new_project_lifecycle BEFORE INSERT OR UPDATE ON public.operational_records FOR EACH ROW EXECUTE FUNCTION private.pin_new_project_lifecycle();

-- Existing guarded project transitions remain the sole gate decision path.
-- This trigger adds pinned prerequisite/exit checks and settings-based task generation.
CREATE FUNCTION private.sync_pinned_lifecycle_work() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prerequisites jsonb; baseline jsonb; stage jsonb; task jsonb; prerequisite text; target text; track text; dept uuid; previous text; required_type text; idx int:=0; completed jsonb;
BEGIN
 IF NEW.record_type<>'Project' OR NOT private.is_shared_test_org(NEW.organization_id) OR nullif(NEW.fields->>'lifecycleBaseline','') IS NULL THEN RETURN NEW; END IF;
 baseline:=(NEW.fields->>'lifecycleBaseline')::jsonb;
 IF NOT EXISTS(SELECT 1 FROM private.lifecycle_revisions WHERE organization_id=NEW.organization_id AND definition=baseline) THEN RAISE EXCEPTION 'UNREGISTERED_PROJECT_BASELINE'; END IF;
 target:=coalesce(NEW.fields->>'currentStage',NEW.stage,'CM_01');
 IF TG_OP='UPDATE' THEN
  IF NEW.fields->>'lifecycleBaseline' IS DISTINCT FROM OLD.fields->>'lifecycleBaseline' THEN RAISE EXCEPTION 'BASELINE_MIGRATION_REQUIRES_REVIEW'; END IF;
  previous:=coalesce(OLD.fields->>'currentStage',OLD.stage,'CM_01');
  IF previous=target THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.tasks WHERE record_id=NEW.id AND stage_code=previous AND lower(status) NOT IN ('complete','completed','done','approved','cancelled')) THEN RAISE EXCEPTION 'CURRENT_STAGE_WORK_INCOMPLETE'; END IF;
  FOR required_type IN SELECT jsonb_array_elements_text(s->'exitTypes') FROM jsonb_array_elements(baseline->'stages') s WHERE s->>'code'=previous LOOP
   IF NOT EXISTS(SELECT 1 FROM public.operational_records r WHERE r.organization_id=NEW.organization_id AND r.record_type=required_type AND lower(r.status::text) IN ('approved','released') AND r.archived_at IS NULL AND (r.fields->>'projectId' IN (NEW.id::text,NEW.reference)) AND coalesce(r.fields->>'lifecycleStage',r.stage)=previous) THEN RAISE EXCEPTION 'REQUIRED_EXIT_EVIDENCE_MISSING: %',required_type; END IF;
  END LOOP;
 END IF;
 SELECT value INTO stage FROM jsonb_array_elements(baseline->'stages') WHERE value->>'code'=target;
 IF stage IS NULL THEN RAISE EXCEPTION 'PINNED_STAGE_MISSING'; END IF;
 track:=coalesce(NEW.fields->>'track',NEW.fields->>'projectTrack');
 IF NOT public.is_stage_applicable_to_track(target,track) THEN RAISE EXCEPTION 'PINNED_STAGE_NOT_APPLICABLE'; END IF;
 completed:=coalesce(NEW.fields->'completedStages','[]'::jsonb);
 SELECT CASE WHEN to_jsonb(c.prerequisites)=stage->'prerequisites' THEN to_jsonb(public.resolve_canonical_stage_prerequisites(target,track)) ELSE stage->'prerequisites' END INTO prerequisites FROM public.canonical_stage_templates c WHERE c.stage_code=target;
 FOR prerequisite IN SELECT jsonb_array_elements_text(prerequisites) LOOP
  IF public.is_stage_applicable_to_track(prerequisite,track) AND NOT (completed ? prerequisite) THEN RAISE EXCEPTION 'PINNED_PREREQUISITE_INCOMPLETE: %',prerequisite; END IF;
 END LOOP;
 FOR task IN SELECT value FROM jsonb_array_elements(stage->'tasks') LOOP
  idx:=idx+1;
  SELECT id INTO dept FROM public.departments WHERE organization_id=NEW.organization_id AND code=task->>'department' AND active;
  IF dept IS NULL THEN RAISE EXCEPTION 'TASK_OWNER_DEPARTMENT_MISSING'; END IF;
  INSERT INTO public.tasks(organization_id,department_id,record_id,title,task_type,status,priority,stage_code,is_custom,order_index,template_task_key,created_by)
  SELECT NEW.organization_id,dept,NEW.id,task->>'title','Lifecycle','Open','Normal',target,false,idx,'LC-TG:'||(baseline->>'id')||':'||target||':'||(task->>'id'),NEW.created_by
  WHERE NOT EXISTS(SELECT 1 FROM public.tasks WHERE record_id=NEW.id AND template_task_key='LC-TG:'||(baseline->>'id')||':'||target||':'||(task->>'id'));
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.sync_pinned_lifecycle_work() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_pinned_lifecycle_work AFTER INSERT OR UPDATE ON public.operational_records FOR EACH ROW EXECUTE FUNCTION private.sync_pinned_lifecycle_work();

CREATE UNIQUE INDEX pinned_task_identity_idx ON public.tasks(record_id,template_task_key) WHERE template_task_key LIKE 'LC-TG:%';
CREATE FUNCTION private.guard_pinned_task_defaults() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.is_custom=false AND coalesce(NEW.template_task_key,'') NOT LIKE 'LC-TG:%' AND EXISTS(SELECT 1 FROM public.operational_records WHERE id=NEW.record_id AND record_type='Project' AND nullif(fields->>'lifecycleBaseline','') IS NOT NULL) THEN RETURN NULL; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_pinned_task_defaults() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_pinned_task_defaults BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION private.guard_pinned_task_defaults();

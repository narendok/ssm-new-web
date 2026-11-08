-- One record dialog may link an existing exact asset revision instead of uploading it again.
CREATE FUNCTION private.infer_deliverable_record_stage() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE code text;
BEGIN
 IF NEW.record_type<>'Project' THEN
  code:=CASE NEW.record_type WHEN 'PRS' THEN 'HW_02' WHEN 'Schematic' THEN 'HW_15' WHEN 'BOM' THEN 'HW_19' WHEN 'Gerber release' THEN 'HW_24' WHEN 'STEP clearance' THEN 'HW_17' WHEN 'Firmware release' THEN 'FW_12' END;
  IF code IS NOT NULL THEN NEW.fields:=NEW.fields||jsonb_build_object('recordStage',code); END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.infer_deliverable_record_stage() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER infer_deliverable_record_stage BEFORE INSERT OR UPDATE ON public.operational_records FOR EACH ROW EXECUTE FUNCTION private.infer_deliverable_record_stage();

DO $$ BEGIN EXECUTE replace(pg_get_functiondef('private.sync_pinned_lifecycle_work()'::regprocedure),'coalesce(r.fields->>''lifecycleStage'',r.stage)','coalesce(r.fields->>''recordStage'',r.fields->>''hwStage'',r.fields->>''lifecycleStage'',r.stage)'); END $$;
CREATE FUNCTION public.attach_reusable_revision_to_record(p_payload jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; r public.operational_records%ROWTYPE; project public.operational_records%ROWTYPE; asset private.reusable_asset_revisions%ROWTYPE; replay record; digest text; result jsonb; linked jsonb;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.is_client OR a.role NOT IN ('admin','department_lead') OR NOT private.is_shared_test_org(a.organization_id) THEN RAISE EXCEPTION 'RECORD_REUSE_DENIED'; END IF;
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>8192 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.organization_id::text,410));
 digest:=encode(sha256(convert_to('record_reuse'||p_payload::text,'UTF8')),'hex');
 SELECT * INTO replay FROM private.shared_test_requests WHERE organization_id=a.organization_id AND actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN IF replay.request_hash<>digest THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF; RETURN replay.response; END IF;
 SELECT * INTO r FROM public.operational_records WHERE id=(p_payload->>'recordId')::uuid AND organization_id=a.organization_id AND record_type NOT IN ('Project','Stage completion') AND archived_at IS NULL AND private.shared_test_record_visible(id) FOR UPDATE;
 IF NOT FOUND OR lower(r.status::text)<>'draft' OR (a.role<>'admin' AND NOT private.shared_test_scope(a.organization_id,r.department_id)) THEN RAISE EXCEPTION 'DRAFT_RECORD_REQUIRED'; END IF;
 SELECT * INTO project FROM public.operational_records WHERE id=(p_payload->>'projectId')::uuid AND organization_id=a.organization_id AND record_type='Project' AND archived_at IS NULL AND private.shared_test_record_visible(id);
 IF NOT FOUND OR (coalesce(r.fields->>'projectId','') NOT IN (project.id::text,project.reference) AND NOT EXISTS(SELECT 1 FROM public.record_links WHERE organization_id=a.organization_id AND source_record_id=project.id AND target_record_id=r.id)) THEN RAISE EXCEPTION 'RECORD_PROJECT_MISMATCH'; END IF;
 SELECT * INTO asset FROM private.reusable_asset_revisions WHERE id=(p_payload->>'assetRevisionId')::uuid AND organization_id=a.organization_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ASSET_REVISION_REQUIRED'; END IF;
 IF nullif(r.fields->>'reusableAssetRevisionId','') IS NOT NULL AND r.fields->>'reusableAssetRevisionId'<>asset.id::text THEN RAISE EXCEPTION 'RECORD_REVISION_LINK_ALREADY_PINNED'; END IF;
 IF EXISTS(SELECT 1 FROM public.documents d JOIN public.controlled_document_files f ON f.document_id=d.id JOIN storage.objects o ON o.bucket_id='controlled-documents' AND o.name=f.storage_path WHERE d.record_id=r.id) THEN RAISE EXCEPTION 'RECORD_ALREADY_HAS_UPLOADED_ORIGINAL'; END IF;
 linked:=public.mutate_lifecycle_workspace('link_asset',jsonb_build_object('projectId',project.id,'assetRevisionId',asset.id,'assessment',p_payload->>'assessment'),md5(p_request_id::text||':use')::uuid);
 UPDATE public.operational_records SET fields=fields||jsonb_build_object('projectId',project.id,'reusableAssetRevisionId',asset.id,'reusedOriginalFileId',asset.file_id,'reusedOriginalDocumentId',asset.document_id,'reusedSourceProjectId',asset.source_project,'reusedOriginalRevision',asset.definition->>'documentRevision','reuseAssessment',p_payload->>'assessment'),updated_at=now(),updated_by=auth.uid() WHERE id=r.id;
 INSERT INTO public.audit_events(organization_id,actor_id,entity_type,entity_id,action,detail) VALUES(a.organization_id,auth.uid(),'record',r.id,'reusable_original_linked',jsonb_build_object('assetRevisionId',asset.id,'fileId',asset.file_id,'projectUseId',linked->>'id'));
 result:=jsonb_build_object('id',r.id,'assetRevisionId',asset.id,'fileId',asset.file_id);
 INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response) VALUES(a.organization_id,auth.uid(),p_request_id,digest,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.attach_reusable_revision_to_record(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.attach_reusable_revision_to_record(jsonb,uuid) TO authenticated;

CREATE FUNCTION private.guard_record_reuse_pointer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.fields->'reusableAssetRevisionId' IS DISTINCT FROM OLD.fields->'reusableAssetRevisionId' OR NEW.fields->'reusedOriginalFileId' IS DISTINCT FROM OLD.fields->'reusedOriginalFileId' OR NEW.fields->'reusedOriginalDocumentId' IS DISTINCT FROM OLD.fields->'reusedOriginalDocumentId' OR NEW.fields->'reusedSourceProjectId' IS DISTINCT FROM OLD.fields->'reusedSourceProjectId' THEN
  IF lower(OLD.status::text)<>'draft' OR NOT EXISTS(SELECT 1 FROM private.reusable_asset_revisions a JOIN private.project_asset_uses u ON u.asset_id=a.id JOIN public.operational_records p ON p.id=u.project_id
    WHERE a.id::text=NEW.fields->>'reusableAssetRevisionId' AND a.file_id::text=NEW.fields->>'reusedOriginalFileId' AND a.document_id::text=NEW.fields->>'reusedOriginalDocumentId' AND a.source_project::text=NEW.fields->>'reusedSourceProjectId'
      AND a.organization_id=NEW.organization_id AND NEW.fields->>'projectId' IN (p.id::text,p.reference)) THEN RAISE EXCEPTION 'USE_VERIFIED_REUSABLE_ORIGINAL'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_record_reuse_pointer() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_record_reuse_pointer BEFORE UPDATE ON public.operational_records FOR EACH ROW EXECUTE FUNCTION private.guard_record_reuse_pointer();

CREATE FUNCTION private.has_record_original_object(p_record uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.documents d JOIN public.controlled_document_files f ON f.document_id=d.id JOIN storage.objects o ON o.bucket_id='controlled-documents' AND o.name=f.storage_path WHERE d.record_id=p_record AND f.superseded_at IS NULL AND f.size_bytes>0 AND length(f.checksum)=64)
 OR EXISTS(SELECT 1 FROM public.operational_records r JOIN private.reusable_asset_revisions a ON a.id::text=r.fields->>'reusableAssetRevisionId' AND a.organization_id=r.organization_id
  JOIN private.project_asset_uses u ON u.asset_id=a.id JOIN public.operational_records p ON p.id=u.project_id
  JOIN public.controlled_document_files f ON f.id=a.file_id JOIN storage.objects o ON o.bucket_id='controlled-documents' AND o.name=f.storage_path
  WHERE r.id=p_record AND r.fields->>'projectId' IN (p.id::text,p.reference) AND r.fields->>'reusedOriginalFileId'=f.id::text AND f.size_bytes>0 AND length(f.checksum)=64)
$$;
REVOKE ALL ON FUNCTION private.has_record_original_object(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.require_binary_stage_exit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous text; baseline jsonb; kind text;
BEGIN
 IF NEW.record_type<>'Project' OR NOT private.is_shared_test_org(NEW.organization_id) OR nullif(OLD.fields->>'lifecycleBaseline','') IS NULL THEN RETURN NEW; END IF;
 previous:=coalesce(OLD.fields->>'currentStage',OLD.stage,'CM_01');
 IF previous=coalesce(NEW.fields->>'currentStage',NEW.stage,'CM_01') THEN RETURN NEW; END IF;
 baseline:=(OLD.fields->>'lifecycleBaseline')::jsonb;
 FOR kind IN SELECT jsonb_array_elements_text(s->'exitTypes') FROM jsonb_array_elements(baseline->'stages') s WHERE s->>'code'=previous LOOP
  IF kind ~* '(schematic|gerber|step|cad|firmware (binary|release)|production binary|hex|pcb layout|3d model)' AND NOT EXISTS(
   SELECT 1 FROM public.operational_records r WHERE r.organization_id=NEW.organization_id AND r.record_type=kind AND lower(r.status::text) IN ('approved','released') AND r.archived_at IS NULL
    AND r.fields->>'projectId' IN (NEW.id::text,NEW.reference) AND coalesce(r.fields->>'recordStage',r.fields->>'hwStage',r.fields->>'lifecycleStage',r.stage)=previous AND private.has_record_original_object(r.id)
  ) THEN RAISE EXCEPTION 'REQUIRED_BINARY_ORIGINAL_MISSING: %',kind; END IF;
 END LOOP;
 RETURN NEW;
END $$;

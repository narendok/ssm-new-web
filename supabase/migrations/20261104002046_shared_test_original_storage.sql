-- Dedicated TEST rollout: private registered originals only, never public file access.
INSERT INTO storage.buckets(id,name,public,file_size_limit)
VALUES('controlled-documents','controlled-documents',false,26214400)
ON CONFLICT(id) DO NOTHING;

CREATE POLICY "TEST permitted registered original reads" ON storage.objects
FOR SELECT TO authenticated USING (
 bucket_id='controlled-documents' AND private.can_access_controlled_document_object(name)
 AND EXISTS(SELECT 1 FROM public.controlled_document_files f WHERE f.storage_path=name AND private.is_shared_test_org(f.organization_id))
);
CREATE POLICY "TEST permitted registered original uploads" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
 bucket_id='controlled-documents' AND private.can_access_controlled_document_object(name)
 AND EXISTS(SELECT 1 FROM public.controlled_document_files f WHERE f.storage_path=name AND f.uploaded_by=auth.uid() AND f.superseded_at IS NULL AND private.is_shared_test_org(f.organization_id))
);
-- Originals are immutable: no authenticated UPDATE/DELETE policies are added.

CREATE FUNCTION private.require_reusable_original_object() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.controlled_document_files f JOIN storage.objects o ON o.name=f.storage_path AND o.bucket_id='controlled-documents'
   WHERE f.id=NEW.file_id AND f.document_id=NEW.document_id AND f.organization_id=NEW.organization_id AND f.size_bytes>0 AND length(f.checksum)=64) THEN
  RAISE EXCEPTION 'ORIGINAL_UPLOAD_INCOMPLETE';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.require_reusable_original_object() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER require_reusable_original_object BEFORE INSERT ON private.reusable_asset_revisions
FOR EACH ROW EXECUTE FUNCTION private.require_reusable_original_object();

CREATE FUNCTION private.require_binary_stage_exit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous text; baseline jsonb; kind text;
BEGIN
 IF NEW.record_type<>'Project' OR NOT private.is_shared_test_org(NEW.organization_id) OR nullif(OLD.fields->>'lifecycleBaseline','') IS NULL THEN RETURN NEW; END IF;
 previous:=coalesce(OLD.fields->>'currentStage',OLD.stage,'CM_01');
 IF previous=coalesce(NEW.fields->>'currentStage',NEW.stage,'CM_01') THEN RETURN NEW; END IF;
 baseline:=(OLD.fields->>'lifecycleBaseline')::jsonb;
 FOR kind IN SELECT jsonb_array_elements_text(s->'exitTypes') FROM jsonb_array_elements(baseline->'stages') s WHERE s->>'code'=previous LOOP
  IF kind ~* '(schematic|gerber|step|cad|firmware binary|production binary|hex|pcb layout|3d model)' AND NOT EXISTS(
   SELECT 1 FROM public.operational_records r JOIN public.documents d ON d.record_id=r.id
   JOIN public.controlled_document_files f ON f.document_id=d.id AND f.organization_id=r.organization_id
   JOIN storage.objects o ON o.bucket_id='controlled-documents' AND o.name=f.storage_path
   WHERE r.organization_id=NEW.organization_id AND r.record_type=kind AND lower(r.status::text) IN ('approved','released')
     AND r.archived_at IS NULL AND r.fields->>'projectId' IN (NEW.id::text,NEW.reference)
     AND coalesce(r.fields->>'lifecycleStage',r.stage)=previous AND f.superseded_at IS NULL AND f.size_bytes>0 AND length(f.checksum)=64
  ) THEN RAISE EXCEPTION 'REQUIRED_BINARY_ORIGINAL_MISSING: %',kind; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.require_binary_stage_exit() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER require_binary_stage_exit BEFORE UPDATE ON public.operational_records
FOR EACH ROW EXECUTE FUNCTION private.require_binary_stage_exit();
CREATE OR REPLACE FUNCTION public.get_lifecycle_workspace() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client OR NOT private.is_shared_test_org(a.organization_id) THEN RAISE EXCEPTION 'LIFECYCLE_READ_DENIED'; END IF;
 RETURN jsonb_build_object(
 'revision', (SELECT jsonb_build_object('id',id,'definition',definition) FROM private.lifecycle_revisions WHERE organization_id=a.organization_id ORDER BY version DESC LIMIT 1),
 'files',coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.id,'documentId',d.id,'title',d.title,'revision',f.revision,'checksum',f.checksum)) FROM public.controlled_document_files f JOIN public.documents d ON d.id=f.document_id WHERE f.organization_id=a.organization_id AND f.superseded_at IS NULL AND f.size_bytes>0 AND f.checksum IS NOT NULL AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='controlled-documents' AND o.name=f.storage_path) AND private.shared_test_scope(a.organization_id,d.department_id)), '[]'::jsonb),
 'assets',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'sourceProject',r.source_project,'documentId',r.document_id,'fileId',r.file_id,'definition',r.definition,'createdAt',r.created_at)) FROM private.reusable_asset_revisions r WHERE r.organization_id=a.organization_id AND private.shared_test_record_visible(r.source_project) AND EXISTS(SELECT 1 FROM public.documents d WHERE d.id=r.document_id AND private.shared_test_scope(a.organization_id,d.department_id))), '[]'::jsonb),
 'uses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'projectId',u.project_id,'assetRevisionId',u.asset_id,'assessment',u.assessment,'createdAt',u.created_at)) FROM private.project_asset_uses u JOIN private.reusable_asset_revisions r ON r.id=u.asset_id WHERE u.organization_id=a.organization_id AND private.shared_test_record_visible(u.project_id) AND private.shared_test_record_visible(r.source_project) AND EXISTS(SELECT 1 FROM public.documents d WHERE d.id=r.document_id AND private.shared_test_scope(a.organization_id,d.department_id))), '[]'::jsonb));
END $$;

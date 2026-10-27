-- Shared Vault metadata is additive; no existing document/file is moved or relabelled.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.register_controlled_document(p_payload jsonb,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; org uuid; department uuid; project uuid; source uuid; context_record public.operational_records%ROWTYPE;
 parent public.operational_records%ROWTYPE; file public.controlled_document_files%ROWTYPE; origin public.documents%ROWTYPE;
 scope text; title text; kind text; meta jsonb; entity uuid; replay record; digest text; result jsonb;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client OR a.role NOT IN ('admin','department_lead') THEN RAISE EXCEPTION 'DOCUMENT_REGISTER_DENIED'; END IF;
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>16384 THEN RAISE EXCEPTION 'INVALID_DOCUMENT_REQUEST'; END IF;
 org:=a.organization_id;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text,0));
 digest:=encode(sha256(convert_to('register_document:'||p_payload::text,'UTF8')),'hex');
 SELECT * INTO replay FROM private.shared_test_requests WHERE organization_id=org AND actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN IF replay.request_hash<>digest THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF; RETURN replay.response; END IF;
 department:=CASE WHEN a.role='admin' THEN NULLIF(p_payload->>'departmentId','')::uuid ELSE private.shared_test_member_department(a.membership_id) END;
 IF NOT EXISTS(SELECT 1 FROM public.departments WHERE id=department AND organization_id=org AND active AND code<>'CLIENT') THEN RAISE EXCEPTION 'DOCUMENT_DEPARTMENT_REQUIRED'; END IF;
 scope:=p_payload->>'scope'; title:=trim(p_payload->>'title'); kind:=trim(p_payload->>'documentType');
 IF scope IS NULL OR scope NOT IN ('common','internal','client','department') THEN RAISE EXCEPTION 'DOCUMENT_SCOPE_REQUIRED'; END IF;
 IF COALESCE(title,'')='' OR length(title)>300 OR COALESCE(kind,'')='' OR length(kind)>100 THEN RAISE EXCEPTION 'DOCUMENT_TITLE_AND_TYPE_REQUIRED'; END IF;
 project:=NULLIF(p_payload->>'projectId','')::uuid;
 source:=NULLIF(p_payload->>'recordId','')::uuid;
 IF scope IN ('internal','client') THEN
  SELECT * INTO parent FROM public.operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL;
  IF parent.id IS NULL OR NOT private.shared_test_record_visible(parent.id) THEN RAISE EXCEPTION 'DOCUMENT_PROJECT_REQUIRED'; END IF;
  source:=COALESCE(source,parent.id);
 ELSIF project IS NOT NULL THEN RAISE EXCEPTION 'DOCUMENT_NONPROJECT_SCOPE'; END IF;
 IF source IS NOT NULL THEN
  SELECT * INTO context_record FROM public.operational_records WHERE id=source AND organization_id=org AND archived_at IS NULL;
  IF context_record.id IS NULL OR NOT private.shared_test_record_visible(context_record.id) THEN RAISE EXCEPTION 'DOCUMENT_SOURCE_DENIED'; END IF;
  IF scope NOT IN ('internal','client') AND (context_record.record_type='Project' OR NULLIF(context_record.fields->>'projectId','') IS NOT NULL OR EXISTS(SELECT 1 FROM public.record_links l JOIN public.operational_records p ON p.id=l.source_record_id AND p.record_type='Project' WHERE l.organization_id=org AND l.target_record_id=source)) THEN RAISE EXCEPTION 'DOCUMENT_NONPROJECT_SCOPE'; END IF;
  IF project IS NOT NULL AND source<>project AND NOT EXISTS(SELECT 1 FROM public.record_links WHERE organization_id=org AND source_record_id=project AND target_record_id=source)
    AND COALESCE(context_record.fields->>'projectId','') NOT IN (project::text,parent.reference) THEN RAISE EXCEPTION 'DOCUMENT_SOURCE_PROJECT_MISMATCH'; END IF;
 END IF;
 meta:=jsonb_build_object('scope',scope,'projectId',project,'revision','01','status','Draft','classification','Internal',
   'reference','HLPL-'||COALESCE(NULLIF(regexp_replace(parent.reference,'^HLPL-',''),''),'GEN')||'-'||(SELECT code FROM public.departments WHERE id=department)||'-DOC-'||upper(replace(p_request_id::text,'-',''))||'-01');
 IF kind IN ('Panel ZIP','Stencil PCB fab') THEN
  IF project IS NULL THEN RAISE EXCEPTION 'GERBER_SOURCE_PROJECT_REQUIRED'; END IF;
  SELECT * INTO file FROM public.controlled_document_files WHERE id=NULLIF(p_payload->>'sourceFileId','')::uuid AND organization_id=org AND superseded_at IS NULL;
  IF file.id IS NULL THEN RAISE EXCEPTION 'GERBER_SOURCE_FILE_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='controlled-documents' AND name=file.storage_path) THEN RAISE EXCEPTION 'GERBER_SOURCE_UPLOAD_INCOMPLETE'; END IF;
  PERFORM public.get_controlled_file_access(file.id);
  SELECT * INTO origin FROM public.documents WHERE id=file.document_id AND organization_id=org;
  IF origin.id IS NULL OR origin.document_type<>'Gerber ZIP' OR NOT COALESCE(origin.metadata->>'projectId'=project::text OR origin.record_id=project OR EXISTS(SELECT 1 FROM public.record_links WHERE organization_id=org AND source_record_id=project AND target_record_id=origin.record_id),false) THEN RAISE EXCEPTION 'GERBER_SOURCE_PROJECT_OR_TYPE_MISMATCH'; END IF;
  meta:=meta||jsonb_build_object('sourceFileId',file.id,'sourceDocumentId',origin.id,'sourceRevision',file.revision,'sourceChecksum',file.checksum);
 END IF;
 INSERT INTO public.documents(organization_id,department_id,record_id,title,document_type,reference_url,visibility,metadata,created_by)
 VALUES(org,department,source,title,kind,'private','internal',meta,auth.uid()) RETURNING id INTO entity;
 INSERT INTO public.audit_events(organization_id,actor_id,entity_type,entity_id,action,detail)
 VALUES(org,auth.uid(),'document',entity,'document_registered',jsonb_build_object('department_id',department,'scope',scope,'project_id',project,'source_id',source));
 result:=jsonb_build_object('id',entity,'reference',meta->>'reference','status','Draft');
 INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response) VALUES(org,auth.uid(),p_request_id,digest,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.register_controlled_document(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_controlled_document(jsonb,uuid) TO authenticated;

-- Align file metadata authorization with the existing file/storage policies, not all organization members.
CREATE OR REPLACE FUNCTION public.get_controlled_file_access(p_file_id uuid)
RETURNS TABLE(file_id uuid,organization_id uuid,department_id uuid,document_id uuid,revision text,storage_path text,original_name text,content_type text,size_bytes bigint,checksum text,uploaded_by uuid,uploaded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.controlled_document_files%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT * INTO f FROM public.controlled_document_files WHERE id=p_file_id;
 IF f.id IS NULL THEN RAISE EXCEPTION 'FILE_NOT_FOUND'; END IF;
 IF NOT public.is_organization_member(f.organization_id) OR NOT (
  public.has_organization_role(f.organization_id,ARRAY['admin'::public.app_role]) OR
  public.has_department_permission(f.organization_id,f.department_id,'documents:manage') OR f.uploaded_by=auth.uid()) THEN RAISE EXCEPTION 'FILE_ACCESS_DENIED'; END IF;
 IF private.is_shared_test_org(f.organization_id) AND NOT private.shared_test_scope(f.organization_id,f.department_id) THEN RAISE EXCEPTION 'FILE_ACCESS_DENIED'; END IF;
 RETURN QUERY SELECT f.id,f.organization_id,f.department_id,f.document_id,f.revision,f.storage_path,f.original_name,f.content_type,f.size_bytes,f.checksum,f.uploaded_by,f.uploaded_at;
END $$;
REVOKE ALL ON FUNCTION public.get_controlled_file_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_controlled_file_access(uuid) TO authenticated;

DROP POLICY IF EXISTS shared_vault_file_reads ON public.controlled_document_files;
CREATE POLICY shared_vault_file_reads ON public.controlled_document_files AS RESTRICTIVE FOR SELECT TO authenticated
USING(public.is_organization_member(organization_id) AND (NOT private.is_shared_test_org(organization_id) OR private.shared_test_scope(organization_id,department_id)));

CREATE OR REPLACE FUNCTION private.can_access_controlled_document_object(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.controlled_document_files f WHERE f.storage_path=object_name
 AND public.is_organization_member(f.organization_id)
 AND (NOT private.is_shared_test_org(f.organization_id) OR private.shared_test_scope(f.organization_id,f.department_id))
 AND (f.uploaded_by=auth.uid() OR public.has_organization_role(f.organization_id,ARRAY['admin'::public.app_role]) OR public.has_department_permission(f.organization_id,f.department_id,'documents:manage')))
$$;
REVOKE ALL ON FUNCTION private.can_access_controlled_document_object(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_access_controlled_document_object(text) TO authenticated,service_role;

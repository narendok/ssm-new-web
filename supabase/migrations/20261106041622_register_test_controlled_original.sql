-- Allow authenticated TEST department members to register an immutable original
-- only for a document they are permitted to access. Tenant and department are
-- derived from the authenticated membership; neither is accepted from client.
CREATE OR REPLACE FUNCTION public.register_test_controlled_original(p_payload jsonb, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  a record;
  doc public.documents%ROWTYPE;
  v_org uuid;
  v_dept uuid;
  v_file_id uuid;
  v_revision text;
  v_original_name text;
  v_content_type text;
  v_file_size bigint;
  v_checksum text;
  v_safe_name text;
  v_path text;
  v_digest text;
  replay record;
  result jsonb;
BEGIN
  SELECT * INTO a FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client
     OR a.role NOT IN ('admin','department_lead','member')
     OR NOT private.is_shared_test_org(a.organization_id) THEN
    RAISE EXCEPTION 'ORIGINAL_REGISTER_DENIED';
  END IF;
  IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
     OR octet_length(p_payload::text)>8192 THEN RAISE EXCEPTION 'INVALID_ORIGINAL_REQUEST'; END IF;

  v_org := a.organization_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text, 431));
  v_digest := encode(sha256(convert_to('register_original:'||p_payload::text,'UTF8')),'hex');
  SELECT * INTO replay FROM private.shared_test_requests
   WHERE organization_id=v_org AND actor_id=auth.uid() AND request_id=p_request_id;
  IF FOUND THEN
    IF replay.request_hash<>v_digest THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
    RETURN replay.response;
  END IF;

  SELECT * INTO doc FROM public.documents
   WHERE id=NULLIF(p_payload->>'documentId','')::uuid AND organization_id=v_org FOR UPDATE;
  IF doc.id IS NULL OR doc.visibility='client'
     OR (a.role<>'admin' AND doc.department_id IS DISTINCT FROM private.shared_test_member_department(a.membership_id))
     OR (doc.record_id IS NOT NULL AND NOT private.shared_test_record_visible(doc.record_id)) THEN
    RAISE EXCEPTION 'DOCUMENT_SCOPE_DENIED';
  END IF;
  v_dept := doc.department_id;
  IF v_dept IS NULL OR NOT private.shared_test_scope(v_org,v_dept) THEN RAISE EXCEPTION 'DOCUMENT_DEPARTMENT_REQUIRED'; END IF;

  v_revision := trim(p_payload->>'revision');
  v_original_name := trim(p_payload->>'originalName');
  v_content_type := trim(p_payload->>'contentType');
  v_file_size := NULLIF(p_payload->>'sizeBytes','')::bigint;
  v_checksum := lower(trim(p_payload->>'checksum'));
  IF COALESCE(v_revision,'')='' OR length(v_revision)>80
     OR COALESCE(v_original_name,'')='' OR length(v_original_name)>180
     OR COALESCE(v_content_type,'')='' OR length(v_content_type)>180
     OR v_file_size IS NULL OR v_file_size<1 OR v_file_size>26214400
     OR v_checksum !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'INVALID_ORIGINAL_METADATA'; END IF;
  IF EXISTS (SELECT 1 FROM public.controlled_document_files f
      WHERE f.organization_id=v_org AND f.document_id=doc.id AND f.revision=v_revision AND f.checksum=v_checksum) THEN
    SELECT f.id,f.storage_path INTO v_file_id,v_path FROM public.controlled_document_files f
      WHERE f.organization_id=v_org AND f.document_id=doc.id AND f.revision=v_revision AND f.checksum=v_checksum;
    result := jsonb_build_object('id',v_file_id,'storagePath',v_path,'status','Registered');
    INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response)
      VALUES(v_org,auth.uid(),p_request_id,v_digest,result);
    RETURN result;
  END IF;

  v_file_id := gen_random_uuid();
  v_safe_name := regexp_replace(regexp_replace(v_original_name,'[^a-zA-Z0-9._-]','_','g'),'_+','_','g');
  v_path := v_org::text||'/'||v_dept::text||'/'||doc.id::text||'/'||regexp_replace(v_revision,'[^a-zA-Z0-9._-]','_','g')||'/'||substr(v_checksum,1,16)||'-'||v_safe_name;
  INSERT INTO public.controlled_document_files(id,organization_id,department_id,document_id,revision,storage_path,original_name,content_type,size_bytes,checksum,uploaded_by,audit_note)
    VALUES(v_file_id,v_org,v_dept,doc.id,v_revision,v_path,v_original_name,v_content_type,v_file_size,v_checksum,auth.uid(),'Authenticated TEST original; pending byte verification');
  INSERT INTO public.audit_events(organization_id,actor_id,entity_type,entity_id,action,detail)
    VALUES(v_org,auth.uid(),'controlled_document_file',v_file_id,'original_registered',jsonb_build_object('document_id',doc.id,'department_id',v_dept,'revision',v_revision,'checksum',v_checksum,'size_bytes',v_file_size));
  result := jsonb_build_object('id',v_file_id,'storagePath',v_path,'status','Registered');
  INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response)
    VALUES(v_org,auth.uid(),p_request_id,v_digest,result);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.register_test_controlled_original(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_test_controlled_original(jsonb,uuid) TO authenticated;

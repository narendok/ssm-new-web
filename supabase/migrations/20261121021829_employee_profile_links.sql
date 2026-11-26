-- HR-issued letters and employee equipment custody are explicit links to
-- existing shared masters. No fixtures or personal data are seeded here.

ALTER TABLE public.business_items DROP CONSTRAINT business_items_kind_check;
ALTER TABLE public.business_items ADD CONSTRAINT business_items_kind_check
  CHECK (kind IN ('allocation','expense','ticket','ticket_help_request','profile','template','assignment','channel','message','employee_letter','employee_asset','employee_profile_change'));

CREATE UNIQUE INDEX IF NOT EXISTS business_employee_letter_file_unique
  ON public.business_items(organization_id, owner_id, (payload->>'fileId'))
  WHERE kind='employee_letter';
CREATE UNIQUE INDEX IF NOT EXISTS business_asset_one_custodian
  ON public.business_items(organization_id, (payload->>'assetRecordId'))
  WHERE kind='employee_asset' AND payload->>'custodyStatus'='Assigned';

DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('private.business_visible(public.business_items,jsonb)'::regprocedure)
    INTO definition;
  IF position('employee_letter' IN definition)=0 THEN
    definition := replace(definition,
      'IF p.kind=''profile'' THEN',
      'IF p.kind IN (''employee_letter'',''employee_asset'',''employee_profile_change'') THEN RETURN p.owner_id=mid OR role=''admin'' OR (role=''department_lead'' AND dept IN (''HR'',''HROPS'')); END IF;'||E'\n IF p.kind=''profile'' THEN');
    IF definition NOT LIKE '%employee_letter%' THEN RAISE EXCEPTION 'BUSINESS_VISIBILITY_PATCH_ANCHOR_MISSING'; END IF;
    EXECUTE definition;
  END IF;
END
$migration$;

DO $migration$
DECLARE definition text; anchor text; replacement text;
BEGIN
  definition := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  IF position('issue_employee_letter' IN definition)=0 THEN
    definition := replace(definition,
      'member record;',
      'member record;'||E'\n file public.controlled_document_files%ROWTYPE;'||E'\n asset public.operational_records%ROWTYPE;'||E'\n profile_payload jsonb;'||E'\n base_profile jsonb;');
    IF position('file public.controlled_document_files%ROWTYPE;' IN definition)=0
      OR position('asset public.operational_records%ROWTYPE;' IN definition)=0 THEN
      RAISE EXCEPTION 'BUSINESS_MUTATION_DECLARATION_PATCH_ANCHOR_MISSING';
    END IF;
    anchor := ' ELSIF p_action=''save_profile'' THEN';
    replacement := $branch$ ELSIF p_action='issue_employee_letter' THEN
  IF NOT is_hr THEN RAISE EXCEPTION 'HR_AUTHORITY_REQUIRED'; END IF;
  IF COALESCE(data->>'letterType','') NOT IN ('Appointment','Confirmation','Promotion','Relieving','Experience','SOP_Notice','Bonus_Award')
    OR length(trim(COALESCE(data->>'referenceNumber','')))<3 OR (data->>'effectiveDate')::date IS NULL THEN
    RAISE EXCEPTION 'EMPLOYEE_LETTER_DETAILS_REQUIRED';
  END IF;
  SELECT * INTO member FROM public.organization_members
    WHERE id=NULLIF(data->>'memberId','')::uuid AND organization_id=org AND active AND role<>'viewer';
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_EMPLOYEE'; END IF;
  SELECT f.* INTO file FROM public.controlled_document_files f
    JOIN public.documents d ON d.id=f.document_id AND d.organization_id=org
    JOIN public.departments owner_department ON owner_department.id=f.department_id
      AND owner_department.organization_id=org AND owner_department.active AND owner_department.code IN ('HR','HROPS')
    JOIN storage.objects object ON object.bucket_id='controlled-documents' AND object.name=f.storage_path
    WHERE f.id=NULLIF(data->>'fileId','')::uuid
      AND f.document_id=NULLIF(data->>'documentId','')::uuid
      AND f.organization_id=org AND d.department_id=f.department_id AND f.superseded_at IS NULL AND f.size_bytes>0
      AND f.checksum ~ '^[a-fA-F0-9]{64}$' AND lower(d.document_type) LIKE '%letter%'
      AND private.original_has_verified_receipt(f.id);
  IF NOT FOUND THEN RAISE EXCEPTION 'ISSUED_LETTER_ORIGINAL_UNAVAILABLE'; END IF;
  INSERT INTO public.business_items(organization_id,kind,owner_id,department_id,payload)
    VALUES(org,'employee_letter',member.id,file.department_id,jsonb_build_object(
      'documentId',file.document_id,'fileId',file.id,'letterType',data->>'letterType',
      'title',(SELECT title FROM public.documents WHERE id=file.document_id),
      'referenceNumber',trim(data->>'referenceNumber'),'effectiveDate',data->>'effectiveDate',
      'status','Review','originalName',file.original_name,'draftedBy',mid,'draftedAt',now()
    )) RETURNING id INTO item_id;
 ELSIF p_action='approve_employee_letter' THEN
  IF NOT is_hr OR i.kind IS DISTINCT FROM 'employee_letter' OR i.payload->>'status'<>'Review' OR i.owner_id=mid THEN
    RAISE EXCEPTION 'EMPLOYEE_LETTER_APPROVAL_DENIED';
  END IF;
  data:=i.payload||jsonb_build_object('status','Pending_Employee_Acknowledgement','approvedBy',mid,'approvedAt',now());
  UPDATE public.business_items SET payload=data,version=version+1,updated_at=now() WHERE id=i.id;
 ELSIF p_action='acknowledge_employee_letter' THEN
  IF i.kind IS DISTINCT FROM 'employee_letter' OR i.owner_id<>mid OR i.payload->>'status'<>'Pending_Employee_Acknowledgement' OR NOT COALESCE((data->>'acknowledged')::boolean,false) THEN
    RAISE EXCEPTION 'EMPLOYEE_LETTER_ACKNOWLEDGEMENT_DENIED';
  END IF;
  data:=i.payload||jsonb_build_object('status','Issued','employeeApprovedBy',mid,'employeeApprovedAt',now(),'issuedAt',now());
  UPDATE public.business_items SET payload=data,version=version+1,updated_at=now() WHERE id=i.id;
 ELSIF p_action='reject_employee_letter' THEN
  IF i.kind IS DISTINCT FROM 'employee_letter' OR i.owner_id<>mid OR i.payload->>'status'<>'Pending_Employee_Acknowledgement' OR length(trim(COALESCE(data->>'reason','')))<3 THEN
    RAISE EXCEPTION 'EMPLOYEE_LETTER_CORRECTION_DENIED';
  END IF;
  UPDATE public.business_items SET payload=payload||jsonb_build_object('status','Correction_Requested','correctionRequestedBy',mid,'correctionRequestedAt',now(),'correctionReason',trim(data->>'reason')),version=version+1,updated_at=now() WHERE id=i.id;
 ELSIF p_action='assign_employee_asset' THEN
  IF NOT is_hr THEN RAISE EXCEPTION 'HR_AUTHORITY_REQUIRED'; END IF;
  SELECT * INTO member FROM public.organization_members
    WHERE id=NULLIF(data->>'memberId','')::uuid AND organization_id=org AND active AND role<>'viewer';
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_EMPLOYEE'; END IF;
  SELECT * INTO asset FROM public.operational_records
    WHERE id=NULLIF(data->>'assetRecordId','')::uuid AND organization_id=org
      AND record_type='Asset' AND archived_at IS NULL AND private.shared_test_record_visible(id)
    FOR UPDATE;
  IF NOT FOUND OR COALESCE(NULLIF(asset.fields->>'assetTag',''),NULLIF(asset.reference,'')) IS NULL
    OR NULLIF(trim(COALESCE(asset.fields->>'serialNumber','')),'') IS NULL THEN
    RAISE EXCEPTION 'CANONICAL_SERIAL_ASSET_REQUIRED';
  END IF;
  IF EXISTS(SELECT 1 FROM public.business_items assigned WHERE assigned.organization_id=org
    AND assigned.kind='employee_asset' AND assigned.payload->>'assetRecordId'=asset.id::text
    AND assigned.payload->>'custodyStatus'='Assigned') THEN RAISE EXCEPTION 'ASSET_ALREADY_ASSIGNED'; END IF;
  INSERT INTO public.business_items(organization_id,kind,owner_id,department_id,payload)
    VALUES(org,'employee_asset',member.id,asset.department_id,jsonb_build_object(
      'assetRecordId',asset.id,'assetTag',COALESCE(NULLIF(asset.fields->>'assetTag',''),asset.reference),
      'assetName',COALESCE(NULLIF(asset.fields->>'assetName',''),asset.title),
      'serialNumber',asset.fields->>'serialNumber','category',asset.fields->>'category',
      'custodyStatus','Assigned','acknowledged',false,'assignedBy',mid,'assignedAt',now()
    )) RETURNING id INTO item_id;
 ELSIF p_action='acknowledge_employee_asset' THEN
  IF i.kind IS DISTINCT FROM 'employee_asset' OR i.owner_id<>mid OR i.payload->>'custodyStatus'<>'Assigned' THEN
    RAISE EXCEPTION 'ASSET_ACKNOWLEDGMENT_DENIED';
  END IF;
  data:=i.payload||jsonb_build_object('acknowledged',true,'acknowledgedAt',now());
  UPDATE public.business_items SET payload=data,version=version+1,updated_at=now() WHERE id=i.id;
 ELSIF p_action='return_employee_asset' THEN
  IF NOT is_hr OR i.kind IS DISTINCT FROM 'employee_asset' OR i.payload->>'custodyStatus'<>'Assigned'
    OR length(trim(COALESCE(data->>'reason','')))<3 THEN RAISE EXCEPTION 'ASSET_RETURN_DENIED'; END IF;
  data:=i.payload||jsonb_build_object('custodyStatus','Returned','returnReason',trim(data->>'reason'),'returnedBy',mid,'returnedAt',now());
  UPDATE public.business_items SET payload=data,version=version+1,updated_at=now() WHERE id=i.id;
 ELSIF p_action IN ('save_profile','request_profile_change') THEN
  IF p_action='save_profile' AND NOT is_hr THEN RAISE EXCEPTION 'HR_AUTHORITY_REQUIRED'; END IF;
  IF p_action='request_profile_change' AND (a.role NOT IN ('member','department_lead','admin') OR NULLIF(data->>'memberId','')::uuid IS DISTINCT FROM mid) THEN RAISE EXCEPTION 'PROFILE_CHANGE_REQUEST_DENIED'; END IF;
  SELECT * INTO member FROM public.organization_members
   WHERE id=NULLIF(data->>'memberId','')::uuid AND organization_id=org AND active AND role<>'viewer';
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_EMPLOYEE'; END IF;
  IF i.id IS NOT NULL AND (i.kind<>'profile' OR i.owner_id<>member.id) THEN RAISE EXCEPTION 'PROFILE_IDENTITY_IMMUTABLE'; END IF;
  SELECT payload INTO base_profile FROM public.business_items WHERE organization_id=org AND kind='profile' AND owner_id=member.id;
  IF NULLIF(trim(COALESCE(data->>'reason','')),'') IS NULL OR length(trim(data->>'reason'))<3 THEN RAISE EXCEPTION 'PROFILE_CHANGE_REASON_REQUIRED'; END IF;
  IF NULLIF(trim(COALESCE(data->>'email','')),'') IS NOT NULL AND trim(data->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'INVALID_PROFILE_EMAIL'; END IF;
  IF NULLIF(data->>'joiningDate','') IS NOT NULL AND data->>'joiningDate' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'INVALID_PROFILE_JOINING_DATE'; END IF;
  profile_payload:=COALESCE(base_profile,'{}'::jsonb)||jsonb_build_object(
    'employeeCode',NULLIF(trim(COALESCE(data->>'employeeCode','')),''),
    'email',NULLIF(trim(COALESCE(data->>'email','')),''),
    'phone',NULLIF(trim(COALESCE(data->>'phone','')),''),
    'roleTitle',NULLIF(trim(COALESCE(data->>'roleTitle','')),''),
    'joiningDate',NULLIF(data->>'joiningDate',''),
    'facilityLocation',NULLIF(trim(COALESCE(data->>'facilityLocation','')),''),
    'emergencyContact',NULLIF(trim(COALESCE(data->>'emergencyContact','')),''));
  IF p_action='save_profile' AND data ? 'travelBand' THEN
   IF COALESCE(data->>'travelBand','') NOT IN ('staff','manager','senior') THEN RAISE EXCEPTION 'INVALID_TRAVEL_BAND'; END IF;
   profile_payload:=profile_payload||jsonb_build_object('travelBand',data->>'travelBand');
  END IF;
  IF p_action='request_profile_change' THEN
   IF length(trim(COALESCE(data->>'reason','')))<3 THEN RAISE EXCEPTION 'PROFILE_CHANGE_REASON_REQUIRED'; END IF;
   IF EXISTS(SELECT 1 FROM business_items WHERE organization_id=org AND kind='employee_profile_change' AND owner_id=member.id AND payload->>'status' IN ('Pending_HR_Review','Pending_Employee_Acknowledgement')) THEN RAISE EXCEPTION 'PROFILE_CHANGE_ALREADY_PENDING'; END IF;
  END IF;
  IF p_action='save_profile' AND EXISTS(SELECT 1 FROM business_items WHERE organization_id=org AND kind='employee_profile_change' AND owner_id=member.id AND payload->>'status' IN ('Pending_HR_Review','Pending_Employee_Acknowledgement')) THEN RAISE EXCEPTION 'PROFILE_CHANGE_ALREADY_PENDING'; END IF;
  INSERT INTO public.business_items(organization_id,kind,owner_id,department_id,payload)
   VALUES(org,'employee_profile_change',member.id,private.shared_test_member_department(member.id),jsonb_build_object(
    'status',CASE WHEN p_action='save_profile' THEN 'Pending_Employee_Acknowledgement' ELSE 'Pending_HR_Review' END,
    'changeSource',CASE WHEN p_action='save_profile' THEN 'HR' ELSE 'Employee' END,
    'baseProfile',COALESCE(base_profile,'{}'::jsonb),'proposedProfile',profile_payload,'baseVersion',COALESCE((SELECT version FROM public.business_items WHERE organization_id=org AND kind='profile' AND owner_id=member.id),0),
    'requestedBy',mid,'requestedAt',now(),'reason',NULLIF(trim(COALESCE(data->>'reason','')),''))) RETURNING id INTO item_id;
 ELSIF p_action IN ('approve_profile_change','acknowledge_profile_change') THEN
  IF i.kind IS DISTINCT FROM 'employee_profile_change' THEN RAISE EXCEPTION 'PROFILE_CHANGE_UNAVAILABLE'; END IF;
  IF p_action='approve_profile_change' AND (NOT is_hr OR i.payload->>'status'<>'Pending_HR_Review' OR i.owner_id=mid) THEN RAISE EXCEPTION 'PROFILE_CHANGE_APPROVAL_DENIED'; END IF;
  IF p_action='acknowledge_profile_change' AND (i.owner_id<>mid OR i.payload->>'status'<>'Pending_Employee_Acknowledgement') THEN RAISE EXCEPTION 'PROFILE_CHANGE_ACKNOWLEDGEMENT_DENIED'; END IF;
  IF COALESCE((SELECT version FROM public.business_items WHERE organization_id=org AND kind='profile' AND owner_id=i.owner_id),0)<>COALESCE((i.payload->>'baseVersion')::int,0) THEN RAISE EXCEPTION 'PROFILE_BASELINE_CHANGED'; END IF;
  profile_payload:=i.payload->'proposedProfile';
  UPDATE public.business_items SET payload=profile_payload,version=version+1,updated_at=now()
   WHERE organization_id=org AND kind='profile' AND owner_id=i.owner_id;
  IF NOT FOUND THEN INSERT INTO public.business_items(organization_id,kind,owner_id,department_id,payload)
    VALUES(org,'profile',i.owner_id,i.department_id,profile_payload); END IF;
  UPDATE public.business_items SET payload=payload||jsonb_build_object('status','Approved','approvedBy',mid,'approvedAt',now()),version=version+1,updated_at=now() WHERE id=i.id;
 ELSIF p_action='reject_profile_change' THEN
  IF i.kind IS DISTINCT FROM 'employee_profile_change' OR length(trim(COALESCE(data->>'reason','')))<3 THEN RAISE EXCEPTION 'PROFILE_CHANGE_REJECTION_INVALID'; END IF;
  IF NOT ((is_hr AND i.payload->>'status'='Pending_HR_Review' AND i.owner_id<>mid) OR (i.owner_id=mid AND i.payload->>'status'='Pending_Employee_Acknowledgement')) THEN RAISE EXCEPTION 'PROFILE_CHANGE_REJECTION_DENIED'; END IF;
  UPDATE public.business_items SET payload=payload||jsonb_build_object('status','Rejected','decisionBy',mid,'decidedAt',now(),'decisionReason',trim(data->>'reason')),version=version+1,updated_at=now() WHERE id=i.id;
 ELSIF p_action='save_profile' THEN$branch$;
    IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'BUSINESS_MUTATION_PATCH_ANCHOR_MISSING'; END IF;
    definition := replace(definition, anchor, replacement);
    EXECUTE definition;
  END IF;
END
$migration$;

DO $migration$
DECLARE definition text; anchor text; replacement text; employee_routes text;
BEGIN
  definition := pg_get_functiondef('private.business_notify(uuid)'::regprocedure);
  anchor := 'OR (i.kind=''ticket_help_request'' AND';
  employee_routes := '(i.kind=''employee_letter'' AND m.id=i.owner_id) OR'||E'\n'||
    '  (i.kind=''employee_asset'' AND m.id=i.owner_id) OR'||E'\n'||
    '  (i.kind=''employee_profile_change'' AND m.id=i.owner_id) OR'||E'\n'||
    '  (i.kind=''employee_letter'' AND i.payload->>''status'' IN (''Review'',''Correction_Requested'') AND m.id<>i.owner_id AND (m.role=''admin'' OR (m.role=''department_lead'' AND private.shared_test_member_department(m.id)=i.department_id))) OR'||E'\n'||
    '  (i.kind=''employee_profile_change'' AND i.payload->>''status''=''Pending_HR_Review'' AND m.id<>i.owner_id AND (m.role=''admin'' OR (m.role=''department_lead'' AND private.shared_test_member_department(m.id) IN (SELECT d.id FROM departments d WHERE d.organization_id=i.organization_id AND d.code IN (''HR'',''HROPS''))))) OR'||E'\n';
  IF position('i.kind IN (''expense'',''assignment'',''ticket'',''employee_letter'',''employee_asset'',''employee_profile_change'')' IN definition)=0 THEN
    IF position(anchor IN definition)>0 THEN
      replacement:='OR '||employee_routes||anchor;
    ELSE
      anchor := '  (i.kind IN (''expense'',''assignment'',''ticket'') AND m.id=i.owner_id) OR'||E'\n';
      IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'EMPLOYEE_PROFILE_NOTIFICATION_PATCH_ANCHOR_MISSING'; END IF;
      replacement:=anchor||'  '||employee_routes||'  (i.kind=''ticket_help_request'' AND (m.id=i.owner_id OR m.role=''admin'' OR (m.role=''department_lead'' AND private.shared_test_member_department(m.id)=i.department_id))) OR'||E'\n';
    END IF;
    definition:=replace(definition,anchor,replacement);
    EXECUTE definition;
  END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION public.get_employee_letter_file_access(p_item_id uuid)
RETURNS TABLE(file_id uuid,storage_path text,original_name text,checksum text,size_bytes bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor record; link public.business_items%ROWTYPE; file public.controlled_document_files%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO actor FROM public.resolve_test_membership();
  IF actor.membership_id IS NULL OR actor.is_client OR actor.role='viewer' THEN RAISE EXCEPTION 'EMPLOYEE_PROFILE_ACCESS_DENIED'; END IF;
  SELECT * INTO link FROM public.business_items WHERE id=p_item_id AND organization_id=actor.organization_id
    AND kind='employee_letter' AND owner_id=actor.membership_id AND payload->>'status' IN ('Pending_Employee_Acknowledgement','Issued');
  IF NOT FOUND THEN RAISE EXCEPTION 'EMPLOYEE_LETTER_UNAVAILABLE'; END IF;
  SELECT f.* INTO file FROM public.controlled_document_files f WHERE f.id=(link.payload->>'fileId')::uuid
    AND f.organization_id=actor.organization_id AND f.document_id=(link.payload->>'documentId')::uuid
    AND f.superseded_at IS NULL AND f.size_bytes>0 AND f.checksum ~ '^[a-fA-F0-9]{64}$'
    AND private.original_has_verified_receipt(f.id);
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='controlled-documents' AND name=file.storage_path) THEN
    RAISE EXCEPTION 'EMPLOYEE_LETTER_ORIGINAL_UNAVAILABLE';
  END IF;
  RETURN QUERY SELECT file.id,file.storage_path,file.original_name,file.checksum,file.size_bytes;
END $$;
REVOKE ALL ON FUNCTION public.get_employee_letter_file_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_employee_letter_file_access(uuid) TO authenticated;

DO $migration$
DECLARE definition text; anchor text; replacement text;
BEGIN
  definition := pg_get_functiondef('private.can_access_controlled_document_object(text)'::regprocedure);
  anchor := 'OR public.has_department_permission(f.organization_id,f.department_id,''documents:manage''))';
  replacement := $access$OR public.has_department_permission(f.organization_id,f.department_id,'documents:manage')
    OR EXISTS(SELECT 1 FROM public.business_items letter
      JOIN public.resolve_test_membership() actor ON actor.membership_id=letter.owner_id
      WHERE letter.organization_id=f.organization_id AND letter.kind='employee_letter'
        AND letter.payload->>'fileId'=f.id::text AND letter.payload->>'status' IN ('Pending_Employee_Acknowledgement','Issued')
        AND private.original_has_verified_receipt(f.id)))$access$;
  IF position('kind=''employee_letter''' IN definition)=0 THEN
    IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'CONTROLLED_FILE_POLICY_PATCH_ANCHOR_MISSING'; END IF;
    definition:=replace(definition,anchor,replacement);
    EXECUTE definition;
  END IF;
END
$migration$;

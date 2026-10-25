-- 20261025091500_harden_downstream_master_guards.sql
-- Forward migration: Hardened fail-closed downstream master transaction guards
-- Enforces:
-- 1. Capability-gated creation of master entities (Supplier, Part, Customer)
-- 2. Fail-closed supplier verification gate on Purchase Orders and Mass Production Requests
--    (Rejects missing suppliers, non-existent supplier IDs, and unverified/pending suppliers)
-- 3. Fail-closed part release gate on Released BOMs and Mass Production Releases
--    (Rejects missing parts, non-existent part IDs/MPNs, and engineering-only/unreleased parts)
-- 4. Consistent enforcement across create_record, update_record, and request_approval
-- 5. Canonical return payload including entity id, reference, and record_type

CREATE OR REPLACE FUNCTION public.mutate_shared_test_workspace(p_action text,p_payload jsonb,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 a record;
 m organization_members%ROWTYPE;
 r operational_records%ROWTYPE;
 t tasks%ROWTYPE;
 p approvals%ROWTYPE;
 s_rec operational_records%ROWTYPE;
 p_rec operational_records%ROWTYPE;
 org uuid;
 dept uuid;
 reviewer uuid;
 assignee uuid;
 project uuid;
 entity uuid;
 record_fields jsonb;
 payload_hash text;
 replay record;
 result jsonb;
 rec_type text;
 sup_ref text;
 prt_ref text;
 target_stage text;
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.role='viewer' THEN RAISE EXCEPTION 'TEST_WRITE_DENIED'; END IF;
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>131072 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 org:=a.organization_id;
 dept:=private.shared_test_member_department(a.membership_id);
 IF a.role<>'admin' AND dept IS NULL THEN RAISE EXCEPTION 'DEPARTMENT_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text,0));
 payload_hash:=encode(sha256(convert_to(p_action||p_payload::text,'UTF8')),'hex');
 SELECT * INTO replay FROM private.shared_test_requests WHERE organization_id=org AND actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN
  IF replay.request_hash<>payload_hash THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
  RETURN replay.response;
 END IF;

 IF p_action IN ('create_project','create_record','create_task','create_document') AND NULLIF(trim(p_payload->>'title'),'') IS NULL THEN
  RAISE EXCEPTION 'TITLE_REQUIRED';
 END IF;

 rec_type:=trim(COALESCE(p_payload->>'record_type',''));

 IF p_action = 'create_task' THEN
  project:=(p_payload->>'project_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL) THEN
   RAISE EXCEPTION 'PROJECT_REQUIRED';
  END IF;
  IF a.role='admin' THEN dept:=NULLIF(p_payload->>'department_id','')::uuid; END IF;
  IF NOT EXISTS(SELECT 1 FROM departments WHERE id=dept AND organization_id=org AND active AND code<>'CLIENT') THEN
   RAISE EXCEPTION 'DEPARTMENT_REQUIRED';
  END IF;
 ELSIF p_action = 'create_record' THEN
  IF rec_type IN ('Supplier','Part','Customer') THEN
   project:=NULLIF(p_payload->>'project_id','')::uuid;
   IF project IS NOT NULL AND NOT EXISTS(SELECT 1 FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'PROJECT_REQUIRED';
   END IF;
   IF rec_type = 'Supplier' THEN
    IF a.role<>'admin' AND COALESCE(a.department_code,'')<>'PUR' THEN
     RAISE EXCEPTION 'SUPPLIER_CREATE_DENIED: Only Purchasing or Admin can register suppliers';
    END IF;
    SELECT id INTO dept FROM departments WHERE organization_id=org AND code='PUR' AND active;
   ELSIF rec_type = 'Customer' THEN
    IF a.role<>'admin' AND COALESCE(a.department_code,'')<>'SAL' THEN
     RAISE EXCEPTION 'CUSTOMER_CREATE_DENIED: Only Sales or Admin can register customers';
    END IF;
    SELECT id INTO dept FROM departments WHERE organization_id=org AND code='SAL' AND active;
   ELSIF rec_type = 'Part' THEN
    IF a.role<>'admin' AND COALESCE(a.department_code,'') NOT IN ('EHW','FW','SW','MECH','PUR','RND') THEN
     RAISE EXCEPTION 'PART_CREATE_DENIED: Only Engineering or Purchasing can register parts';
    END IF;
    IF a.role='admin' THEN dept:=NULLIF(p_payload->>'department_id','')::uuid; END IF;
    IF dept IS NULL THEN dept:=private.shared_test_member_department(a.membership_id); END IF;
   END IF;
  ELSE
   project:=(p_payload->>'project_id')::uuid;
   IF NOT EXISTS(SELECT 1 FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'PROJECT_REQUIRED';
   END IF;
   IF a.role='admin' THEN dept:=NULLIF(p_payload->>'department_id','')::uuid; END IF;
   IF NOT EXISTS(SELECT 1 FROM departments WHERE id=dept AND organization_id=org AND active AND code<>'CLIENT') THEN
    RAISE EXCEPTION 'DEPARTMENT_REQUIRED';
   END IF;
  END IF;
 END IF;

 IF p_action='create_project' THEN
  IF a.role<>'admin' AND NOT (a.role='department_lead' AND a.department_code='SAL') THEN
   RAISE EXCEPTION 'PROJECT_CREATE_DENIED';
  END IF;
  IF COALESCE(p_payload->>'reference','') !~ '^HLPL-[A-Z0-9]+(-[A-Z0-9]+)*$' THEN
   RAISE EXCEPTION 'PROJECT_CODE_REQUIRED';
  END IF;
  SELECT id INTO dept FROM departments WHERE organization_id=org AND code='SAL' AND active;
  INSERT INTO operational_records(organization_id,department_id,area,record_type,reference,title,stage,fields,notes,created_by,updated_by,is_demo)
  VALUES(org,dept,'sales','Project',p_payload->>'reference',trim(p_payload->>'title'),'Stage 1',jsonb_build_object('revision','01'),COALESCE(p_payload->>'notes',''),auth.uid(),auth.uid(),true)
  RETURNING id INTO entity;

 ELSIF p_action='create_record' THEN
  IF lower(rec_type)='project' THEN RAISE EXCEPTION 'USE_PROJECT_CREATION'; END IF;
  IF COALESCE(p_payload->>'reference','') !~ '^HLPL-[A-Z0-9]+(-[A-Z0-9]+)*$' OR NULLIF(rec_type,'') IS NULL THEN
   RAISE EXCEPTION 'CONTROLLED_REFERENCE_REQUIRED';
  END IF;
  record_fields:=COALESCE(p_payload->'fields','{}'::jsonb);
  IF jsonb_typeof(record_fields)<>'object' OR record_fields ?| ARRAY['last_stage_gate','lifecycleStage','currentStage'] OR NULLIF(trim(record_fields->>'revision'),'') IS NULL THEN
   RAISE EXCEPTION 'REVISION_REQUIRED';
  END IF;

  -- Fail-closed Supplier Gate for Purchase Orders and Mass Production Requests
  IF rec_type IN ('Purchase order','Purchase Order','Mass production request') THEN
   sup_ref:=NULLIF(trim(COALESCE(record_fields->>'supplier_id', record_fields->>'supplier', record_fields->>'supplierId')), '');
   IF sup_ref IS NULL THEN
    RAISE EXCEPTION 'SUPPLIER_REQUIRED: A valid supplier must be specified for purchase orders';
   END IF;
   SELECT * INTO s_rec FROM operational_records sup
   WHERE sup.organization_id = org AND sup.record_type = 'Supplier' AND sup.archived_at IS NULL
     AND (sup.id::text = sup_ref OR sup.reference = sup_ref OR sup.title = sup_ref)
   LIMIT 1;
   IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPPLIER_NOT_FOUND: Referenced supplier does not exist in operational records';
   END IF;
   IF s_rec.fields->>'verification_status' = 'Pending_Verification'
      OR s_rec.status IN ('draft', 'in_review')
      OR COALESCE(s_rec.fields->>'verification_status', '') = 'Pending_Verification'
      OR (s_rec.fields->>'verification_status' IS NOT NULL AND s_rec.fields->>'verification_status' <> 'Approved') THEN
    RAISE EXCEPTION 'SUPPLIER_VERIFICATION_REQUIRED: Supplier is pending verification and cannot be used for production purchase orders';
   END IF;
  END IF;

  -- Fail-closed Part Release Gate for Released BOMs and Production Releases
  target_stage:=COALESCE(record_fields->>'stage', p_payload->>'stage');
  IF (rec_type IN ('Release','Production order','BOM','Mass production BOM') AND target_stage = 'released')
     OR rec_type = 'Mass production BOM' THEN
   prt_ref:=NULLIF(trim(COALESCE(record_fields->>'part_id', record_fields->>'part', record_fields->>'partId', record_fields->>'mpn')), '');
   IF prt_ref IS NULL THEN
    RAISE EXCEPTION 'PART_REQUIRED: A valid component part must be specified for released BOMs';
   END IF;
   SELECT * INTO p_rec FROM operational_records prt
   WHERE prt.organization_id = org AND prt.record_type = 'Part' AND prt.archived_at IS NULL
     AND (prt.id::text = prt_ref OR prt.reference = prt_ref OR prt.fields->>'mpn' = prt_ref)
   LIMIT 1;
   IF NOT FOUND THEN
    RAISE EXCEPTION 'PART_NOT_FOUND: Referenced component part does not exist in operational records';
   END IF;
   IF p_rec.fields->>'release_status' = 'Engineering_Only'
      OR p_rec.status IN ('draft', 'in_review')
      OR COALESCE(p_rec.fields->>'release_status', '') = 'Engineering_Only'
      OR (p_rec.fields->>'release_status' IS NOT NULL AND p_rec.fields->>'release_status' <> 'Released') THEN
    RAISE EXCEPTION 'PART_RELEASE_REQUIRED: Part is engineering-only and cannot be released to mass production';
   END IF;
  END IF;

  INSERT INTO operational_records(organization_id,department_id,area,record_type,reference,title,fields,notes,created_by,updated_by,is_demo)
  VALUES(org,dept,(SELECT lower(code) FROM departments WHERE id=dept),rec_type,p_payload->>'reference',trim(p_payload->>'title'),record_fields,COALESCE(p_payload->>'notes',''),auth.uid(),auth.uid(),true)
  RETURNING id INTO entity;

  IF project IS NOT NULL THEN
   INSERT INTO record_links(organization_id,source_record_id,target_record_id,relationship,created_by)
   VALUES(org,project,entity,'deliverable',auth.uid());
  END IF;

 ELSIF p_action='create_task' THEN
  assignee:=NULLIF(p_payload->>'assignee_id','')::uuid;
  IF a.role='member' THEN assignee:=a.membership_id; END IF;
  IF assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM organization_members WHERE id=assignee AND organization_id=org AND active AND role<>'viewer' AND private.shared_test_member_department(id)=dept) THEN
   RAISE EXCEPTION 'ASSIGNEE_DEPARTMENT_MISMATCH';
  END IF;
  IF COALESCE(p_payload->>'priority','Normal') NOT IN ('Critical','High','Normal','Low') THEN
   RAISE EXCEPTION 'INVALID_TASK_PRIORITY';
  END IF;
  INSERT INTO tasks(organization_id,department_id,record_id,title,assignee_id,due_at,priority,created_by)
  VALUES(org,dept,project,trim(p_payload->>'title'),assignee,NULLIF(p_payload->>'due_at','')::timestamptz,COALESCE(p_payload->>'priority','Normal'),auth.uid())
  RETURNING id INTO entity;

 ELSIF p_action='update_task' THEN
  SELECT * INTO t FROM tasks WHERE id=(p_payload->>'id')::uuid AND organization_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_FOUND'; END IF;
  IF t.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN
   RAISE EXCEPTION 'STALE_WRITE: Reload before saving';
  END IF;
  IF a.role<>'admin' AND NOT (a.role='department_lead' AND t.department_id=dept) AND NOT (a.role='member' AND t.assignee_id=a.membership_id) THEN
   RAISE EXCEPTION 'TASK_WRITE_DENIED';
  END IF;
  IF p_payload->>'status' NOT IN ('Open','In Progress','In review','Complete') OR p_payload->>'status' IS NULL THEN
   RAISE EXCEPTION 'INVALID_TASK_STATUS';
  END IF;
  IF t.status='In review' AND p_payload->>'status'='Complete' THEN
   RAISE EXCEPTION 'USE_LINKED_REVIEW_RECORD';
  END IF;
  assignee:=t.assignee_id;
  IF p_payload ? 'assignee_id' THEN
   IF a.role<>'department_lead' THEN RAISE EXCEPTION 'TASK_ASSIGNMENT_DENIED'; END IF;
   assignee:=NULLIF(p_payload->>'assignee_id','')::uuid;
   IF assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM organization_members WHERE id=assignee AND organization_id=org AND active AND role<>'viewer' AND private.shared_test_member_department(id)=t.department_id) THEN
    RAISE EXCEPTION 'ASSIGNEE_DEPARTMENT_MISMATCH';
   END IF;
  END IF;
  UPDATE tasks SET status=p_payload->>'status',assignee_id=assignee,updated_at=now() WHERE id=t.id;
  entity:=t.id;

 ELSIF p_action IN ('update_record','request_approval','create_document') THEN
  SELECT * INTO r FROM operational_records WHERE id=(p_payload->>'record_id')::uuid AND organization_id=org AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECORD_NOT_FOUND'; END IF;
  IF NOT private.shared_test_scope(org,r.department_id) THEN RAISE EXCEPTION 'RECORD_SCOPE_DENIED'; END IF;

  IF p_action='update_record' THEN
   IF r.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN
    RAISE EXCEPTION 'STALE_WRITE: Reload before saving';
   END IF;
   IF r.record_type='Project' THEN RAISE EXCEPTION 'USE_STAGE_GATE'; END IF;
   IF a.role='member' AND r.created_by<>auth.uid() THEN RAISE EXCEPTION 'RECORD_WRITE_DENIED'; END IF;
   record_fields:=COALESCE(p_payload->'fields',r.fields);
   IF jsonb_typeof(record_fields)<>'object' OR record_fields ?| ARRAY['last_stage_gate','lifecycleStage','currentStage'] OR NULLIF(trim(record_fields->>'revision'),'') IS NULL THEN
    RAISE EXCEPTION 'REVISION_REQUIRED';
   END IF;
   IF r.status IN ('approved','released') AND (record_fields->>'revision'=r.fields->>'revision' OR a.role='member') THEN
    RAISE EXCEPTION 'NEW_REVISION_REQUIRED';
   END IF;

   -- Fail-closed Supplier Gate on PO update
   IF r.record_type IN ('Purchase order','Purchase Order','Mass production request') THEN
    sup_ref:=NULLIF(trim(COALESCE(record_fields->>'supplier_id', record_fields->>'supplier', record_fields->>'supplierId')), '');
    IF sup_ref IS NULL THEN
     RAISE EXCEPTION 'SUPPLIER_REQUIRED: A valid supplier must be specified for purchase orders';
    END IF;
    SELECT * INTO s_rec FROM operational_records sup
    WHERE sup.organization_id = org AND sup.record_type = 'Supplier' AND sup.archived_at IS NULL
      AND (sup.id::text = sup_ref OR sup.reference = sup_ref OR sup.title = sup_ref)
    LIMIT 1;
    IF NOT FOUND THEN
     RAISE EXCEPTION 'SUPPLIER_NOT_FOUND: Referenced supplier does not exist in operational records';
    END IF;
    IF s_rec.fields->>'verification_status' = 'Pending_Verification'
       OR s_rec.status IN ('draft', 'in_review')
       OR COALESCE(s_rec.fields->>'verification_status', '') = 'Pending_Verification'
       OR (s_rec.fields->>'verification_status' IS NOT NULL AND s_rec.fields->>'verification_status' <> 'Approved') THEN
     RAISE EXCEPTION 'SUPPLIER_VERIFICATION_REQUIRED: Supplier is pending verification and cannot be used for production purchase orders';
    END IF;
   END IF;

   -- Fail-closed Part Release Gate on BOM update
   target_stage:=COALESCE(record_fields->>'stage', p_payload->>'stage', r.stage);
   IF (r.record_type IN ('Release','Production order','BOM','Mass production BOM') AND target_stage = 'released')
      OR r.record_type = 'Mass production BOM' THEN
    prt_ref:=NULLIF(trim(COALESCE(record_fields->>'part_id', record_fields->>'part', record_fields->>'partId', record_fields->>'mpn')), '');
    IF prt_ref IS NULL THEN
     RAISE EXCEPTION 'PART_REQUIRED: A valid component part must be specified for released BOMs';
    END IF;
    SELECT * INTO p_rec FROM operational_records prt
    WHERE prt.organization_id = org AND prt.record_type = 'Part' AND prt.archived_at IS NULL
      AND (prt.id::text = prt_ref OR prt.reference = prt_ref OR prt.fields->>'mpn' = prt_ref)
    LIMIT 1;
    IF NOT FOUND THEN
     RAISE EXCEPTION 'PART_NOT_FOUND: Referenced component part does not exist in operational records';
    END IF;
    IF p_rec.fields->>'release_status' = 'Engineering_Only'
       OR p_rec.status IN ('draft', 'in_review')
       OR COALESCE(p_rec.fields->>'release_status', '') = 'Engineering_Only'
       OR (p_rec.fields->>'release_status' IS NOT NULL AND p_rec.fields->>'release_status' <> 'Released') THEN
     RAISE EXCEPTION 'PART_RELEASE_REQUIRED: Part is engineering-only and cannot be released to mass production';
    END IF;
   END IF;

   UPDATE operational_records
   SET fields=record_fields,notes=COALESCE(p_payload->>'notes',notes),status='draft',updated_by=auth.uid()
   WHERE id=r.id;
   entity:=r.id;

  ELSIF p_action='request_approval' THEN
   IF NOT public.has_department_permission(org,r.department_id,'approvals:decide') THEN
    RAISE EXCEPTION 'REQUEST_AUTHORITY_DENIED';
   END IF;
   reviewer:=(p_payload->>'reviewer_department_id')::uuid;
   IF NOT EXISTS(SELECT 1 FROM departments WHERE id=reviewer AND organization_id=org AND active AND code<>'CLIENT') THEN
    RAISE EXCEPTION 'REVIEWER_DEPARTMENT_REQUIRED';
   END IF;
   IF EXISTS(SELECT 1 FROM approvals WHERE organization_id=org AND record_id=r.id AND reviewer_department_id=reviewer AND evidence_revision=r.fields->>'revision' AND outcome='pending') THEN
    RAISE EXCEPTION 'REVIEW_ALREADY_PENDING';
   END IF;

   -- Downstream gates check before requesting approval
   IF r.record_type IN ('Purchase order','Purchase Order','Mass production request') THEN
    sup_ref:=NULLIF(trim(COALESCE(r.fields->>'supplier_id', r.fields->>'supplier', r.fields->>'supplierId')), '');
    IF sup_ref IS NULL THEN
     RAISE EXCEPTION 'SUPPLIER_REQUIRED: A valid supplier must be specified for purchase orders';
    END IF;
    SELECT * INTO s_rec FROM operational_records sup
    WHERE sup.organization_id = org AND sup.record_type = 'Supplier' AND sup.archived_at IS NULL
      AND (sup.id::text = sup_ref OR sup.reference = sup_ref OR sup.title = sup_ref)
    LIMIT 1;
    IF NOT FOUND THEN
     RAISE EXCEPTION 'SUPPLIER_NOT_FOUND: Referenced supplier does not exist in operational records';
    END IF;
    IF s_rec.fields->>'verification_status' = 'Pending_Verification'
       OR s_rec.status IN ('draft', 'in_review')
       OR COALESCE(s_rec.fields->>'verification_status', '') = 'Pending_Verification'
       OR (s_rec.fields->>'verification_status' IS NOT NULL AND s_rec.fields->>'verification_status' <> 'Approved') THEN
     RAISE EXCEPTION 'SUPPLIER_VERIFICATION_REQUIRED: Supplier is pending verification and cannot be used for production purchase orders';
    END IF;
   END IF;

   INSERT INTO approvals(organization_id,department_id,reviewer_department_id,record_id,title,created_by,evidence_record_id,evidence_revision)
   VALUES(org,r.department_id,reviewer,r.id,'Review · '||r.reference,auth.uid(),r.id,r.fields->>'revision')
   RETURNING id INTO entity;
   UPDATE operational_records SET status='in_review',updated_by=auth.uid() WHERE id=r.id;

  ELSE
   INSERT INTO documents(organization_id,department_id,record_id,title,document_type,reference_url,created_by)
   VALUES(org,r.department_id,r.id,trim(p_payload->>'title'),COALESCE(NULLIF(p_payload->>'document_type',''),'Controlled document'),'private',auth.uid())
   RETURNING id INTO entity;
  END IF;

 ELSIF p_action='decide_approval' THEN
  SELECT * INTO p FROM approvals WHERE id=(p_payload->>'id')::uuid AND organization_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPROVAL_NOT_FOUND'; END IF;
  IF p.outcome<>'pending' THEN RAISE EXCEPTION 'DECISION_ALREADY_SAVED'; END IF;
  IF p.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN
   RAISE EXCEPTION 'STALE_WRITE: Reload before saving';
  END IF;
  IF NOT public.has_department_permission(org,COALESCE(p.reviewer_department_id,p.department_id),'approvals:decide') THEN
   RAISE EXCEPTION 'SIGNING_AUTHORITY_DENIED';
  END IF;
  IF p_payload->>'outcome' NOT IN ('approved','rejected','returned') OR p_payload->>'outcome' IS NULL THEN
   RAISE EXCEPTION 'INVALID_DECISION';
  END IF;
  UPDATE approvals
  SET outcome=(p_payload->>'outcome')::approval_outcome,
      approver_id=a.membership_id,
      decided_by=auth.uid(),
      decided_at=now(),
      decision_notes=COALESCE(p_payload->>'notes','')
  WHERE id=p.id;

  UPDATE operational_records
  SET status=CASE WHEN p_payload->>'outcome'='approved' AND NOT EXISTS(SELECT 1 FROM approvals WHERE record_id=p.record_id AND evidence_revision=p.evidence_revision AND outcome<>'approved') THEN 'approved'::portal_record_status ELSE 'in_review'::portal_record_status END,
      updated_by=auth.uid()
  WHERE id=p.record_id;
  entity:=p.id;

 ELSE
  RAISE EXCEPTION 'UNSUPPORTED_ACTION';
 END IF;

 INSERT INTO audit_events(organization_id,actor_id,entity_type,entity_id,action,detail)
 VALUES(org,auth.uid(),'shared_test_workspace',entity,p_action,jsonb_build_object('membership_id',a.membership_id,'department',a.department_code));

 result:=jsonb_build_object(
   'id',entity,
   'reference',COALESCE(p_payload->>'reference', r.reference, ''),
   'record_type',COALESCE(rec_type, r.record_type, ''),
   'action',p_action,
   'saved_at',now()
 );

 INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response)
 VALUES(org,auth.uid(),p_request_id,payload_hash,result);

 RETURN result;
END $$;

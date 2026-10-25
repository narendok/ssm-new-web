-- 20261025091500_harden_downstream_master_guards.sql
-- Forward migration: Hardened fail-closed downstream master transaction guards
-- Enforces:
-- 1. Capability-gated creation of master entities (Supplier, Part, Customer)
-- 2. Anti-tampering: Non-admin creation always enforces draft status (Pending_Verification, Engineering_Only)
-- 3. Fail-closed POSITIVE supplier verification gate on Purchase Orders and Mass Production Requests
--    (Rejects missing suppliers, non-existent supplier IDs, and any supplier NOT positively Approved)
-- 4. Fail-closed POSITIVE part release gate on Released BOMs and Mass Production Releases
--    (Rejects missing parts, non-existent part IDs/MPNs, and any part NOT positively Released)
-- 5. Consistent enforcement across create_record, update_record, and request_approval
-- 6. Canonical return payload including entity id, reference, and record_type

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

  -- Anti-tampering on creation: Non-admins cannot self-approve on creation
  IF rec_type = 'Supplier' AND a.role <> 'admin' THEN
   IF record_fields->>'verification_status' = 'Approved' THEN
    record_fields:=jsonb_set(record_fields, '{verification_status}', '"Pending_Verification"');
   END IF;
  END IF;
  IF rec_type = 'Part' AND a.role <> 'admin' THEN
   IF record_fields->>'release_status' = 'Released' THEN
    record_fields:=jsonb_set(record_fields, '{release_status}', '"Engineering_Only"');
   END IF;
  END IF;

  -- POSITIVE Fail-closed Supplier Gate for Purchase Orders and Mass Production Requests
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
   -- Positive check: Must be explicitly Approved
   IF NOT (s_rec.status = 'approved' OR COALESCE(s_rec.fields->>'verification_status', '') = 'Approved') THEN
    RAISE EXCEPTION 'SUPPLIER_VERIFICATION_REQUIRED: Supplier is pending verification and cannot be used for production purchase orders';
   END IF;
  END IF;

  -- POSITIVE Fail-closed Part Release Gate for Released BOMs and Production Releases
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
   -- Positive check: Must be explicitly Released or Approved
   IF NOT (p_rec.status IN ('released', 'approved') OR COALESCE(p_rec.fields->>'release_status', '') = 'Released') THEN
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

   -- Anti-tampering on update: Non-admins cannot self-approve or release
   IF r.record_type = 'Supplier' AND a.role <> 'admin' THEN
    IF record_fields->>'verification_status' = 'Approved' AND COALESCE(r.fields->>'verification_status', '') <> 'Approved' THEN
     RAISE EXCEPTION 'SUPPLIER_APPROVAL_DENIED: Only Admin or formal approval workflow can approve suppliers';
    END IF;
   END IF;
   IF r.record_type = 'Part' AND a.role <> 'admin' THEN
    IF record_fields->>'release_status' = 'Released' AND COALESCE(r.fields->>'release_status', '') <> 'Released' THEN
     RAISE EXCEPTION 'PART_RELEASE_DENIED: Only Admin or formal release workflow can release parts';
    END IF;
   END IF;

   -- POSITIVE Fail-closed Supplier Gate on PO update
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
    IF NOT (s_rec.status = 'approved' OR COALESCE(s_rec.fields->>'verification_status', '') = 'Approved') THEN
     RAISE EXCEPTION 'SUPPLIER_VERIFICATION_REQUIRED: Supplier is pending verification and cannot be used for production purchase orders';
    END IF;
   END IF;

   -- POSITIVE Fail-closed Part Release Gate on BOM update
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
    IF NOT (p_rec.status IN ('released', 'approved') OR COALESCE(p_rec.fields->>'release_status', '') = 'Released') THEN
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
    IF NOT (s_rec.status = 'approved' OR COALESCE(s_rec.fields->>'verification_status', '') = 'Approved') THEN
     RAISE EXCEPTION 'SUPPLIER_VERIFICATION_REQUIRED: Supplier is pending verification and cannot be used for production purchase orders';
    END IF;
   END IF;

   IF (r.record_type IN ('Release','Production order','BOM','Mass production BOM') AND COALESCE(r.fields->>'stage', r.stage) = 'released')
      OR r.record_type = 'Mass production BOM' THEN
    prt_ref:=NULLIF(trim(COALESCE(r.fields->>'part_id', r.fields->>'part', r.fields->>'partId', r.fields->>'mpn')), '');
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
    IF NOT (p_rec.status IN ('released', 'approved') OR COALESCE(p_rec.fields->>'release_status', '') = 'Released') THEN
     RAISE EXCEPTION 'PART_RELEASE_REQUIRED: Part is engineering-only and cannot be released to mass production';
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

  IF p_payload->>'outcome'='approved' AND NOT EXISTS(SELECT 1 FROM approvals WHERE record_id=p.record_id AND evidence_revision=p.evidence_revision AND outcome<>'approved') THEN
   UPDATE operational_records
   SET status=CASE WHEN record_type='Part' THEN 'released'::portal_record_status ELSE 'approved'::portal_record_status END,
       fields=CASE
         WHEN record_type='Supplier' THEN jsonb_set(fields, '{verification_status}', '"Approved"')
         WHEN record_type='Part' THEN jsonb_set(fields, '{release_status}', '"Released"')
         ELSE fields
       END,
       updated_by=auth.uid()
   WHERE id=p.record_id;
  ELSE
   UPDATE operational_records
   SET status=CASE WHEN p_payload->>'outcome'='rejected' THEN 'draft'::portal_record_status ELSE 'in_review'::portal_record_status END,
       updated_by=auth.uid()
   WHERE id=p.record_id;
  END IF;
  entity:=p.id;

 ELSIF p_action='sync_scenario_test_fixtures' THEN
  IF a.role<>'admin' THEN RAISE EXCEPTION 'FIXTURE_SYNC_DENIED: Admin authority required to sync scenario test fixtures'; END IF;
  result:=public.sync_scenario_test_fixtures(COALESCE(p_payload->>'p_run_id', p_payload->>'run_id', 'TEST-SCENARIO-RUN-001'));
  INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response)
  VALUES(org,auth.uid(),p_request_id,payload_hash,result);
  RETURN result;

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

-- §14.13 & §14.14 Connected TEST Fixture Manifest and Idempotent Synchronizer
CREATE TABLE IF NOT EXISTS public.scenario_fixture_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  run_id text NOT NULL,
  scenario_id text NOT NULL,
  fixture_key text NOT NULL,
  entity_type text NOT NULL,
  record_type text NOT NULL,
  canonical_id uuid NOT NULL,
  reference text NOT NULL,
  stage text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_scenario_manifest UNIQUE (organization_id, run_id, fixture_key, entity_type, reference)
);

ALTER TABLE public.scenario_fixture_manifests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scenario_fixture_manifests_read ON public.scenario_fixture_manifests;
CREATE POLICY scenario_fixture_manifests_read ON public.scenario_fixture_manifests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.organization_id = scenario_fixture_manifests.organization_id
      AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
  ));

REVOKE ALL ON public.scenario_fixture_manifests FROM PUBLIC,anon;
GRANT SELECT ON public.scenario_fixture_manifests TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_scenario_test_fixtures(p_run_id text DEFAULT 'TEST-SCENARIO-RUN-001')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  a record;
  org uuid;
  d_sal uuid;
  d_ehw uuid;
  d_fw uuid;
  d_mech uuid;
  d_pur uuid;
  d_qa uuid;
  d_emf uuid;
  d_rnd uuid;
  prj_s01 uuid;
  prj_s03 uuid;
  prj_s04 uuid;
  prj_s05 uuid;
  prj_s06 uuid;
  sup_vend uuid;
  sup_pend uuid;
  prt_mcu uuid;
  prt_eng uuid;
  rec_id uuid;
  doc_id uuid;
  manifest_count integer;
BEGIN
  SELECT * INTO a FROM resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.role = 'viewer' THEN
    RAISE EXCEPTION 'TEST_WRITE_DENIED';
  END IF;
  IF a.role <> 'admin' THEN RAISE EXCEPTION 'FIXTURE_ADMIN_REQUIRED'; END IF;
  IF p_run_id IS NULL OR p_run_id !~ '^TEST-[A-Za-z0-9_-]{1,80}$' THEN RAISE EXCEPTION 'INVALID_TEST_RUN_ID'; END IF;
  org := a.organization_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text, 42));

  IF EXISTS(SELECT 1 FROM public.scenario_fixture_manifests WHERE organization_id = org AND run_id = p_run_id) THEN
    RETURN jsonb_build_object(
      'run_id', p_run_id,
      'status', 'already_synced',
      'persisted_count', (SELECT count(*) FROM public.scenario_fixture_manifests WHERE organization_id = org AND run_id = p_run_id),
      'manifest', (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.scenario_id, m.entity_type, m.reference) FROM public.scenario_fixture_manifests m WHERE organization_id = org AND run_id = p_run_id)
    );
  END IF;

  SELECT id INTO d_sal FROM departments WHERE organization_id = org AND code = 'SAL' AND active;
  SELECT id INTO d_ehw FROM departments WHERE organization_id = org AND code = 'EHW' AND active;
  SELECT id INTO d_fw  FROM departments WHERE organization_id = org AND code = 'FW'  AND active;
  SELECT id INTO d_mech FROM departments WHERE organization_id = org AND code = 'MECH' AND active;
  SELECT id INTO d_pur FROM departments WHERE organization_id = org AND code = 'PUR' AND active;
  SELECT id INTO d_qa  FROM departments WHERE organization_id = org AND code = 'QA'  AND active;
  SELECT id INTO d_emf FROM departments WHERE organization_id = org AND code = 'EMF' AND active;
  SELECT id INTO d_rnd FROM departments WHERE organization_id = org AND code = 'RND' AND active;
  IF d_rnd IS NULL THEN d_rnd := d_ehw; END IF;

  -- Canonical Masters
  SELECT id INTO sup_vend FROM operational_records WHERE organization_id = org AND record_type = 'Supplier' AND reference = 'HLPL-SUP-VEND-01' AND archived_at IS NULL LIMIT 1;
  IF sup_vend IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_pur, 'pur', 'Supplier', 'HLPL-SUP-VEND-01', 'Texas Instruments India Pvt Ltd', 'approved',
           jsonb_build_object('name','Texas Instruments India Pvt Ltd','category','Semiconductors & ICs','verification_status','Approved','revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO sup_vend;
  END IF;

  SELECT id INTO sup_pend FROM operational_records WHERE organization_id = org AND record_type = 'Supplier' AND reference = 'HLPL-SUP-PEND-01' AND archived_at IS NULL LIMIT 1;
  IF sup_pend IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_pur, 'pur', 'Supplier', 'HLPL-SUP-PEND-01', 'Shenzhen FastTurn PCB Co', 'draft',
           jsonb_build_object('name','Shenzhen FastTurn PCB Co','category','PCB Fabrication','verification_status','Pending_Verification','revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO sup_pend;
  END IF;

  SELECT id INTO prt_mcu FROM operational_records WHERE organization_id = org AND record_type = 'Part' AND reference = 'HLPL-PRT-MCU-01' AND archived_at IS NULL LIMIT 1;
  IF prt_mcu IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_ehw, 'ehw', 'Part', 'HLPL-PRT-MCU-01', 'STM32F405RGT6 · Microcontroller', 'released',
           jsonb_build_object('mpn','STM32F405RGT6','description','Microcontroller ARM Cortex-M4 168MHz','release_status','Released','revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO prt_mcu;
  END IF;

  SELECT id INTO prt_eng FROM operational_records WHERE organization_id = org AND record_type = 'Part' AND reference = 'HLPL-PRT-ENG-01' AND archived_at IS NULL LIMIT 1;
  IF prt_eng IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_ehw, 'ehw', 'Part', 'HLPL-PRT-ENG-01', 'ESP32-S3-WROOM-1 · Wireless Module', 'draft',
           jsonb_build_object('mpn','ESP32-S3-WROOM-1','description','Wireless SoC Module','release_status','Engineering_Only','revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO prt_eng;
  END IF;

  -- S01: INTERNAL-JIG
  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_rnd, 'rnd', 'Project', 'TEST-JIG-01', 'TEST Internal Harness & EOL Jig', 'Stage 4', 'open',
         jsonb_build_object('customer','Internal Hexense Labs — Production Tooling','currentStage','Stage 4','revision','01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO prj_s01;
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S01', 'INTERNAL-JIG', 'project', 'Project', prj_s01, 'TEST-JIG-01', 'Stage 4');

  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_ehw, 'ehw', 'Schematic', 'HLPL-JIG-EHW-SCH-01', 'Harness 20-Pin Continuity Schematic', 'Stage 3', 'approved',
         jsonb_build_object('projectId', prj_s01::text, 'projectCode', 'TEST-JIG-01', 'revision', '01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
  VALUES(org, prj_s01, rec_id, 'deliverable', auth.uid());
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S01', 'INTERNAL-JIG', 'record', 'Schematic', rec_id, 'HLPL-JIG-EHW-SCH-01', 'Stage 3');

  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_mech, 'mech', 'CAD', 'HLPL-JIG-MECH-STP-01', 'Pogo-Pin Enclosure Clearance 3D STEP', 'Stage 4', 'in_review',
         jsonb_build_object('projectId', prj_s01::text, 'projectCode', 'TEST-JIG-01', 'revision', '01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
  VALUES(org, prj_s01, rec_id, 'deliverable', auth.uid());
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S01', 'INTERNAL-JIG', 'record', 'CAD', rec_id, 'HLPL-JIG-MECH-STP-01', 'Stage 4');

  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_fw, 'fw', 'Program', 'HLPL-JIG-TE-PRG-01', 'Automated EOL Flashing Script', 'Stage 4', 'draft',
         jsonb_build_object('projectId', prj_s01::text, 'projectCode', 'TEST-JIG-01', 'revision', '01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
  VALUES(org, prj_s01, rec_id, 'deliverable', auth.uid());
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S01', 'INTERNAL-JIG', 'record', 'Program', rec_id, 'HLPL-JIG-TE-PRG-01', 'Stage 4');

  INSERT INTO documents(organization_id, department_id, record_id, title, document_type, reference_url, created_by)
  VALUES(org, d_mech, prj_s01, 'EOL Jig Mechanical Assembly Drawing', 'Drawing', 'private', auth.uid())
  RETURNING id INTO doc_id;
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S01', 'INTERNAL-JIG', 'document', 'Drawing', doc_id, 'DOC-JIG-MECH-DWG', 'Stage 4');

  -- S02: DECLINED-ENQUIRY (Strictly NO project created per §14.14 S02 Invariant)
  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_sal, 'sales', 'Enquiry', 'ENQ-2026-EXT-01', 'TEST Extended-Temperature Tracker Enquiry', 'Stage 1', 'archived',
         jsonb_build_object('customer','Nordic Fleet Logistics AB','targetWindow','6 Weeks','outcome','Declined','terminalReason','Arrow 14-week lead-time exceeds customer 6-week window','revision','01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S02', 'DECLINED-ENQUIRY', 'record', 'Enquiry', rec_id, 'ENQ-2026-EXT-01', 'Stage 1');

  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_pur, 'pur', 'Contract review', 'HLPL-EXT-PUR-FEAS-01', 'Automotive Cold-Temp Component Sourcing Feasibility', 'Stage 1', 'archived',
         jsonb_build_object('supplier','Arrow Electronics','leadTimeWeeks','14','constraintWeeks','6','outcome','Rejected','revision','01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S02', 'DECLINED-ENQUIRY', 'record', 'Contract review', rec_id, 'HLPL-EXT-PUR-FEAS-01', 'Stage 1');

  -- S03: CLIENT-POC
  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_sal, 'sales', 'Project', 'TEST-POC-01', 'TEST Fleet OBD Tracker PoC', 'Stage 2', 'open',
         jsonb_build_object('customer','Metro Transit Authority','currentStage','Stage 2','revision','01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO prj_s03;
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S03', 'CLIENT-POC', 'project', 'Project', prj_s03, 'TEST-POC-01', 'Stage 2');

  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_ehw, 'ehw', 'PRS', 'HLPL-POC-PRS-01', 'OBD Tracker System Requirements Specification', 'Stage 2', 'approved',
         jsonb_build_object('projectId', prj_s03::text, 'projectCode', 'TEST-POC-01', 'revision', '01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
  VALUES(org, prj_s03, rec_id, 'deliverable', auth.uid());
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S03', 'CLIENT-POC', 'record', 'PRS', rec_id, 'HLPL-POC-PRS-01', 'Stage 2');

  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_ehw, 'ehw', 'BOM', 'HLPL-POC-BOM-01', 'PoC Prototype Bill of Materials (Tentative)', 'Stage 2', 'draft',
         jsonb_build_object('projectId', prj_s03::text, 'projectCode', 'TEST-POC-01', 'stage', 'tentative', 'revision', '01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
  VALUES(org, prj_s03, rec_id, 'deliverable', auth.uid());
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S03', 'CLIENT-POC', 'record', 'BOM', rec_id, 'HLPL-POC-BOM-01', 'Stage 2');

  -- S04: SYSTEM-PILOT
  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_sal, 'sales', 'Project', 'TEST-PLT-01', 'TEST Vehicle Gateway Integration Pilot', 'Stage 3', 'open',
         jsonb_build_object('customer','Apex Commercial Logistics','currentStage','Stage 3','revision','01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO prj_s04;
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S04', 'SYSTEM-PILOT', 'project', 'Project', prj_s04, 'TEST-PLT-01', 'Stage 3');

  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_fw, 'fw', 'HSI register', 'HLPL-PLT-FW-HSI-01', 'Hardware-Software Interface Register v0.4', 'Stage 3', 'approved',
         jsonb_build_object('projectId', prj_s04::text, 'projectCode', 'TEST-PLT-01', 'revision', '01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
  VALUES(org, prj_s04, rec_id, 'deliverable', auth.uid());
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S04', 'SYSTEM-PILOT', 'record', 'HSI register', rec_id, 'HLPL-PLT-FW-HSI-01', 'Stage 3');

  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_fw, 'fw', 'Firmware release', 'HLPL-PLT-FW-REL-01', 'Pilot Candidate Firmware v0.9.1-rc2', 'Stage 3', 'approved',
         jsonb_build_object('projectId', prj_s04::text, 'projectCode', 'TEST-PLT-01', 'revision', '01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
  VALUES(org, prj_s04, rec_id, 'deliverable', auth.uid());
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S04', 'SYSTEM-PILOT', 'record', 'Firmware release', rec_id, 'HLPL-PLT-FW-REL-01', 'Stage 3');

  -- S05: PILOT-REFINEMENT
  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_sal, 'sales', 'Project', 'TEST-REG-01', 'TEST Cold-Chain Tracker Pilot Refinement', 'Stage 4', 'open',
         jsonb_build_object('customer','BioPharma ColdStream Global','currentStage','Stage 4','revision','01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO prj_s05;
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S05', 'PILOT-REFINEMENT', 'project', 'Project', prj_s05, 'TEST-REG-01', 'Stage 4');

  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_ehw, 'ehw', 'Engineering change', 'HLPL-REG-EHW-ECN-01', 'ECN: Temperature Sensor Alert Duplication Patch', 'Stage 4', 'in_review',
         jsonb_build_object('projectId', prj_s05::text, 'projectCode', 'TEST-REG-01', 'revision', '01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
  VALUES(org, prj_s05, rec_id, 'deliverable', auth.uid());
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S05', 'PILOT-REFINEMENT', 'record', 'Engineering change', rec_id, 'HLPL-REG-EHW-ECN-01', 'Stage 4');

  -- S06: BULK-PRODUCTION (§14.14 Invariant: 150 accepted + 5 held + 45 inspection = 200 lot 1; 300 remaining planned)
  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_sal, 'sales', 'Project', 'TEST-RFT-01', 'TEST Rugged Fleet Tracker Production', 'Stage 5', 'open',
         jsonb_build_object('customer','Titan Haulage International','currentStage','Stage 5','revision','01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO prj_s06;
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'BULK-PRODUCTION', 'project', 'Project', prj_s06, 'TEST-RFT-01', 'Stage 5');

  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_pur, 'pur', 'BOM', 'HLPL-RFT-PUR-BOM-01', 'Rugged Fleet Tracker Released Production BOM', 'released', 'released',
         jsonb_build_object('projectId', prj_s06::text, 'projectCode', 'TEST-RFT-01', 'stage', 'released', 'part', prt_mcu::text, 'revision', '01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
  VALUES(org, prj_s06, rec_id, 'deliverable', auth.uid());
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'BULK-PRODUCTION', 'record', 'BOM', rec_id, 'HLPL-RFT-PUR-BOM-01', 'released');

  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_pur, 'pur', 'Purchase order', 'HLPL-RFT-PUR-PO-01', 'Component Batch Order for 200 Lot 1 Trackers', 'Stage 5', 'approved',
         jsonb_build_object('projectId', prj_s06::text, 'projectCode', 'TEST-RFT-01', 'supplier', sup_vend::text, 'quantity', '200', 'revision', '01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
  VALUES(org, prj_s06, rec_id, 'deliverable', auth.uid());
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'BULK-PRODUCTION', 'record', 'Purchase order', rec_id, 'HLPL-RFT-PUR-PO-01', 'Stage 5');

  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_emf, 'emf', 'Production order', 'HLPL-RFT-EMF-ORD-01', 'First 200-Unit Production Lot Dispatch', 'Stage 5', 'approved',
         jsonb_build_object('projectId', prj_s06::text, 'projectCode', 'TEST-RFT-01', 'totalPlannedUnits', 500, 'lotQuantity', 200, 'remainingPlannedUnits', 300, 'revision', '01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
  VALUES(org, prj_s06, rec_id, 'deliverable', auth.uid());
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'BULK-PRODUCTION', 'record', 'Production order', rec_id, 'HLPL-RFT-EMF-ORD-01', 'Stage 5');

  INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
  VALUES(org, d_qa, 'qa', 'Inspection', 'HLPL-RFT-QA-IQC-01', 'First Lot IQC Batch Disposition Matrix', 'Stage 5', 'in_review',
         jsonb_build_object('projectId', prj_s06::text, 'projectCode', 'TEST-RFT-01',
                            'totalPlannedUnits', 500, 'lotQuantity', 200, 'acceptedUnits', 150, 'heldUnits', 5,
                            'pendingInspectionUnits', 45, 'remainingPlannedUnits', 300, 'reconciliationCheckPassed', true, 'revision', '01'),
         true, auth.uid(), auth.uid())
  RETURNING id INTO rec_id;
  INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
  VALUES(org, prj_s06, rec_id, 'deliverable', auth.uid());
  INSERT INTO scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'BULK-PRODUCTION', 'record', 'Inspection', rec_id, 'HLPL-RFT-QA-IQC-01', 'Stage 5');

  SELECT count(*) INTO manifest_count FROM public.scenario_fixture_manifests WHERE organization_id = org AND run_id = p_run_id;

  RETURN jsonb_build_object(
    'run_id', p_run_id,
    'status', 'created',
    'persisted_count', manifest_count,
    'manifest', (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.scenario_id, m.entity_type, m.reference) FROM public.scenario_fixture_manifests m WHERE organization_id = org AND run_id = p_run_id)
  );
END $$;

REVOKE ALL ON FUNCTION public.sync_scenario_test_fixtures(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_scenario_test_fixtures(text) TO authenticated;

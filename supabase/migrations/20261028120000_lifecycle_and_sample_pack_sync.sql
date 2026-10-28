-- 20261028120000_lifecycle_and_sample_pack_sync.sql
-- Forward migration: Canonical Lifecycle Server-Side Persistence & Atomic Sample Pack Synchronizer
-- Authority: ANTIGRAVITY_READY_TO_USE_CONSOLIDATED_HANDOFF_2026-10-21.md §16.10 - §16.12

-- 1. Additive columns on tasks for stage tracking, custom tasks, order, and cancellation audit
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS stage_code text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 1;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- 2. Canonical Sample Pack Synchronizer (LC2-2026-10-28)
CREATE OR REPLACE FUNCTION public.sync_canonical_sample_pack(p_run_id text DEFAULT 'LC2-2026-10-28')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  a record;
  org uuid;
  d_sal uuid;
  d_ehw uuid;
  d_fw uuid;
  d_sw uuid;
  d_mech uuid;
  d_pur uuid;
  d_qa uuid;
  d_emf uuid;
  d_sit uuid;
  d_rnd uuid;
  p_id uuid;
  enq_id uuid;
  manifest_count integer;
BEGIN
  SELECT * INTO a FROM resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.role = 'viewer' THEN
    RAISE EXCEPTION 'TEST_WRITE_DENIED';
  END IF;
  IF a.role NOT IN ('admin', 'department_lead') THEN
    RAISE EXCEPTION 'FIXTURE_ADMIN_REQUIRED: Admin or Department Lead authority required to sync sample pack';
  END IF;
  IF p_run_id IS NULL OR p_run_id !~ '^[A-Za-z0-9_-]{1,80}$' THEN
    RAISE EXCEPTION 'INVALID_RUN_ID';
  END IF;

  org := a.organization_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text, 88));

  -- Completeness verification: if manifest rows exist, verify that all 9 entities exist in operational_records
  SELECT count(*) INTO manifest_count FROM public.scenario_fixture_manifests WHERE organization_id = org AND run_id = p_run_id;
  IF manifest_count >= 9 THEN
    IF (SELECT count(*) FROM public.operational_records WHERE organization_id = org AND archived_at IS NULL AND reference IN (
      'PRJ-INT-001', 'ENQ-DECL-001', 'PRJ-POC-001', 'PRJ-GW-001', 'PRJ-CC-001',
      'PRJ-PROD-001', 'PRJ-APP-001', 'PRJ-RM-001', 'PRJ-UPG-001'
    )) = 9 THEN
      RETURN jsonb_build_object(
        'run_id', p_run_id,
        'status', 'already_synced',
        'persisted_count', manifest_count,
        'manifest', (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.fixture_key, m.entity_type, m.reference) FROM public.scenario_fixture_manifests m WHERE organization_id = org AND run_id = p_run_id)
      );
    END IF;
  END IF;

  SELECT id INTO d_sal FROM departments WHERE organization_id = org AND code = 'SAL' AND active;
  SELECT id INTO d_ehw FROM departments WHERE organization_id = org AND code = 'EHW' AND active;
  SELECT id INTO d_fw  FROM departments WHERE organization_id = org AND code = 'FW'  AND active;
  SELECT id INTO d_sw  FROM departments WHERE organization_id = org AND code = 'SW'  AND active;
  SELECT id INTO d_mech FROM departments WHERE organization_id = org AND code = 'MECH' AND active;
  SELECT id INTO d_pur FROM departments WHERE organization_id = org AND code = 'PUR' AND active;
  SELECT id INTO d_qa  FROM departments WHERE organization_id = org AND code = 'QA'  AND active;
  SELECT id INTO d_emf FROM departments WHERE organization_id = org AND code = 'EMF' AND active;
  SELECT id INTO d_sit FROM departments WHERE organization_id = org AND code = 'SIT' AND active;
  SELECT id INTO d_rnd FROM departments WHERE organization_id = org AND code = 'RND' AND active;
  IF d_rnd IS NULL THEN d_rnd := d_ehw; END IF;

  -- LC2-P01: Internal Equipment Harness Jig (PRJ-INT-001, HW only)
  SELECT id INTO p_id FROM operational_records WHERE organization_id = org AND record_type = 'Project' AND reference = 'PRJ-INT-001' AND archived_at IS NULL;
  IF p_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_ehw, 'ehw', 'Project', 'PRJ-INT-001', 'Internal Equipment Harness Jig', 'HW_31', 'open',
           jsonb_build_object('customer','Internal Manufacturing & Assembly','track','hardware_only','currentStage','HW_31','revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO p_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S01', 'LC2-P01', 'project', 'Project', p_id, 'PRJ-INT-001', 'HW_31')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = p_id;

  -- LC2-E02: Declined Enquiry (ENQ-DECL-001, NO PROJECT CREATED)
  SELECT id INTO enq_id FROM operational_records WHERE organization_id = org AND record_type = 'Enquiry' AND reference = 'ENQ-DECL-001' AND archived_at IS NULL;
  IF enq_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_sal, 'sal', 'Enquiry', 'ENQ-DECL-001', 'Extended-Temperature (-40°C) Fleet Tracker Enquiry', 'CM_02', 'draft',
           jsonb_build_object('customer','Nordic Fleet Logistics AB','declined',true,'declineReason','14-week distributor lead time for required military-grade power IC','revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO enq_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S02', 'LC2-E02', 'enquiry', 'Enquiry', enq_id, 'ENQ-DECL-001', 'CM_02')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = enq_id;

  -- LC2-P03: Fleet OBD Tracker PoC (PRJ-POC-001, HW + FW)
  SELECT id INTO p_id FROM operational_records WHERE organization_id = org AND record_type = 'Project' AND reference = 'PRJ-POC-001' AND archived_at IS NULL;
  IF p_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_sal, 'sal', 'Project', 'PRJ-POC-001', 'Fleet OBD Tracker PoC (10 units)', 'INT_03', 'open',
           jsonb_build_object('customer','Metro Cab Consortium','track','hardware_firmware','currentStage','INT_03','pocUnits','10','revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO p_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S03', 'LC2-P03', 'project', 'Project', p_id, 'PRJ-POC-001', 'INT_03')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = p_id;

  -- LC2-P04: Vehicle Gateway Integration Pilot (PRJ-GW-001, HW + FW + SW)
  SELECT id INTO p_id FROM operational_records WHERE organization_id = org AND record_type = 'Project' AND reference = 'PRJ-GW-001' AND archived_at IS NULL;
  IF p_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_sal, 'sal', 'Project', 'PRJ-GW-001', 'Commercial Vehicle Gateway Pilot', 'INT_03', 'open',
           jsonb_build_object('customer','Apex Logistics Solutions','track','hardware_firmware_software','currentStage','INT_03','pilotUnits','25','revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO p_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S04', 'LC2-P04', 'project', 'Project', p_id, 'PRJ-GW-001', 'INT_03')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = p_id;

  -- LC2-P05: Cold-Chain Tracker Refinement (PRJ-CC-001, FW only on existing HW)
  SELECT id INTO p_id FROM operational_records WHERE organization_id = org AND record_type = 'Project' AND reference = 'PRJ-CC-001' AND archived_at IS NULL;
  IF p_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_fw, 'fw', 'Project', 'PRJ-CC-001', 'Cold-Chain Tracker Firmware Refinement', 'FW_11', 'open',
           jsonb_build_object('customer','PharmaCold Express Ltd','track','firmware_only','currentStage','FW_11','revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO p_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S05', 'LC2-P05', 'project', 'Project', p_id, 'PRJ-CC-001', 'FW_11')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = p_id;

  -- LC2-P06: Rugged Fleet Tracker Production (PRJ-PROD-001, HW + FW, 500 planned, Lot 1 = 200 = 150 accepted + 5 held + 45 inspecting; 300 remaining)
  SELECT id INTO p_id FROM operational_records WHERE organization_id = org AND record_type = 'Project' AND reference = 'PRJ-PROD-001' AND archived_at IS NULL;
  IF p_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_sal, 'sal', 'Project', 'PRJ-PROD-001', 'Rugged Fleet Tracker Bulk Production', 'CL_01', 'open',
           jsonb_build_object('customer','Bharat Heavy Logistics Ltd','track','hardware_firmware','currentStage','CL_01','totalPlannedUnits',500,'lotQuantity',200,'acceptedUnits',150,'heldUnits',5,'pendingInspectionUnits',45,'remainingPlannedUnits',300,'revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO p_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'LC2-P06', 'project', 'Project', p_id, 'PRJ-PROD-001', 'CL_01')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = p_id;

  -- LC2-P07: Internal Service Application (PRJ-APP-001, SW only)
  SELECT id INTO p_id FROM operational_records WHERE organization_id = org AND record_type = 'Project' AND reference = 'PRJ-APP-001' AND archived_at IS NULL;
  IF p_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_sw, 'sw', 'Project', 'PRJ-APP-001', 'Internal Service Diagnostics Portal', 'SW_08', 'open',
           jsonb_build_object('customer','Hexense Internal IT & Service','track','software_only','currentStage','SW_08','revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO p_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S07', 'LC2-P07', 'project', 'Project', p_id, 'PRJ-APP-001', 'SW_08')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = p_id;

  -- LC2-P08: Existing Product Deployment (PRJ-RM-001, Ready-made catalog device)
  SELECT id INTO p_id FROM operational_records WHERE organization_id = org AND record_type = 'Project' AND reference = 'PRJ-RM-001' AND archived_at IS NULL;
  IF p_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_sit, 'sit', 'Project', 'PRJ-RM-001', 'Commercial Catalog OBD Tracker Rollout', 'RM_03', 'open',
           jsonb_build_object('customer','City Delivery Express','track','ready_made','currentStage','RM_03','catalogDevice','HLPL-OBD4-01','revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO p_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S08', 'LC2-P08', 'project', 'Project', p_id, 'PRJ-RM-001', 'RM_03')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = p_id;

  -- LC2-P09: Device Connectivity Upgrade (PRJ-UPG-001, FW + SW on existing HW)
  SELECT id INTO p_id FROM operational_records WHERE organization_id = org AND record_type = 'Project' AND reference = 'PRJ-UPG-001' AND archived_at IS NULL;
  IF p_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_fw, 'fw', 'Project', 'PRJ-UPG-001', 'Telematics Payload Compression Upgrade', 'INT_02', 'open',
           jsonb_build_object('customer','FastCargo Logistics','track','firmware_software_existing_hardware','currentStage','INT_02','revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO p_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S09', 'LC2-P09', 'project', 'Project', p_id, 'PRJ-UPG-001', 'INT_02')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = p_id;

  SELECT count(*) INTO manifest_count FROM public.scenario_fixture_manifests WHERE organization_id = org AND run_id = p_run_id;

  RETURN jsonb_build_object(
    'run_id', p_run_id,
    'status', 'synced_new',
    'persisted_count', manifest_count,
    'manifest', (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.fixture_key, m.entity_type, m.reference) FROM public.scenario_fixture_manifests m WHERE organization_id = org AND run_id = p_run_id)
  );
END $$;

REVOKE ALL ON FUNCTION public.sync_canonical_sample_pack(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_canonical_sample_pack(text) TO authenticated;

-- 3. Extend public.mutate_shared_test_workspace with Lifecycle & Custom Task Actions
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

 IF p_action IN ('create_project','create_record','create_task','create_custom_task','create_document') AND NULLIF(trim(p_payload->>'title'),'') IS NULL THEN
  RAISE EXCEPTION 'TITLE_REQUIRED';
 END IF;

 rec_type:=trim(COALESCE(p_payload->>'record_type',''));

 IF p_action IN ('create_task', 'create_custom_task') THEN
  project:=(p_payload->>'project_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL) THEN
   RAISE EXCEPTION 'PROJECT_REQUIRED';
  END IF;
  IF a.role='admin' THEN dept:=NULLIF(p_payload->>'department_id','')::uuid; END IF;
  IF dept IS NULL THEN dept:=private.shared_test_member_department(a.membership_id); END IF;
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
  VALUES(org,dept,'sales','Project',p_payload->>'reference',trim(p_payload->>'title'),'CM_01',jsonb_build_object('revision','01'),COALESCE(p_payload->>'notes',''),auth.uid(),auth.uid(),true)
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
   IF NOT (s_rec.status = 'approved' OR COALESCE(s_rec.fields->>'verification_status', '') = 'Approved') THEN
    RAISE EXCEPTION 'SUPPLIER_VERIFICATION_REQUIRED: Supplier is pending verification and cannot be used for production purchase orders';
   END IF;
  END IF;

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

 ELSIF p_action='create_custom_task' THEN
  IF a.role NOT IN ('admin', 'department_lead') THEN
   RAISE EXCEPTION 'CUSTOM_TASK_CREATE_DENIED: Only Admin or Department Lead can create custom tasks';
  END IF;
  assignee:=NULLIF(p_payload->>'assignee_id','')::uuid;
  IF assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM organization_members WHERE id=assignee AND organization_id=org AND active AND role<>'viewer' AND private.shared_test_member_department(id)=dept) THEN
   RAISE EXCEPTION 'ASSIGNEE_DEPARTMENT_MISMATCH';
  END IF;
  IF COALESCE(p_payload->>'priority','Normal') NOT IN ('Critical','High','Normal','Low') THEN
   RAISE EXCEPTION 'INVALID_TASK_PRIORITY';
  END IF;
  INSERT INTO tasks(organization_id,department_id,record_id,title,assignee_id,due_at,priority,stage_code,is_custom,order_index,created_by)
  VALUES(org,dept,project,trim(p_payload->>'title'),assignee,NULLIF(p_payload->>'due_at','')::timestamptz,COALESCE(p_payload->>'priority','Normal'),COALESCE(p_payload->>'stage_code',''),true,COALESCE((p_payload->>'order_index')::integer, 99),auth.uid())
  RETURNING id INTO entity;

 ELSIF p_action='update_task' THEN
  SELECT * INTO t FROM tasks WHERE id=(p_payload->>'id')::uuid AND organization_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_FOUND'; END IF;
  IF p_payload ? 'expected_updated_at' AND t.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN
   RAISE EXCEPTION 'STALE_WRITE: Reload before saving';
  END IF;
  IF a.role<>'admin' AND NOT (a.role='department_lead' AND t.department_id=dept) AND NOT (a.role='member' AND t.assignee_id=a.membership_id) THEN
   RAISE EXCEPTION 'TASK_WRITE_DENIED';
  END IF;
  IF p_payload ? 'status' THEN
   IF p_payload->>'status' NOT IN ('Open','In Progress','In review','Complete','cancelled') OR p_payload->>'status' IS NULL THEN
    RAISE EXCEPTION 'INVALID_TASK_STATUS';
   END IF;
   IF t.status='In review' AND p_payload->>'status'='Complete' THEN
    RAISE EXCEPTION 'USE_LINKED_REVIEW_RECORD';
   END IF;
  END IF;
  assignee:=t.assignee_id;
  IF p_payload ? 'assignee_id' THEN
   IF a.role<>'department_lead' AND a.role<>'admin' THEN RAISE EXCEPTION 'TASK_ASSIGNMENT_DENIED'; END IF;
   assignee:=NULLIF(p_payload->>'assignee_id','')::uuid;
   IF assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM organization_members WHERE id=assignee AND organization_id=org AND active AND role<>'viewer' AND private.shared_test_member_department(id)=t.department_id) THEN
    RAISE EXCEPTION 'ASSIGNEE_DEPARTMENT_MISMATCH';
   END IF;
  END IF;
  UPDATE tasks
  SET status=COALESCE(p_payload->>'status', status),
      assignee_id=assignee,
      title=COALESCE(NULLIF(trim(p_payload->>'title'),''), title),
      priority=COALESCE(NULLIF(p_payload->>'priority',''), priority),
      order_index=COALESCE((p_payload->>'order_index')::integer, order_index),
      updated_at=now()
  WHERE id=t.id;
  entity:=t.id;

 ELSIF p_action='cancel_task' THEN
  SELECT * INTO t FROM tasks WHERE id=(p_payload->>'id')::uuid AND organization_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_FOUND'; END IF;
  IF a.role<>'admin' AND NOT (a.role='department_lead' AND t.department_id=dept) THEN
   RAISE EXCEPTION 'TASK_WRITE_DENIED';
  END IF;
  UPDATE tasks
  SET status='cancelled',
      cancellation_reason=trim(COALESCE(p_payload->>'reason', 'Cancelled by user')),
      cancelled_at=now(),
      updated_at=now()
  WHERE id=t.id;
  entity:=t.id;

 ELSIF p_action='delete_task' THEN
  SELECT * INTO t FROM tasks WHERE id=(p_payload->>'id')::uuid AND organization_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_FOUND'; END IF;
  IF a.role<>'admin' AND NOT (a.role='department_lead' AND t.department_id=dept) THEN
   RAISE EXCEPTION 'TASK_WRITE_DENIED';
  END IF;
  IF NOT t.is_custom THEN
   RAISE EXCEPTION 'DEFAULT_TEMPLATE_TASK_CANNOT_BE_DELETED: Cancel the task instead';
  END IF;
  IF t.status IN ('In Progress', 'In review', 'Complete') THEN
   RAISE EXCEPTION 'TASK_IN_USE_CANNOT_DELETE: Tasks with progress must be cancelled with an audit reason';
  END IF;
  IF t.assignee_id IS NOT NULL THEN
   RAISE EXCEPTION 'TASK_ASSIGNED_CANNOT_DELETE: Assigned tasks must be cancelled with an audit reason';
  END IF;
  DELETE FROM tasks WHERE id=t.id;
  entity:=t.id;

 ELSIF p_action='advance_stage' THEN
  project:=(p_payload->>'project_id')::uuid;
  SELECT * INTO r FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF a.role<>'admin' AND a.role<>'department_lead' THEN
   RAISE EXCEPTION 'STAGE_ADVANCE_DENIED';
  END IF;
  target_stage:=trim(p_payload->>'target_stage');
  IF target_stage IS NULL OR target_stage = '' THEN
   RAISE EXCEPTION 'TARGET_STAGE_REQUIRED';
  END IF;
  UPDATE operational_records
  SET stage=target_stage,
      fields=jsonb_set(
        COALESCE(fields,'{}'::jsonb),
        '{currentStage}',
        to_jsonb(target_stage)
      ) || jsonb_build_object(
        'lastStageTransitionAt', now(),
        'lastStageTransitionBy', auth.uid(),
        'stageRemark', COALESCE(p_payload->>'notes', '')
      ),
      updated_at=now(),
      updated_by=auth.uid()
  WHERE id=r.id;
  entity:=r.id;

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

   IF r.record_type = 'Supplier' AND a.role <> 'admin' THEN
    IF record_fields->>'verification_status' = 'Approved' AND COALESCE(r.fields->>'verification_status', '') <> 'Approved' THEN
     RAISE EXCEPTION 'SUPPLIER_APPROVAL_DENIED: Only Admin or formal approval workflow can approve suppliers';
    END IF;
   END IF;
   IF r.record_type = 'Part' AND a.role <> 'admin' THEN
    IF record_fields->>'release_status' = 'Released' AND COALESCE(r.fields->>'release_status', '') <> 'Released' THEN
     RAISE EXCEPTION 'PART_RELEASE_DENIED: Only Admin or formal approval workflow can release parts';
    END IF;
   END IF;

   IF r.record_type IN ('Purchase order','Purchase Order','Mass production request') THEN
    sup_ref:=NULLIF(trim(COALESCE(record_fields->>'supplier_id', record_fields->>'supplier', record_fields->>'supplierId')), '');
    IF sup_ref IS NOT NULL THEN
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
   END IF;

   target_stage:=COALESCE(record_fields->>'stage', p_payload->>'stage');
   IF (r.record_type IN ('Release','Production order','BOM','Mass production BOM') AND target_stage = 'released')
      OR r.record_type = 'Mass production BOM' THEN
    prt_ref:=NULLIF(trim(COALESCE(record_fields->>'part_id', record_fields->>'part', record_fields->>'partId', record_fields->>'mpn')), '');
    IF prt_ref IS NOT NULL THEN
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
   END IF;

   UPDATE operational_records
   SET fields=record_fields,notes=COALESCE(p_payload->>'notes',r.notes),updated_at=now(),updated_by=auth.uid()
   WHERE id=r.id;
   entity:=r.id;

  ELSIF p_action='request_approval' THEN
   reviewer:=NULLIF(p_payload->>'reviewer_department_id','')::uuid;
   IF reviewer IS NULL OR NOT EXISTS(SELECT 1 FROM departments WHERE id=reviewer AND organization_id=org AND active) THEN
    RAISE EXCEPTION 'REVIEWER_DEPARTMENT_REQUIRED';
   END IF;
   IF a.role<>'admin' AND reviewer=r.department_id THEN
    RAISE EXCEPTION 'CROSS_DEPARTMENT_REVIEW_REQUIRED';
   END IF;
   IF r.record_type IN ('Purchase order','Purchase Order','Mass production request') THEN
    sup_ref:=NULLIF(trim(COALESCE(r.fields->>'supplier_id', r.fields->>'supplier', r.fields->>'supplierId')), '');
    IF sup_ref IS NOT NULL THEN
     SELECT * INTO s_rec FROM operational_records sup
     WHERE sup.organization_id = org AND sup.record_type = 'Supplier' AND sup.archived_at IS NULL
       AND (sup.id::text = sup_ref OR sup.reference = sup_ref OR sup.title = sup_ref)
     LIMIT 1;
     IF NOT FOUND OR NOT (s_rec.status = 'approved' OR COALESCE(s_rec.fields->>'verification_status', '') = 'Approved') THEN
      RAISE EXCEPTION 'SUPPLIER_VERIFICATION_REQUIRED: Cannot request approval with unapproved supplier';
     END IF;
    END IF;
   END IF;
   IF (r.record_type IN ('Release','Production order','BOM','Mass production BOM') AND r.fields->>'stage' = 'released')
      OR r.record_type = 'Mass production BOM' THEN
    prt_ref:=NULLIF(trim(COALESCE(r.fields->>'part_id', r.fields->>'part', r.fields->>'partId', r.fields->>'mpn')), '');
    IF prt_ref IS NOT NULL THEN
     SELECT * INTO p_rec FROM operational_records prt
     WHERE prt.organization_id = org AND prt.record_type = 'Part' AND prt.archived_at IS NULL
       AND (prt.id::text = prt_ref OR prt.reference = prt_ref OR prt.fields->>'mpn' = prt_ref)
     LIMIT 1;
     IF NOT FOUND OR NOT (p_rec.status IN ('released', 'approved') OR COALESCE(p_rec.fields->>'release_status', '') = 'Released') THEN
      RAISE EXCEPTION 'PART_RELEASE_REQUIRED: Cannot request approval for unreleased component part';
     END IF;
    END IF;
   END IF;
   INSERT INTO approvals(organization_id,department_id,record_id,reviewer_department_id,title,outcome,evidence_revision,created_by)
   VALUES(org,r.department_id,r.id,reviewer,'Review '||r.title,'pending',r.fields->>'revision',auth.uid())
   RETURNING id INTO entity;
   UPDATE operational_records SET status='in_review',updated_at=now(),updated_by=auth.uid() WHERE id=r.id;

  ELSIF p_action='create_document' THEN
   INSERT INTO documents(organization_id,department_id,record_id,title,document_type,file_path,file_size,mime_type,created_by)
   VALUES(org,r.department_id,r.id,trim(p_payload->>'title'),trim(COALESCE(p_payload->>'document_type','Document')),COALESCE(p_payload->>'file_path','vault/'||gen_random_uuid()),COALESCE((p_payload->>'file_size')::bigint,0),COALESCE(p_payload->>'mime_type','application/octet-stream'),auth.uid())
   RETURNING id INTO entity;
  END IF;

 ELSIF p_action='decide_approval' THEN
  SELECT * INTO p FROM approvals WHERE id=(p_payload->>'id')::uuid AND organization_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPROVAL_NOT_FOUND'; END IF;
  IF p.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN
   RAISE EXCEPTION 'STALE_WRITE: Reload before saving';
  END IF;
  IF a.role<>'admin' AND (dept IS NULL OR dept<>p.reviewer_department_id) THEN
   RAISE EXCEPTION 'SIGNING_AUTHORITY_DENIED';
  END IF;
  IF p.outcome<>'pending' THEN RAISE EXCEPTION 'ALREADY_DECIDED'; END IF;
  IF p_payload->>'outcome' NOT IN ('approved','rejected','returned') THEN
   RAISE EXCEPTION 'INVALID_DECISION';
  END IF;
  UPDATE approvals
  SET outcome=(p_payload->>'outcome')::approval_outcome,
      decision_notes=COALESCE(p_payload->>'notes',''),
      decided_by=auth.uid(),
      decided_at=now(),
      updated_at=now()
  WHERE id=p.id;
  IF p_payload->>'outcome'='approved' THEN
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

 ELSIF p_action='sync_canonical_sample_pack' THEN
  IF a.role NOT IN ('admin', 'department_lead') THEN
   RAISE EXCEPTION 'FIXTURE_ADMIN_REQUIRED: Admin or Department Lead authority required';
  END IF;
  result:=public.sync_canonical_sample_pack(COALESCE(p_payload->>'p_run_id', 'LC2-2026-10-28'));
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

REVOKE ALL ON FUNCTION public.mutate_shared_test_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_shared_test_workspace(text,jsonb,uuid) TO authenticated;

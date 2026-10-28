-- 20261028120000_lifecycle_and_sample_pack_sync.sql
-- Forward migration: Canonical Lifecycle Server-Side Persistence, Guard Hardening, and Atomic Sample Pack Synchronizer
-- Authority: ANTIGRAVITY_READY_TO_USE_CONSOLIDATED_HANDOFF_2026-10-21.md §16.10 - §16.12

-- 1. Additive columns on tasks for stage tracking, custom tasks, order, and cancellation audit
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS stage_code text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 1;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- 2. Canonical Stage Validation Helper
CREATE OR REPLACE FUNCTION public.is_valid_canonical_stage(p_stage text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(COALESCE(p_stage, '')) IN (
    'CM_01','CM_02','CM_03','CM_04',
    'HW_01','HW_02','HW_03','HW_04','HW_05','HW_06','HW_07','HW_08','HW_09','HW_10',
    'HW_11','HW_12','HW_13','HW_14','HW_15','HW_16','HW_17','HW_18','HW_19','HW_20',
    'HW_21','HW_22','HW_23','HW_24','HW_25','HW_26','HW_27','HW_28','HW_29','HW_30',
    'HW_31','HW_32','HW_33','HW_34','HW_35','HW_36','HW_37',
    'FW_01','FW_02','FW_03','FW_04','FW_05','FW_06','FW_07','FW_08','FW_09','FW_10','FW_11','FW_12',
    'SW_01','SW_02','SW_03','SW_04','SW_05','SW_06','SW_07','SW_08','SW_09','SW_10',
    'MECH_01','MECH_02','MECH_03','MECH_04','MECH_05','MECH_06','MECH_07','MECH_08','MECH_09','MECH_10','MECH_11','MECH_12','MECH_13','MECH_14',
    'RM_01','RM_02','RM_03',
    'INT_01','INT_02','INT_03',
    'CL_01','CL_02','CL_03','CL_04',
    'Stage 1','Stage 2','Stage 3','Stage 4','Stage 5','Stage 6','Stage 7','Stage 8','Stage 9'
  );
$$;

-- 3. Canonical Sample Pack Synchronizer (LC2-2026-10-28)
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
  rec_id uuid;
  doc_id uuid;
  task_id uuid;
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

  -- Completeness verification: if manifest rows exist, verify that all 9 top-level projects/enquiries and tasks exist
  SELECT count(*) INTO manifest_count FROM public.scenario_fixture_manifests WHERE organization_id = org AND run_id = p_run_id;
  IF manifest_count >= 30 THEN
    IF (SELECT count(*) FROM public.operational_records WHERE organization_id = org AND archived_at IS NULL AND reference IN (
      'PRJ-INT-001', 'ENQ-DECL-001', 'PRJ-POC-001', 'PRJ-GW-001', 'PRJ-CC-001',
      'PRJ-PROD-001', 'PRJ-APP-001', 'PRJ-RM-001', 'PRJ-UPG-001'
    )) = 9 AND (SELECT count(*) FROM public.tasks WHERE organization_id = org AND stage_code IS NOT NULL) >= 12 THEN
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

  -- =========================================================================
  -- LC2-P01: Internal Equipment Harness Jig (PRJ-INT-001, HW only, HW_31)
  -- =========================================================================
  SELECT id INTO p_id FROM operational_records WHERE organization_id = org AND record_type = 'Project' AND reference = 'PRJ-INT-001' AND archived_at IS NULL;
  IF p_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_ehw, 'ehw', 'Project', 'PRJ-INT-001', 'Internal Harness & EOL Test Jig', 'HW_31', 'open',
           jsonb_build_object('customer','Internal Hexense Labs — Plant Tooling Division','track','hardware_only','currentStage','HW_31','revision','01','scope','Internal'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO p_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S01', 'LC2-P01', 'project', 'Project', p_id, 'PRJ-INT-001', 'HW_31')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = p_id;

  -- Connected records for P01: Schematic, BOM, GRN
  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-JIG-EHW-SCH-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_ehw, 'ehw', 'Schematic', 'HLPL-JIG-EHW-SCH-01', 'Harness 20-Pin Continuity & Pogo Jig Schematic', 'HW_18', 'approved',
           jsonb_build_object('projectId','PRJ-INT-001','revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S01', 'LC2-P01', 'record', 'Schematic', rec_id, 'HLPL-JIG-EHW-SCH-01', 'HW_18')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-JIG-EHW-BOM-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_ehw, 'ehw', 'BOM', 'HLPL-JIG-EHW-BOM-01', 'Tentative Test Jig Hardware BOM', 'HW_19', 'approved',
           jsonb_build_object('projectId','PRJ-INT-001','revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S01', 'LC2-P01', 'record', 'BOM', rec_id, 'HLPL-JIG-EHW-BOM-01', 'HW_19')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-JIG-EMF-GRN-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_emf, 'emf', 'GRN', 'HLPL-JIG-EMF-GRN-01', 'Outsourced PCBA Receipt & QA Inspection Note', 'HW_30', 'approved',
           jsonb_build_object('projectId','PRJ-INT-001','revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S01', 'LC2-P01', 'record', 'GRN', rec_id, 'HLPL-JIG-EMF-GRN-01', 'HW_30')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  -- Connected document for P01
  SELECT id INTO doc_id FROM documents WHERE organization_id = org AND record_id = p_id AND title = 'EOL Test Jig Pogo-Pin Fixture Drawing';
  IF doc_id IS NULL THEN
    INSERT INTO documents(organization_id, department_id, record_id, title, document_type, reference_url, visibility, created_by)
    VALUES(org, d_ehw, p_id, 'EOL Test Jig Pogo-Pin Fixture Drawing', 'Drawing', 'vault/PRJ-INT-001-DWG-01.pdf', 'internal', auth.uid())
    RETURNING id INTO doc_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S01', 'LC2-P01', 'document', 'Drawing', doc_id, 'DOC-P01-DWG', 'HW_31')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = doc_id;

  -- Connected tasks for P01: HW_31 tasks
  SELECT id INTO task_id FROM tasks WHERE organization_id = org AND record_id = p_id AND title = 'Outsourced PCBA incoming QA inspection & serial logging';
  IF task_id IS NULL THEN
    INSERT INTO tasks(organization_id, department_id, record_id, title, status, priority, stage_code, order_index, is_custom, created_by)
    VALUES(org, d_emf, p_id, 'Outsourced PCBA incoming QA inspection & serial logging', 'Complete', 'Normal', 'HW_31', 1, false, auth.uid())
    RETURNING id INTO task_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S01', 'LC2-P01', 'task', 'Task', task_id, 'TASK-P01-01', 'HW_31')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = task_id;

  SELECT id INTO task_id FROM tasks WHERE organization_id = org AND record_id = p_id AND title = 'Current-limited bench power bring-up & thermal camera scan';
  IF task_id IS NULL THEN
    INSERT INTO tasks(organization_id, department_id, record_id, title, status, priority, stage_code, order_index, is_custom, created_by)
    VALUES(org, d_ehw, p_id, 'Current-limited bench power bring-up & thermal camera scan', 'In Progress', 'Critical', 'HW_31', 2, false, auth.uid())
    RETURNING id INTO task_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S01', 'LC2-P01', 'task', 'Task', task_id, 'TASK-P01-02', 'HW_31')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = task_id;

  -- =========================================================================
  -- LC2-E02: Declined Enquiry (ENQ-DECL-001, terminal, NO PROJECT CREATED)
  -- =========================================================================
  SELECT id INTO enq_id FROM operational_records WHERE organization_id = org AND record_type = 'Enquiry' AND reference = 'ENQ-DECL-001' AND archived_at IS NULL;
  IF enq_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_sal, 'sal', 'Enquiry', 'ENQ-DECL-001', 'Extended-Temperature (-40°C) Fleet Tracker Enquiry', 'CM_02', 'draft',
           jsonb_build_object('customer','Nordic Fleet Logistics AB','declined',true,'declineReason','14-week distributor lead time for required military-grade power IC exceeds 6-week window','revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO enq_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S02', 'LC2-E02', 'enquiry', 'Enquiry', enq_id, 'ENQ-DECL-001', 'CM_02')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = enq_id;

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-EXT-PUR-FEAS-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_pur, 'pur', 'Contract review', 'HLPL-EXT-PUR-FEAS-01', 'Extended-Temperature SCM Component Feasibility Review', 'CM_02', 'archived',
           jsonb_build_object('linkedRecords','ENQ-DECL-001','supplier','Arrow Electronics','leadTimeWeeks',14,'decision','Declined by Sales & Purchasing Leads','revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, enq_id, rec_id, 'feasibility', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S02', 'LC2-E02', 'record', 'Contract review', rec_id, 'HLPL-EXT-PUR-FEAS-01', 'CM_02')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO doc_id FROM documents WHERE organization_id = org AND record_id = enq_id AND title = 'Commercial Declination Notice';
  IF doc_id IS NULL THEN
    INSERT INTO documents(organization_id, department_id, record_id, title, document_type, reference_url, visibility, created_by)
    VALUES(org, d_sal, enq_id, 'Commercial Declination Notice', 'Notice', 'vault/ENQ-DECL-001-NOTICE.pdf', 'internal', auth.uid())
    RETURNING id INTO doc_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S02', 'LC2-E02', 'document', 'Notice', doc_id, 'DOC-E02-NOT', 'CM_02')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = doc_id;

  -- =========================================================================
  -- LC2-P03: Fleet OBD Tracker PoC (PRJ-POC-001, HW + FW, INT_03)
  -- =========================================================================
  SELECT id INTO p_id FROM operational_records WHERE organization_id = org AND record_type = 'Project' AND reference = 'PRJ-POC-001' AND archived_at IS NULL;
  IF p_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_sal, 'sal', 'Project', 'PRJ-POC-001', 'Fleet OBD Tracker PoC (10 units)', 'INT_03', 'open',
           jsonb_build_object('customer','Tata Motors Limited · EV Fleet Division','track','hardware_firmware','currentStage','INT_03','pocUnits',10,'revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO p_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S03', 'LC2-P03', 'project', 'Project', p_id, 'PRJ-POC-001', 'INT_03')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = p_id;

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-POC-EHW-PRS-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_ehw, 'ehw', 'PRS', 'HLPL-POC-EHW-PRS-01', 'Product Requirement Specification · OBD Tracker PoC', 'HW_02', 'approved',
           jsonb_build_object('projectId','PRJ-POC-001','revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S03', 'LC2-P03', 'record', 'PRS', rec_id, 'HLPL-POC-EHW-PRS-01', 'HW_02')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-POC-EMF-PRT-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_emf, 'emf', 'Prototype', 'HLPL-POC-EMF-PRT-01', '10-Unit Prototype Lot Build Record', 'HW_28', 'approved',
           jsonb_build_object('projectId','PRJ-POC-001','quantity',10,'revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S03', 'LC2-P03', 'record', 'Prototype', rec_id, 'HLPL-POC-EMF-PRT-01', 'HW_28')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO doc_id FROM documents WHERE organization_id = org AND record_id = p_id AND title = 'PoC Field Trial Protocol & Debounce Clarification';
  IF doc_id IS NULL THEN
    INSERT INTO documents(organization_id, department_id, record_id, title, document_type, reference_url, visibility, created_by)
    VALUES(org, d_sal, p_id, 'PoC Field Trial Protocol & Debounce Clarification', 'Protocol', 'vault/PRJ-POC-001-PROTO.pdf', 'internal', auth.uid())
    RETURNING id INTO doc_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S03', 'LC2-P03', 'document', 'Protocol', doc_id, 'DOC-P03-PROTO', 'INT_03')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = doc_id;

  SELECT id INTO task_id FROM tasks WHERE organization_id = org AND record_id = p_id AND title = 'Deliver 10 prototype units to client vehicle testing depot';
  IF task_id IS NULL THEN
    INSERT INTO tasks(organization_id, department_id, record_id, title, status, priority, stage_code, order_index, is_custom, created_by)
    VALUES(org, d_sal, p_id, 'Deliver 10 prototype units to client vehicle testing depot', 'Complete', 'Normal', 'INT_03', 1, false, auth.uid())
    RETURNING id INTO task_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S03', 'LC2-P03', 'task', 'Task', task_id, 'TASK-P03-01', 'INT_03')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = task_id;

  SELECT id INTO task_id FROM tasks WHERE organization_id = org AND record_id = p_id AND title = 'Collect client debounce filter trial feedback (50ms vs 200ms)';
  IF task_id IS NULL THEN
    INSERT INTO tasks(organization_id, department_id, record_id, title, status, priority, stage_code, order_index, is_custom, created_by)
    VALUES(org, d_fw, p_id, 'Collect client debounce filter trial feedback (50ms vs 200ms)', 'In Progress', 'High', 'INT_03', 2, false, auth.uid())
    RETURNING id INTO task_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S03', 'LC2-P03', 'task', 'Task', task_id, 'TASK-P03-02', 'INT_03')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = task_id;

  -- =========================================================================
  -- LC2-P04: Vehicle Gateway Integration Pilot (PRJ-GW-001, HW+FW+SW, INT_03)
  -- =========================================================================
  SELECT id INTO p_id FROM operational_records WHERE organization_id = org AND record_type = 'Project' AND reference = 'PRJ-GW-001' AND archived_at IS NULL;
  IF p_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_sal, 'sal', 'Project', 'PRJ-GW-001', 'Commercial Vehicle Gateway Pilot', 'INT_03', 'open',
           jsonb_build_object('customer','Apex Logistics Solutions','track','hardware_firmware_software','currentStage','INT_03','pilotUnits',25,'revision','01'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO p_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S04', 'LC2-P04', 'project', 'Project', p_id, 'PRJ-GW-001', 'INT_03')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = p_id;

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-GW-ESW-SRS-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_ehw, 'ehw', 'SRS', 'HLPL-GW-ESW-SRS-01', 'System Requirement Specification · Dual-CAN Telematics Gateway', 'SW_02', 'approved',
           jsonb_build_object('projectId','PRJ-GW-001','revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S04', 'LC2-P04', 'record', 'SRS', rec_id, 'HLPL-GW-ESW-SRS-01', 'SW_02')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO doc_id FROM documents WHERE organization_id = org AND record_id = p_id AND title = 'Commercial Vehicle Gateway 30-Day Pilot Log';
  IF doc_id IS NULL THEN
    INSERT INTO documents(organization_id, department_id, record_id, title, document_type, reference_url, visibility, created_by)
    VALUES(org, d_qa, p_id, 'Commercial Vehicle Gateway 30-Day Pilot Log', 'Log', 'vault/PRJ-GW-001-LOG.pdf', 'internal', auth.uid())
    RETURNING id INTO doc_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S04', 'LC2-P04', 'document', 'Log', doc_id, 'DOC-P04-LOG', 'INT_03')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = doc_id;

  SELECT id INTO task_id FROM tasks WHERE organization_id = org AND record_id = p_id AND title = 'Commission 25 trial units in trial commercial vehicles';
  IF task_id IS NULL THEN
    INSERT INTO tasks(organization_id, department_id, record_id, title, status, priority, stage_code, order_index, is_custom, created_by)
    VALUES(org, d_qa, p_id, 'Commission 25 trial units in trial commercial vehicles', 'Complete', 'Normal', 'INT_03', 1, false, auth.uid())
    RETURNING id INTO task_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S04', 'LC2-P04', 'task', 'Task', task_id, 'TASK-P04-01', 'INT_03')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = task_id;

  SELECT id INTO task_id FROM tasks WHERE organization_id = org AND record_id = p_id AND title = 'Monitor daily fleet telematics telemetry ingestion & fault log';
  IF task_id IS NULL THEN
    INSERT INTO tasks(organization_id, department_id, record_id, title, status, priority, stage_code, order_index, is_custom, created_by)
    VALUES(org, d_sit, p_id, 'Monitor daily fleet telematics telemetry ingestion & fault log', 'In Progress', 'Normal', 'INT_03', 2, false, auth.uid())
    RETURNING id INTO task_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S04', 'LC2-P04', 'task', 'Task', task_id, 'TASK-P04-02', 'INT_03')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = task_id;

  -- =========================================================================
  -- LC2-P05: Cold-Chain Tracker Refinement (PRJ-CC-001, FW only, FW_11)
  -- =========================================================================
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

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-CC-FW-REL-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_fw, 'fw', 'Firmware release', 'HLPL-CC-FW-REL-01', 'Firmware v2.1.2 Handover Reconnect Patch Candidate', 'FW_11', 'open',
           jsonb_build_object('projectId','PRJ-CC-001','version','2.1.2','revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S05', 'LC2-P05', 'record', 'Firmware release', rec_id, 'HLPL-CC-FW-REL-01', 'FW_11')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO doc_id FROM documents WHERE organization_id = org AND record_id = p_id AND title = 'Cell Handover Bug Report & Patch Verification Plan';
  IF doc_id IS NULL THEN
    INSERT INTO documents(organization_id, department_id, record_id, title, document_type, reference_url, visibility, created_by)
    VALUES(org, d_qa, p_id, 'Cell Handover Bug Report & Patch Verification Plan', 'Report', 'vault/PRJ-CC-001-BUG.pdf', 'internal', auth.uid())
    RETURNING id INTO doc_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S05', 'LC2-P05', 'document', 'Report', doc_id, 'DOC-P05-BUG', 'FW_11')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = doc_id;

  SELECT id INTO task_id FROM tasks WHERE organization_id = org AND record_id = p_id AND title = 'Prepare cell handover disconnect debounce patch v2.1.2';
  IF task_id IS NULL THEN
    INSERT INTO tasks(organization_id, department_id, record_id, title, status, priority, stage_code, order_index, is_custom, created_by)
    VALUES(org, d_fw, p_id, 'Prepare cell handover disconnect debounce patch v2.1.2', 'In Progress', 'High', 'FW_11', 1, false, auth.uid())
    RETURNING id INTO task_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S05', 'LC2-P05', 'task', 'Task', task_id, 'TASK-P05-01', 'FW_11')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = task_id;

  -- =========================================================================
  -- LC2-P06: Rugged Fleet Tracker Bulk Production (PRJ-PROD-001, HW+FW, CL_01)
  -- 500 planned, Lot 1 = 200 = 150 accepted + 5 held + 45 inspecting; 300 remaining
  -- =========================================================================
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

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-PROD-PUR-BOM-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_pur, 'pur', 'BOM', 'HLPL-PROD-PUR-BOM-01', 'Production Sourced BOM · Rugged Fleet Tracker', 'CL_01', 'approved',
           jsonb_build_object('projectId','PRJ-PROD-001','revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'LC2-P06', 'record', 'BOM', rec_id, 'HLPL-PROD-PUR-BOM-01', 'CL_01')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-PROD-EMF-WO-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_emf, 'emf', 'Production order', 'HLPL-PROD-EMF-WO-01', 'Mass Production Work Order · Lot 1 (200 units)', 'CL_01', 'open',
           jsonb_build_object('projectId','PRJ-PROD-001','lotQuantity',200,'revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'LC2-P06', 'record', 'Production order', rec_id, 'HLPL-PROD-EMF-WO-01', 'CL_01')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-PROD-QA-INSP-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_qa, 'qa', 'Inspection', 'HLPL-PROD-QA-INSP-01', 'Lot 1 EOL & AOI Inspection Certificate (150 Accepted)', 'CL_01', 'approved',
           jsonb_build_object('projectId','PRJ-PROD-001','acceptedUnits',150,'revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'LC2-P06', 'record', 'Inspection', rec_id, 'HLPL-PROD-QA-INSP-01', 'CL_01')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-PROD-QA-MRB-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_qa, 'qa', 'NCR', 'HLPL-PROD-QA-MRB-01', 'MRB Quarantine & Hold Notice · 5 Units Cold Solder', 'CL_01', 'open',
           jsonb_build_object('projectId','PRJ-PROD-001','heldUnits',5,'revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'LC2-P06', 'record', 'NCR', rec_id, 'HLPL-PROD-QA-MRB-01', 'CL_01')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-PROD-FIN-INV-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_sal, 'sal', 'Invoice', 'HLPL-PROD-FIN-INV-01', 'Commercial Tax Invoice · 150 Accepted Lot Units', 'CL_01', 'open',
           jsonb_build_object('projectId','PRJ-PROD-001','invoicedUnits',150,'revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'LC2-P06', 'record', 'Invoice', rec_id, 'HLPL-PROD-FIN-INV-01', 'CL_01')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO doc_id FROM documents WHERE organization_id = org AND record_id = p_id AND title = 'Rugged Fleet Tracker EOL Test Report & CoC';
  IF doc_id IS NULL THEN
    INSERT INTO documents(organization_id, department_id, record_id, title, document_type, reference_url, visibility, created_by)
    VALUES(org, d_qa, p_id, 'Rugged Fleet Tracker EOL Test Report & CoC', 'Certificate', 'vault/PRJ-PROD-001-COC.pdf', 'internal', auth.uid())
    RETURNING id INTO doc_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'LC2-P06', 'document', 'Certificate', doc_id, 'DOC-P06-COC', 'CL_01')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = doc_id;

  SELECT id INTO task_id FROM tasks WHERE organization_id = org AND record_id = p_id AND title = 'Release 150 inspected and accepted units to dispatch staging';
  IF task_id IS NULL THEN
    INSERT INTO tasks(organization_id, department_id, record_id, title, status, priority, stage_code, order_index, is_custom, created_by)
    VALUES(org, d_qa, p_id, 'Release 150 inspected and accepted units to dispatch staging', 'Complete', 'Normal', 'CL_01', 1, false, auth.uid())
    RETURNING id INTO task_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'LC2-P06', 'task', 'Task', task_id, 'TASK-P06-01', 'CL_01')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = task_id;

  SELECT id INTO task_id FROM tasks WHERE organization_id = org AND record_id = p_id AND title = 'Material Review Board disposition for 5 held units (cold solder)';
  IF task_id IS NULL THEN
    INSERT INTO tasks(organization_id, department_id, record_id, title, status, priority, stage_code, order_index, is_custom, created_by)
    VALUES(org, d_qa, p_id, 'Material Review Board disposition for 5 held units (cold solder)', 'In Progress', 'Critical', 'CL_01', 2, false, auth.uid())
    RETURNING id INTO task_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'LC2-P06', 'task', 'Task', task_id, 'TASK-P06-02', 'CL_01')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = task_id;

  SELECT id INTO task_id FROM tasks WHERE organization_id = org AND record_id = p_id AND title = 'Generate GST e-way bill & commercial tax invoice for Lot 1';
  IF task_id IS NULL THEN
    INSERT INTO tasks(organization_id, department_id, record_id, title, status, priority, stage_code, order_index, is_custom, created_by)
    VALUES(org, d_sal, p_id, 'Generate GST e-way bill & commercial tax invoice for Lot 1', 'Open', 'High', 'CL_01', 3, false, auth.uid())
    RETURNING id INTO task_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S06', 'LC2-P06', 'task', 'Task', task_id, 'TASK-P06-03', 'CL_01')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = task_id;

  -- =========================================================================
  -- LC2-P07: Internal Service Application (PRJ-APP-001, SW only, SW_08)
  -- =========================================================================
  SELECT id INTO p_id FROM operational_records WHERE organization_id = org AND record_type = 'Project' AND reference = 'PRJ-APP-001' AND archived_at IS NULL;
  IF p_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_sw, 'sw', 'Project', 'PRJ-APP-001', 'Internal Service Diagnostics Portal', 'SW_08', 'open',
           jsonb_build_object('customer','Hexense Internal IT & Service','track','software_only','currentStage','SW_08','revision','01','scope','Internal'),
           true, auth.uid(), auth.uid())
    RETURNING id INTO p_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S07', 'LC2-P07', 'project', 'Project', p_id, 'PRJ-APP-001', 'SW_08')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = p_id;

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-APP-SW-SPEC-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_sw, 'sw', 'SRS', 'HLPL-APP-SW-SPEC-01', 'Internal Service Diagnostics Architecture Spec', 'SW_02', 'approved',
           jsonb_build_object('projectId','PRJ-APP-001','revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S07', 'LC2-P07', 'record', 'SRS', rec_id, 'HLPL-APP-SW-SPEC-01', 'SW_02')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO doc_id FROM documents WHERE organization_id = org AND record_id = p_id AND title = 'Internal Service Diagnostics API Specification';
  IF doc_id IS NULL THEN
    INSERT INTO documents(organization_id, department_id, record_id, title, document_type, reference_url, visibility, created_by)
    VALUES(org, d_sw, p_id, 'Internal Service Diagnostics API Specification', 'Specification', 'vault/PRJ-APP-001-SPEC.pdf', 'internal', auth.uid())
    RETURNING id INTO doc_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S07', 'LC2-P07', 'document', 'Specification', doc_id, 'DOC-P07-SPEC', 'SW_08')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = doc_id;

  SELECT id INTO task_id FROM tasks WHERE organization_id = org AND record_id = p_id AND title = 'Deploy staging service diagnostics container to internal cluster';
  IF task_id IS NULL THEN
    INSERT INTO tasks(organization_id, department_id, record_id, title, status, priority, stage_code, order_index, is_custom, created_by)
    VALUES(org, d_sw, p_id, 'Deploy staging service diagnostics container to internal cluster', 'In Progress', 'High', 'SW_08', 1, false, auth.uid())
    RETURNING id INTO task_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S07', 'LC2-P07', 'task', 'Task', task_id, 'TASK-P07-01', 'SW_08')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = task_id;

  -- =========================================================================
  -- LC2-P08: Commercial Catalog Product Deployment (PRJ-RM-001, Ready-made, RM_03)
  -- =========================================================================
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

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-RM-PUR-PO-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_pur, 'pur', 'Purchase order', 'HLPL-RM-PUR-PO-01', 'Catalog OBD Tracker Sourcing PO (500 units)', 'RM_02', 'approved',
           jsonb_build_object('projectId','PRJ-RM-001','supplier','Queclink Wireless','quantity',500,'revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S08', 'LC2-P08', 'record', 'Purchase order', rec_id, 'HLPL-RM-PUR-PO-01', 'RM_02')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO doc_id FROM documents WHERE organization_id = org AND record_id = p_id AND title = 'Catalog Device Deployment Guide & Warranty Card';
  IF doc_id IS NULL THEN
    INSERT INTO documents(organization_id, department_id, record_id, title, document_type, reference_url, visibility, created_by)
    VALUES(org, d_sit, p_id, 'Catalog Device Deployment Guide & Warranty Card', 'Guide', 'vault/PRJ-RM-001-GUIDE.pdf', 'internal', auth.uid())
    RETURNING id INTO doc_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S08', 'LC2-P08', 'document', 'Guide', doc_id, 'DOC-P08-GUIDE', 'RM_03')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = doc_id;

  SELECT id INTO task_id FROM tasks WHERE organization_id = org AND record_id = p_id AND title = 'Conduct customer site installation & APN network verification';
  IF task_id IS NULL THEN
    INSERT INTO tasks(organization_id, department_id, record_id, title, status, priority, stage_code, order_index, is_custom, created_by)
    VALUES(org, d_sit, p_id, 'Conduct customer site installation & APN network verification', 'In Progress', 'Normal', 'RM_03', 1, false, auth.uid())
    RETURNING id INTO task_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S08', 'LC2-P08', 'task', 'Task', task_id, 'TASK-P08-01', 'RM_03')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = task_id;

  -- =========================================================================
  -- LC2-P09: Device Connectivity Upgrade (PRJ-UPG-001, FW+SW, INT_02)
  -- =========================================================================
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

  SELECT id INTO rec_id FROM operational_records WHERE organization_id = org AND reference = 'HLPL-UPG-FW-SPEC-01' AND archived_at IS NULL;
  IF rec_id IS NULL THEN
    INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, stage, status, fields, is_demo, created_by, updated_by)
    VALUES(org, d_fw, 'fw', 'SRS', 'HLPL-UPG-FW-SPEC-01', 'Payload Compression & Differential FOTA Protocol', 'FW_02', 'approved',
           jsonb_build_object('projectId','PRJ-UPG-001','revision','01'), true, auth.uid(), auth.uid())
    RETURNING id INTO rec_id;
    INSERT INTO record_links(organization_id, source_record_id, target_record_id, relationship, created_by)
    VALUES(org, p_id, rec_id, 'deliverable', auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S09', 'LC2-P09', 'record', 'SRS', rec_id, 'HLPL-UPG-FW-SPEC-01', 'FW_02')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = rec_id;

  SELECT id INTO doc_id FROM documents WHERE organization_id = org AND record_id = p_id AND title = 'Payload Compression Protocol & FOTA Plan';
  IF doc_id IS NULL THEN
    INSERT INTO documents(organization_id, department_id, record_id, title, document_type, reference_url, visibility, created_by)
    VALUES(org, d_fw, p_id, 'Payload Compression Protocol & FOTA Plan', 'Protocol', 'vault/PRJ-UPG-001-FOTA.pdf', 'internal', auth.uid())
    RETURNING id INTO doc_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S09', 'LC2-P09', 'document', 'Protocol', doc_id, 'DOC-P09-FOTA', 'INT_02')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = doc_id;

  SELECT id INTO task_id FROM tasks WHERE organization_id = org AND record_id = p_id AND title = 'Verify compressed payload decompression on staging ingestion broker';
  IF task_id IS NULL THEN
    INSERT INTO tasks(organization_id, department_id, record_id, title, status, priority, stage_code, order_index, is_custom, created_by)
    VALUES(org, d_sw, p_id, 'Verify compressed payload decompression on staging ingestion broker', 'In Progress', 'Normal', 'INT_02', 1, false, auth.uid())
    RETURNING id INTO task_id;
  END IF;
  INSERT INTO public.scenario_fixture_manifests(organization_id, run_id, scenario_id, fixture_key, entity_type, record_type, canonical_id, reference, stage)
  VALUES(org, p_run_id, 'S09', 'LC2-P09', 'task', 'Task', task_id, 'TASK-P09-01', 'INT_02')
  ON CONFLICT (organization_id, run_id, fixture_key, entity_type, reference) DO UPDATE SET canonical_id = task_id;

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

-- 4. Extend public.mutate_shared_test_workspace with Lifecycle, Custom Task Actions, and Hardened Master Guards
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
 custom_stage text;
 cancel_reason text;
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

  -- FAIL-CLOSED Supplier Verification Gate on PO creation
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

  -- FAIL-CLOSED Part Release Gate on BOM creation
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
  custom_stage:=trim(COALESCE(p_payload->>'stage_code',''));
  IF custom_stage <> '' AND NOT public.is_valid_canonical_stage(custom_stage) THEN
   RAISE EXCEPTION 'INVALID_STAGE_CODE: Task stage % is not a valid canonical stage', custom_stage;
  END IF;
  INSERT INTO tasks(organization_id,department_id,record_id,title,assignee_id,due_at,priority,stage_code,created_by)
  VALUES(org,dept,project,trim(p_payload->>'title'),assignee,NULLIF(p_payload->>'due_at','')::timestamptz,COALESCE(p_payload->>'priority','Normal'),NULLIF(custom_stage,''),auth.uid())
  RETURNING id INTO entity;

 ELSIF p_action='create_custom_task' THEN
  IF a.role NOT IN ('admin', 'department_lead') THEN
   RAISE EXCEPTION 'CUSTOM_TASK_CREATE_DENIED: Only Admin or Department Lead can create custom tasks';
  END IF;
  custom_stage:=trim(COALESCE(p_payload->>'stage_code',''));
  IF custom_stage = '' OR NOT public.is_valid_canonical_stage(custom_stage) THEN
   RAISE EXCEPTION 'INVALID_STAGE_CODE: Custom task stage % is not a valid canonical stage', custom_stage;
  END IF;
  assignee:=NULLIF(p_payload->>'assignee_id','')::uuid;
  IF assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM organization_members WHERE id=assignee AND organization_id=org AND active AND role<>'viewer' AND private.shared_test_member_department(id)=dept) THEN
   RAISE EXCEPTION 'ASSIGNEE_DEPARTMENT_MISMATCH';
  END IF;
  IF COALESCE(p_payload->>'priority','Normal') NOT IN ('Critical','High','Normal','Low') THEN
   RAISE EXCEPTION 'INVALID_TASK_PRIORITY';
  END IF;
  INSERT INTO tasks(organization_id,department_id,record_id,title,assignee_id,due_at,priority,stage_code,is_custom,order_index,created_by)
  VALUES(org,dept,project,trim(p_payload->>'title'),assignee,NULLIF(p_payload->>'due_at','')::timestamptz,COALESCE(p_payload->>'priority','Normal'),custom_stage,true,COALESCE((p_payload->>'order_index')::integer, 99),auth.uid())
  RETURNING id INTO entity;

 ELSIF p_action='update_task' THEN
  SELECT * INTO t FROM tasks WHERE id=(p_payload->>'id')::uuid AND organization_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_FOUND'; END IF;
  IF NULLIF(trim(p_payload->>'expected_updated_at'),'') IS NULL THEN
   RAISE EXCEPTION 'EXPECTED_UPDATED_AT_REQUIRED: Expected updated_at is required for concurrency control';
  END IF;
  IF t.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN
   RAISE EXCEPTION 'STALE_WRITE: Reload before saving';
  END IF;
  IF a.role<>'admin' AND NOT (a.role='department_lead' AND t.department_id=dept) AND NOT (a.role='member' AND t.assignee_id=a.membership_id) THEN
   RAISE EXCEPTION 'TASK_WRITE_DENIED';
  END IF;
  IF p_payload ? 'status' THEN
   IF p_payload->>'status' NOT IN ('Open','In Progress','In review','Complete','cancelled','Cancelled') OR p_payload->>'status' IS NULL THEN
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
  IF NULLIF(trim(p_payload->>'expected_updated_at'),'') IS NULL THEN
   RAISE EXCEPTION 'EXPECTED_UPDATED_AT_REQUIRED: Expected updated_at is required for concurrency control';
  END IF;
  IF t.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN
   RAISE EXCEPTION 'STALE_WRITE: Reload before saving';
  END IF;
  IF a.role<>'admin' AND NOT (a.role='department_lead' AND t.department_id=dept) THEN
   RAISE EXCEPTION 'TASK_WRITE_DENIED';
  END IF;
  cancel_reason:=trim(COALESCE(p_payload->>'reason', ''));
  IF cancel_reason = '' OR length(cancel_reason) < 5 THEN
   RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED: A substantive cancellation reason is required (minimum 5 characters)';
  END IF;
  UPDATE tasks
  SET status='Cancelled',
      cancellation_reason=cancel_reason,
      cancelled_at=now(),
      updated_at=now()
  WHERE id=t.id;
  entity:=t.id;

 ELSIF p_action='delete_task' THEN
  SELECT * INTO t FROM tasks WHERE id=(p_payload->>'id')::uuid AND organization_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_FOUND'; END IF;
  IF NULLIF(trim(p_payload->>'expected_updated_at'),'') IS NULL THEN
   RAISE EXCEPTION 'EXPECTED_UPDATED_AT_REQUIRED: Expected updated_at is required for concurrency control';
  END IF;
  IF t.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN
   RAISE EXCEPTION 'STALE_WRITE: Reload before saving';
  END IF;
  IF a.role<>'admin' AND NOT (a.role='department_lead' AND t.department_id=dept) THEN
   RAISE EXCEPTION 'TASK_WRITE_DENIED';
  END IF;
  IF NOT t.is_custom THEN
   RAISE EXCEPTION 'CANNOT_DELETE_CANONICAL_TASK: Default template tasks cannot be deleted; cancel them with a substantive reason';
  END IF;
  IF t.status <> 'Open' THEN
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
  target_stage:=trim(COALESCE(p_payload->>'target_stage',''));
  IF target_stage = '' THEN
   RAISE EXCEPTION 'TARGET_STAGE_REQUIRED';
  END IF;
  IF NOT public.is_valid_canonical_stage(target_stage) THEN
   RAISE EXCEPTION 'INVALID_STAGE_CODE: Target stage % is not a valid canonical stage', target_stage;
  END IF;

  -- Department Authorization Check on Stage Gate Advancement
  IF a.role <> 'admin' THEN
   IF target_stage LIKE 'CM_%' AND a.department_code <> 'SAL' THEN
    RAISE EXCEPTION 'STAGE_ADVANCE_DENIED: Only Sales or Admin can advance commercial stages';
   ELSIF target_stage LIKE 'HW_%' AND a.department_code <> 'EHW' THEN
    RAISE EXCEPTION 'STAGE_ADVANCE_DENIED: Only Hardware Lead or Admin can advance hardware stages';
   ELSIF target_stage LIKE 'FW_%' AND a.department_code <> 'FW' THEN
    RAISE EXCEPTION 'STAGE_ADVANCE_DENIED: Only Firmware Lead or Admin can advance firmware stages';
   ELSIF target_stage LIKE 'SW_%' AND a.department_code <> 'SW' THEN
    RAISE EXCEPTION 'STAGE_ADVANCE_DENIED: Only Software Lead or Admin can advance software stages';
   ELSIF target_stage LIKE 'MECH_%' AND a.department_code <> 'MECH' THEN
    RAISE EXCEPTION 'STAGE_ADVANCE_DENIED: Only Mechanical Lead or Admin can advance mechanical stages';
   ELSIF target_stage LIKE 'CL_%' AND a.department_code NOT IN ('QA', 'SAL') THEN
    RAISE EXCEPTION 'STAGE_ADVANCE_DENIED: Only QA, Sales, or Admin can advance release/closure stages';
   ELSIF target_stage LIKE 'RM_%' AND a.department_code NOT IN ('PUR', 'SIT', 'SAL') THEN
    RAISE EXCEPTION 'STAGE_ADVANCE_DENIED: Only Purchasing, Service/IT, or Sales can advance ready-made stages';
   ELSIF target_stage LIKE 'INT_%' AND a.department_code NOT IN ('EHW', 'FW', 'SW', 'QA') THEN
    RAISE EXCEPTION 'STAGE_ADVANCE_DENIED: Only Engineering or QA leads can advance integration stages';
   ELSIF target_stage LIKE 'Stage %' AND r.department_id <> dept THEN
    RAISE EXCEPTION 'STAGE_ADVANCE_DENIED: Department lead can only advance stages for projects in their authorized department scope';
   END IF;
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

   -- FAIL-CLOSED Supplier Verification Gate on PO update
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

   -- FAIL-CLOSED Part Release Gate on BOM update
   target_stage:=COALESCE(record_fields->>'stage', p_payload->>'stage');
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

   -- FAIL-CLOSED Supplier Verification Gate on Approval Request
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
     RAISE EXCEPTION 'SUPPLIER_VERIFICATION_REQUIRED: Cannot request approval with unapproved supplier';
    END IF;
   END IF;

   -- FAIL-CLOSED Part Release Gate on Approval Request
   IF (r.record_type IN ('Release','Production order','BOM','Mass production BOM') AND r.fields->>'stage' = 'released')
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
     RAISE EXCEPTION 'PART_RELEASE_REQUIRED: Cannot request approval for unreleased component part';
    END IF;
   END IF;

   INSERT INTO approvals(organization_id,department_id,record_id,reviewer_department_id,title,outcome,evidence_revision,created_by)
   VALUES(org,r.department_id,r.id,reviewer,'Review '||r.title,'pending',r.fields->>'revision',auth.uid())
   RETURNING id INTO entity;
   UPDATE operational_records SET status='in_review',updated_at=now(),updated_by=auth.uid() WHERE id=r.id;

  ELSIF p_action='create_document' THEN
   INSERT INTO documents(organization_id,department_id,record_id,title,document_type,reference_url,visibility,created_by)
   VALUES(org,r.department_id,r.id,trim(p_payload->>'title'),trim(COALESCE(p_payload->>'document_type','Document')),COALESCE(p_payload->>'reference_url',p_payload->>'file_path','vault/'||gen_random_uuid()),COALESCE(p_payload->>'visibility','internal'),auth.uid())
   RETURNING id INTO entity;
  END IF;

 ELSIF p_action='decide_approval' THEN
  SELECT * INTO p FROM approvals WHERE id=(p_payload->>'id')::uuid AND organization_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPROVAL_NOT_FOUND'; END IF;
  IF NULLIF(trim(p_payload->>'expected_updated_at'),'') IS NULL THEN
   RAISE EXCEPTION 'EXPECTED_UPDATED_AT_REQUIRED: Expected updated_at is required for concurrency control';
  END IF;
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
       fields=jsonb_set(
         fields,
         '{verification_status}',
         '"Approved"'
       ),
       updated_at=now(),
       updated_by=auth.uid()
   WHERE id=p.record_id;
  ELSIF p_payload->>'outcome'='rejected' THEN
   UPDATE operational_records
   SET status='draft'::portal_record_status,
       updated_at=now(),
       updated_by=auth.uid()
   WHERE id=p.record_id;
  END IF;
  entity:=p.id;

 ELSIF p_action='sync_canonical_sample_pack' THEN
  IF a.role NOT IN ('admin', 'department_lead') THEN
   RAISE EXCEPTION 'FIXTURE_ADMIN_REQUIRED';
  END IF;
  result := public.sync_canonical_sample_pack(COALESCE(p_payload->>'p_run_id', 'LC2-2026-10-28'));
  INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response)
  VALUES(org,auth.uid(),p_request_id,payload_hash,result);
  RETURN result;

 ELSIF p_action='sync_scenario_test_fixtures' THEN
  IF a.role NOT IN ('admin', 'department_lead') THEN
   RAISE EXCEPTION 'FIXTURE_ADMIN_REQUIRED';
  END IF;
  result := public.sync_canonical_sample_pack(COALESCE(p_payload->>'p_run_id', 'LC2-2026-10-28'));
  INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response)
  VALUES(org,auth.uid(),p_request_id,payload_hash,result);
  RETURN result;

 ELSE
  RAISE EXCEPTION 'UNKNOWN_ACTION';
 END IF;

 result:=jsonb_build_object('ok',true,'id',entity);
 INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response)
 VALUES(org,auth.uid(),p_request_id,payload_hash,result);
 RETURN result;
END $$;

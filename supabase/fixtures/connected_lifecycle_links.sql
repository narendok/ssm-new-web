-- Manual TEST completion only: original fixture IDs, no live stock/payment/shipment effects.
BEGIN;
DO $fixture_links$
DECLARE org uuid; actor uuid; run text := 'TEST-LIFECYCLE-20261025-001'; edge record; source_id uuid; target_id uuid; item record;
BEGIN
 SELECT m.organization_id,m.user_id INTO org,actor FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.active AND m.role='admin' AND o.name='TEST ONLY · SSM-new1 synthetic workspace';
 IF actor IS NULL THEN RAISE EXCEPTION 'TEST_ADMIN_REQUIRED'; END IF;
 FOR edge IN SELECT * FROM (VALUES
 ('HLPL-JIG-MECH-STP-01','HLPL-JIG-EHW-SCH-01'),
 ('HLPL-JIG-TE-PRG-01','HLPL-JIG-MECH-STP-01'),
 ('HLPL-POC-BOM-01','HLPL-POC-PRS-01'),
 ('HLPL-PLT-FW-REL-01','HLPL-PLT-FW-HSI-01'),
 ('HLPL-RFT-PUR-PO-01','HLPL-RFT-PUR-BOM-01'),
 ('HLPL-RFT-EMF-ORD-01','HLPL-RFT-PUR-PO-01'),
 ('HLPL-RFT-QA-IQC-01','HLPL-RFT-EMF-ORD-01')
 ) AS links(target,source) LOOP
   SELECT canonical_id INTO source_id FROM scenario_fixture_manifests WHERE organization_id=org AND run_id=run AND reference=edge.source;
   SELECT canonical_id INTO target_id FROM scenario_fixture_manifests WHERE organization_id=org AND run_id=run AND reference=edge.target;
   IF source_id IS NULL OR target_id IS NULL THEN RAISE EXCEPTION 'FIXTURE_DEPENDENCY_MISSING'; END IF;
   UPDATE operational_records SET fields=fields||jsonb_build_object('dependsOn',source_id::text) WHERE id=target_id AND organization_id=org;
   INSERT INTO record_links(organization_id,source_record_id,target_record_id,relationship,created_by) SELECT org,source_id,target_id,'dependency',actor WHERE NOT EXISTS(SELECT 1 FROM record_links WHERE organization_id=org AND source_record_id=source_id AND target_record_id=target_id AND relationship='dependency');
 END LOOP;
 SELECT canonical_id INTO source_id FROM scenario_fixture_manifests WHERE organization_id=org AND run_id=run AND reference='ENQ-2026-EXT-01';
 SELECT canonical_id INTO target_id FROM scenario_fixture_manifests WHERE organization_id=org AND run_id=run AND reference='HLPL-EXT-PUR-FEAS-01';
 UPDATE operational_records SET fields=fields||jsonb_build_object('enquiryId',source_id::text,'requiredInputs',source_id::text) WHERE id=target_id AND organization_id=org;
 -- These are explicitly simulated starting snapshots, NOT executed operational gate approvals.
 FOR item IN SELECT * FROM (VALUES ('S01','Stage 4'),('S03','Stage 4'),('S04','Stage 5'),('S05','Stage 6'),('S06','Stage 8')) AS stages(scenario,stage) LOOP
   UPDATE operational_records SET stage=item.stage,fields=fields||jsonb_build_object('currentStage',item.stage,'sampleStageSnapshot',true)
   WHERE organization_id=org AND is_demo AND id IN(SELECT canonical_id FROM scenario_fixture_manifests WHERE organization_id=org AND run_id=run AND scenario_id=item.scenario AND entity_type='project');
   UPDATE scenario_fixture_manifests SET stage=item.stage WHERE organization_id=org AND run_id=run AND scenario_id=item.scenario AND entity_type='project';
 END LOOP;
END $fixture_links$;
COMMIT;
SELECT 'sample links and starting stages reconciled' AS result;

-- Add one additional fictional item to each currently underrepresented Shared TEST
-- inventory category so category and department filters have multiple choices.
-- This changes only demo Part masters and their explicitly fictional opening balances.
BEGIN;

WITH samples(reference,title,source_reference,category,subcategory,primary_department,department_views,fixture_key,specifications) AS (
  VALUES
    (
      'HLPL-DEMO-INV-PKG-02',
      'ESD transit sleeve sample',
      'HLPL-DEMO-INV-PKG-01',
      'Packaging & Consumables',
      'ESD transit packaging',
      'PUR',
      ARRAY['PUR','EMF','EHW','QA']::text[],
      'PKG-02',
      '{"use":"Fictional example for filter coverage","material":"Not recorded","approvedSpecification":"Not recorded"}'::jsonb
    ),
    (
      'HLPL-DEMO-INV-TOOL-02',
      'Harness crimp-height gauge sample',
      'HLPL-DEMO-INV-TOOL-01',
      'Production Tools',
      'Harness tooling',
      'EMF',
      ARRAY['EMF','QA','PUR','EHW']::text[],
      'TOOL-02',
      '{"function":"Fictional crimp-height check example","assetLink":"Not recorded","calibration":"Not recorded"}'::jsonb
    )
)
INSERT INTO public.operational_records (
    organization_id, department_id, area, record_type, reference, title, status,
    priority, fields, notes, created_by, updated_by, is_demo
  )
  SELECT
    source.organization_id,
    department.id,
    source.area,
    'Part',
    sample.reference,
    sample.title,
    'draft'::public.portal_record_status,
    'normal',
    jsonb_build_object(
      'mpn','Not recorded',
      'category',sample.category,
      'subcategory',sample.subcategory,
      'revision','01',
      'fixtureKey',sample.fixture_key,
      'fixturePack','SSM-DEMO-INVENTORY-2026-11-v1.1',
      'specifications',sample.specifications,
      'departmentViews',sample.department_views,
      'primaryDepartment',sample.primary_department,
      'unit','pcs',
      'sampleDataNotice','Fictional Shared TEST example for category and department-view filter testing. Not an approved part specification; quantity is a fictional opening balance, and supplier, cost, receipt and release are not recorded.'
    ),
    'DEMO_ONLY · item master example; no stock transaction or engineering approval is represented.',
    source.created_by,
    source.updated_by,
    true
  FROM samples AS sample
  JOIN public.operational_records AS source
    ON source.reference=sample.source_reference
    AND source.record_type='Part'
    AND source.archived_at IS NULL
    AND source.is_demo
    AND private.is_shared_test_org(source.organization_id)
  JOIN public.departments AS department
    ON department.organization_id=source.organization_id
    AND department.code=sample.primary_department
    AND department.active
ON CONFLICT (organization_id,reference) DO NOTHING;

INSERT INTO public.shared_inventory_events (
  organization_id,part_id,department_id,event_kind,on_hand_delta,held_delta,
  location,bin,note,is_demo,fixture_key
)
SELECT
  part.organization_id,
  part.id,
  part.department_id,
  'opening',
  CASE part.reference
    WHEN 'HLPL-DEMO-INV-PKG-02' THEN 18
    WHEN 'HLPL-DEMO-INV-TOOL-02' THEN 5
  END,
  0,
  'Fictional TEST stockroom',
  CASE part.reference
    WHEN 'HLPL-DEMO-INV-PKG-02' THEN 'TEST-PKG'
    WHEN 'HLPL-DEMO-INV-TOOL-02' THEN 'TEST-TOOL'
  END,
  'Fictional opening balance for Shared TEST category and department-view filter coverage; not a real receipt, supplier commitment, cost, or Production quantity.',
  true,
  'shared-test-opening:' || part.reference
FROM public.operational_records AS part
WHERE private.is_shared_test_org(part.organization_id)
  AND part.record_type='Part'
  AND part.archived_at IS NULL
  AND part.is_demo
  AND part.reference IN ('HLPL-DEMO-INV-PKG-02','HLPL-DEMO-INV-TOOL-02')
  AND EXISTS (
    SELECT 1 FROM public.departments AS department
    WHERE department.id=part.department_id
      AND department.organization_id=part.organization_id
      AND department.active
  )
ON CONFLICT (organization_id,fixture_key) WHERE fixture_key IS NOT NULL DO NOTHING;

COMMIT;

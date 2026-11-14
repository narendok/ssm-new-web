-- Ensure each active Shared TEST department has a visible common-document
-- index without inventing an approved policy, effective date, or original file.
WITH common_packs(code, title) AS (
  VALUES
    ('SAL','Enquiry intake and opportunity handling work instruction'),
    ('EHW','Hardware design review and ECAD revision-control work instruction'),
    ('FW','Firmware branch, build, and release-control work instruction'),
    ('SW','Software change, security, and API review work instruction'),
    ('MECH','CAD revision, fit-check, and drawing-control work instruction'),
    ('PUR','Supplier qualification and purchase-request work instruction'),
    ('QA','Quality planning, DVP&R, and nonconformance work instruction'),
    ('EMF','Electronics assembly, ESD, and traveler-control work instruction'),
    ('MMF','Mechanical fabrication, tooling, and fit-check work instruction'),
    ('FIN','Budget, expense, and commercial-review work instruction'),
    ('SIT','Service ticket, access, and backup-review work instruction'),
    ('HROPS','Competency, training, and workplace-safety work instruction')
)
INSERT INTO public.documents(
  organization_id, department_id, record_id, title, document_type,
  reference_url, visibility, metadata, created_by
)
SELECT d.organization_id, d.id, NULL,
       'TEST SAMPLE · ' || COALESCE(p.title, d.name || ' common operating work instruction'),
       'D01 common-document draft index', 'private', 'internal',
       jsonb_build_object(
         'scope','common',
         'projectId',NULL,
         'revision','D0 · TEST',
         'status','Draft',
         'classification','Internal · synthetic TEST sample · not effective',
         'reference','HLPL-GEN-' || d.code || '-D01-INDEX-01',
         'seedKey','shared-test-common-index-v1:' || d.code,
         'effectiveDate','Not effective · no original file attached'
       ),
       actor.user_id
FROM public.departments d
JOIN LATERAL (
  SELECT m.user_id
  FROM public.organization_members m
  WHERE m.organization_id=d.organization_id AND m.active
  ORDER BY CASE WHEN m.role='admin' THEN 0 ELSE 1 END, m.id
  LIMIT 1
) actor ON true
LEFT JOIN common_packs p ON p.code=d.code
WHERE d.active AND d.code<>'CLIENT'
  AND private.is_shared_test_org(d.organization_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.documents existing
    WHERE existing.organization_id=d.organization_id
      AND existing.department_id=d.id
      AND existing.metadata->>'seedKey'='shared-test-common-index-v1:' || d.code
  );

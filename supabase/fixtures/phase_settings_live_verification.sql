-- Explicit synthetic TEST scenario. Uses the normal RPC guards; no production target or real acceptance.
DO $scenario$
DECLARE actor uuid; source public.operational_records%ROWTYPE; result jsonb; revision text;
BEGIN
 IF (SELECT count(*) FROM public.organizations)<>1 OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE name='TEST ONLY · SSM-new1 synthetic workspace') THEN RAISE EXCEPTION 'ISOLATED_TEST_ORG_REQUIRED'; END IF;
 SELECT user_id INTO actor FROM public.organization_members WHERE role='admin' AND active AND display_name='TEST Executive Admin';
 IF actor IS NULL THEN RAISE EXCEPTION 'SYNTHETIC_TEST_ADMIN_REQUIRED'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SELECT definition->>'id' INTO revision FROM private.lifecycle_revisions ORDER BY version DESC LIMIT 1;
 SELECT * INTO source FROM public.operational_records WHERE title='TEST · Orion Controls modular bench sensor pilot' AND record_type IN ('Enquiry','Opportunity') AND archived_at IS NULL ORDER BY created_at DESC LIMIT 1;
 IF source.id IS NULL THEN
  result:=public.mutate_sales_intake(jsonb_build_object('mode','enquiry','title','TEST · Orion Controls modular bench sensor pilot',
   'customerName','Orion Controls Private Limited (fictional)','customerCode','TESTORION','spocName','Meera Joshi (TEST)','spocEmail','meera.joshi@example.com',
   'targetVolume','12','scopeSummary','Synthetic lifecycle scenario: 12 evaluation units of a modular 24 V bench sensor controller with local UART diagnostics. Requirements, effort and budgets are fictional test assumptions. No real certification, product release or customer acceptance is represented.'),gen_random_uuid());
  SELECT * INTO source FROM public.operational_records WHERE id=(result->>'id')::uuid;
 END IF;
 IF source.record_type='Enquiry' THEN
  result:=public.mutate_sales_intake(jsonb_build_object('mode','convert','sourceId',source.id,'expectedUpdatedAt',source.updated_at,'title',source.title,
   'dispatchFeasibility',true,'feasibilityRaciRevision',revision),gen_random_uuid());
 END IF;
END $scenario$;
SELECT r.id,r.reference,r.record_type,r.fields->>'requiredDepartments' required_departments,r.fields->>'feasibilityRaciRevision' settings_revision,
 (SELECT count(*) FROM public.tasks t WHERE t.record_id=r.id) tasks,
 (SELECT count(*) FROM public.approvals a WHERE a.record_id=r.id AND a.outcome='pending') pending_reviews
FROM public.operational_records r WHERE r.title='TEST · Orion Controls modular bench sensor pilot' AND r.record_type IN ('Enquiry','Opportunity') AND r.archived_at IS NULL;

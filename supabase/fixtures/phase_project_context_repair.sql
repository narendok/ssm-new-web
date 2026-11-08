-- Repair only the named fictional TEST project using its already reviewed source opportunity.
DO $repair$
DECLARE org_id uuid; project_row public.operational_records%ROWTYPE; source_row public.operational_records%ROWTYPE; admin_id uuid;
BEGIN
 SELECT id INTO org_id FROM public.organizations WHERE name='TEST ONLY · SSM-new1 synthetic workspace';
 IF org_id IS NULL OR (SELECT count(*) FROM public.organizations)<>1 THEN RAISE EXCEPTION 'ISOLATED_TEST_ORG_REQUIRED'; END IF;
 SELECT user_id INTO admin_id FROM public.organization_members WHERE organization_id=org_id AND role='admin' AND active AND display_name='TEST Executive Admin';
 SELECT * INTO project_row FROM public.operational_records WHERE organization_id=org_id AND reference='HLPL-TEST-ORION-PHASES-20261107' AND record_type='Project' AND archived_at IS NULL;
 IF project_row.id IS NULL OR project_row.fields->>'sourceOpportunityId' IS NULL THEN RAISE EXCEPTION 'EXPECTED_FICTIONAL_PROJECT_REQUIRED'; END IF;
 SELECT * INTO source_row FROM public.operational_records WHERE organization_id=org_id AND id=(project_row.fields->>'sourceOpportunityId')::uuid AND record_type='Opportunity' AND archived_at IS NULL;
 IF source_row.id IS NULL OR source_row.title<>'TEST · Orion Controls modular bench sensor pilot' THEN RAISE EXCEPTION 'LINKED_TEST_OPPORTUNITY_REQUIRED'; END IF;
 UPDATE public.operational_records SET fields=fields||jsonb_strip_nulls(jsonb_build_object(
  'quantity',source_row.fields->>'quantity','targetDate',source_row.fields->>'targetDate',
  'contactPerson',source_row.fields->>'contactPerson','email',source_row.fields->>'email','owner',source_row.fields->>'owner'
 )),updated_by=admin_id WHERE id=project_row.id;
END $repair$;
SELECT r.reference,r.fields->>'quantity' quantity,r.fields->>'contactPerson' contact_person,r.fields->>'email' contact_email,r.fields->>'owner' owner_name
FROM public.organizations o JOIN public.operational_records r ON r.organization_id=o.id
WHERE o.name='TEST ONLY · SSM-new1 synthetic workspace' AND r.reference='HLPL-TEST-ORION-PHASES-20261107' AND r.record_type='Project';

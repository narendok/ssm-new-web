-- One-time engineering-track decision for a shared TEST opportunity.
-- Customer scope clues never waive feasibility review or assign this field.
CREATE OR REPLACE FUNCTION public.decide_shared_test_track_after_feasibility(
  p_payload jsonb,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  a record;
  src public.operational_records%ROWTYPE;
  sal_department uuid;
  reviewer_count integer;
  digest text;
  replay record;
  result jsonb;
  selected_track text;
  requested_at text;
BEGIN
  SELECT * INTO a FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client
     OR NOT private.is_shared_test_org(a.organization_id)
     OR (a.role <> 'admin' AND (a.role <> 'department_lead' OR COALESCE(a.department_code, '') <> 'SAL')) THEN
    RAISE EXCEPTION 'SALES_TRACK_DECISION_DENIED';
  END IF;
  IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR octet_length(p_payload::text) > 8192 THEN
    RAISE EXCEPTION 'INVALID_TRACK_DECISION';
  END IF;

  selected_track := p_payload->>'track';
  IF selected_track NOT IN (
    'hardware_only', 'firmware_only', 'software_only', 'hardware_firmware',
    'firmware_software_existing_hardware', 'hardware_firmware_software', 'ready_made'
  ) THEN
    RAISE EXCEPTION 'SALES_TRACK_INVALID';
  END IF;
  IF NULLIF(p_payload->>'opportunityId', '') IS NULL
     OR NULLIF(p_payload->>'expectedUpdatedAt', '') IS NULL THEN
    RAISE EXCEPTION 'TRACK_DECISION_SOURCE_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(a.organization_id::text, 0));
  digest := encode(sha256(convert_to('sales_track_decision:' || p_payload::text, 'UTF8')), 'hex');
  SELECT * INTO replay FROM private.shared_test_requests
  WHERE organization_id=a.organization_id AND actor_id=auth.uid() AND request_id=p_request_id;
  IF FOUND THEN
    IF replay.request_hash <> digest THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
    RETURN replay.response;
  END IF;

  SELECT id INTO sal_department FROM public.departments
  WHERE organization_id=a.organization_id AND code='SAL' AND active;
  IF sal_department IS NULL THEN RAISE EXCEPTION 'SALES_DEPARTMENT_REQUIRED'; END IF;

  SELECT * INTO src FROM public.operational_records
  WHERE id=(p_payload->>'opportunityId')::uuid
    AND organization_id=a.organization_id
    AND department_id=sal_department
    AND record_type='Opportunity'
    AND archived_at IS NULL
    AND private.shared_test_record_visible(id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SALES_OPPORTUNITY_NOT_FOUND'; END IF;
  IF src.updated_at IS DISTINCT FROM (p_payload->>'expectedUpdatedAt')::timestamptz THEN
    RAISE EXCEPTION 'STALE_SALES_OPPORTUNITY: Reload before deciding the engineering track';
  END IF;
  IF NULLIF(src.fields->>'feasibilityDispatchedAt', '') IS NULL
     OR NULLIF(src.fields->>'requiredDepartments', '') IS NULL THEN
    RAISE EXCEPTION 'FEASIBILITY_NOT_DISPATCHED';
  END IF;
  IF lower(COALESCE(src.fields->>'outcome', '')) IN ('declined','rejected','cancelled','closed') THEN
    RAISE EXCEPTION 'SALES_OPPORTUNITY_CLOSED';
  END IF;
  IF NULLIF(src.fields->>'projectTrack', '') IS NOT NULL THEN
    RAISE EXCEPTION 'SALES_TRACK_ALREADY_DECIDED';
  END IF;

  SELECT count(DISTINCT trim(code)) INTO reviewer_count
  FROM unnest(string_to_array(src.fields->>'requiredDepartments', ',')) AS requested(code)
  WHERE trim(code) <> '';
  IF reviewer_count < 1 THEN RAISE EXCEPTION 'SALES_REVIEW_DEPARTMENTS_REQUIRED'; END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(string_to_array(src.fields->>'requiredDepartments', ',')) AS requested(code)
    LEFT JOIN public.departments d
      ON d.organization_id=a.organization_id AND d.active AND d.code=trim(requested.code)
    WHERE trim(requested.code) = '' OR d.id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.approvals ap
         WHERE ap.organization_id=a.organization_id
           AND ap.record_id=src.id
           AND ap.reviewer_department_id=d.id
           AND ap.evidence_revision=src.fields->>'revision'
           AND ap.outcome='approved'
           AND ap.decided_at IS NOT NULL
       )
  ) THEN
    RAISE EXCEPTION 'FEASIBILITY_REVIEWS_INCOMPLETE';
  END IF;

  requested_at := now()::text;
  UPDATE public.operational_records
  SET fields=fields || jsonb_build_object(
        'projectTrack', selected_track,
        'trackDecisionAt', requested_at,
        'trackDecisionBy', a.display_name,
        'trackDecisionBasis', 'completed internal feasibility reviews'
      ),
      updated_at=now(),
      updated_by=auth.uid()
  WHERE id=src.id;

  INSERT INTO public.audit_events(organization_id,actor_id,entity_type,entity_id,action,detail)
  VALUES(a.organization_id,auth.uid(),'sales_intake',src.id,'sales_track_decided',
    jsonb_build_object('membership_id',a.membership_id,'track',selected_track,'basis','completed internal feasibility reviews'));
  result := jsonb_build_object('id',src.id,'reference',src.reference,'track',selected_track);
  INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response)
  VALUES(a.organization_id,auth.uid(),p_request_id,digest,result);
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_shared_test_track_after_feasibility(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decide_shared_test_track_after_feasibility(jsonb,uuid) TO authenticated;

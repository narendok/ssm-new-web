-- Require an active canonical Customer when a feasibility Opportunity carries
-- customer identity. Truly customerless/internal Opportunities remain valid.
CREATE OR REPLACE FUNCTION public.start_project_from_feasibility(p_payload jsonb,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 a record;
 source public.operational_records%ROWTYPE;
 customer_master public.operational_records%ROWTYPE;
 replay record;
 digest text;
 result jsonb;
 project_id uuid;
 customer_id_text text;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client OR NOT private.is_shared_test_org(a.organization_id) OR (a.role<>'admin' AND (a.role<>'department_lead' OR a.department_code<>'SAL')) THEN RAISE EXCEPTION 'SALES_PROJECT_START_DENIED'; END IF;
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>8192 THEN RAISE EXCEPTION 'INVALID_PROJECT_START'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.organization_id::text,0));
 digest:=encode(sha256(convert_to('start_project'||p_payload::text,'UTF8')),'hex');
 SELECT * INTO replay FROM private.shared_test_requests WHERE organization_id=a.organization_id AND actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN IF replay.request_hash<>digest THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF; RETURN replay.response; END IF;
 SELECT * INTO source FROM public.operational_records WHERE id=(p_payload->>'opportunityId')::uuid AND organization_id=a.organization_id AND record_type='Opportunity' AND archived_at IS NULL AND private.shared_test_record_visible(id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OPPORTUNITY_REQUIRED'; END IF;
 IF source.updated_at IS DISTINCT FROM (p_payload->>'expectedUpdatedAt')::timestamptz THEN RAISE EXCEPTION 'STALE_OPPORTUNITY'; END IF;
 IF nullif(source.fields->>'projectId','') IS NOT NULL THEN RAISE EXCEPTION 'OPPORTUNITY_ALREADY_LINKED'; END IF;
 IF nullif(source.fields->>'trackDecisionAt','') IS NULL OR nullif(source.fields->>'projectTrack','') IS NULL OR nullif(source.fields->>'requiredDepartments','') IS NULL OR lower(coalesce(source.fields->>'outcome','')) IN ('declined','rejected','cancelled','closed') THEN RAISE EXCEPTION 'FEASIBILITY_AND_TRACK_DECISION_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(string_to_array(source.fields->>'requiredDepartments',',')) requested(code) LEFT JOIN public.departments d ON d.organization_id=a.organization_id AND d.active AND d.code=trim(requested.code) WHERE d.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.approvals ap WHERE ap.organization_id=a.organization_id AND ap.record_id=source.id AND ap.reviewer_department_id=d.id AND ap.evidence_revision=source.fields->>'revision' AND ap.outcome='approved' AND ap.decided_at IS NOT NULL)) THEN RAISE EXCEPTION 'FEASIBILITY_REVIEWS_INCOMPLETE'; END IF;
 customer_id_text:=coalesce(nullif(trim(source.fields->>'customerId'),''),nullif(trim(source.fields->>'customer_id'),''));
 IF customer_id_text IS NULL THEN
  IF nullif(trim(source.fields->>'customer'),'') IS NOT NULL OR nullif(trim(source.fields->>'customerCode'),'') IS NOT NULL THEN
   RAISE EXCEPTION 'CUSTOMER_MASTER_LINK_REQUIRED';
  END IF;
 ELSE
  SELECT * INTO customer_master FROM public.operational_records r
   WHERE r.id::text=customer_id_text AND r.organization_id=a.organization_id
     AND r.record_type='Customer' AND r.archived_at IS NULL
     AND lower(r.status::text) NOT IN ('archived','obsolete','rejected');
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_LINK_INVALID'; END IF;
 END IF;
 IF nullif(trim(p_payload->>'title'),'') IS NULL OR coalesce(p_payload->>'reference','') !~ '^HLPL-[A-Z0-9]+(-[A-Z0-9]+)*$' THEN RAISE EXCEPTION 'PROJECT_TITLE_AND_CODE_REQUIRED'; END IF;
 result:=private.mutate_workspace_before_lifecycle_start('create_project',jsonb_build_object('reference',p_payload->>'reference','title',p_payload->>'title','track',source.fields->>'projectTrack','notes','Created from reviewed opportunity '||source.reference),md5(p_request_id::text||':create')::uuid);
 project_id:=(result->>'id')::uuid;
 UPDATE public.operational_records SET fields=fields||jsonb_strip_nulls(jsonb_build_object(
  'sourceOpportunityId',source.id,'sourceOpportunityReference',source.reference,'sourceFeasibilityRevision',source.fields->>'revision',
  'customerId',customer_master.id,'customer_id',customer_master.id,'customer',customer_master.title,'customerCode',customer_master.reference,
  'scope',source.fields->>'scope','quantity',source.fields->>'quantity',
  'targetDate',source.fields->>'targetDate','contactPerson',source.fields->>'contactPerson','email',source.fields->>'email',
  'owner',source.fields->>'owner'
 )),updated_by=auth.uid() WHERE id=project_id;
 UPDATE public.operational_records SET fields=fields||jsonb_build_object('projectId',p_payload->>'reference','projectRecordId',project_id),updated_by=auth.uid() WHERE id=source.id;
 result:=result||jsonb_build_object('reference',p_payload->>'reference');
 INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response) VALUES(a.organization_id,auth.uid(),p_request_id,digest,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.start_project_from_feasibility(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_project_from_feasibility(jsonb,uuid) TO authenticated;

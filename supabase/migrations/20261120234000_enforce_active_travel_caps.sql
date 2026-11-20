-- Enforce an Admin/Finance-published travel policy from itemized trip inputs.
-- Illustrative Draft values never block requests. HR/Admin maps the employee's
-- band; exceptions are saved as pending review and cannot consume budget until
-- Finance/Admin clears the exception and the normal approval chain completes.
DO $migration$
DECLARE
  fn text;
  profile_projection text := $old$data:=jsonb_build_object('employeeCode',data->>'employeeCode','email',data->>'email','phone',data->>'phone','roleTitle',data->>'roleTitle','joiningDate',data->>'joiningDate','facilityLocation',data->>'facilityLocation','emergencyContact',data->>'emergencyContact');$old$;
  profile_replacement text := $new$IF NULLIF(data->>'travelBand','') IS NOT NULL AND data->>'travelBand' NOT IN ('staff','manager','senior') THEN RAISE EXCEPTION 'INVALID_TRAVEL_BAND'; END IF;
  data:=jsonb_build_object('employeeCode',data->>'employeeCode','email',data->>'email','phone',data->>'phone','roleTitle',data->>'roleTitle','joiningDate',data->>'joiningDate','facilityLocation',data->>'facilityLocation','emergencyContact',data->>'emergencyContact','travelBand',NULLIF(data->>'travelBand',''));$new$;
BEGIN
  fn := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  IF length(fn)-length(replace(fn,profile_projection,''))<>length(profile_projection) THEN
    RAISE EXCEPTION 'TRAVEL_BAND_PROFILE_PATCH_PRECONDITION';
  END IF;
  fn := replace(fn,profile_projection,profile_replacement);
  IF position('INVALID_TRAVEL_BAND' in fn)=0 THEN RAISE EXCEPTION 'TRAVEL_BAND_PROFILE_PATCH_FAILED'; END IF;
  EXECUTE fn;
END $migration$;

-- Finance may inspect only pending, approved, or settled requests; include the new review state.
DO $migration$
DECLARE fn text; old_status text; new_status text;
BEGIN
  fn := pg_get_functiondef('private.business_visible(public.business_items,jsonb)'::regprocedure);
  old_status := $old$IN ('Pending_Finance','Pending_Admin','Approved','Settled')$old$;
  new_status := $new$IN ('Pending_Finance','Pending_Admin','Pending_Policy_Exception','Approved','Settled')$new$;
  IF length(fn)-length(replace(fn,old_status,''))<>length(old_status) THEN
    RAISE EXCEPTION 'TRAVEL_EXCEPTION_VISIBILITY_PRECONDITION';
  END IF;
  fn := replace(fn,old_status,new_status);
  IF position('Pending_Policy_Exception' in fn)=0 THEN RAISE EXCEPTION 'TRAVEL_EXCEPTION_VISIBILITY_PATCH_FAILED'; END IF;
  EXECUTE fn;
END $migration$;

CREATE OR REPLACE FUNCTION public.get_effective_travel_policy(p_department uuid, p_travel_date date DEFAULT current_date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  a record;
  own_department uuid;
  company jsonb;
  department jsonb;
  effective jsonb;
  company_version integer := 0;
  department_version integer := 0;
  employee_band text;
BEGIN
  SELECT * INTO a FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN RAISE EXCEPTION 'TRAVEL_POLICY_ACCESS_DENIED'; END IF;
  own_department := private.shared_test_member_department(a.membership_id);
  IF p_department IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.departments WHERE id=p_department AND organization_id=a.organization_id AND active AND upper(code)<>'CLIENT'
  ) THEN RAISE EXCEPTION 'INVALID_DEPARTMENT'; END IF;
  IF a.role<>'admin' AND p_department IS DISTINCT FROM own_department THEN RAISE EXCEPTION 'TRAVEL_POLICY_SCOPE_DENIED'; END IF;

  SELECT published_value,published_version INTO company,company_version
    FROM private.travel_policies WHERE organization_id=a.organization_id AND scope='company';
  SELECT published_value,published_version INTO department,department_version
    FROM private.travel_policies WHERE organization_id=a.organization_id AND scope=p_department::text;
  effective := coalesce(department,company,private.default_travel_policy());
  SELECT payload->>'travelBand' INTO employee_band FROM public.business_items
    WHERE organization_id=a.organization_id AND kind='profile' AND owner_id=a.membership_id;

  RETURN jsonb_build_object(
    'policy',effective,
    'isEffective',effective->>'status'='Active' AND NULLIF(effective->>'effectiveFrom','')::date<=p_travel_date,
    'policyVersion',CASE WHEN department IS NOT NULL THEN department_version ELSE company_version END,
    'employeeBand',employee_band,
    'band',CASE WHEN employee_band IS NULL THEN NULL ELSE (
      SELECT item FROM jsonb_array_elements(effective->'bands') item WHERE item->>'id'=employee_band LIMIT 1
    ) END
  );
END $$;

REVOKE ALL ON FUNCTION public.get_effective_travel_policy(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_effective_travel_policy(uuid,date) TO authenticated;

-- Route an exception to Finance/Admin inboxes as well as keeping it visible to its owner.
DO $migration$
DECLARE fn text; old_status text; new_status text;
BEGIN
  fn := pg_get_functiondef('private.business_notify(uuid)'::regprocedure);
  old_status := $old$IN ('Pending_Finance','Approved')$old$;
  new_status := $new$IN ('Pending_Finance','Pending_Policy_Exception','Approved')$new$;
  IF length(fn)-length(replace(fn,old_status,''))<>length(old_status) THEN
    RAISE EXCEPTION 'TRAVEL_EXCEPTION_NOTIFICATION_PRECONDITION';
  END IF;
  fn := replace(fn,old_status,new_status);
  IF position('Pending_Policy_Exception' in fn)=0 THEN RAISE EXCEPTION 'TRAVEL_EXCEPTION_NOTIFICATION_PATCH_FAILED'; END IF;
  EXECUTE fn;
END $migration$;

DO $migration$
DECLARE
  fn text;
  declaration text := $old$travel_policy jsonb; existing_advance uuid;$old$;
  expanded_declaration text := $new$travel_policy jsonb; existing_advance uuid;
  travel_policy_band jsonb; travel_band text; travel_days integer; hotel_cap numeric; meal_cap numeric; local_cap numeric;
  hotel_rate numeric; hotel_nights integer; meal_rate numeric; meal_days integer; local_rate numeric; local_days integer;
  transport_estimate numeric; travel_estimate numeric; travel_advance_cap numeric; requires_policy_exception boolean;
  policy_version integer; policy_normal_status text;$new$;
  state_marker text := $state$next_state:=CASE WHEN data->>'requestType'='purchase' THEN 'Pending_Procurement' ELSE 'Pending_Finance' END;$state$;
  state_validation text := $validate$IF data->>'requestType'='travel' THEN
   SELECT COALESCE(dp.published_value,cp.published_value,private.default_travel_policy()),
          CASE WHEN dp.published_value IS NOT NULL THEN dp.published_version ELSE COALESCE(cp.published_version,0) END
    INTO travel_policy,policy_version
    FROM (SELECT 1) seed
    LEFT JOIN private.travel_policies cp ON cp.organization_id=org AND cp.scope='company'
    LEFT JOIN private.travel_policies dp ON dp.organization_id=org AND dp.scope=dept::text;
   IF travel_policy->>'status'='Active' AND NULLIF(travel_policy->>'effectiveFrom','')::date <= (data->>'travelStartDate')::date THEN
    SELECT payload->>'travelBand' INTO travel_band FROM public.business_items
      WHERE organization_id=org AND kind='profile' AND owner_id=mid;
    IF travel_band NOT IN ('staff','manager','senior') THEN RAISE EXCEPTION 'TRAVEL_BAND_REQUIRED'; END IF;
    SELECT item INTO travel_policy_band FROM jsonb_array_elements(travel_policy->'bands') item WHERE item->>'id'=travel_band;
    IF travel_policy_band IS NULL THEN RAISE EXCEPTION 'TRAVEL_POLICY_BAND_UNAVAILABLE'; END IF;
    travel_days := (data->>'travelEndDate')::date - (data->>'travelStartDate')::date + 1;
    hotel_rate := COALESCE(NULLIF(data->>'travelHotelRate','')::numeric,0);
    hotel_nights := COALESCE(NULLIF(data->>'travelHotelNights','')::integer,0);
    meal_rate := COALESCE(NULLIF(data->>'travelMealRate','')::numeric,0);
    meal_days := COALESCE(NULLIF(data->>'travelMealDays','')::integer,travel_days);
    local_rate := COALESCE(NULLIF(data->>'travelLocalRate','')::numeric,0);
    local_days := COALESCE(NULLIF(data->>'travelLocalDays','')::integer,travel_days);
    transport_estimate := COALESCE(NULLIF(data->>'travelTransportEstimate','')::numeric,0);
    IF hotel_rate<0 OR hotel_nights NOT BETWEEN 0 AND travel_days OR meal_rate<0 OR meal_days NOT BETWEEN 0 AND travel_days
       OR local_rate<0 OR local_days NOT BETWEEN 0 AND travel_days OR transport_estimate<0 THEN RAISE EXCEPTION 'INVALID_TRAVEL_COST_BREAKDOWN'; END IF;
    hotel_cap := CASE WHEN selected_location.city_tier='metro' THEN (travel_policy_band->>'hotelMetro')::numeric ELSE (travel_policy_band->>'hotelOther')::numeric END;
    meal_cap := (travel_policy_band->>'mealsPerDay')::numeric;
    local_cap := (travel_policy_band->>'localPerDay')::numeric;
    travel_estimate := transport_estimate + hotel_rate*hotel_nights + meal_rate*meal_days + local_rate*local_days;
    IF travel_estimate<=0 THEN RAISE EXCEPTION 'TRAVEL_ESTIMATE_REQUIRED'; END IF;
    travel_advance_cap := floor(travel_estimate*(travel_policy->>'advancePercent')::numeric/100);
    requires_policy_exception := (hotel_nights>0 AND hotel_rate>hotel_cap) OR (meal_days>0 AND meal_rate>meal_cap)
      OR (local_days>0 AND local_rate>local_cap) OR amount>travel_advance_cap;
    IF requires_policy_exception AND length(trim(COALESCE(data->>'travelPolicyExceptionReason','')))<3 THEN
      RAISE EXCEPTION 'TRAVEL_POLICY_EXCEPTION_REASON_REQUIRED';
    END IF;
    IF requires_policy_exception THEN policy_normal_status:=next_state; next_state:='Pending_Policy_Exception'; END IF;
    data:=data||jsonb_build_object('travelPolicyVersion',policy_version,'travelPolicyBand',travel_band,
      'travelEstimate',travel_estimate,'travelAdvanceCap',travel_advance_cap,
      'policyExceptionStatus',CASE WHEN requires_policy_exception THEN 'Pending' ELSE 'Not_Required' END,
      'policyNormalStatus',CASE WHEN requires_policy_exception THEN policy_normal_status ELSE NULL END,
      'travelPolicyExceptionReason',NULLIF(trim(data->>'travelPolicyExceptionReason'),''));
   END IF;
  END IF;
  $validate$;
  payload_marker text := $payload$'travelEndDate',data->>'travelEndDate','merchant',data->>'merchant'$payload$;
  payload_replacement text := $payload$'travelEndDate',data->>'travelEndDate','travelHotelRate',NULLIF(data->>'travelHotelRate','')::numeric,
    'travelHotelNights',NULLIF(data->>'travelHotelNights','')::integer,'travelMealRate',NULLIF(data->>'travelMealRate','')::numeric,
    'travelMealDays',NULLIF(data->>'travelMealDays','')::integer,'travelLocalRate',NULLIF(data->>'travelLocalRate','')::numeric,
    'travelLocalDays',NULLIF(data->>'travelLocalDays','')::integer,'travelTransportEstimate',NULLIF(data->>'travelTransportEstimate','')::numeric,
    'travelPolicyVersion',data->'travelPolicyVersion','travelPolicyBand',data->'travelPolicyBand','travelEstimate',data->'travelEstimate',
    'travelAdvanceCap',data->'travelAdvanceCap','policyExceptionStatus',data->'policyExceptionStatus','policyNormalStatus',data->'policyNormalStatus',
    'travelPolicyExceptionReason',data->'travelPolicyExceptionReason','merchant',data->>'merchant'$payload$;
BEGIN
  fn := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  IF length(fn)-length(replace(fn,declaration,''))<>length(declaration) THEN RAISE EXCEPTION 'TRAVEL_CAP_DECLARATION_PRECONDITION'; END IF;
  fn := replace(fn,declaration,expanded_declaration);
  IF length(fn)-length(replace(fn,state_marker,''))<>length(state_marker) THEN RAISE EXCEPTION 'TRAVEL_CAP_STATE_PRECONDITION'; END IF;
  fn := replace(fn,state_marker,state_marker||E'\n'||state_validation);
  IF length(fn)-length(replace(fn,payload_marker,''))<>length(payload_marker) THEN RAISE EXCEPTION 'TRAVEL_CAP_PAYLOAD_PRECONDITION'; END IF;
  fn := replace(fn,payload_marker,payload_replacement);
  IF position('Pending_Policy_Exception' in fn)=0 OR position('TRAVEL_BAND_REQUIRED' in fn)=0
    OR position('travelAdvanceCap' in fn)=0 THEN RAISE EXCEPTION 'TRAVEL_CAP_PATCH_FAILED'; END IF;
  EXECUTE fn;
END $migration$;

DO $migration$
DECLARE fn text; old_actions text; new_actions text;
BEGIN
  fn := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  old_actions := $old$ELSIF p_action IN ('approve_expense','reject_expense','post_expense') THEN$old$;
  new_actions := $new$ELSIF p_action IN ('approve_travel_exception','reject_travel_exception') THEN
  IF i.kind IS DISTINCT FROM 'expense' OR i.payload->>'status'<>'Pending_Policy_Exception' THEN RAISE EXCEPTION 'TRAVEL_EXCEPTION_NOT_PENDING'; END IF;
  IF NOT is_fin THEN RAISE EXCEPTION 'FINANCE_AUTHORITY_REQUIRED'; END IF;
  IF i.owner_id=mid THEN RAISE EXCEPTION 'SELF_APPROVAL_DENIED'; END IF;
  IF p_action='reject_travel_exception' THEN
   IF length(trim(COALESCE(data->>'reason','')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
   data:=i.payload||jsonb_build_object('status','Rejected','policyExceptionStatus','Rejected','policyExceptionDecisionReason',trim(data->>'reason'),'policyExceptionReviewedBy',mid,'updatedAt',now());
  ELSE
   data:=i.payload||jsonb_build_object('status',COALESCE(i.payload->>'policyNormalStatus','Pending_Finance'),'policyExceptionStatus','Approved','policyExceptionReviewedBy',mid,'policyExceptionReviewedAt',now(),'updatedAt',now());
  END IF;
  UPDATE business_items SET payload=data,version=version+1,updated_at=now() WHERE id=i.id;
 $new$||old_actions;
  IF length(fn)-length(replace(fn,old_actions,''))<>length(old_actions) THEN RAISE EXCEPTION 'TRAVEL_EXCEPTION_ACTION_PATCH_PRECONDITION'; END IF;
  fn := replace(fn,old_actions,new_actions);
  IF position('TRAVEL_EXCEPTION_NOT_PENDING' in fn)=0 THEN RAISE EXCEPTION 'TRAVEL_EXCEPTION_ACTION_PATCH_FAILED'; END IF;
  EXECUTE fn;
END $migration$;

REVOKE ALL ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) TO authenticated;

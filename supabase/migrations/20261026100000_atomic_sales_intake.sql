-- Account-backed Sales intake. Additive RPC; existing record, inventory and gate writers stay intact.
CREATE OR REPLACE FUNCTION public.mutate_sales_intake(p_payload jsonb,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<intake>>
DECLARE
 a record; src public.operational_records%ROWTYPE; customer public.operational_records%ROWTYPE;
 department uuid; reviewer uuid; assigned uuid; entity uuid; sheet jsonb; result jsonb; replay record;
 mode text; title text; reference text; digest text; fields jsonb; selected jsonb; review_code text; key text; value jsonb;
 review_count integer:=0; requested boolean; due timestamptz;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client OR a.role NOT IN ('admin','department_lead')
    OR (a.role<>'admin' AND COALESCE(a.department_code,'')<>'SAL') THEN
  RAISE EXCEPTION 'SALES_INTAKE_DENIED';
 END IF;
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>65536 THEN RAISE EXCEPTION 'INVALID_SALES_INTAKE'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.organization_id::text,0));
 digest:=encode(sha256(convert_to('sales_intake:'||p_payload::text,'UTF8')),'hex');
 SELECT * INTO replay FROM private.shared_test_requests WHERE organization_id=a.organization_id AND actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN
  IF replay.request_hash<>digest THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
  RETURN replay.response;
 END IF;
 mode:=p_payload->>'mode';
 IF mode IS NULL OR mode NOT IN ('enquiry','opportunity','convert','dispatch') THEN RAISE EXCEPTION 'SALES_MODE_REQUIRED'; END IF;
 IF p_payload ? 'dispatchFeasibility' AND jsonb_typeof(p_payload->'dispatchFeasibility')<>'boolean' THEN RAISE EXCEPTION 'INVALID_DISPATCH_FLAG'; END IF;
 requested:=mode='dispatch' OR (mode<>'enquiry' AND COALESCE((p_payload->>'dispatchFeasibility')::boolean,false));
 SELECT id INTO department FROM public.departments WHERE organization_id=a.organization_id AND code='SAL' AND active;
 IF department IS NULL THEN RAISE EXCEPTION 'SALES_DEPARTMENT_REQUIRED'; END IF;
 IF mode IN ('convert','dispatch') THEN
  SELECT * INTO src FROM public.operational_records WHERE id=(p_payload->>'sourceId')::uuid AND organization_id=a.organization_id AND archived_at IS NULL FOR UPDATE;
  IF src.id IS NULL OR src.department_id<>department OR NOT private.shared_test_record_visible(src.id) THEN RAISE EXCEPTION 'SALES_SOURCE_DENIED'; END IF;
  IF src.updated_at IS DISTINCT FROM (p_payload->>'expectedUpdatedAt')::timestamptz THEN RAISE EXCEPTION 'STALE_SALES_INTAKE: Reload before saving'; END IF;
  IF (mode='convert' AND src.record_type<>'Enquiry') OR (mode='dispatch' AND src.record_type<>'Opportunity') THEN RAISE EXCEPTION 'SALES_SOURCE_TYPE_INVALID'; END IF;
  IF src.status NOT IN ('draft','open') OR lower(COALESCE(src.fields->>'outcome','')) IN ('declined','rejected','cancelled') OR NULLIF(src.fields->>'feasibilityDispatchedAt','') IS NOT NULL THEN RAISE EXCEPTION 'SALES_INTAKE_ALREADY_DISPATCHED_OR_CLOSED'; END IF;
  fields:=src.fields; entity:=src.id; reference:=src.reference;
 ELSE
  fields:=jsonb_build_object('revision','01');
  reference:='HLPL-GEN-SAL-'||CASE WHEN mode='enquiry' THEN 'ENQ' ELSE 'OPP' END||'-'||upper(replace(p_request_id::text,'-',''))||'-01';
 END IF;
 IF mode<>'dispatch' THEN
  title:=trim(COALESCE(p_payload->>'title',''));
  IF title='' OR length(title)>300 THEN RAISE EXCEPTION 'SALES_TITLE_REQUIRED'; END IF;
  IF COALESCE(p_payload->>'track','turnkey') NOT IN ('turnkey','software','firmware','ready_made') THEN RAISE EXCEPTION 'SALES_TRACK_INVALID'; END IF;
  -- Explicit allowlist: caller cannot supply approval, lifecycle, signature or arbitrary master status fields.
  FOR key,review_code IN SELECT * FROM jsonb_each_text('{"customerName":"customer","customerCode":"customerCode","spocName":"contactPerson","spocEmail":"email","scopeSummary":"scope","targetVolume":"quantity","targetClosureDate":"targetDate","track":"projectTrack"}'::jsonb) LOOP
   IF p_payload ? key THEN
    IF jsonb_typeof(p_payload->key)<>'string' THEN RAISE EXCEPTION 'SALES_FIELD_MUST_BE_TEXT: %',key; END IF;
    fields:=fields||jsonb_build_object(review_code,p_payload->>key);
   END IF;
  END LOOP;
  IF NULLIF(p_payload->>'customerId','') IS NOT NULL THEN
   SELECT * INTO customer FROM public.operational_records WHERE id=(p_payload->>'customerId')::uuid AND organization_id=a.organization_id AND record_type='Customer' AND archived_at IS NULL;
   IF customer.id IS NULL OR NOT private.shared_test_record_visible(customer.id) THEN RAISE EXCEPTION 'SALES_CUSTOMER_INVALID'; END IF;
   fields:=fields||jsonb_build_object('customerId',customer.id,'customer',customer.title,'customerCode',customer.reference);
  END IF;
  fields:=fields||jsonb_build_object('owner',a.display_name);
 END IF;
 IF mode='dispatch' AND p_payload ? 'targetClosureDate' THEN
  IF jsonb_typeof(p_payload->'targetClosureDate')<>'string' THEN RAISE EXCEPTION 'SALES_FIELD_MUST_BE_TEXT: targetClosureDate'; END IF;
  fields:=fields||jsonb_build_object('targetDate',p_payload->>'targetClosureDate');
 END IF;
 IF NULLIF(fields->>'targetDate','') IS NOT NULL THEN
  IF (fields->>'targetDate') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'SALES_DATE_INVALID'; END IF;
  due:=(fields->>'targetDate')::date::timestamp AT TIME ZONE 'Asia/Kolkata';
 END IF;
 IF requested THEN
  selected:=p_payload->'feasibilityDepts';
  IF selected IS NULL OR jsonb_typeof(selected)<>'array' OR jsonb_array_length(selected)=0 THEN RAISE EXCEPTION 'SALES_REVIEW_DEPARTMENTS_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(selected) item WHERE jsonb_typeof(item)<>'string') OR (SELECT count(*)<>count(DISTINCT item) FROM jsonb_array_elements_text(selected) item) THEN RAISE EXCEPTION 'SALES_REVIEW_DEPARTMENTS_INVALID'; END IF;
  FOR review_code IN SELECT jsonb_array_elements_text(selected) LOOP
   IF NOT EXISTS(SELECT 1 FROM public.departments WHERE organization_id=a.organization_id AND active AND departments.code=review_code AND departments.code<>'CLIENT') THEN RAISE EXCEPTION 'SALES_REVIEW_DEPARTMENT_INVALID: %',review_code; END IF;
  END LOOP;
  fields:=fields||jsonb_build_object('requiredDepartments',(SELECT string_agg(item,',') FROM jsonb_array_elements_text(selected) item),'feasibilityDispatchedAt',now());
 END IF;
 IF entity IS NULL THEN
  result:=public.mutate_shared_test_workspace('create_record',jsonb_build_object('title',title,'reference',reference,'record_type',CASE WHEN mode='enquiry' THEN 'Enquiry' ELSE 'Opportunity' END,'project_id',NULL,'department_id',department,'fields',fields,'notes',COALESCE(p_payload->>'scopeSummary','')),gen_random_uuid());
  entity:=(result->>'id')::uuid;
 ELSE
  UPDATE public.operational_records SET record_type='Opportunity',title=COALESCE(intake.title,src.title),fields=intake.fields,notes=COALESCE(p_payload->>'scopeSummary',src.notes),updated_by=auth.uid() WHERE id=entity;
 END IF;
 sheet:=public.mutate_project_input_sheet('create',jsonb_build_object('sourceId',entity,'scope','Client'));
 IF p_payload ? 'parameterValues' THEN
  IF jsonb_typeof(p_payload->'parameterValues')<>'object' THEN RAISE EXCEPTION 'SALES_PARAMETERS_INVALID'; END IF;
  FOR key,value IN SELECT * FROM jsonb_each(p_payload->'parameterValues') LOOP
   IF jsonb_typeof(value)<>'string' THEN RAISE EXCEPTION 'SALES_PARAMETER_MUST_BE_TEXT'; END IF;
   IF trim(value#>>'{}')='' THEN CONTINUE; END IF;
   IF (sheet->'parameter_values'->key->>'input')=value#>>'{}' THEN CONTINUE; END IF;
   IF NULLIF(trim(sheet->'parameter_values'->key->>'input'),'') IS NOT NULL OR NULLIF(trim(sheet->'parameter_values'->key->>'finalValue'),'') IS NOT NULL THEN RAISE EXCEPTION 'SALES_EXISTING_INPUT_PRESERVED: %',key; END IF;
   sheet:=public.mutate_project_input_sheet('input',jsonb_build_object('sheetId',sheet->>'id','expectedVersion',(sheet->>'version')::integer,'parameterId',key,'input',value,'source',reference||' / Sales intake','finalValue','','required',true,'exclusionReason',''));
  END LOOP;
 END IF;
 IF requested THEN
  FOR review_code IN SELECT jsonb_array_elements_text(selected) LOOP
   SELECT id,lead_member_id INTO reviewer,assigned FROM public.departments WHERE organization_id=a.organization_id AND active AND departments.code=review_code;
   PERFORM public.mutate_shared_test_workspace('request_approval',jsonb_build_object('record_id',entity,'reviewer_department_id',reviewer),gen_random_uuid());
   IF assigned IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.organization_members WHERE id=assigned AND organization_id=a.organization_id AND active AND private.shared_test_member_department(id)=reviewer) THEN assigned:=NULL; END IF;
   INSERT INTO public.tasks(organization_id,department_id,record_id,title,priority,assignee_id,due_at,created_by)
   VALUES(a.organization_id,reviewer,entity,'Feasibility · '||reference,'High',assigned,due,auth.uid());
   review_count:=review_count+1;
  END LOOP;
 END IF;
 INSERT INTO public.audit_events(organization_id,actor_id,entity_type,entity_id,action,detail)
 VALUES(a.organization_id,auth.uid(),'sales_intake',entity,'sales_'||mode,jsonb_build_object('membership_id',a.membership_id,'source_id',entity,'sheet_id',sheet->>'id','review_count',review_count,'previous_type',src.record_type));
 result:=jsonb_build_object('id',entity,'reference',reference,'sheetId',sheet->>'id','reviewCount',review_count,'mode',mode);
 INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response) VALUES(a.organization_id,auth.uid(),p_request_id,digest,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.mutate_sales_intake(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_sales_intake(jsonb,uuid) TO authenticated;

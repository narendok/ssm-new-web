-- Preserve existing data; reject missing ticket states and invalid source types.
CREATE OR REPLACE FUNCTION public.mutate_business_workspace(p_action text,p_payload jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='Asia/Kolkata' AS $$
DECLARE a record; i business_items%ROWTYPE; allocation business_items%ROWTYPE; t business_items%ROWTYPE;
 org uuid; mid uuid; dept uuid; item_id uuid; project uuid; data jsonb; result jsonb; sig text; old_request record; member record;
 amount numeric; actual numeric; available numeric; next_state text; is_fin boolean; is_hr boolean; is_service boolean; q jsonb; answer jsonb; count_q integer; score numeric; cycle text;
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATED_MEMBERSHIP_REQUIRED'; END IF;
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>131072 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 org:=a.organization_id; mid:=a.membership_id;
 is_fin:=COALESCE(a.role='admin' OR (a.role='department_lead' AND a.department_code='FIN'),false);
 is_hr:=COALESCE(a.role='admin' OR (a.role='department_lead' AND a.department_code IN ('HR','HROPS')),false);
 is_service:=COALESCE(a.role='admin' OR (a.role<>'viewer' AND a.department_code='SIT'),false);
 -- One organization lock serializes budget reservations, retries and campaign occurrences.
 PERFORM 1 FROM organizations WHERE id=org FOR UPDATE;
 sig:=encode(sha256(convert_to(p_action||p_payload::text,'UTF8')),'hex');
 SELECT * INTO old_request FROM private.business_requests WHERE organization_id=org AND actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN IF old_request.signature<>sig THEN RAISE EXCEPTION 'RETRY_PAYLOAD_CHANGED'; END IF; RETURN old_request.result; END IF;
 data:=COALESCE(p_payload->'data','{}'); item_id:=NULLIF(p_payload->>'id','')::uuid;
 IF item_id IS NOT NULL THEN
  SELECT * INTO i FROM business_items WHERE id=item_id AND organization_id=org FOR UPDATE;
  IF NOT FOUND OR NOT COALESCE(private.business_visible(i,to_jsonb(a)),false) THEN RAISE EXCEPTION 'ITEM_UNAVAILABLE'; END IF;
  IF i.version IS DISTINCT FROM (p_payload->>'version')::int THEN RAISE EXCEPTION 'STALE_VERSION'; END IF;
 END IF;
 IF p_action='allocate' THEN
  IF NOT is_fin THEN RAISE EXCEPTION 'FINANCE_AUTHORITY_REQUIRED'; END IF;
  dept:=(data->>'departmentId')::uuid; project:=NULLIF(data->>'projectId','')::uuid;
  IF NOT EXISTS(SELECT 1 FROM departments WHERE id=dept AND organization_id=org AND active) THEN RAISE EXCEPTION 'INVALID_DEPARTMENT'; END IF;
  IF project IS NOT NULL AND NOT EXISTS(SELECT 1 FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL) THEN RAISE EXCEPTION 'INVALID_PROJECT'; END IF;
  amount:=(data->>'allocatedAmount')::numeric;
  IF amount IS NULL OR amount<=0 OR amount>1e12 OR length(trim(COALESCE(data->>'category','')))=0 OR COALESCE(data->>'currency','') !~ '^[A-Z]{3}$' OR NULLIF(trim(data->>'periodId'),'') IS NULL OR (data->>'startDate')::date IS NULL OR (data->>'endDate')::date IS NULL OR (data->>'endDate')::date<(data->>'startDate')::date OR COALESCE((data->>'financeLimit')::numeric,0)<0 THEN RAISE EXCEPTION 'INVALID_ALLOCATION'; END IF;
  -- Allocation revisions are new approved allocations; committed/spent rows cannot be overwritten by client arrays.
  INSERT INTO business_items(organization_id,kind,department_id,project_id,owner_id,payload) VALUES(org,'allocation',dept,project,mid,
   jsonb_build_object('category',data->>'category','allocatedAmount',amount,'committedAmount',0,'spentAmount',0,'currency',data->>'currency','periodId',data->>'periodId','startDate',data->>'startDate','endDate',data->>'endDate','financeLimit',NULLIF(data->>'financeLimit','')::numeric,'approvedBy',a.display_name)) RETURNING id INTO item_id;
 ELSIF p_action='request_expense' THEN
  IF a.role NOT IN ('admin','department_lead','member') THEN RAISE EXCEPTION 'EXPENSE_REQUEST_DENIED'; END IF;
  dept:=private.shared_test_member_department(mid); IF dept IS NULL THEN dept:=NULLIF(data->>'departmentId','')::uuid; END IF;
  IF dept IS NULL OR NOT EXISTS(SELECT 1 FROM departments WHERE id=dept AND organization_id=org AND active) THEN RAISE EXCEPTION 'DEPARTMENT_REQUIRED'; END IF;
  amount:=(data->>'amount')::numeric; project:=NULLIF(data->>'projectId','')::uuid;
  IF amount IS NULL OR amount<=0 OR amount>1e12 OR length(trim(COALESCE(data->>'purpose','')))<3 OR COALESCE(data->>'currency','') !~ '^[A-Z]{3}$' OR NULLIF(trim(data->>'category'),'') IS NULL OR (data->>'requiredDate')::date IS NULL THEN RAISE EXCEPTION 'INVALID_EXPENSE'; END IF;
  IF project IS NOT NULL AND NOT EXISTS(SELECT 1 FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND private.shared_test_record_visible(id) AND archived_at IS NULL) THEN RAISE EXCEPTION 'INVALID_PROJECT'; END IF;
  next_state:=CASE WHEN a.role IN ('department_lead','admin') THEN 'Pending_Finance' ELSE 'Pending_Dept_Review' END;
  -- A Finance lead's own claim is routed to Admin, never back to themselves.
  IF a.role='department_lead' AND a.department_code='FIN' THEN next_state:='Pending_Admin'; END IF;
  INSERT INTO business_items(organization_id,kind,owner_id,department_id,project_id,payload) VALUES(org,'expense',mid,dept,project,
   jsonb_build_object('requesterName',a.display_name,'requesterId',mid,'amount',amount,'currency',data->>'currency','purpose',data->>'purpose','category',data->>'category','requiredDate',data->>'requiredDate','status',next_state,'createdAt',now(),'updatedAt',now())) RETURNING id INTO item_id;
 ELSIF p_action IN ('approve_expense','reject_expense','post_expense') THEN
  IF i.kind IS DISTINCT FROM 'expense' THEN RAISE EXCEPTION 'EXPENSE_REQUIRED'; END IF;
  IF i.owner_id=mid THEN RAISE EXCEPTION 'SELF_APPROVAL_DENIED'; END IF;
  next_state:=i.payload->>'status';
  IF p_action='post_expense' THEN
   IF NOT is_fin OR next_state<>'Approved' THEN RAISE EXCEPTION 'POSTING_AUTHORITY_OR_STATE_DENIED'; END IF;
  ELSE
   IF NOT COALESCE(((next_state='Pending_Dept_Review' AND ((a.role='department_lead' AND i.department_id=private.shared_test_member_department(mid)) OR a.role='admin')) OR (next_state='Pending_Finance' AND is_fin) OR (next_state='Pending_Admin' AND a.role='admin')),false) THEN RAISE EXCEPTION 'REVIEW_AUTHORITY_OR_STATE_DENIED'; END IF;
  END IF;
  IF p_action='reject_expense' THEN
   IF length(trim(COALESCE(data->>'reason','')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
   data:=i.payload||jsonb_build_object('status','Rejected','decisionReason',data->>'reason','reviewedBy',mid,'updatedAt',now());
  ELSIF next_state='Pending_Dept_Review' THEN
   data:=i.payload||jsonb_build_object('status','Pending_Finance','departmentApprovedBy',mid,'updatedAt',now());
  ELSE
   amount:=(i.payload->>'amount')::numeric;
   IF p_action='post_expense' THEN
    SELECT * INTO allocation FROM business_items WHERE id=(i.payload->>'allocationId')::uuid AND organization_id=org AND kind='allocation' FOR UPDATE;
   ELSE
    SELECT * INTO allocation FROM business_items WHERE id=(data->>'allocationId')::uuid AND organization_id=org AND kind='allocation' AND department_id=i.department_id AND project_id IS NOT DISTINCT FROM i.project_id AND payload->>'category'=i.payload->>'category' AND payload->>'currency'=i.payload->>'currency' AND current_date BETWEEN (payload->>'startDate')::date AND (payload->>'endDate')::date FOR UPDATE;
   END IF;
   IF NOT FOUND THEN RAISE EXCEPTION 'EXACT_ACTIVE_ALLOCATION_REQUIRED'; END IF;
   available:=(allocation.payload->>'allocatedAmount')::numeric-(allocation.payload->>'spentAmount')::numeric-(allocation.payload->>'committedAmount')::numeric;
   IF p_action='post_expense' THEN
    actual:=(data->>'actualAmount')::numeric;
    IF actual IS NULL OR actual<0 OR actual>1e12 OR length(trim(COALESCE(data->>'postingRef','')))<3 OR length(trim(COALESCE(data->>'evidenceRef','')))<3 OR (allocation.payload->>'committedAmount')::numeric<amount OR actual-amount>available THEN RAISE EXCEPTION 'INVALID_OR_UNFUNDED_POSTING'; END IF;
    UPDATE business_items SET payload=payload||jsonb_build_object('committedAmount',(payload->>'committedAmount')::numeric-amount,'spentAmount',(payload->>'spentAmount')::numeric+actual),version=version+1,updated_at=now() WHERE id=allocation.id;
    data:=i.payload||jsonb_build_object('status','Settled','actualAmount',actual,'postingRef',data->>'postingRef','evidenceRef',data->>'evidenceRef','postedBy',mid,'updatedAt',now());
   ELSE
    IF amount>available THEN RAISE EXCEPTION 'INSUFFICIENT_BUDGET'; END IF;
    IF next_state='Pending_Finance' AND a.role<>'admin' AND ((allocation.payload->>'financeLimit') IS NULL OR amount>(allocation.payload->>'financeLimit')::numeric) THEN
     data:=i.payload||jsonb_build_object('status','Pending_Admin','financeApprovedBy',mid,'updatedAt',now());
    ELSE
     UPDATE business_items SET payload=payload||jsonb_build_object('committedAmount',(payload->>'committedAmount')::numeric+amount),version=version+1,updated_at=now() WHERE id=allocation.id;
     data:=i.payload||jsonb_build_object('status','Approved','allocationId',allocation.id,'approvedBy',mid,'updatedAt',now());
    END IF;
   END IF;
  END IF;
  UPDATE business_items SET payload=data,version=version+1,updated_at=now() WHERE id=i.id;
 ELSIF p_action='ticket_create' THEN
  IF length(trim(COALESCE(data->>'subject','')))<3 OR length(trim(COALESCE(data->>'description','')))<3 THEN RAISE EXCEPTION 'TICKET_DETAILS_REQUIRED'; END IF;
  project:=NULLIF(data->>'projectId','')::uuid;
  IF project IS NOT NULL AND NOT EXISTS(SELECT 1 FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL AND private.shared_test_record_visible(id)) THEN RAISE EXCEPTION 'INVALID_PROJECT'; END IF;
  IF COALESCE(data->>'priority','') NOT IN ('Critical','High','Normal','Low') THEN RAISE EXCEPTION 'INVALID_PRIORITY'; END IF;
  INSERT INTO business_items(organization_id,kind,owner_id,department_id,project_id,payload) VALUES(org,'ticket',mid,private.shared_test_member_department(mid),project,
   jsonb_build_object('subject',data->>'subject','description',data->>'description','category',data->>'category','priority',data->>'priority','source',CASE WHEN a.role='viewer' THEN 'Client' ELSE 'Internal' END,'requesterName',a.display_name,'status','Open','replies','[]'::jsonb,'history',jsonb_build_array(jsonb_build_object('timestamp',now(),'actor',a.display_name,'action','Created')),'createdAt',now(),'updatedAt',now())) RETURNING id INTO item_id;
 ELSIF p_action IN ('ticket_reply','ticket_status') THEN
  IF i.kind IS DISTINCT FROM 'ticket' THEN RAISE EXCEPTION 'TICKET_REQUIRED'; END IF;
  IF p_action='ticket_reply' THEN
   IF length(trim(COALESCE(data->>'message','')))<1 THEN RAISE EXCEPTION 'MESSAGE_REQUIRED'; END IF;
   IF COALESCE((data->>'isInternalNote')::boolean,false) AND NOT (is_service OR a.department_code='SAL') THEN RAISE EXCEPTION 'INTERNAL_NOTE_DENIED'; END IF;
   data:=i.payload||jsonb_build_object('replies',COALESCE(i.payload->'replies','[]')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'authorName',a.display_name,'authorRole',a.role,'isInternalNote',COALESCE((data->>'isInternalNote')::boolean,false),'message',data->>'message','createdAt',now())),'updatedAt',now());
  ELSE
   IF NOT is_service THEN RAISE EXCEPTION 'SERVICE_AUTHORITY_REQUIRED'; END IF;
   next_state:=data->>'status';
   IF next_state IS NULL OR next_state NOT IN ('Open','Assigned','In Progress','Waiting','Resolved','Closed') THEN RAISE EXCEPTION 'INVALID_TICKET_TRANSITION'; END IF;
   IF NOT ((i.payload->>'status'='Open' AND next_state='Assigned') OR (i.payload->>'status'='Assigned' AND next_state='In Progress') OR (i.payload->>'status'='In Progress' AND next_state IN ('Waiting','Resolved')) OR (i.payload->>'status'='Waiting' AND next_state='In Progress') OR (i.payload->>'status'='Resolved' AND next_state IN ('Closed','In Progress')) OR (i.payload->>'status'='Closed' AND next_state='Open' AND length(trim(COALESCE(data->>'reason','')))>=3)) THEN RAISE EXCEPTION 'INVALID_TICKET_TRANSITION'; END IF;
   data:=i.payload||jsonb_build_object('status',next_state,'history',COALESCE(i.payload->'history','[]')||jsonb_build_array(jsonb_build_object('timestamp',now(),'actor',a.display_name,'action',next_state,'reason',data->>'reason')),'updatedAt',now());
  END IF;
  UPDATE business_items SET payload=data,version=version+1,updated_at=now() WHERE id=i.id;
 ELSIF p_action='save_profile' THEN
  IF NOT is_hr THEN RAISE EXCEPTION 'HR_AUTHORITY_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM organization_members WHERE id=(data->>'memberId')::uuid AND organization_id=org AND active AND role<>'viewer') THEN RAISE EXCEPTION 'INVALID_EMPLOYEE'; END IF;
  IF i.id IS NOT NULL AND (i.kind<>'profile' OR i.owner_id<>(data->>'memberId')::uuid) THEN RAISE EXCEPTION 'PROFILE_IDENTITY_IMMUTABLE'; END IF;
  data:=jsonb_build_object('employeeCode',data->>'employeeCode','email',data->>'email','phone',data->>'phone','roleTitle',data->>'roleTitle','joiningDate',data->>'joiningDate','facilityLocation',data->>'facilityLocation','emergencyContact',data->>'emergencyContact');
  IF i.id IS NULL THEN
   IF EXISTS(SELECT 1 FROM business_items WHERE organization_id=org AND kind='profile' AND owner_id=(p_payload->'data'->>'memberId')::uuid) THEN RAISE EXCEPTION 'PROFILE_EXISTS'; END IF;
   INSERT INTO business_items(organization_id,kind,owner_id,payload) VALUES(org,'profile',(p_payload->'data'->>'memberId')::uuid,data) RETURNING id INTO item_id;
  ELSE UPDATE business_items SET payload=data,version=version+1,updated_at=now() WHERE id=i.id; END IF;
 ELSIF p_action='publish_template' THEN
  IF NOT is_hr THEN RAISE EXCEPTION 'HR_AUTHORITY_REQUIRED'; END IF;
  IF COALESCE(data->>'type','') NOT IN ('policy','training','form') OR length(trim(COALESCE(data->>'title','')))<3 OR jsonb_typeof(data->'audienceIds') IS DISTINCT FROM 'array' OR jsonb_array_length(data->'audienceIds')<1 THEN RAISE EXCEPTION 'TEMPLATE_DETAILS_REQUIRED'; END IF;
  IF COALESCE((data->>'isAnonymous')::boolean,false) AND data->>'type'<>'form' THEN RAISE EXCEPTION 'ANONYMOUS_FORM_ONLY'; END IF;
  IF (data->>'dueDate')::date IS NULL OR (data->>'dueDate')::date < current_date OR COALESCE((data->>'cadenceDays')::int,0)<0 THEN RAISE EXCEPTION 'INVALID_CAMPAIGN_DATES'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(data->'audienceIds') x WHERE NOT EXISTS(SELECT 1 FROM organization_members m WHERE m.id=x::uuid AND m.organization_id=org AND m.active AND m.role<>'viewer')) THEN RAISE EXCEPTION 'INVALID_AUDIENCE'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(data->'questions','[]')) definition GROUP BY definition->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'DUPLICATE_QUESTION_ID'; END IF;
  FOR q IN SELECT value FROM jsonb_array_elements(COALESCE(data->'questions','[]')) LOOP
   IF COALESCE(q->>'type','') NOT IN ('text','number','choice','rating','boolean','date') OR length(trim(COALESCE(q->>'label','')))=0 OR length(trim(COALESCE(q->>'id','')))=0 THEN RAISE EXCEPTION 'INVALID_QUESTION'; END IF;
   IF q->>'type'='choice' AND (jsonb_typeof(q->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(q->'options')<2 OR EXISTS(SELECT 1 FROM jsonb_array_elements(q->'options') x WHERE jsonb_typeof(x)<>'string' OR x='""')) THEN RAISE EXCEPTION 'INVALID_CHOICES'; END IF;
  END LOOP;
  IF data->>'type' IN ('form','training') AND jsonb_array_length(COALESCE(data->'questions','[]'))<1 THEN RAISE EXCEPTION 'QUESTIONS_REQUIRED'; END IF;
  INSERT INTO business_items(organization_id,kind,owner_id,payload) VALUES(org,'template',mid,data||jsonb_build_object('revision',1,'publishedAt',now())) RETURNING id INTO item_id;
  FOR member IN SELECT m.* FROM organization_members m WHERE m.organization_id=org AND m.active AND m.role<>'viewer' AND data->'audienceIds' ? m.id::text LOOP
   INSERT INTO business_items(organization_id,kind,owner_id,department_id,payload) VALUES(org,'assignment',member.id,private.shared_test_member_department(member.id),jsonb_build_object('templateId',item_id,'cycle',current_date::text,'dueDate',data->>'dueDate','status','Pending'));
  END LOOP;
 ELSIF p_action='submit_assignment' THEN
  IF i.kind IS DISTINCT FROM 'assignment' OR i.owner_id<>mid OR i.payload->>'status' IN ('Completed','Submitted') THEN RAISE EXCEPTION 'ASSIGNMENT_DENIED'; END IF;
  SELECT * INTO t FROM business_items WHERE id=(i.payload->>'templateId')::uuid AND organization_id=org AND kind='template';
  IF NOT FOUND THEN RAISE EXCEPTION 'PUBLISHED_TEMPLATE_REQUIRED'; END IF;
  IF t.payload->>'type'='policy' THEN
   IF NOT COALESCE((data->>'acknowledged')::boolean,false) THEN RAISE EXCEPTION 'ACKNOWLEDGMENT_REQUIRED'; END IF;
  ELSE
   IF jsonb_typeof(data->'answers') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'ANSWERS_REQUIRED'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(data->'answers') k WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(t.payload->'questions','[]')) definition WHERE definition->>'id'=k)) THEN RAISE EXCEPTION 'UNKNOWN_ANSWER_KEY'; END IF;
   FOR q IN SELECT value FROM jsonb_array_elements(COALESCE(t.payload->'questions','[]')) LOOP
    answer:=data->'answers'->(q->>'id');
    IF COALESCE((q->>'required')::boolean,false) AND (answer IS NULL OR answer='null' OR answer='""' OR (jsonb_typeof(answer)='string' AND length(trim(answer#>>'{}'))=0)) THEN RAISE EXCEPTION 'REQUIRED_ANSWER_MISSING'; END IF;
    IF answer IS NOT NULL AND answer<>'null' AND answer<>'""' THEN
     IF q->>'type' IN ('text','date') AND jsonb_typeof(answer)<>'string' THEN RAISE EXCEPTION 'INVALID_TEXT_ANSWER'; END IF;
     IF q->>'type'='date' AND (answer#>>'{}')::date IS NULL THEN RAISE EXCEPTION 'INVALID_DATE_ANSWER'; END IF;
     IF q->>'type' IN ('number','rating') AND (jsonb_typeof(answer)<>'number' OR (q->>'type'='rating' AND (answer::text::numeric<1 OR answer::text::numeric>5))) THEN RAISE EXCEPTION 'INVALID_NUMERIC_ANSWER'; END IF;
     IF q->>'type'='boolean' AND jsonb_typeof(answer)<>'boolean' THEN RAISE EXCEPTION 'INVALID_BOOLEAN_ANSWER'; END IF;
     IF q->>'type'='choice' AND NOT(q->'options' @> jsonb_build_array(answer)) THEN RAISE EXCEPTION 'INVALID_CHOICE'; END IF;
    END IF;
   END LOOP;
   INSERT INTO private.business_answers(organization_id,template_id,assignment_id,member_id,answers) VALUES(org,t.id,
    CASE WHEN COALESCE((t.payload->>'isAnonymous')::boolean,false) THEN NULL ELSE i.id END,
    CASE WHEN COALESCE((t.payload->>'isAnonymous')::boolean,false) THEN NULL ELSE mid END,data->'answers');
  END IF;
  UPDATE business_items SET payload=payload||jsonb_build_object('status',CASE WHEN t.payload->>'type'='training' THEN 'Submitted' ELSE 'Completed' END,'completedDay',current_date),version=version+1,updated_at=date_trunc('day',now()) WHERE id=i.id;
 ELSIF p_action='review_training' THEN
  IF NOT is_hr OR i.kind IS DISTINCT FROM 'assignment' OR i.payload->>'status'<>'Submitted' OR i.owner_id=mid THEN RAISE EXCEPTION 'TRAINING_REVIEW_DENIED'; END IF;
  SELECT * INTO t FROM business_items WHERE id=(i.payload->>'templateId')::uuid AND organization_id=org AND kind='template' AND payload->>'type'='training';
  IF NOT FOUND OR length(trim(COALESCE(data->>'evidenceRef','')))<3 THEN RAISE EXCEPTION 'TRAINING_EVIDENCE_REQUIRED'; END IF;
  UPDATE business_items SET payload=payload||jsonb_build_object('status','Completed','verifiedBy',mid,'verifiedAt',now(),'evidenceRef',data->>'evidenceRef'),version=version+1,updated_at=now() WHERE id=i.id;
 ELSIF p_action='channel_create' THEN
  IF a.role NOT IN ('admin','department_lead') OR jsonb_typeof(data->'memberIds') IS DISTINCT FROM 'array' OR NOT(data->'memberIds' ? mid::text) THEN RAISE EXCEPTION 'CHANNEL_AUTHORITY_REQUIRED'; END IF;
  IF length(trim(COALESCE(data->>'name','')))<2 THEN RAISE EXCEPTION 'CHANNEL_NAME_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(data->'memberIds') x WHERE NOT EXISTS(SELECT 1 FROM organization_members m WHERE m.id=x::uuid AND m.organization_id=org AND m.active AND m.role<>'viewer')) THEN RAISE EXCEPTION 'INVALID_PARTICIPANT'; END IF;
  INSERT INTO business_items(organization_id,kind,owner_id,payload) VALUES(org,'channel',mid,jsonb_build_object('name',data->>'name','memberIds',data->'memberIds','topic',data->>'topic')) RETURNING id INTO item_id;
 ELSIF p_action='send_message' THEN
  SELECT * INTO t FROM business_items WHERE id=(data->>'channelId')::uuid AND kind='channel' AND private.business_visible(business_items,to_jsonb(a));
  IF NOT FOUND OR length(trim(COALESCE(data->>'text','')))<1 THEN RAISE EXCEPTION 'CHANNEL_OR_MESSAGE_DENIED'; END IF;
  IF data ? 'poll' AND (jsonb_typeof(data->'poll'->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(data->'poll'->'options')<2 OR jsonb_array_length(data->'poll'->'options')>10 OR length(trim(COALESCE(data->'poll'->>'question','')))<1 OR (data->'poll'->>'closesAt')::timestamptz IS NULL OR (data->'poll'->>'closesAt')::timestamptz<=now() OR EXISTS(SELECT 1 FROM jsonb_array_elements(data->'poll'->'options') x WHERE jsonb_typeof(x)<>'string' OR x='""')) THEN RAISE EXCEPTION 'INVALID_POLL'; END IF;
  INSERT INTO business_items(organization_id,kind,owner_id,payload) VALUES(org,'message',mid,jsonb_build_object('channelId',t.id,'text',data->>'text','senderName',a.display_name,'senderDept',a.department_code,'type',COALESCE(data->>'type','update'),'tags',COALESCE(data->'tags','[]'),'createdAt',now(),'poll',CASE WHEN data ? 'poll' THEN jsonb_build_object('question',data->'poll'->>'question','options',data->'poll'->'options','closesAt',data->'poll'->>'closesAt') ELSE NULL END)) RETURNING id INTO item_id;
 ELSIF p_action='poll_vote' THEN
  IF i.kind IS DISTINCT FROM 'message' OR (i.payload->'poll' IS NULL OR i.payload->'poll'='null') OR (i.payload->'poll'->>'closesAt')::timestamptz IS NULL OR (i.payload->'poll'->>'closesAt')::timestamptz<=now() THEN RAISE EXCEPTION 'POLL_CLOSED_OR_UNAVAILABLE'; END IF;
  count_q:=(data->>'choice')::int;
  IF count_q IS NULL OR count_q<0 OR count_q>=jsonb_array_length(i.payload->'poll'->'options') THEN RAISE EXCEPTION 'INVALID_POLL_OPTION'; END IF;
  INSERT INTO private.business_votes(message_id,member_id,choice) VALUES(i.id,mid,count_q) ON CONFLICT(message_id,member_id) DO UPDATE SET choice=excluded.choice;
 ELSE RAISE EXCEPTION 'UNKNOWN_BUSINESS_ACTION'; END IF;
 PERFORM private.business_notify(item_id);
 IF p_action='publish_template' THEN PERFORM private.business_notify(id) FROM business_items WHERE organization_id=org AND kind='assignment' AND payload->>'templateId'=item_id::text; END IF;
 result:=jsonb_build_object('id',item_id,'saved',true);
 INSERT INTO private.business_requests VALUES(org,auth.uid(),p_request_id,sig,result);
 -- Never include survey answers or anonymous response IDs in audit details.
 INSERT INTO audit_events(organization_id,actor_id,entity_type,entity_id,action,detail) VALUES(org,auth.uid(),'business_item',item_id,p_action,jsonb_build_object('version',COALESCE(i.version,0)+1));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) TO authenticated;


-- Keep original shared operations and IDs; honor saved priorities and review locks.
CREATE OR REPLACE FUNCTION public.mutate_shared_test_workspace(p_action text,p_payload jsonb,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; m organization_members%ROWTYPE; r operational_records%ROWTYPE; t tasks%ROWTYPE; p approvals%ROWTYPE;
 org uuid; dept uuid; reviewer uuid; assignee uuid; project uuid; entity uuid; record_fields jsonb; payload_hash text; replay record; result jsonb;
 rec_type text;
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.role='viewer' THEN RAISE EXCEPTION 'TEST_WRITE_DENIED'; END IF;
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>131072 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 org:=a.organization_id; dept:=private.shared_test_member_department(a.membership_id);
 IF a.role<>'admin' AND dept IS NULL THEN RAISE EXCEPTION 'DEPARTMENT_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text,0));
 payload_hash:=encode(sha256(convert_to(p_action||p_payload::text,'UTF8')),'hex');
 SELECT * INTO replay FROM private.shared_test_requests WHERE organization_id=org AND actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN IF replay.request_hash<>payload_hash THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF; RETURN replay.response; END IF;
 IF p_action IN ('create_project','create_record','create_task','create_document') AND NULLIF(trim(p_payload->>'title'),'') IS NULL THEN RAISE EXCEPTION 'TITLE_REQUIRED'; END IF;
 rec_type:=trim(COALESCE(p_payload->>'record_type',''));
 IF p_action = 'create_task' THEN
  project:=(p_payload->>'project_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL) THEN RAISE EXCEPTION 'PROJECT_REQUIRED'; END IF;
  IF a.role='admin' THEN dept:=NULLIF(p_payload->>'department_id','')::uuid; END IF;
  IF NOT EXISTS(SELECT 1 FROM departments WHERE id=dept AND organization_id=org AND active AND code<>'CLIENT') THEN RAISE EXCEPTION 'DEPARTMENT_REQUIRED'; END IF;
 ELSIF p_action = 'create_record' THEN
  IF rec_type IN ('Supplier','Part','Customer') THEN
   project:=NULLIF(p_payload->>'project_id','')::uuid;
   IF project IS NOT NULL AND NOT EXISTS(SELECT 1 FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL) THEN RAISE EXCEPTION 'PROJECT_REQUIRED'; END IF;
   IF rec_type = 'Supplier' THEN
    IF a.role<>'admin' AND COALESCE(a.department_code,'')<>'PUR' THEN RAISE EXCEPTION 'SUPPLIER_CREATE_DENIED: Only Purchasing or Admin can register suppliers'; END IF;
    SELECT id INTO dept FROM departments WHERE organization_id=org AND code='PUR' AND active;
   ELSIF rec_type = 'Customer' THEN
    IF a.role<>'admin' AND COALESCE(a.department_code,'')<>'SAL' THEN RAISE EXCEPTION 'CUSTOMER_CREATE_DENIED: Only Sales or Admin can register customers'; END IF;
    SELECT id INTO dept FROM departments WHERE organization_id=org AND code='SAL' AND active;
   ELSIF rec_type = 'Part' THEN
    IF a.role<>'admin' AND COALESCE(a.department_code,'') NOT IN ('EHW','FW','SW','MECH','PUR') THEN RAISE EXCEPTION 'PART_CREATE_DENIED: Only Engineering or Purchasing can register parts'; END IF;
    IF a.role='admin' THEN dept:=NULLIF(p_payload->>'department_id','')::uuid; END IF;
    IF dept IS NULL THEN dept:=private.shared_test_member_department(a.membership_id); END IF;
   END IF;
  ELSE
   project:=(p_payload->>'project_id')::uuid;
   IF NOT EXISTS(SELECT 1 FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL) THEN RAISE EXCEPTION 'PROJECT_REQUIRED'; END IF;
   IF a.role='admin' THEN dept:=NULLIF(p_payload->>'department_id','')::uuid; END IF;
   IF NOT EXISTS(SELECT 1 FROM departments WHERE id=dept AND organization_id=org AND active AND code<>'CLIENT') THEN RAISE EXCEPTION 'DEPARTMENT_REQUIRED'; END IF;
  END IF;
 END IF;
 IF p_action='create_project' THEN
  IF a.role<>'admin' AND NOT (a.role='department_lead' AND a.department_code='SAL') THEN RAISE EXCEPTION 'PROJECT_CREATE_DENIED'; END IF;
  IF COALESCE(p_payload->>'reference','') !~ '^HLPL-[A-Z0-9]+(-[A-Z0-9]+)*$' THEN RAISE EXCEPTION 'PROJECT_CODE_REQUIRED'; END IF;
  SELECT id INTO dept FROM departments WHERE organization_id=org AND code='SAL' AND active;
  INSERT INTO operational_records(organization_id,department_id,area,record_type,reference,title,stage,fields,notes,created_by,updated_by,is_demo)
  VALUES(org,dept,'sales','Project',p_payload->>'reference',trim(p_payload->>'title'),'Stage 1',jsonb_build_object('revision','01'),COALESCE(p_payload->>'notes',''),auth.uid(),auth.uid(),true) RETURNING id INTO entity;
 ELSIF p_action='create_record' THEN
  IF lower(rec_type)='project' THEN RAISE EXCEPTION 'USE_PROJECT_CREATION'; END IF;
  IF COALESCE(p_payload->>'reference','') !~ '^HLPL-[A-Z0-9]+(-[A-Z0-9]+)*$' OR NULLIF(rec_type,'') IS NULL THEN RAISE EXCEPTION 'CONTROLLED_REFERENCE_REQUIRED'; END IF;
  record_fields:=COALESCE(p_payload->'fields','{}'::jsonb);
  IF jsonb_typeof(record_fields)<>'object' OR record_fields ?| ARRAY['last_stage_gate','lifecycleStage','currentStage'] OR NULLIF(trim(record_fields->>'revision'),'') IS NULL THEN RAISE EXCEPTION 'REVISION_REQUIRED'; END IF;
  IF rec_type IN ('Purchase order','Purchase Order','Mass production request') THEN
   IF EXISTS (SELECT 1 FROM operational_records sup WHERE sup.organization_id = org AND sup.record_type = 'Supplier' AND (sup.id::text = record_fields->>'supplier' OR sup.reference = record_fields->>'supplier' OR sup.title = record_fields->>'supplier') AND (sup.fields->>'verification_status' = 'Pending_Verification' OR sup.status = 'draft')) THEN
    RAISE EXCEPTION 'SUPPLIER_VERIFICATION_REQUIRED: Supplier is pending verification and cannot be used for production purchase orders';
   END IF;
  END IF;
  IF rec_type IN ('Release','Production order','BOM') AND COALESCE(record_fields->>'stage', p_payload->>'stage') = 'released' THEN
   IF EXISTS (SELECT 1 FROM operational_records prt WHERE prt.organization_id = org AND prt.record_type = 'Part' AND (prt.id::text = record_fields->>'part' OR prt.reference = record_fields->>'part' OR prt.fields->>'mpn' = record_fields->>'mpn') AND (prt.fields->>'release_status' = 'Engineering_Only' OR prt.status = 'draft')) THEN
    RAISE EXCEPTION 'PART_RELEASE_REQUIRED: Part is engineering-only and cannot be released to mass production';
   END IF;
  END IF;
  INSERT INTO operational_records(organization_id,department_id,area,record_type,reference,title,fields,notes,created_by,updated_by,is_demo)
  VALUES(org,dept,(SELECT lower(code) FROM departments WHERE id=dept),rec_type,p_payload->>'reference',trim(p_payload->>'title'),record_fields,COALESCE(p_payload->>'notes',''),auth.uid(),auth.uid(),true) RETURNING id INTO entity;
  IF project IS NOT NULL THEN
   INSERT INTO record_links(organization_id,source_record_id,target_record_id,relationship,created_by) VALUES(org,project,entity,'deliverable',auth.uid());
  END IF;
 ELSIF p_action='create_task' THEN
  assignee:=NULLIF(p_payload->>'assignee_id','')::uuid;
  IF a.role='member' THEN assignee:=a.membership_id; END IF;
  IF assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM organization_members WHERE id=assignee AND organization_id=org AND active AND role<>'viewer' AND private.shared_test_member_department(id)=dept) THEN RAISE EXCEPTION 'ASSIGNEE_DEPARTMENT_MISMATCH'; END IF;
  IF COALESCE(p_payload->>'priority','Normal') NOT IN ('Critical','High','Normal','Low') THEN RAISE EXCEPTION 'INVALID_TASK_PRIORITY'; END IF;
  INSERT INTO tasks(organization_id,department_id,record_id,title,assignee_id,due_at,priority,created_by)
  VALUES(org,dept,project,trim(p_payload->>'title'),assignee,NULLIF(p_payload->>'due_at','')::timestamptz,COALESCE(p_payload->>'priority','Normal'),auth.uid()) RETURNING id INTO entity;
 ELSIF p_action='update_task' THEN
  SELECT * INTO t FROM tasks WHERE id=(p_payload->>'id')::uuid AND organization_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_FOUND'; END IF;
  IF t.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN RAISE EXCEPTION 'STALE_WRITE: Reload before saving'; END IF;
  IF a.role<>'admin' AND NOT (a.role='department_lead' AND t.department_id=dept) AND NOT (a.role='member' AND t.assignee_id=a.membership_id) THEN RAISE EXCEPTION 'TASK_WRITE_DENIED'; END IF;
  IF p_payload->>'status' NOT IN ('Open','In Progress','In review','Complete') OR p_payload->>'status' IS NULL THEN RAISE EXCEPTION 'INVALID_TASK_STATUS'; END IF;
  IF t.status='In review' AND p_payload->>'status'='Complete' THEN RAISE EXCEPTION 'USE_LINKED_REVIEW_RECORD'; END IF;
  assignee:=t.assignee_id;
  IF p_payload ? 'assignee_id' THEN
   IF a.role<>'department_lead' THEN RAISE EXCEPTION 'TASK_ASSIGNMENT_DENIED'; END IF;
   assignee:=NULLIF(p_payload->>'assignee_id','')::uuid;
   IF assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM organization_members WHERE id=assignee AND organization_id=org AND active AND role<>'viewer' AND private.shared_test_member_department(id)=t.department_id) THEN RAISE EXCEPTION 'ASSIGNEE_DEPARTMENT_MISMATCH'; END IF;
  END IF;
  UPDATE tasks SET status=p_payload->>'status',assignee_id=assignee,updated_at=now() WHERE id=t.id; entity:=t.id;
 ELSIF p_action IN ('update_record','request_approval','create_document') THEN
  SELECT * INTO r FROM operational_records WHERE id=(p_payload->>'record_id')::uuid AND organization_id=org AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECORD_NOT_FOUND'; END IF;
  IF NOT private.shared_test_scope(org,r.department_id) THEN RAISE EXCEPTION 'RECORD_SCOPE_DENIED'; END IF;
  IF p_action='update_record' THEN
   IF r.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN RAISE EXCEPTION 'STALE_WRITE: Reload before saving'; END IF;
   IF r.record_type='Project' THEN RAISE EXCEPTION 'USE_STAGE_GATE'; END IF;
   IF a.role='member' AND r.created_by<>auth.uid() THEN RAISE EXCEPTION 'RECORD_WRITE_DENIED'; END IF;
   record_fields:=COALESCE(p_payload->'fields',r.fields);
   IF jsonb_typeof(record_fields)<>'object' OR record_fields ?| ARRAY['last_stage_gate','lifecycleStage','currentStage'] OR NULLIF(trim(record_fields->>'revision'),'') IS NULL THEN RAISE EXCEPTION 'REVISION_REQUIRED'; END IF;
   IF r.status IN ('approved','released') AND (record_fields->>'revision'=r.fields->>'revision' OR a.role='member') THEN RAISE EXCEPTION 'NEW_REVISION_REQUIRED'; END IF;
   UPDATE operational_records SET fields=record_fields,notes=COALESCE(p_payload->>'notes',notes),status='draft',updated_by=auth.uid() WHERE id=r.id; entity:=r.id;
  ELSIF p_action='request_approval' THEN
   IF NOT public.has_department_permission(org,r.department_id,'approvals:decide') THEN RAISE EXCEPTION 'REQUEST_AUTHORITY_DENIED'; END IF;
   reviewer:=(p_payload->>'reviewer_department_id')::uuid;
   IF NOT EXISTS(SELECT 1 FROM departments WHERE id=reviewer AND organization_id=org AND active AND code<>'CLIENT') THEN RAISE EXCEPTION 'REVIEWER_DEPARTMENT_REQUIRED'; END IF;
   IF EXISTS(SELECT 1 FROM approvals WHERE organization_id=org AND record_id=r.id AND reviewer_department_id=reviewer AND evidence_revision=r.fields->>'revision' AND outcome='pending') THEN RAISE EXCEPTION 'REVIEW_ALREADY_PENDING'; END IF;
   INSERT INTO approvals(organization_id,department_id,reviewer_department_id,record_id,title,created_by,evidence_record_id,evidence_revision)
   VALUES(org,r.department_id,reviewer,r.id,'Review · '||r.reference,auth.uid(),r.id,r.fields->>'revision') RETURNING id INTO entity;
   UPDATE operational_records SET status='in_review',updated_by=auth.uid() WHERE id=r.id;
  ELSE
   INSERT INTO documents(organization_id,department_id,record_id,title,document_type,reference_url,created_by)
   VALUES(org,r.department_id,r.id,trim(p_payload->>'title'),COALESCE(NULLIF(p_payload->>'document_type',''),'Controlled document'),'private',auth.uid()) RETURNING id INTO entity;
  END IF;
 ELSIF p_action='decide_approval' THEN
  SELECT * INTO p FROM approvals WHERE id=(p_payload->>'id')::uuid AND organization_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPROVAL_NOT_FOUND'; END IF;
  IF p.outcome<>'pending' THEN RAISE EXCEPTION 'DECISION_ALREADY_SAVED'; END IF;
  IF p.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN RAISE EXCEPTION 'STALE_WRITE: Reload before saving'; END IF;
  IF NOT public.has_department_permission(org,COALESCE(p.reviewer_department_id,p.department_id),'approvals:decide') THEN RAISE EXCEPTION 'SIGNING_AUTHORITY_DENIED'; END IF;
  IF p_payload->>'outcome' NOT IN ('approved','rejected','returned') OR p_payload->>'outcome' IS NULL THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
  UPDATE approvals SET outcome=(p_payload->>'outcome')::approval_outcome,approver_id=a.membership_id,decided_by=auth.uid(),decided_at=now(),decision_notes=COALESCE(p_payload->>'notes','') WHERE id=p.id;
  UPDATE operational_records SET status=CASE WHEN p_payload->>'outcome'='approved' AND NOT EXISTS(SELECT 1 FROM approvals WHERE record_id=p.record_id AND evidence_revision=p.evidence_revision AND outcome<>'approved') THEN 'approved'::portal_record_status ELSE 'in_review'::portal_record_status END,updated_by=auth.uid() WHERE id=p.record_id;
  entity:=p.id;
 ELSE RAISE EXCEPTION 'UNSUPPORTED_ACTION'; END IF;
 INSERT INTO audit_events(organization_id,actor_id,entity_type,entity_id,action,detail)
 VALUES(org,auth.uid(),'shared_test_workspace',entity,p_action,jsonb_build_object('membership_id',a.membership_id,'department',a.department_code));
 result:=jsonb_build_object('id',entity,'reference',COALESCE(p_payload->>'reference',''),'record_type',rec_type,'action',p_action,'saved_at',now());
 INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response) VALUES(org,auth.uid(),p_request_id,payload_hash,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.mutate_shared_test_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_shared_test_workspace(text,jsonb,uuid) TO authenticated;

-- Shared TEST expense routing: requester -> Procurement (goods/services) -> Finance,
-- or requester -> Finance (travel/reimbursement). No budget approval is bypassed.
DO $$
DECLARE
  fn text;
  before text;
BEGIN
  fn := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  before := fn;
  fn := replace(fn,
    'next_state text; is_fin boolean; is_hr boolean;',
    'next_state text; is_fin boolean; is_proc boolean; is_hr boolean;');
  fn := replace(fn,
    'is_fin:=COALESCE(a.role=''admin'' OR (a.role=''department_lead'' AND a.department_code=''FIN''),false);',
    'is_fin:=COALESCE(a.role=''admin'' OR (a.role=''department_lead'' AND a.department_code=''FIN''),false); is_proc:=COALESCE(a.role=''admin'' OR (a.role=''department_lead'' AND a.department_code=''PUR''),false);');
  fn := replace(fn,
    '  next_state:=CASE WHEN a.role IN (''department_lead'',''admin'') THEN ''Pending_Finance'' ELSE ''Pending_Dept_Review'' END;'||E'\n'||
    '  -- A Finance lead''s own claim is routed to Admin, never back to themselves.'||E'\n'||
    '  IF a.role=''department_lead'' AND a.department_code=''FIN'' THEN next_state:=''Pending_Admin''; END IF;'||E'\n'||
    '  INSERT INTO business_items(organization_id,kind,owner_id,department_id,project_id,payload) VALUES(org,''expense'',mid,dept,project,'||E'\n'||
    '   jsonb_build_object(''requesterName'',a.display_name,''requesterId'',mid,''amount'',amount,''currency'',data->>''currency'',''purpose'',data->>''purpose'',''category'',data->>''category'',''requiredDate'',data->>''requiredDate'',''status'',next_state,''createdAt'',now(),''updatedAt'',now())) RETURNING id INTO item_id;',
    '  IF COALESCE(data->>''requestType'',''travel'') NOT IN (''travel'',''reimbursement'',''purchase'') THEN RAISE EXCEPTION ''INVALID_EXPENSE_REQUEST_TYPE''; END IF;'||E'\n'||
    '  IF data->>''requestType''=''purchase'' AND length(trim(COALESCE(data->>''itemOrService'','''')))<3 THEN RAISE EXCEPTION ''PURCHASE_DETAILS_REQUIRED''; END IF;'||E'\n'||
    '  next_state:=CASE WHEN data->>''requestType''=''purchase'' THEN ''Pending_Procurement'' ELSE ''Pending_Finance'' END;'||E'\n'||
    '  IF data->>''requestType''=''purchase'' AND data->>''purchaseKind'' NOT IN (''goods'',''service'') THEN RAISE EXCEPTION ''PURCHASE_TYPE_REQUIRED''; END IF;'||E'\n'||
    '  -- Travel and reimbursement route directly to Finance; purchase goods/services must be reviewed by Procurement first.'||E'\n'||
    '  IF data->>''requestType''=''reimbursement'' AND length(trim(COALESCE(data->>''merchant'','''')))<2 THEN RAISE EXCEPTION ''REIMBURSEMENT_MERCHANT_REQUIRED''; END IF;'||E'\n'||
    '  INSERT INTO business_items(organization_id,kind,owner_id,department_id,project_id,payload) VALUES(org,''expense'',mid,dept,project,'||E'\n'||
    '   jsonb_build_object(''requesterName'',a.display_name,''requesterId'',mid,''amount'',amount,''currency'',data->>''currency'',''purpose'',data->>''purpose'',''category'',data->>''category'',''requiredDate'',data->>''requiredDate'',''requestType'',COALESCE(data->>''requestType'',''travel''),''purchaseKind'',data->>''purchaseKind'',''itemOrService'',data->>''itemOrService'',''quantity'',NULLIF(data->>''quantity'','''')::numeric,''supplierName'',data->>''supplierName'',''quotationReference'',data->>''quotationReference'',''destination'',data->>''destination'',''travelStartDate'',data->>''travelStartDate'',''travelEndDate'',data->>''travelEndDate'',''merchant'',data->>''merchant'',''expenseDate'',data->>''expenseDate'',''receiptReference'',data->>''receiptReference'',''status'',next_state,''createdAt'',now(),''updatedAt'',now())) RETURNING id INTO item_id;');
  IF fn = before THEN RAISE EXCEPTION 'EXPENSE_ROUTING_PATCH_NOT_APPLIED: request creation'; END IF;
  before := fn;
  fn := replace(fn,
    '(next_state=''Pending_Finance'' AND is_fin) OR (next_state=''Pending_Admin'' AND a.role=''admin'')',
    '(next_state=''Pending_Procurement'' AND is_proc) OR (next_state=''Pending_Finance'' AND is_fin) OR (next_state=''Pending_Admin'' AND a.role=''admin'')');
  fn := replace(fn,
    '  ELSIF next_state=''Pending_Dept_Review'' THEN'||E'\n'||
    '   data:=i.payload||jsonb_build_object(''status'',''Pending_Finance'',''departmentApprovedBy'',mid,''updatedAt'',now());',
    '  ELSIF next_state=''Pending_Procurement'' THEN'||E'\n'||
    '   data:=i.payload||jsonb_build_object(''status'',''Pending_Finance'',''procurementReviewedBy'',mid,''updatedAt'',now());'||E'\n'||
    '  ELSIF next_state=''Pending_Dept_Review'' THEN'||E'\n'||
    '   data:=i.payload||jsonb_build_object(''status'',''Pending_Finance'',''departmentApprovedBy'',mid,''updatedAt'',now());');
  IF fn = before THEN RAISE EXCEPTION 'EXPENSE_ROUTING_PATCH_NOT_APPLIED: review transition'; END IF;
  EXECUTE fn;
END $$;

CREATE OR REPLACE FUNCTION private.business_visible(p public.business_items,a jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public SET timezone='Asia/Kolkata' AS $$
DECLARE dept text:=a->>'department_code'; mid uuid:=(a->>'membership_id')::uuid; role text:=a->>'role';
BEGIN
 IF p.organization_id IS DISTINCT FROM (a->>'organization_id')::uuid THEN RETURN false; END IF;
 IF p.kind='ticket' THEN
  RETURN p.owner_id=mid OR role='admin' OR (role<>'viewer' AND dept='SIT') OR (role<>'viewer' AND p.payload->>'source'='Client' AND dept='SAL' AND (p.project_id IS NULL OR private.shared_test_record_visible(p.project_id)));
 END IF;
 IF role='viewer' THEN RETURN false; END IF;
 IF p.kind='allocation' THEN RETURN role='admin' OR (role='department_lead' AND (dept='FIN' OR p.department_id=private.shared_test_member_department(mid))); END IF;
 IF p.kind='expense' THEN
  RETURN p.owner_id=mid OR role='admin' OR
   (role='department_lead' AND dept='FIN') OR
   (role='department_lead' AND dept='PUR' AND p.payload->>'status'='Pending_Procurement') OR
   (role='department_lead' AND p.department_id=private.shared_test_member_department(mid));
 END IF;
 IF p.kind='profile' THEN RETURN p.owner_id=mid OR role='admin' OR (role='department_lead' AND dept IN ('HR','HROPS')); END IF;
 IF p.kind='assignment' THEN RETURN p.owner_id=mid OR role='admin' OR (role='department_lead' AND dept IN ('HR','HROPS')); END IF;
 IF p.kind='template' THEN RETURN role='admin' OR (role='department_lead' AND dept IN ('HR','HROPS')) OR EXISTS(SELECT 1 FROM business_items i WHERE i.kind='assignment' AND i.owner_id=mid AND i.organization_id=p.organization_id AND i.payload->>'templateId'=p.id::text); END IF;
 IF p.kind='channel' THEN RETURN p.payload->'memberIds' ? mid::text; END IF;
 IF p.kind='message' THEN RETURN EXISTS(SELECT 1 FROM business_items c WHERE c.kind='channel' AND c.organization_id=p.organization_id AND c.id=(p.payload->>'channelId')::uuid AND c.payload->'memberIds' ? mid::text); END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION private.business_visible(public.business_items,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.business_notify(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='Asia/Kolkata' AS $$
DECLARE i business_items%ROWTYPE; recipient record; event text; channel business_items%ROWTYPE;
BEGIN
 SELECT * INTO i FROM business_items WHERE id=p_id;
 IF NOT FOUND THEN RETURN; END IF;
 event:=i.kind||':'||i.version::text;
 IF i.kind='message' THEN SELECT * INTO channel FROM business_items WHERE id=(i.payload->>'channelId')::uuid AND organization_id=i.organization_id AND kind='channel'; END IF;
 FOR recipient IN SELECT m.* FROM organization_members m WHERE m.organization_id=i.organization_id AND m.active AND (m.role<>'viewer' OR (i.kind='ticket' AND m.id=i.owner_id)) AND (
  (i.kind IN ('expense','assignment','ticket') AND m.id=i.owner_id) OR
  (i.kind='ticket' AND (m.role='admin' OR private.shared_test_member_department(m.id) IN (SELECT id FROM departments WHERE organization_id=i.organization_id AND code='SIT'))) OR
  (i.kind='expense' AND m.id<>i.owner_id AND (
   (i.payload->>'status'='Pending_Dept_Review' AND (m.role='admin' OR (m.role='department_lead' AND private.shared_test_member_department(m.id)=i.department_id))) OR
   (i.payload->>'status'='Pending_Procurement' AND (m.role='admin' OR (m.role='department_lead' AND private.shared_test_member_department(m.id) IN (SELECT id FROM departments WHERE organization_id=i.organization_id AND code='PUR')))) OR
   (i.payload->>'status' IN ('Pending_Finance','Approved') AND (m.role='admin' OR (m.role='department_lead' AND private.shared_test_member_department(m.id) IN (SELECT id FROM departments WHERE organization_id=i.organization_id AND code='FIN')))) OR
   (i.payload->>'status'='Pending_Admin' AND m.role='admin'))) OR
  (i.kind='message' AND m.id<>i.owner_id AND channel.payload->'memberIds' ? m.id::text)
 ) LOOP
  INSERT INTO private.business_notifications(organization_id,recipient_id,item_id,event) VALUES(i.organization_id,recipient.id,i.id,event) ON CONFLICT DO NOTHING;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.business_notify(uuid) FROM PUBLIC,anon,authenticated;

DO $$
DECLARE fn text;
BEGIN
 fn:=pg_get_functiondef('public.get_business_workspace()'::regprocedure);
 fn:=replace(fn,
  'jsonb_build_object(''id'',r.id,''reference'',r.reference,''title'',r.title)',
  'jsonb_build_object(''id'',r.id,''reference'',r.reference,''title'',r.title,''currentStage'',COALESCE(NULLIF(r.fields->>''currentStage'',''''),NULLIF(r.stage,''''),NULLIF(r.fields->>''companyPhase'','''')))');
 IF position('currentStage' in fn)=0 THEN RAISE EXCEPTION 'EXPENSE_PROJECT_STAGE_PATCH_NOT_APPLIED'; END IF;
 EXECUTE fn;
END $$;

REVOKE ALL ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_business_workspace() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_business_workspace() TO authenticated;

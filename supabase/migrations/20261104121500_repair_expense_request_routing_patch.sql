-- Normalize pg_get_functiondef line endings before replacing the request branch.
-- (The same migration executes on local PostgreSQL-compatible test runtimes.)
DO $$
DECLARE
 fn text;
 old_branch text;
 new_branch text;
BEGIN
 fn:=pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
 fn:=replace(fn,E'\r\n',E'\n');
 old_branch:='  next_state:=CASE WHEN a.role IN (''department_lead'',''admin'') THEN ''Pending_Finance'' ELSE ''Pending_Dept_Review'' END;'||E'\n'||
    '  -- A Finance lead''s own claim is routed to Admin, never back to themselves.'||E'\n'||
    '  IF a.role=''department_lead'' AND a.department_code=''FIN'' THEN next_state:=''Pending_Admin''; END IF;'||E'\n'||
    '  INSERT INTO business_items(organization_id,kind,owner_id,department_id,project_id,payload) VALUES(org,''expense'',mid,dept,project,'||E'\n'||
    '   jsonb_build_object(''requesterName'',a.display_name,''requesterId'',mid,''amount'',amount,''currency'',data->>''currency'',''purpose'',data->>''purpose'',''category'',data->>''category'',''requiredDate'',data->>''requiredDate'',''status'',next_state,''createdAt'',now(),''updatedAt'',now())) RETURNING id INTO item_id;';
 new_branch:='  IF COALESCE(data->>''requestType'',''travel'') NOT IN (''travel'',''reimbursement'',''purchase'') THEN RAISE EXCEPTION ''INVALID_EXPENSE_REQUEST_TYPE''; END IF;'||E'\n'||
    '  IF data->>''requestType''=''purchase'' AND length(trim(COALESCE(data->>''itemOrService'','''')))<3 THEN RAISE EXCEPTION ''PURCHASE_DETAILS_REQUIRED''; END IF;'||E'\n'||
    '  next_state:=CASE WHEN data->>''requestType''=''purchase'' THEN ''Pending_Procurement'' ELSE ''Pending_Finance'' END;'||E'\n'||
    '  IF data->>''requestType''=''purchase'' AND data->>''purchaseKind'' NOT IN (''goods'',''service'') THEN RAISE EXCEPTION ''PURCHASE_TYPE_REQUIRED''; END IF;'||E'\n'||
    '  -- Travel and reimbursement route directly to Finance; purchase goods/services must be reviewed by Procurement first.'||E'\n'||
    '  IF data->>''requestType''=''reimbursement'' AND length(trim(COALESCE(data->>''merchant'','''')))<2 THEN RAISE EXCEPTION ''REIMBURSEMENT_MERCHANT_REQUIRED''; END IF;'||E'\n'||
    '  INSERT INTO business_items(organization_id,kind,owner_id,department_id,project_id,payload) VALUES(org,''expense'',mid,dept,project,'||E'\n'||
    '   jsonb_build_object(''requesterName'',a.display_name,''requesterId'',mid,''amount'',amount,''currency'',data->>''currency'',''purpose'',data->>''purpose'',''category'',data->>''category'',''requiredDate'',data->>''requiredDate'',''requestType'',COALESCE(data->>''requestType'',''travel''),''purchaseKind'',data->>''purchaseKind'',''itemOrService'',data->>''itemOrService'',''quantity'',NULLIF(data->>''quantity'','''')::numeric,''supplierName'',data->>''supplierName'',''quotationReference'',data->>''quotationReference'',''destination'',data->>''destination'',''travelStartDate'',data->>''travelStartDate'',''travelEndDate'',data->>''travelEndDate'',''merchant'',data->>''merchant'',''expenseDate'',data->>''expenseDate'',''receiptReference'',data->>''receiptReference'',''status'',next_state,''createdAt'',now(),''updatedAt'',now())) RETURNING id INTO item_id;';
 IF position('COALESCE(data->>''requestType'',''travel'')' in fn)=0 THEN
  fn:=replace(fn,old_branch,new_branch);
 END IF;
 IF position('ELSIF next_state=''Pending_Procurement'' THEN' in fn)=0 THEN
  fn:=replace(fn,
   '  ELSIF next_state=''Pending_Dept_Review'' THEN'||E'\n'||
   '   data:=i.payload||jsonb_build_object(''status'',''Pending_Finance'',''departmentApprovedBy'',mid,''updatedAt'',now());',
   '  ELSIF next_state=''Pending_Procurement'' THEN'||E'\n'||
   '   data:=i.payload||jsonb_build_object(''status'',''Pending_Finance'',''procurementReviewedBy'',mid,''updatedAt'',now());'||E'\n'||
   '  ELSIF next_state=''Pending_Dept_Review'' THEN'||E'\n'||
   '   data:=i.payload||jsonb_build_object(''status'',''Pending_Finance'',''departmentApprovedBy'',mid,''updatedAt'',now());');
 END IF;
 IF position('COALESCE(data->>''requestType'',''travel'')' in fn)=0 OR position('ELSIF next_state=''Pending_Procurement'' THEN' in fn)=0 THEN RAISE EXCEPTION 'EXPENSE_ROUTING_REPAIR_FAILED'; END IF;
 EXECUTE fn;
END $$;

CREATE OR REPLACE FUNCTION private.business_visible(p public.business_items,a jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public SET timezone='Asia/Kolkata' AS $$
DECLARE dept text:=a->>'department_code'; mid uuid:=(a->>'membership_id')::uuid; role text:=a->>'role'; state text:=p.payload->>'status';
BEGIN
 IF p.organization_id IS DISTINCT FROM (a->>'organization_id')::uuid THEN RETURN false; END IF;
 IF p.kind='ticket' THEN
  RETURN p.owner_id=mid OR role='admin' OR (role<>'viewer' AND dept='SIT') OR (role<>'viewer' AND p.payload->>'source'='Client' AND dept='SAL' AND (p.project_id IS NULL OR private.shared_test_record_visible(p.project_id)));
 END IF;
 IF role='viewer' THEN RETURN false; END IF;
 IF p.kind='allocation' THEN RETURN role='admin' OR (role='department_lead' AND (dept='FIN' OR p.department_id=private.shared_test_member_department(mid))); END IF;
 IF p.kind='expense' THEN
  RETURN p.owner_id=mid OR role='admin' OR
   (role='department_lead' AND dept='PUR' AND state='Pending_Procurement') OR
   (role='department_lead' AND dept='FIN' AND state IN ('Pending_Finance','Pending_Admin','Approved','Settled')) OR
   (role='department_lead' AND p.department_id=private.shared_test_member_department(mid) AND state='Pending_Dept_Review');
 END IF;
 IF p.kind='profile' THEN RETURN p.owner_id=mid OR role='admin' OR (role='department_lead' AND dept IN ('HR','HROPS')); END IF;
 IF p.kind='assignment' THEN RETURN p.owner_id=mid OR role='admin' OR (role='department_lead' AND dept IN ('HR','HROPS')); END IF;
 IF p.kind='template' THEN RETURN role='admin' OR (role='department_lead' AND dept IN ('HR','HROPS')) OR EXISTS(SELECT 1 FROM business_items i WHERE i.kind='assignment' AND i.owner_id=mid AND i.organization_id=p.organization_id AND i.payload->>'templateId'=p.id::text); END IF;
 IF p.kind='channel' THEN RETURN p.payload->'memberIds' ? mid::text; END IF;
 IF p.kind='message' THEN RETURN EXISTS(SELECT 1 FROM business_items c WHERE c.kind='channel' AND c.organization_id=p.organization_id AND c.id=(p.payload->>'channelId')::uuid AND c.payload->'memberIds' ? mid::text); END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION private.business_visible(public.business_items,jsonb) FROM PUBLIC,anon,authenticated;

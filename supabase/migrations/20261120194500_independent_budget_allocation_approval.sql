-- New budget allocations require independent Admin/Finance approval.
-- Existing rows without a status remain effective as legacy approved rows.
DO $migration$
DECLARE
  fn text;
  old_payload text := $old$'financeLimit',NULLIF(data->>'financeLimit','')::numeric,'approvedBy',a.display_name$old$;
  new_payload text := $new$'financeLimit',NULLIF(data->>'financeLimit','')::numeric,'status','Pending_Approval','requestedBy',mid,'requestedByName',a.display_name$new$;
  request_marker text := $marker$ELSIF p_action='request_expense' THEN$marker$;
  approval_actions text := $actions$ELSIF p_action IN ('approve_allocation','reject_allocation') THEN
  IF i.kind IS DISTINCT FROM 'allocation' THEN RAISE EXCEPTION 'ALLOCATION_REQUIRED'; END IF;
  IF NOT is_fin THEN RAISE EXCEPTION 'FINANCE_AUTHORITY_REQUIRED'; END IF;
  IF i.owner_id=mid THEN RAISE EXCEPTION 'SELF_APPROVAL_DENIED'; END IF;
  IF COALESCE(i.payload->>'status','Approved')<>'Pending_Approval' THEN RAISE EXCEPTION 'ALLOCATION_NOT_PENDING'; END IF;
  IF p_action='reject_allocation' THEN
   IF length(trim(COALESCE(data->>'reason','')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
   data:=i.payload||jsonb_build_object('status','Rejected','decisionReason',trim(data->>'reason'),'rejectedBy',mid,'rejectedAt',now());
  ELSE
   data:=i.payload||jsonb_build_object('status','Approved','approvedBy',mid,'approvedAt',now());
  END IF;
  UPDATE business_items SET payload=data,version=version+1,updated_at=now() WHERE id=i.id;
  $actions$;
  old_direct_lookup text := $direct$FROM business_items WHERE id=(i.payload->>'allocationId')::uuid AND organization_id=org AND kind='allocation' FOR UPDATE;$direct$;
  new_direct_lookup text := $direct$FROM business_items WHERE id=(i.payload->>'allocationId')::uuid AND organization_id=org AND kind='allocation' AND COALESCE(payload->>'status','Approved')='Approved' FOR UPDATE;$direct$;
  old_match_lookup text := $match$AND payload->>'currency'=i.payload->>'currency' AND current_date BETWEEN (payload->>'startDate')::date AND (payload->>'endDate')::date FOR UPDATE;$match$;
  new_match_lookup text := $match$AND payload->>'currency'=i.payload->>'currency' AND COALESCE(payload->>'status','Approved')='Approved' AND current_date BETWEEN (payload->>'startDate')::date AND (payload->>'endDate')::date FOR UPDATE;$match$;
  old_allocation_category text := $allocation$length(trim(COALESCE(data->>'category','')))=0 OR COALESCE(data->>'currency','') !~ '^[A-Z]{3}$'$allocation$;
  new_allocation_category text := $allocation$length(trim(COALESCE(data->>'category','')))=0 OR NOT COALESCE((public.get_expense_catalogue(dept)->'categories') ? trim(data->>'category'),false) OR COALESCE(data->>'currency','') !~ '^[A-Z]{3}$'$allocation$;
  old_expense_category text := $expense$NULLIF(trim(data->>'category'),'') IS NULL OR (data->>'requiredDate')::date IS NULL$expense$;
  new_expense_category text := $expense$NULLIF(trim(data->>'category'),'') IS NULL OR NOT COALESCE((public.get_expense_catalogue(dept)->'categories') ? trim(data->>'category'),false) OR (data->>'requiredDate')::date IS NULL$expense$;
BEGIN
  fn := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  IF length(fn)-length(replace(fn,old_payload,''))<>length(old_payload) THEN
    RAISE EXCEPTION 'ALLOCATION_CREATE_PATCH_PRECONDITION';
  END IF;
  fn := replace(fn,old_payload,new_payload);
  IF length(fn)-length(replace(fn,request_marker,''))<>length(request_marker) THEN
    RAISE EXCEPTION 'ALLOCATION_APPROVAL_INSERT_PRECONDITION';
  END IF;
  fn := replace(fn,request_marker,approval_actions||request_marker);
  IF length(fn)-length(replace(fn,old_direct_lookup,''))<>length(old_direct_lookup) THEN
    RAISE EXCEPTION 'ALLOCATION_POSTING_FILTER_PRECONDITION';
  END IF;
  fn := replace(fn,old_direct_lookup,new_direct_lookup);
  IF length(fn)-length(replace(fn,old_match_lookup,''))<>length(old_match_lookup) THEN
    RAISE EXCEPTION 'ALLOCATION_APPROVAL_FILTER_PRECONDITION';
  END IF;
  fn := replace(fn,old_match_lookup,new_match_lookup);
  IF length(fn)-length(replace(fn,old_allocation_category,''))<>length(old_allocation_category) THEN
    RAISE EXCEPTION 'ALLOCATION_CATEGORY_PATCH_PRECONDITION';
  END IF;
  fn := replace(fn,old_allocation_category,new_allocation_category);
  IF length(fn)-length(replace(fn,old_expense_category,''))<>length(old_expense_category) THEN
    RAISE EXCEPTION 'EXPENSE_CATEGORY_PATCH_PRECONDITION';
  END IF;
  fn := replace(fn,old_expense_category,new_expense_category);
  IF position('Pending_Approval' in fn)=0 OR position('SELF_APPROVAL_DENIED' in fn)=0
    OR position('ALLOCATION_NOT_PENDING' in fn)=0
    OR position('get_expense_catalogue(dept)' in fn)=0 THEN
    RAISE EXCEPTION 'ALLOCATION_APPROVAL_PATCH_FAILED';
  END IF;
  EXECUTE fn;
END $migration$;

REVOKE ALL ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) TO authenticated;

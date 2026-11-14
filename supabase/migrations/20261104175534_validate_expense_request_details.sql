-- Validate the selected request type's fields server-side (not only in the browser form).
DO $$
DECLARE fn text;
BEGIN
 fn:=pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
 fn:=replace(fn,E'\r\n',E'\n');
 IF position('INVALID_TRAVEL_DETAILS' in fn)=0 THEN
  fn:=replace(fn,
   '  IF data->>''requestType''=''purchase'' AND data->>''purchaseKind'' NOT IN (''goods'',''service'') THEN RAISE EXCEPTION ''PURCHASE_TYPE_REQUIRED''; END IF;',
   '  IF data->>''requestType''=''purchase'' AND data->>''purchaseKind'' NOT IN (''goods'',''service'') THEN RAISE EXCEPTION ''PURCHASE_TYPE_REQUIRED''; END IF;'||E'\n'||
   '  IF data->>''requestType''=''travel'' AND (length(trim(COALESCE(data->>''destination'','''')))<2 OR (data->>''travelStartDate'')::date IS NULL OR (data->>''travelEndDate'')::date IS NULL OR (data->>''travelEndDate'')::date<(data->>''travelStartDate'')::date) THEN RAISE EXCEPTION ''INVALID_TRAVEL_DETAILS''; END IF;'||E'\n'||
   '  IF data->>''requestType''=''reimbursement'' AND (length(trim(COALESCE(data->>''merchant'','''')))<2 OR (data->>''expenseDate'')::date IS NULL) THEN RAISE EXCEPTION ''INVALID_REIMBURSEMENT_DETAILS''; END IF;'||E'\n'||
   '  IF data->>''requestType''=''purchase'' AND data->>''purchaseKind''=''goods'' AND COALESCE((data->>''quantity'')::numeric,0)<=0 THEN RAISE EXCEPTION ''INVALID_PURCHASE_QUANTITY''; END IF;');
 END IF;
 IF position('INVALID_TRAVEL_DETAILS' in fn)=0 OR position('INVALID_PURCHASE_QUANTITY' in fn)=0 THEN RAISE EXCEPTION 'EXPENSE_REQUEST_DETAIL_VALIDATION_PATCH_FAILED'; END IF;
 EXECUTE fn;
END $$;

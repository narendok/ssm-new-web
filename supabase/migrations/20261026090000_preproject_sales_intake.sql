-- Extend the current guarded writer without rewriting historical migrations or relaxing engineering gates.
DO $migration$
DECLARE definition text; original text;
BEGIN
 SELECT pg_get_functiondef('public.mutate_shared_test_workspace(text,jsonb,uuid)'::regprocedure) INTO definition;
 IF position('PREPROJECT_SALES_AUTHORITY_REQUIRED' in definition)>0 THEN RETURN; END IF;
 original:=definition;
 definition:=replace(definition,
  $old$IF rec_type IN ('Supplier','Part','Customer') THEN$old$,
  $new$IF rec_type IN ('Supplier','Part','Customer','Enquiry','Opportunity') THEN$new$);
 definition:=replace(definition,
  $old$ELSIF rec_type = 'Customer' THEN$old$,
  $new$ELSIF rec_type IN ('Enquiry','Opportunity') THEN
    IF a.is_client OR a.role NOT IN ('admin','department_lead') OR (a.role<>'admin' AND COALESCE(a.department_code,'')<>'SAL') THEN
     RAISE EXCEPTION 'PREPROJECT_SALES_AUTHORITY_REQUIRED';
    END IF;
    SELECT id INTO dept FROM departments WHERE organization_id=org AND code='SAL' AND active;
   ELSIF rec_type = 'Customer' THEN$new$);
 IF definition=original OR position('PREPROJECT_SALES_AUTHORITY_REQUIRED' in definition)=0 OR position($check$'Customer','Enquiry','Opportunity') THEN$check$ in definition)=0 THEN
  RAISE EXCEPTION 'PREPROJECT_MIGRATION_CONTRACT_CHANGED: inspect the installed writer before deployment';
 END IF;
 EXECUTE definition;
END;
$migration$;

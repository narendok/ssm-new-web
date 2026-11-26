-- A Draft policy without an effective date must return JSON false, not SQL
-- NULL. Postgres boolean AND propagates NULL; clients need a strict inactive
-- signal so a valid unpublished policy does not look like an RPC failure.
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
    'isEffective',COALESCE(effective->>'status'='Active' AND NULLIF(effective->>'effectiveFrom','')::date<=p_travel_date,false),
    'policyVersion',CASE
      WHEN department IS NOT NULL THEN COALESCE(department_version,0)
      ELSE COALESCE(company_version,0)
    END,
    'employeeBand',employee_band,
    'band',CASE WHEN employee_band IS NULL THEN NULL ELSE (
      SELECT item FROM jsonb_array_elements(effective->'bands') item WHERE item->>'id'=employee_band LIMIT 1
    ) END
  );
END $$;

REVOKE ALL ON FUNCTION public.get_effective_travel_policy(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_effective_travel_policy(uuid,date) TO authenticated;

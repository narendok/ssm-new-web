-- Company travel-policy values are visible only to Admin and Operations leads.
-- Other internal members receive the public illustrative default and no stored
-- policy values, even when calling the RPC directly outside the UI.
CREATE OR REPLACE FUNCTION public.get_travel_policy(p_department uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  a record;
  company jsonb;
  department jsonb;
  company_draft jsonb;
  department_draft jsonb;
  company_version integer := 0;
  department_version integer := 0;
  own_department uuid;
  stored jsonb;
  published jsonb;
  published_version integer := 0;
BEGIN
  SELECT * INTO a FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN
    RAISE EXCEPTION 'TRAVEL_POLICY_ACCESS_DENIED';
  END IF;
  own_department := private.shared_test_member_department(a.membership_id);

  IF NOT (a.role = 'admin' OR (a.role = 'department_lead' AND a.department_code = 'OPS')) THEN
    RETURN jsonb_build_object(
      'company', private.default_travel_policy(),
      'companyDraft', NULL,
      'department', NULL,
      'departmentDraft', NULL,
      'companyVersion', 0,
      'departmentVersion', 0,
      'scopeDepartment', NULL,
      'isAdmin', false,
      'canView', false,
      'ownDepartment', own_department,
      'canManageCompany', false,
      'canManageDepartment', false
    );
  END IF;

  SELECT value, published_value, version, travel_policies.published_version
    INTO stored, published, company_version, published_version
    FROM private.travel_policies
    WHERE organization_id = a.organization_id AND scope = 'company';
  company := coalesce(published, private.default_travel_policy());
  company_draft := CASE
    WHEN stored IS NULL OR company_version > published_version
      THEN coalesce(stored, private.default_travel_policy())
    ELSE NULL
  END;

  IF p_department IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.departments
      WHERE id = p_department AND organization_id = a.organization_id AND active
    ) THEN
      RAISE EXCEPTION 'INVALID_DEPARTMENT';
    END IF;
    IF a.role <> 'admin' AND NOT (a.department_code = 'OPS' AND own_department = p_department) THEN
      RAISE EXCEPTION 'TRAVEL_POLICY_SCOPE_DENIED';
    END IF;
    SELECT value, published_value, version, travel_policies.published_version
      INTO stored, published, department_version, published_version
      FROM private.travel_policies
      WHERE organization_id = a.organization_id AND scope = p_department::text;
    department := published;
    department_draft := CASE
      WHEN stored IS NOT NULL AND department_version > published_version THEN stored
      ELSE NULL
    END;
  END IF;

  RETURN jsonb_build_object(
    'company', company,
    'companyDraft', CASE WHEN a.role = 'admin' THEN company_draft ELSE NULL END,
    'department', department,
    'departmentDraft', CASE
      WHEN a.role = 'admin' OR (a.department_code = 'OPS' AND own_department = p_department)
        THEN department_draft
      ELSE NULL
    END,
    'companyVersion', coalesce(company_version, 0),
    'departmentVersion', coalesce(department_version, 0),
    'scopeDepartment', p_department,
    'isAdmin', a.role = 'admin',
    'canView', true,
    'ownDepartment', own_department,
    'canManageCompany', a.role = 'admin',
    'canManageDepartment', coalesce(
      a.role = 'admin' OR (a.department_code = 'OPS' AND own_department = p_department), false
    )
  );
END $$;

REVOKE ALL ON FUNCTION public.get_travel_policy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_travel_policy(uuid) TO authenticated;

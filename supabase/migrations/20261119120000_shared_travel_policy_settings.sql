-- Versioned shared travel-policy settings. Values are illustrative and remain Draft
-- until an Admin publishes an approved company policy.
CREATE TABLE private.travel_policies (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  scope text NOT NULL,
  value jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  published_value jsonb,
  published_version integer NOT NULL DEFAULT 0,
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, scope)
);
ALTER TABLE private.travel_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.travel_policies FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.default_travel_policy()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT '{
    "currency":"INR",
    "status":"Draft",
    "effectiveFrom":null,
    "advancePercent":80,
    "oneOpenAdvance":true,
    "cityTiers":["Metro tier","Other cities"],
    "bands":[
      {"id":"staff","label":"Staff / Individual contributor","hotelMetro":4000,"hotelOther":2500,"mealsPerDay":800,"localPerDay":600},
      {"id":"manager","label":"Department lead / Manager","hotelMetro":5500,"hotelOther":3500,"mealsPerDay":1200,"localPerDay":1000},
      {"id":"senior","label":"Senior leadership","hotelMetro":8000,"hotelOther":5500,"mealsPerDay":1800,"localPerDay":1500}
    ]
  }'::jsonb
$$;

CREATE FUNCTION public.get_travel_policy(p_department uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; company jsonb; department jsonb; company_draft jsonb; department_draft jsonb; company_version integer:=0; department_version integer:=0; own_department uuid; stored jsonb; published jsonb; published_version integer:=0;
BEGIN
  SELECT * INTO a FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN RAISE EXCEPTION 'TRAVEL_POLICY_ACCESS_DENIED'; END IF;
  own_department:=private.shared_test_member_department(a.membership_id);
  SELECT value,published_value,version,travel_policies.published_version INTO stored,published,company_version,published_version FROM private.travel_policies WHERE organization_id=a.organization_id AND scope='company';
  company:=coalesce(published,private.default_travel_policy());
  company_draft:=CASE WHEN stored IS NULL OR company_version>published_version THEN coalesce(stored,private.default_travel_policy()) ELSE NULL END;
  IF p_department IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.departments WHERE id=p_department AND organization_id=a.organization_id AND active) THEN RAISE EXCEPTION 'INVALID_DEPARTMENT'; END IF;
    IF a.role<>'admin' AND NOT (a.role='department_lead' AND a.department_code='OPS' AND own_department=p_department) THEN RAISE EXCEPTION 'TRAVEL_POLICY_SCOPE_DENIED'; END IF;
    SELECT value,published_value,version,travel_policies.published_version INTO stored,published,department_version,published_version FROM private.travel_policies WHERE organization_id=a.organization_id AND scope=p_department::text;
    department:=published;
    department_draft:=CASE WHEN stored IS NOT NULL AND department_version>published_version THEN stored ELSE NULL END;
  END IF;
  RETURN jsonb_build_object(
    'company',company,
    'companyDraft',CASE WHEN a.role='admin' THEN company_draft ELSE NULL END,
    'department',department,
    'departmentDraft',CASE WHEN a.role='admin' OR (a.role='department_lead' AND a.department_code='OPS' AND own_department=p_department) THEN department_draft ELSE NULL END,
    'companyVersion',coalesce(company_version,0),
    'departmentVersion',coalesce(department_version,0),
    'scopeDepartment',p_department,
    'isAdmin',a.role='admin',
    'canView',a.role='admin' OR (a.role='department_lead' AND a.department_code='OPS'),
    'ownDepartment',own_department,
    'canManageCompany',a.role='admin',
    'canManageDepartment',coalesce(a.role='admin' OR (a.role='department_lead' AND a.department_code='OPS' AND own_department=p_department),false)
  );
END $$;

CREATE FUNCTION public.save_travel_policy(p_department uuid,p_value jsonb,p_version integer,p_publish boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; current_value jsonb; company jsonb; existing_version integer:=0; own_department uuid; entry jsonb; next_version integer; publish_now boolean;
BEGIN
  SELECT * INTO a FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN RAISE EXCEPTION 'TRAVEL_POLICY_ACCESS_DENIED'; END IF;
  PERFORM 1 FROM public.organizations WHERE id=a.organization_id FOR UPDATE;
  own_department:=private.shared_test_member_department(a.membership_id);
  publish_now:=p_publish OR (a.role='department_lead' AND p_department IS NOT NULL);
  IF p_department IS NULL THEN
    IF a.role<>'admin' THEN RAISE EXCEPTION 'ADMIN_REQUIRED_FOR_COMPANY_TRAVEL_POLICY'; END IF;
    SELECT value,version INTO current_value,existing_version FROM private.travel_policies WHERE organization_id=a.organization_id AND scope='company';
    IF coalesce(existing_version,0) IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'TRAVEL_POLICY_CHANGED_RELOAD'; END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM public.departments WHERE id=p_department AND organization_id=a.organization_id AND active) THEN RAISE EXCEPTION 'INVALID_DEPARTMENT'; END IF;
    IF NOT (a.role='admin' OR (a.role='department_lead' AND a.department_code='OPS' AND own_department=p_department)) THEN RAISE EXCEPTION 'TRAVEL_POLICY_MANAGE_DENIED'; END IF;
    SELECT value,version INTO current_value,existing_version FROM private.travel_policies WHERE organization_id=a.organization_id AND scope=p_department::text;
    IF coalesce(existing_version,0) IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'TRAVEL_POLICY_CHANGED_RELOAD'; END IF;
    SELECT published_value INTO company FROM private.travel_policies WHERE organization_id=a.organization_id AND scope='company';
    company:=coalesce(company,private.default_travel_policy());
    IF a.role<>'admin' AND p_publish THEN RAISE EXCEPTION 'ADMIN_REQUIRED_TO_PUBLISH_TRAVEL_POLICY'; END IF;
    IF jsonb_typeof(p_value->'bands') IS DISTINCT FROM 'array' OR jsonb_array_length(p_value->'bands')<>jsonb_array_length(company->'bands') THEN RAISE EXCEPTION 'INVALID_TRAVEL_POLICY_BANDS'; END IF;
    FOR entry IN SELECT value FROM jsonb_array_elements(p_value->'bands') LOOP
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(company->'bands') base
        WHERE base->>'id'=entry->>'id'
          AND (entry->>'hotelMetro')::numeric BETWEEN 0 AND (base->>'hotelMetro')::numeric
          AND (entry->>'hotelOther')::numeric BETWEEN 0 AND (base->>'hotelOther')::numeric
          AND (entry->>'mealsPerDay')::numeric BETWEEN 0 AND (base->>'mealsPerDay')::numeric
          AND (entry->>'localPerDay')::numeric BETWEEN 0 AND (base->>'localPerDay')::numeric
      ) THEN RAISE EXCEPTION 'DEPARTMENT_POLICY_EXCEEDS_COMPANY_CAP'; END IF;
    END LOOP;
    IF (p_value->>'advancePercent')::numeric > (company->>'advancePercent')::numeric OR coalesce((p_value->>'oneOpenAdvance')::boolean,false) IS DISTINCT FROM coalesce((company->>'oneOpenAdvance')::boolean,false) THEN RAISE EXCEPTION 'DEPARTMENT_POLICY_EXCEEDS_COMPANY_CONTROL'; END IF;
    IF a.role<>'admin' AND company->>'status' IS DISTINCT FROM 'Active' THEN RAISE EXCEPTION 'COMPANY_POLICY_MUST_BE_PUBLISHED_FIRST'; END IF;
  END IF;
  IF jsonb_typeof(p_value) IS DISTINCT FROM 'object' OR p_value->>'currency' IS DISTINCT FROM 'INR' OR jsonb_typeof(p_value->'bands') IS DISTINCT FROM 'array' OR jsonb_array_length(p_value->'bands')<>3 OR p_value->>'advancePercent' IS NULL OR (p_value->>'advancePercent')::numeric NOT BETWEEN 0 AND 100 OR jsonb_typeof(p_value->'oneOpenAdvance') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'INVALID_TRAVEL_POLICY'; END IF;
  IF (SELECT count(DISTINCT item->>'id') FROM jsonb_array_elements(p_value->'bands') item)<>3 THEN RAISE EXCEPTION 'DUPLICATE_TRAVEL_POLICY_BAND'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_value->'bands') LOOP
    IF entry->>'id' IS NULL OR length(trim(coalesce(entry->>'label','')))=0 OR (entry->>'id') NOT IN ('staff','manager','senior') OR
       (entry->>'hotelMetro') IS NULL OR (entry->>'hotelOther') IS NULL OR (entry->>'mealsPerDay') IS NULL OR (entry->>'localPerDay') IS NULL OR
       (entry->>'hotelMetro')::numeric NOT BETWEEN 0 AND 1000000 OR (entry->>'hotelOther')::numeric NOT BETWEEN 0 AND 1000000 OR
       (entry->>'mealsPerDay')::numeric NOT BETWEEN 0 AND 1000000 OR (entry->>'localPerDay')::numeric NOT BETWEEN 0 AND 1000000 THEN RAISE EXCEPTION 'INVALID_TRAVEL_POLICY_BAND'; END IF;
  END LOOP;
  IF p_publish AND a.role<>'admin' THEN RAISE EXCEPTION 'ADMIN_REQUIRED_TO_PUBLISH_TRAVEL_POLICY'; END IF;
  IF p_publish AND (NULLIF(trim(p_value->>'effectiveFrom'),'') IS NULL OR (p_value->>'effectiveFrom')::date IS NULL) THEN RAISE EXCEPTION 'POLICY_EFFECTIVE_DATE_REQUIRED'; END IF;
  p_value:=p_value||jsonb_build_object('status',CASE WHEN p_publish OR (a.role='department_lead' AND p_department IS NOT NULL) THEN 'Active' ELSE 'Draft' END);
  next_version:=coalesce(existing_version,0)+1;
  INSERT INTO private.travel_policies(organization_id,scope,value,version,published_value,published_version,updated_by)
  VALUES(a.organization_id,coalesce(p_department::text,'company'),p_value,next_version,CASE WHEN publish_now THEN p_value ELSE NULL END,CASE WHEN publish_now THEN next_version ELSE 0 END,auth.uid())
  ON CONFLICT(organization_id,scope) DO UPDATE SET value=excluded.value,version=excluded.version,
    published_value=CASE WHEN publish_now THEN excluded.value ELSE travel_policies.published_value END,
    published_version=CASE WHEN publish_now THEN excluded.published_version ELSE travel_policies.published_version END,
    updated_by=auth.uid(),updated_at=now();
  RETURN public.get_travel_policy(p_department);
END $$;

REVOKE ALL ON FUNCTION private.default_travel_policy(),public.get_travel_policy(uuid),public.save_travel_policy(uuid,jsonb,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_travel_policy(uuid),public.save_travel_policy(uuid,jsonb,integer,boolean) TO authenticated;

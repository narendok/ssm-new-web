-- Shared organization-scoped accounting locations and controlled location review.
-- No local/browser defaults are promoted: Admins create approved entries and
-- Finance/Admin review proposals submitted by other workspace members.
CREATE TABLE public.expense_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  reference text NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  city text NOT NULL CHECK (length(trim(city)) BETWEEN 2 AND 120),
  city_tier text NOT NULL CHECK (city_tier IN ('metro','other')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reference)
);
CREATE UNIQUE INDEX expense_locations_name_city_unique
  ON public.expense_locations (organization_id, lower(name), lower(city));
CREATE INDEX expense_locations_org_active ON public.expense_locations (organization_id, active);

CREATE TABLE public.expense_location_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  requested_by uuid NOT NULL REFERENCES public.organization_members(id),
  request_id uuid NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  city text NOT NULL CHECK (length(trim(city)) BETWEEN 2 AND 120),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  location_id uuid REFERENCES public.expense_locations(id),
  reviewed_by uuid REFERENCES public.organization_members(id),
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (organization_id, requested_by, request_id),
  CHECK ((status='Approved')=(location_id IS NOT NULL)),
  CHECK ((status='Pending')=(reviewed_by IS NULL))
);
CREATE INDEX expense_location_requests_org_status ON public.expense_location_requests (organization_id, status, created_at DESC);
CREATE UNIQUE INDEX expense_location_one_pending_name_city
  ON public.expense_location_requests (organization_id, lower(name), lower(city)) WHERE status='Pending';
ALTER TABLE public.expense_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_location_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expense_locations, public.expense_location_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.manage_expense_location(
  p_id uuid, p_name text, p_city text, p_city_tier text, p_active boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; saved public.expense_locations%ROWTYPE; ref text;
BEGIN
  SELECT * INTO a FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.role<>'admin' OR a.is_client THEN
    RAISE EXCEPTION 'EXPENSE_LOCATION_ADMIN_REQUIRED';
  END IF;
  IF length(trim(COALESCE(p_name,''))) NOT BETWEEN 2 AND 160
     OR length(trim(COALESCE(p_city,''))) NOT BETWEEN 2 AND 120
     OR p_city_tier NOT IN ('metro','other') OR p_active IS NULL THEN
    RAISE EXCEPTION 'INVALID_EXPENSE_LOCATION';
  END IF;
  PERFORM 1 FROM public.organizations WHERE id=a.organization_id FOR UPDATE;
  IF p_id IS NULL THEN
    ref:='LOC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    INSERT INTO public.expense_locations(organization_id,reference,name,city,city_tier,active,created_by,updated_by)
    VALUES(a.organization_id,ref,trim(p_name),trim(p_city),p_city_tier,p_active,a.membership_id,a.membership_id)
    RETURNING * INTO saved;
  ELSE
    UPDATE public.expense_locations SET name=trim(p_name),city=trim(p_city),city_tier=p_city_tier,
      active=p_active,updated_by=a.membership_id,updated_at=now()
    WHERE id=p_id AND organization_id=a.organization_id RETURNING * INTO saved;
    IF NOT FOUND THEN RAISE EXCEPTION 'EXPENSE_LOCATION_NOT_FOUND'; END IF;
  END IF;
  RETURN jsonb_build_object('id',saved.id,'reference',saved.reference,'name',saved.name,'city',saved.city,
    'cityTier',saved.city_tier,'active',saved.active,'updatedAt',saved.updated_at);
END $$;

CREATE OR REPLACE FUNCTION public.request_expense_location(p_value jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; saved public.expense_location_requests%ROWTYPE; existing public.expense_location_requests%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client OR a.role NOT IN ('admin','department_lead','member') THEN
    RAISE EXCEPTION 'EXPENSE_LOCATION_REQUEST_DENIED';
  END IF;
  IF p_request_id IS NULL OR jsonb_typeof(p_value) IS DISTINCT FROM 'object'
     OR length(trim(COALESCE(p_value->>'name',''))) NOT BETWEEN 2 AND 160
     OR length(trim(COALESCE(p_value->>'city',''))) NOT BETWEEN 2 AND 120
     OR length(trim(COALESCE(p_value->>'reason',''))) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'INVALID_EXPENSE_LOCATION_REQUEST';
  END IF;
  PERFORM 1 FROM public.organizations WHERE id=a.organization_id FOR UPDATE;
  SELECT * INTO existing FROM public.expense_location_requests
    WHERE organization_id=a.organization_id AND requested_by=a.membership_id AND request_id=p_request_id;
  IF FOUND THEN
    IF existing.name<>trim(p_value->>'name') OR existing.city<>trim(p_value->>'city') OR existing.reason<>trim(p_value->>'reason') THEN
      RAISE EXCEPTION 'RETRY_PAYLOAD_CHANGED';
    END IF;
    saved:=existing;
  ELSE
    IF EXISTS(SELECT 1 FROM public.expense_locations WHERE organization_id=a.organization_id AND active
      AND lower(name)=lower(trim(p_value->>'name')) AND lower(city)=lower(trim(p_value->>'city'))) THEN
      RAISE EXCEPTION 'EXPENSE_LOCATION_ALREADY_APPROVED';
    END IF;
    INSERT INTO public.expense_location_requests(organization_id,requested_by,request_id,name,city,reason)
    VALUES(a.organization_id,a.membership_id,p_request_id,trim(p_value->>'name'),trim(p_value->>'city'),trim(p_value->>'reason'))
    RETURNING * INTO saved;
  END IF;
  RETURN jsonb_build_object('id',saved.id,'name',saved.name,'city',saved.city,'reason',saved.reason,'status',saved.status,'createdAt',saved.created_at);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'EXPENSE_LOCATION_REQUEST_ALREADY_PENDING';
END $$;

CREATE OR REPLACE FUNCTION public.review_expense_location(
  p_id uuid,p_outcome text,p_name text DEFAULT NULL,p_city text DEFAULT NULL,
  p_city_tier text DEFAULT NULL,p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; request public.expense_location_requests%ROWTYPE; saved public.expense_locations%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client
     OR NOT (a.role='admin' OR (a.role='department_lead' AND a.department_code='FIN')) THEN
    RAISE EXCEPTION 'EXPENSE_LOCATION_REVIEW_DENIED';
  END IF;
  IF p_outcome NOT IN ('approve','reject') OR p_id IS NULL THEN RAISE EXCEPTION 'INVALID_EXPENSE_LOCATION_DECISION'; END IF;
  PERFORM 1 FROM public.organizations WHERE id=a.organization_id FOR UPDATE;
  SELECT * INTO request FROM public.expense_location_requests WHERE id=p_id AND organization_id=a.organization_id FOR UPDATE;
  IF NOT FOUND OR request.status<>'Pending' THEN RAISE EXCEPTION 'EXPENSE_LOCATION_REQUEST_NOT_PENDING'; END IF;
  IF request.requested_by=a.membership_id THEN RAISE EXCEPTION 'EXPENSE_LOCATION_SELF_REVIEW_DENIED'; END IF;
  IF p_outcome='approve' THEN
    IF length(trim(COALESCE(p_name,request.name))) NOT BETWEEN 2 AND 160
       OR length(trim(COALESCE(p_city,request.city))) NOT BETWEEN 2 AND 120
       OR COALESCE(p_city_tier,'') NOT IN ('metro','other') THEN
      RAISE EXCEPTION 'LOCATION_REVIEW_REQUIRES_APPROVED_CITY_TIER';
    END IF;
    INSERT INTO public.expense_locations(organization_id,reference,name,city,city_tier,active,created_by,updated_by)
    VALUES(a.organization_id,'LOC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
      trim(COALESCE(p_name,request.name)),trim(COALESCE(p_city,request.city)),p_city_tier,true,a.membership_id,a.membership_id)
    RETURNING * INTO saved;
    UPDATE public.expense_location_requests SET status='Approved',location_id=saved.id,reviewed_by=a.membership_id,
      decision_reason=NULLIF(trim(COALESCE(p_reason,'')),''),reviewed_at=now() WHERE id=request.id;
  ELSE
    IF length(trim(COALESCE(p_reason,'')))<3 THEN RAISE EXCEPTION 'LOCATION_REJECTION_REASON_REQUIRED'; END IF;
    UPDATE public.expense_location_requests SET status='Rejected',reviewed_by=a.membership_id,
      decision_reason=trim(p_reason),reviewed_at=now() WHERE id=request.id;
  END IF;
  RETURN jsonb_build_object('id',request.id,'status',CASE WHEN p_outcome='approve' THEN 'Approved' ELSE 'Rejected' END,
    'location',CASE WHEN p_outcome='approve' THEN jsonb_build_object('id',saved.id,'reference',saved.reference,'name',saved.name,'city',saved.city,'cityTier',saved.city_tier,'active',saved.active) ELSE NULL END);
END $$;

REVOKE ALL ON FUNCTION public.manage_expense_location(uuid,text,text,text,boolean),
  public.request_expense_location(jsonb,uuid),public.review_expense_location(uuid,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_expense_location(uuid,text,text,text,boolean),
  public.request_expense_location(jsonb,uuid),public.review_expense_location(uuid,text,text,text,text,text) TO authenticated;

-- Extend the already-authorized catalogue response without changing its existing
-- expense-category/service/supplier authorization contract.
DO $migration$
DECLARE fn text; marker text := $marker$'isAdmin',a.role='admin');$marker$;
BEGIN
  fn:=pg_get_functiondef('public.get_expense_catalogue(uuid)'::regprocedure);
  IF length(fn)-length(replace(fn,marker,''))<>length(marker) THEN
    RAISE EXCEPTION 'EXPENSE_LOCATION_CATALOGUE_PATCH_PRECONDITION';
  END IF;
  fn:=replace(fn,marker,$replacement$  'locations',CASE WHEN a.role<>'viewer' AND NOT a.is_client THEN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id',l.id,'reference',l.reference,'name',l.name,'city',l.city,'cityTier',l.city_tier,'active',l.active) ORDER BY l.city,l.name)
    FROM public.expense_locations l WHERE l.organization_id=a.organization_id AND l.active
  ),'[]'::jsonb) ELSE '[]'::jsonb END,
  'locationRequests',CASE WHEN a.role='admin' OR (a.role='department_lead' AND a.department_code='FIN') THEN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id',r.id,'requesterId',r.requested_by,'requesterName',m.display_name,'name',r.name,'city',r.city,'reason',r.reason,'status',r.status,'createdAt',r.created_at) ORDER BY r.created_at)
    FROM public.expense_location_requests r JOIN public.organization_members m ON m.id=r.requested_by
    WHERE r.organization_id=a.organization_id AND r.status='Pending'
  ),'[]'::jsonb) WHEN a.role<>'viewer' AND NOT a.is_client THEN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id',r.id,'requesterId',r.requested_by,'name',r.name,'city',r.city,'reason',r.reason,'status',r.status,'createdAt',r.created_at) ORDER BY r.created_at)
    FROM public.expense_location_requests r WHERE r.organization_id=a.organization_id AND r.requested_by=a.membership_id AND r.status='Pending'
  ),'[]'::jsonb) ELSE '[]'::jsonb END,
  'canManageLocations',a.role='admin',
  'canReviewLocations',a.role='admin' OR (a.role='department_lead' AND a.department_code='FIN'),
  'isAdmin',a.role='admin');$replacement$);
  EXECUTE fn;
END $migration$;

-- Travel submissions must carry a current, organization-scoped location ID.
-- The persisted display is rebuilt from the canonical row, never the client text.
DO $migration$
DECLARE fn text; marker text := $marker$next_state:=CASE WHEN data->>'requestType'='purchase' THEN 'Pending_Procurement' ELSE 'Pending_Finance' END;$marker$;
BEGIN
  fn:=pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  IF length(fn)-length(replace(fn,marker,''))<>length(marker) THEN
    RAISE EXCEPTION 'EXPENSE_LOCATION_MUTATION_PATCH_PRECONDITION';
  END IF;
  fn:=replace(fn,marker,$replacement$IF data->>'requestType'='travel' THEN
   SELECT * INTO selected_location FROM public.expense_locations
    WHERE id=NULLIF(data->>'locationId','')::uuid AND organization_id=org AND active FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'APPROVED_EXPENSE_LOCATION_REQUIRED'; END IF;
   data:=data||jsonb_build_object('locationId',selected_location.id,'destination',selected_location.name||' · '||selected_location.city,'locationCityTier',selected_location.city_tier);
  END IF;
  next_state:=CASE WHEN data->>'requestType'='purchase' THEN 'Pending_Procurement' ELSE 'Pending_Finance' END;$replacement$);
  IF position('APPROVED_EXPENSE_LOCATION_REQUIRED' in fn)=0 THEN RAISE EXCEPTION 'EXPENSE_LOCATION_VALIDATION_PATCH_FAILED'; END IF;
  fn:=replace(fn,'amount numeric; actual numeric; available numeric;','amount numeric; actual numeric; available numeric; selected_location public.expense_locations%ROWTYPE;');
  EXECUTE fn;
END $migration$;

DO $migration$
DECLARE fn text;
  marker text := $marker$'destination',data->>'destination','travelStartDate',data->>'travelStartDate'$marker$;
BEGIN
  fn:=pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  IF length(fn)-length(replace(fn,marker,''))<>length(marker) THEN
    RAISE EXCEPTION 'EXPENSE_LOCATION_PAYLOAD_PATCH_PRECONDITION';
  END IF;
  fn:=replace(fn,marker,$replacement$'destination',data->>'destination','locationId',data->>'locationId','locationCityTier',data->>'locationCityTier','travelStartDate',data->>'travelStartDate'$replacement$);
  EXECUTE fn;
END $migration$;

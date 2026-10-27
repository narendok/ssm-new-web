-- Shared register; DEMO examples are never imported.
CREATE TABLE public.decision_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 department_id uuid NOT NULL REFERENCES public.departments(id), project_id uuid REFERENCES public.operational_records(id),
 scope text NOT NULL CHECK(scope IN ('common','internal','client')), stage text,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 180), rationale text NOT NULL CHECK(length(rationale) BETWEEN 1 AND 4000),
 source_references text[] NOT NULL DEFAULT '{}', conditions text NOT NULL DEFAULT '',
 author_id uuid NOT NULL REFERENCES public.organization_members(id), author_name text NOT NULL, author_role text NOT NULL,
 status text NOT NULL CHECK(status IN ('Pending lead review','Recorded','Approved','Rejected')),
 reviewed_by uuid REFERENCES public.organization_members(id), reviewer_name text, reviewed_at timestamptz, review_reason text,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((scope='common' AND project_id IS NULL AND stage IS NULL) OR (scope IN ('internal','client') AND project_id IS NOT NULL AND stage IS NOT NULL AND length(trim(stage)) BETWEEN 1 AND 180))
);
CREATE INDEX decision_entries_scope ON public.decision_entries(organization_id,department_id,project_id,created_at DESC);
CREATE TABLE public.decision_visibility (
 organization_id uuid NOT NULL REFERENCES public.organizations(id), owner_department_id uuid NOT NULL REFERENCES public.departments(id),
 viewer_department_id uuid NOT NULL REFERENCES public.departments(id), enabled boolean NOT NULL DEFAULT true,
 updated_by uuid NOT NULL REFERENCES public.organization_members(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,owner_department_id,viewer_department_id)
);
ALTER TABLE public.decision_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_visibility ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.decision_entries,public.decision_visibility FROM anon,authenticated;
GRANT SELECT ON public.decision_entries,public.decision_visibility TO authenticated;
CREATE FUNCTION private.decision_entry_visible(p_org uuid,p_department uuid,p_author uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=p_org AND m.user_id=auth.uid() AND m.active AND m.role<>'viewer' AND
 (m.role='admin' OR (m.role='member' AND m.id=p_author) OR (m.role='department_lead' AND
 (private.shared_test_member_department(m.id)=p_department OR EXISTS(SELECT 1 FROM public.decision_visibility v WHERE v.organization_id=p_org AND v.owner_department_id=p_department AND v.viewer_department_id=private.shared_test_member_department(m.id) AND v.enabled)))))
$$;
REVOKE ALL ON FUNCTION private.decision_entry_visible(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.decision_entry_visible(uuid,uuid,uuid) TO authenticated;
CREATE POLICY decision_entries_read ON public.decision_entries FOR SELECT TO authenticated USING(private.decision_entry_visible(organization_id,department_id,author_id));
CREATE POLICY decision_visibility_admin ON public.decision_visibility FOR SELECT TO authenticated USING(public.has_organization_role(organization_id,ARRAY['admin'::public.app_role]));
CREATE FUNCTION public.get_shared_decisions() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN RAISE EXCEPTION 'DECISION_ACCESS_DENIED'; END IF;
 RETURN jsonb_build_object('entries',COALESCE((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('department_code',d.code,'project_code',p.reference) ORDER BY e.created_at DESC) FROM public.decision_entries e JOIN public.departments d ON d.id=e.department_id LEFT JOIN public.operational_records p ON p.id=e.project_id WHERE e.organization_id=a.organization_id AND private.decision_entry_visible(e.organization_id,e.department_id,e.author_id)),'[]'::jsonb),
 'visibility',CASE WHEN a.role='admin' THEN COALESCE((SELECT jsonb_agg(to_jsonb(v)) FROM public.decision_visibility v WHERE v.organization_id=a.organization_id),'[]'::jsonb) ELSE '[]'::jsonb END);
END $$;
REVOKE ALL ON FUNCTION public.get_shared_decisions() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_shared_decisions() TO authenticated;

CREATE FUNCTION public.mutate_shared_decision(p_action text,p_payload jsonb,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; org uuid; department uuid; project uuid; entry public.decision_entries%ROWTYPE; replay record;
 signature text; result jsonb; entity uuid; source text[]; viewer uuid; enabled boolean;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN RAISE EXCEPTION 'DECISION_ACCESS_DENIED'; END IF;
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>24576 THEN RAISE EXCEPTION 'INVALID_DECISION_REQUEST'; END IF;
 org:=a.organization_id;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text,0));
 signature:=encode(sha256(convert_to(p_action||':'||p_payload::text,'UTF8')),'hex');
 SELECT * INTO replay FROM private.shared_test_requests WHERE organization_id=org AND actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN IF replay.request_hash<>signature THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF; RETURN replay.response; END IF;
 department:=CASE WHEN a.role='admin' THEN NULLIF(p_payload->>'departmentId','')::uuid ELSE private.shared_test_member_department(a.membership_id) END;
 IF p_action='create' THEN
  IF department IS NULL OR NOT EXISTS(SELECT 1 FROM public.departments WHERE id=department AND organization_id=org AND active AND code<>'CLIENT') THEN RAISE EXCEPTION 'DECISION_DEPARTMENT_REQUIRED'; END IF;
  IF length(trim(COALESCE(p_payload->>'title',''))) NOT BETWEEN 1 AND 180 OR length(trim(COALESCE(p_payload->>'rationale',''))) NOT BETWEEN 1 AND 4000 OR length(COALESCE(p_payload->>'conditions',''))>2000 THEN RAISE EXCEPTION 'DECISION_TITLE_REASON_REQUIRED'; END IF;
  IF p_payload->>'scope' IS NULL OR p_payload->>'scope' NOT IN ('common','internal','client') THEN RAISE EXCEPTION 'DECISION_SCOPE_REQUIRED'; END IF;
  project:=NULLIF(p_payload->>'projectId','')::uuid;
  IF p_payload->>'scope'='common' THEN
   IF project IS NOT NULL OR NULLIF(trim(p_payload->>'stage'),'') IS NOT NULL THEN RAISE EXCEPTION 'COMMON_DECISION_HAS_NO_PROJECT_STAGE'; END IF;
  ELSE
   IF project IS NULL OR NOT EXISTS(SELECT 1 FROM public.operational_records r WHERE r.id=project AND r.organization_id=org AND r.record_type='Project' AND r.archived_at IS NULL AND private.shared_test_record_visible(r.id)) THEN RAISE EXCEPTION 'DECISION_PROJECT_REQUIRED'; END IF;
   IF length(trim(COALESCE(p_payload->>'stage',''))) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'DECISION_STAGE_REQUIRED'; END IF;
  END IF;
  IF p_payload ? 'sourceReferences' AND (jsonb_typeof(p_payload->'sourceReferences')<>'array' OR jsonb_array_length(p_payload->'sourceReferences')>20) THEN RAISE EXCEPTION 'INVALID_SOURCE_REFERENCES'; END IF;
  SELECT COALESCE(array_agg(trim(value)) FILTER(WHERE trim(value)<>''),'{}') INTO source FROM jsonb_array_elements_text(COALESCE(p_payload->'sourceReferences','[]'::jsonb));
  IF EXISTS(SELECT 1 FROM unnest(source) s WHERE length(s)>300) THEN RAISE EXCEPTION 'INVALID_SOURCE_REFERENCES'; END IF;
  INSERT INTO public.decision_entries(organization_id,department_id,project_id,scope,stage,title,rationale,source_references,conditions,author_id,author_name,author_role,status)
  VALUES(org,department,project,p_payload->>'scope',CASE WHEN project IS NOT NULL THEN trim(p_payload->>'stage') END,trim(p_payload->>'title'),trim(p_payload->>'rationale'),source,COALESCE(p_payload->>'conditions',''),a.membership_id,a.display_name,a.role::text,CASE WHEN a.role='member' THEN 'Pending lead review' ELSE 'Recorded' END) RETURNING id INTO entity;
 ELSIF p_action IN ('approve','reject') THEN
  SELECT * INTO entry FROM public.decision_entries WHERE id=NULLIF(p_payload->>'id','')::uuid AND organization_id=org FOR UPDATE;
  IF entry.id IS NULL OR entry.status<>'Pending lead review' OR (a.role<>'admin' AND (a.role<>'department_lead' OR private.shared_test_member_department(a.membership_id) IS DISTINCT FROM entry.department_id)) THEN RAISE EXCEPTION 'DECISION_REVIEW_DENIED'; END IF;
  IF entry.author_id=a.membership_id THEN RAISE EXCEPTION 'DECISION_SELF_APPROVAL_DENIED'; END IF;
  IF entry.version IS DISTINCT FROM (p_payload->>'expectedVersion')::integer THEN RAISE EXCEPTION 'STALE_DECISION'; END IF;
  IF p_action='reject' AND length(trim(COALESCE(p_payload->>'reason','')))<3 THEN RAISE EXCEPTION 'REJECTION_REASON_REQUIRED'; END IF;
  UPDATE public.decision_entries SET status=CASE WHEN p_action='approve' THEN 'Approved' ELSE 'Rejected' END,reviewed_by=a.membership_id,reviewer_name=a.display_name,reviewed_at=now(),review_reason=p_payload->>'reason',version=version+1 WHERE id=entry.id;
  entity:=entry.id;
 ELSIF p_action='visibility' THEN
  IF a.role<>'admin' THEN RAISE EXCEPTION 'DECISION_VISIBILITY_ADMIN_REQUIRED'; END IF;
  viewer:=NULLIF(p_payload->>'viewerDepartmentId','')::uuid; enabled:=(p_payload->>'enabled')::boolean;
  IF enabled IS NULL OR NOT EXISTS(SELECT 1 FROM public.departments WHERE id=department AND organization_id=org AND active AND code<>'CLIENT') OR NOT EXISTS(SELECT 1 FROM public.departments WHERE id=viewer AND organization_id=org AND active AND code<>'CLIENT') THEN RAISE EXCEPTION 'INVALID_VISIBILITY_DEPARTMENT'; END IF;
  INSERT INTO public.decision_visibility(organization_id,owner_department_id,viewer_department_id,enabled,updated_by) VALUES(org,department,viewer,enabled,a.membership_id) ON CONFLICT(organization_id,owner_department_id,viewer_department_id) DO UPDATE SET enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
  entity:=department;
 ELSE RAISE EXCEPTION 'UNKNOWN_DECISION_ACTION'; END IF;
 INSERT INTO public.audit_events(organization_id,actor_id,entity_type,entity_id,action,detail) VALUES(org,auth.uid(),'decision',entity,'decision_'||p_action,jsonb_build_object('department_id',department,'viewer_department_id',viewer,'enabled',enabled));
 result:=jsonb_build_object('id',entity,'saved',true);
 INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response) VALUES(org,auth.uid(),p_request_id,signature,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.mutate_shared_decision(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_shared_decision(text,jsonb,uuid) TO authenticated;

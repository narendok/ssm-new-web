-- Shared TEST operations use normalized records; browser DEMO data is never imported.
CREATE OR REPLACE FUNCTION private.is_shared_test_org(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS(SELECT 1 FROM organizations WHERE id=p_org AND name='TEST ONLY · SSM-new1 synthetic workspace')
$$;
REVOKE ALL ON FUNCTION private.is_shared_test_org(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.is_shared_test_org(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.shared_test_member_department(p_member uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT d.id FROM organization_members m JOIN departments d ON d.organization_id=m.organization_id AND d.active
 WHERE m.id=p_member AND m.active AND (d.lead_member_id=m.id OR EXISTS(
 SELECT 1 FROM department_role_assignments a JOIN department_roles r ON r.id=a.role_id
 WHERE a.member_id=m.id AND a.active AND r.active AND r.organization_id=m.organization_id AND r.department_id=d.id))
 ORDER BY (d.lead_member_id=m.id) DESC,d.id LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.shared_test_member_department(uuid) FROM PUBLIC,anon,authenticated;

-- Repair department membership for the already-provisioned synthetic employees only.
INSERT INTO department_roles(organization_id,department_id,name,role_key)
SELECT d.organization_id,d.id,'TEST employee','test_employee' FROM departments d
WHERE private.is_shared_test_org(d.organization_id) AND d.active AND d.code<>'CLIENT'
ON CONFLICT(organization_id,department_id,role_key) DO NOTHING;
INSERT INTO department_role_assignments(role_id,member_id,assigned_by)
SELECT r.id,m.id,o.created_by FROM department_roles r JOIN departments d ON d.id=r.department_id
JOIN organizations o ON o.id=r.organization_id JOIN organization_members m ON m.organization_id=o.id AND m.active AND m.role='member'
JOIN auth.users u ON u.id=m.user_id AND lower(u.email)='employee.'||lower(d.code)||'@example.com'
WHERE private.is_shared_test_org(o.id) AND r.role_key='test_employee'
ON CONFLICT(role_id,member_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.resolve_test_membership()
RETURNS TABLE(organization_id uuid,organization_name text,membership_id uuid,display_name text,role public.app_role,department_code text,department_name text,is_client boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT m.organization_id,o.name,m.id,COALESCE(m.display_name,'TEST user'),m.role,d.code,d.name,m.role='viewer'
 FROM organization_members m JOIN organizations o ON o.id=m.organization_id
 LEFT JOIN departments d ON d.id=private.shared_test_member_department(m.id)
 WHERE auth.uid() IS NOT NULL AND m.user_id=auth.uid() AND m.active AND private.is_shared_test_org(o.id)
 ORDER BY m.created_at,m.id LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.resolve_test_membership() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_test_membership() TO authenticated;

CREATE OR REPLACE FUNCTION private.shared_test_scope(p_org uuid,p_department uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=p_org AND m.user_id=auth.uid() AND m.active
 AND m.role<>'viewer' AND (m.role='admin' OR private.shared_test_member_department(m.id)=p_department))
$$;
REVOKE ALL ON FUNCTION private.shared_test_scope(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.shared_test_scope(uuid,uuid) TO authenticated;

ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS reviewer_department_id uuid REFERENCES public.departments(id);
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS decision_notes text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION private.shared_test_record_visible(p_record uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM operational_records r WHERE r.id=p_record AND
 (private.shared_test_scope(r.organization_id,r.department_id) OR (r.record_type='Project' AND EXISTS(
 SELECT 1 FROM organization_members m WHERE m.organization_id=r.organization_id AND m.user_id=auth.uid() AND m.active AND m.role<>'viewer'))
 OR EXISTS(SELECT 1 FROM approvals a WHERE a.record_id=r.id AND a.organization_id=r.organization_id
 AND private.shared_test_scope(a.organization_id,COALESCE(a.reviewer_department_id,a.department_id)))))
$$;
REVOKE ALL ON FUNCTION private.shared_test_record_visible(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.shared_test_record_visible(uuid) TO authenticated;

-- Existing non-TEST organizations retain their policies. TEST mutations must use the checked RPC.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['operational_records','tasks','approvals','documents','record_links','audit_events'] LOOP
 EXECUTE format('DROP POLICY IF EXISTS shared_test_no_direct_insert ON public.%I',t);
 EXECUTE format('CREATE POLICY shared_test_no_direct_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT private.is_shared_test_org(organization_id))',t);
 IF t<>'audit_events' THEN
 EXECUTE format('DROP POLICY IF EXISTS shared_test_no_direct_update ON public.%I',t);
 EXECUTE format('DROP POLICY IF EXISTS shared_test_no_direct_delete ON public.%I',t);
 EXECUTE format('CREATE POLICY shared_test_no_direct_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT private.is_shared_test_org(organization_id)) WITH CHECK (NOT private.is_shared_test_org(organization_id))',t);
 EXECUTE format('CREATE POLICY shared_test_no_direct_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT private.is_shared_test_org(organization_id))',t);
 END IF; END LOOP;
END $$;
DROP POLICY IF EXISTS shared_test_record_reads ON operational_records;
DROP POLICY IF EXISTS shared_test_task_reads ON tasks;
DROP POLICY IF EXISTS shared_test_approval_reads ON approvals;
DROP POLICY IF EXISTS shared_test_document_reads ON documents;
DROP POLICY IF EXISTS shared_test_link_reads ON record_links;
DROP POLICY IF EXISTS shared_test_audit_reads ON audit_events;
CREATE POLICY shared_test_record_reads ON operational_records AS RESTRICTIVE FOR SELECT TO authenticated
USING(NOT private.is_shared_test_org(organization_id) OR private.shared_test_record_visible(id));
CREATE POLICY shared_test_task_reads ON tasks AS RESTRICTIVE FOR SELECT TO authenticated
USING(NOT private.is_shared_test_org(organization_id) OR private.shared_test_scope(organization_id,department_id) OR EXISTS(SELECT 1 FROM organization_members m WHERE m.id=assignee_id AND m.user_id=auth.uid() AND m.active));
CREATE POLICY shared_test_approval_reads ON approvals AS RESTRICTIVE FOR SELECT TO authenticated
USING(NOT private.is_shared_test_org(organization_id) OR created_by=auth.uid() OR private.shared_test_scope(organization_id,department_id) OR private.shared_test_scope(organization_id,reviewer_department_id));
CREATE POLICY shared_test_document_reads ON documents AS RESTRICTIVE FOR SELECT TO authenticated
USING(NOT private.is_shared_test_org(organization_id) OR private.shared_test_scope(organization_id,department_id));
CREATE POLICY shared_test_link_reads ON record_links AS RESTRICTIVE FOR SELECT TO authenticated
USING(NOT private.is_shared_test_org(organization_id) OR (private.shared_test_record_visible(source_record_id) AND private.shared_test_record_visible(target_record_id)));
CREATE POLICY shared_test_audit_reads ON audit_events AS RESTRICTIVE FOR SELECT TO authenticated
USING(NOT private.is_shared_test_org(organization_id) OR actor_id=auth.uid() OR public.has_organization_role(organization_id,ARRAY['admin'::app_role]));

-- Delegated TEST review authority is set only by the source owner's checked request transaction.
CREATE OR REPLACE FUNCTION private.bind_shared_test_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r operational_records%ROWTYPE; f controlled_document_files%ROWTYPE; d documents%ROWTYPE; signer organization_members%ROWTYPE; owner_department uuid; reviewer uuid;
BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW.organization_id,NEW.record_id,NEW.department_id,NEW.reviewer_department_id,NEW.created_by,NEW.evidence_record_id,NEW.evidence_document_id,NEW.evidence_revision)
 IS DISTINCT FROM ROW(OLD.organization_id,OLD.record_id,OLD.department_id,OLD.reviewer_department_id,OLD.created_by,OLD.evidence_record_id,OLD.evidence_document_id,OLD.evidence_revision) THEN RAISE EXCEPTION 'APPROVAL_REQUEST_IMMUTABLE'; END IF;
 IF TG_OP='UPDATE' AND OLD.outcome<>'pending' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'DECISION_ALREADY_SAVED'; END IF;
 IF NEW.evidence_record_id IS NULL AND NEW.evidence_document_id IS NULL THEN RETURN NEW; END IF;
 IF num_nonnulls(NEW.evidence_record_id,NEW.evidence_document_id)<>1 OR NULLIF(trim(NEW.evidence_revision),'') IS NULL OR NEW.evidence_is_na THEN RAISE EXCEPTION 'EVIDENCE_BINDING_REQUIRED'; END IF;
 SELECT * INTO r FROM operational_records WHERE id=NEW.record_id AND organization_id=NEW.organization_id AND archived_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'RECORD_NOT_FOUND'; END IF;
 owner_department:=r.department_id;
 IF NEW.evidence_record_id IS NOT NULL THEN
 IF NEW.evidence_record_id<>r.id OR r.fields->>'revision' IS DISTINCT FROM NEW.evidence_revision THEN RAISE EXCEPTION 'EVIDENCE_REVISION_MISMATCH'; END IF;
 NEW.evidence_checksum:=encode(sha256(convert_to(r.fields::text,'UTF8')),'hex');
 ELSE
 SELECT * INTO d FROM documents WHERE id=NEW.evidence_document_id AND organization_id=NEW.organization_id AND record_id=r.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'EVIDENCE_DOCUMENT_MISMATCH'; END IF;
 SELECT * INTO f FROM controlled_document_files WHERE document_id=d.id AND organization_id=NEW.organization_id AND revision=NEW.evidence_revision AND superseded_at IS NULL;
 IF NOT FOUND OR f.checksum !~ '^[a-fA-F0-9]{64}$' OR (SELECT count(*) FROM controlled_document_files WHERE document_id=d.id AND revision=NEW.evidence_revision AND superseded_at IS NULL)<>1 THEN RAISE EXCEPTION 'ACTIVE_REVISION_REQUIRED'; END IF;
 NEW.evidence_checksum:=lower(f.checksum);
 END IF;
 reviewer:=COALESCE(NEW.reviewer_department_id,owner_department);
 IF NOT EXISTS(SELECT 1 FROM departments WHERE id=reviewer AND organization_id=NEW.organization_id AND active AND code<>'CLIENT') THEN RAISE EXCEPTION 'REVIEWER_DEPARTMENT_REQUIRED'; END IF;
 IF TG_OP='INSERT' AND NOT public.has_department_permission(NEW.organization_id,owner_department,'approvals:decide') THEN RAISE EXCEPTION 'REQUEST_AUTHORITY_DENIED'; END IF;
 IF NEW.outcome='approved' THEN
 SELECT * INTO signer FROM organization_members WHERE organization_id=NEW.organization_id AND user_id=auth.uid() AND active;
 IF auth.uid() IS NULL OR NEW.decided_by IS DISTINCT FROM auth.uid() OR NEW.approver_id IS DISTINCT FROM signer.id OR NOT public.has_department_permission(NEW.organization_id,reviewer,'approvals:decide') THEN RAISE EXCEPTION 'SIGNING_AUTHORITY_DENIED'; END IF;
 NEW.decided_at:=now();
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.bind_shared_test_approval() FROM PUBLIC,anon,authenticated;
DROP TRIGGER bind_approval_evidence_revision ON public.approvals;
CREATE TRIGGER bind_approval_evidence_revision BEFORE INSERT OR UPDATE ON approvals FOR EACH ROW
WHEN(NOT private.is_shared_test_org(NEW.organization_id)) EXECUTE FUNCTION public.bind_approval_evidence_revision();
DROP TRIGGER IF EXISTS bind_shared_test_approval ON approvals;
CREATE TRIGGER bind_shared_test_approval BEFORE INSERT OR UPDATE ON approvals FOR EACH ROW
WHEN(private.is_shared_test_org(NEW.organization_id)) EXECUTE FUNCTION private.bind_shared_test_approval();

CREATE TABLE IF NOT EXISTS private.shared_test_requests(
 organization_id uuid NOT NULL REFERENCES public.organizations(id),actor_id uuid NOT NULL REFERENCES auth.users(id),
 request_id uuid NOT NULL,request_hash text NOT NULL,response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,actor_id,request_id));
ALTER TABLE private.shared_test_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.shared_test_requests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_test_workspace()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; result jsonb;
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL THEN RAISE EXCEPTION 'TEST_MEMBERSHIP_REQUIRED'; END IF;
 SELECT jsonb_build_object(
 'membership',to_jsonb(a),'serverTime',now(),
 'departments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'name',d.name,'lead_member_id',d.lead_member_id) ORDER BY d.sort_order) FROM departments d WHERE d.organization_id=a.organization_id AND d.active AND d.code<>'CLIENT'),'[]'::jsonb),
 'members',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'display_name',m.display_name,'role',m.role,'department_id',private.shared_test_member_department(m.id))) FROM organization_members m WHERE m.organization_id=a.organization_id AND m.active AND (a.role='admin' OR private.shared_test_scope(a.organization_id,private.shared_test_member_department(m.id)))),'[]'::jsonb),
 'records',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM operational_records r WHERE r.organization_id=a.organization_id AND r.archived_at IS NULL AND private.shared_test_record_visible(r.id)),'[]'::jsonb),
 'tasks',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC) FROM tasks t WHERE t.organization_id=a.organization_id AND (private.shared_test_scope(t.organization_id,t.department_id) OR t.assignee_id=a.membership_id)),'[]'::jsonb),
 'approvals',COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC) FROM approvals p WHERE p.organization_id=a.organization_id AND a.role<>'viewer' AND (p.created_by=auth.uid() OR private.shared_test_scope(p.organization_id,p.department_id) OR private.shared_test_scope(p.organization_id,p.reviewer_department_id))),'[]'::jsonb),
 'documents',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at DESC) FROM documents d WHERE d.organization_id=a.organization_id AND private.shared_test_scope(d.organization_id,d.department_id)),'[]'::jsonb),
 'audit',COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT * FROM audit_events WHERE organization_id=a.organization_id AND (a.role='admin' OR actor_id=auth.uid()) ORDER BY created_at DESC LIMIT 100)e),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_shared_test_workspace() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_shared_test_workspace() TO authenticated;

CREATE OR REPLACE FUNCTION public.mutate_shared_test_workspace(p_action text,p_payload jsonb,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; m organization_members%ROWTYPE; r operational_records%ROWTYPE; t tasks%ROWTYPE; p approvals%ROWTYPE;
 org uuid; dept uuid; reviewer uuid; assignee uuid; project uuid; entity uuid; fields jsonb; payload_hash text; replay record; result jsonb;
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.role='viewer' THEN RAISE EXCEPTION 'TEST_WRITE_DENIED'; END IF;
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>131072 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 org:=a.organization_id; dept:=private.shared_test_member_department(a.membership_id);
 IF a.role<>'admin' AND dept IS NULL THEN RAISE EXCEPTION 'DEPARTMENT_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text,0));
 payload_hash:=encode(sha256(convert_to(p_action||p_payload::text,'UTF8')),'hex');
 SELECT * INTO replay FROM private.shared_test_requests WHERE organization_id=org AND actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN IF replay.request_hash<>payload_hash THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF; RETURN replay.response; END IF;
 IF p_action IN ('create_project','create_record','create_task','create_document') AND NULLIF(trim(p_payload->>'title'),'') IS NULL THEN RAISE EXCEPTION 'TITLE_REQUIRED'; END IF;
 IF p_action IN ('create_record','create_task') THEN
 project:=(p_payload->>'project_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM operational_records WHERE id=project AND organization_id=org AND record_type='Project' AND archived_at IS NULL) THEN RAISE EXCEPTION 'PROJECT_REQUIRED'; END IF;
 IF a.role='admin' THEN dept:=NULLIF(p_payload->>'department_id','')::uuid; END IF;
 IF NOT EXISTS(SELECT 1 FROM departments WHERE id=dept AND organization_id=org AND active AND code<>'CLIENT') THEN RAISE EXCEPTION 'DEPARTMENT_REQUIRED'; END IF;
 END IF;
 IF p_action='create_project' THEN
 IF a.role<>'admin' AND NOT (a.role='department_lead' AND a.department_code='SAL') THEN RAISE EXCEPTION 'PROJECT_CREATE_DENIED'; END IF;
 IF COALESCE(p_payload->>'reference','') !~ '^HLPL-[A-Z0-9]+(-[A-Z0-9]+)*$' THEN RAISE EXCEPTION 'PROJECT_CODE_REQUIRED'; END IF;
 SELECT id INTO dept FROM departments WHERE organization_id=org AND code='SAL' AND active;
 INSERT INTO operational_records(organization_id,department_id,area,record_type,reference,title,stage,fields,notes,created_by,updated_by,is_demo)
 VALUES(org,dept,'sales','Project',p_payload->>'reference',trim(p_payload->>'title'),'Stage 1',jsonb_build_object('revision','01'),COALESCE(p_payload->>'notes',''),auth.uid(),auth.uid(),true) RETURNING id INTO entity;
 ELSIF p_action='create_record' THEN
 IF lower(trim(p_payload->>'record_type'))='project' THEN RAISE EXCEPTION 'USE_PROJECT_CREATION'; END IF;
 IF COALESCE(p_payload->>'reference','') !~ '^HLPL-[A-Z0-9]+(-[A-Z0-9]+)*$' OR NULLIF(trim(p_payload->>'record_type'),'') IS NULL THEN RAISE EXCEPTION 'CONTROLLED_REFERENCE_REQUIRED'; END IF;
 fields:=COALESCE(p_payload->'fields','{}'::jsonb);
 IF jsonb_typeof(fields)<>'object' OR fields ?| ARRAY['last_stage_gate','lifecycleStage','currentStage'] OR NULLIF(trim(fields->>'revision'),'') IS NULL THEN RAISE EXCEPTION 'REVISION_REQUIRED'; END IF;
 INSERT INTO operational_records(organization_id,department_id,area,record_type,reference,title,fields,notes,created_by,updated_by,is_demo)
 VALUES(org,dept,(SELECT lower(code) FROM departments WHERE id=dept),p_payload->>'record_type',p_payload->>'reference',trim(p_payload->>'title'),fields,COALESCE(p_payload->>'notes',''),auth.uid(),auth.uid(),true) RETURNING id INTO entity;
 INSERT INTO record_links(organization_id,source_record_id,target_record_id,relationship,created_by) VALUES(org,project,entity,'deliverable',auth.uid());
 ELSIF p_action='create_task' THEN
 assignee:=NULLIF(p_payload->>'assignee_id','')::uuid;
 IF a.role='member' THEN assignee:=a.membership_id; END IF;
 IF assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM organization_members WHERE id=assignee AND organization_id=org AND active AND role<>'viewer' AND private.shared_test_member_department(id)=dept) THEN RAISE EXCEPTION 'ASSIGNEE_DEPARTMENT_MISMATCH'; END IF;
 INSERT INTO tasks(organization_id,department_id,record_id,title,assignee_id,due_at,created_by)
 VALUES(org,dept,project,trim(p_payload->>'title'),assignee,NULLIF(p_payload->>'due_at','')::timestamptz,auth.uid()) RETURNING id INTO entity;
 ELSIF p_action='update_task' THEN
 SELECT * INTO t FROM tasks WHERE id=(p_payload->>'id')::uuid AND organization_id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_FOUND'; END IF;
 IF t.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN RAISE EXCEPTION 'STALE_WRITE: Reload before saving'; END IF;
 IF a.role<>'admin' AND NOT (a.role='department_lead' AND t.department_id=dept) AND NOT (a.role='member' AND t.assignee_id=a.membership_id) THEN RAISE EXCEPTION 'TASK_WRITE_DENIED'; END IF;
 IF p_payload->>'status' NOT IN ('Open','In Progress','In review','Complete') OR p_payload->>'status' IS NULL THEN RAISE EXCEPTION 'INVALID_TASK_STATUS'; END IF;
 assignee:=t.assignee_id;
 IF p_payload ? 'assignee_id' THEN
 IF a.role='member' THEN RAISE EXCEPTION 'TASK_ASSIGNMENT_DENIED'; END IF;
 assignee:=NULLIF(p_payload->>'assignee_id','')::uuid;
 IF assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM organization_members WHERE id=assignee AND organization_id=org AND active AND role<>'viewer' AND private.shared_test_member_department(id)=t.department_id) THEN RAISE EXCEPTION 'ASSIGNEE_DEPARTMENT_MISMATCH'; END IF;
 END IF;
 UPDATE tasks SET status=p_payload->>'status',assignee_id=assignee,updated_at=now() WHERE id=t.id; entity:=t.id;
 ELSIF p_action IN ('update_record','request_approval','create_document') THEN
 SELECT * INTO r FROM operational_records WHERE id=(p_payload->>'record_id')::uuid AND organization_id=org AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'RECORD_NOT_FOUND'; END IF;
 IF NOT private.shared_test_scope(org,r.department_id) THEN RAISE EXCEPTION 'RECORD_SCOPE_DENIED'; END IF;
 IF p_action='update_record' THEN
 IF r.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN RAISE EXCEPTION 'STALE_WRITE: Reload before saving'; END IF;
 IF r.record_type='Project' THEN RAISE EXCEPTION 'USE_STAGE_GATE'; END IF;
 IF a.role='member' AND r.created_by<>auth.uid() THEN RAISE EXCEPTION 'RECORD_WRITE_DENIED'; END IF;
 fields:=COALESCE(p_payload->'fields',r.fields);
 IF jsonb_typeof(fields)<>'object' OR fields ?| ARRAY['last_stage_gate','lifecycleStage','currentStage'] OR NULLIF(trim(fields->>'revision'),'') IS NULL THEN RAISE EXCEPTION 'REVISION_REQUIRED'; END IF;
 IF r.status IN ('approved','released') AND (fields->>'revision'=r.fields->>'revision' OR a.role='member') THEN RAISE EXCEPTION 'NEW_REVISION_REQUIRED'; END IF;
 UPDATE operational_records SET fields=fields,notes=COALESCE(p_payload->>'notes',notes),status='draft',updated_by=auth.uid() WHERE id=r.id; entity:=r.id;
 ELSIF p_action='request_approval' THEN
 IF NOT public.has_department_permission(org,r.department_id,'approvals:decide') THEN RAISE EXCEPTION 'REQUEST_AUTHORITY_DENIED'; END IF;
 reviewer:=(p_payload->>'reviewer_department_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM departments WHERE id=reviewer AND organization_id=org AND active AND code<>'CLIENT') THEN RAISE EXCEPTION 'REVIEWER_DEPARTMENT_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM approvals WHERE organization_id=org AND record_id=r.id AND reviewer_department_id=reviewer AND evidence_revision=r.fields->>'revision' AND outcome='pending') THEN RAISE EXCEPTION 'REVIEW_ALREADY_PENDING'; END IF;
 INSERT INTO approvals(organization_id,department_id,reviewer_department_id,record_id,title,created_by,evidence_record_id,evidence_revision)
 VALUES(org,r.department_id,reviewer,r.id,'Review · '||r.reference,auth.uid(),r.id,r.fields->>'revision') RETURNING id INTO entity;
 UPDATE operational_records SET status='in_review',updated_by=auth.uid() WHERE id=r.id;
 ELSE
 INSERT INTO documents(organization_id,department_id,record_id,title,document_type,reference_url,created_by)
 VALUES(org,r.department_id,r.id,trim(p_payload->>'title'),COALESCE(NULLIF(p_payload->>'document_type',''),'Controlled document'),'private',auth.uid()) RETURNING id INTO entity;
 END IF;
 ELSIF p_action='decide_approval' THEN
 SELECT * INTO p FROM approvals WHERE id=(p_payload->>'id')::uuid AND organization_id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'APPROVAL_NOT_FOUND'; END IF;
 IF p.outcome<>'pending' THEN RAISE EXCEPTION 'DECISION_ALREADY_SAVED'; END IF;
 IF p.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN RAISE EXCEPTION 'STALE_WRITE: Reload before saving'; END IF;
 IF NOT public.has_department_permission(org,COALESCE(p.reviewer_department_id,p.department_id),'approvals:decide') THEN RAISE EXCEPTION 'SIGNING_AUTHORITY_DENIED'; END IF;
 IF p_payload->>'outcome' NOT IN ('approved','rejected','returned') OR p_payload->>'outcome' IS NULL THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
 UPDATE approvals SET outcome=(p_payload->>'outcome')::approval_outcome,approver_id=a.membership_id,decided_by=auth.uid(),decided_at=now(),decision_notes=COALESCE(p_payload->>'notes','') WHERE id=p.id;
 UPDATE operational_records SET status=CASE WHEN p_payload->>'outcome'='approved' AND NOT EXISTS(SELECT 1 FROM approvals WHERE record_id=p.record_id AND evidence_revision=p.evidence_revision AND outcome<>'approved') THEN 'approved'::portal_record_status ELSE 'in_review'::portal_record_status END,updated_by=auth.uid() WHERE id=p.record_id;
 entity:=p.id;
 ELSE RAISE EXCEPTION 'UNSUPPORTED_ACTION'; END IF;
 INSERT INTO audit_events(organization_id,actor_id,entity_type,entity_id,action,detail)
 VALUES(org,auth.uid(),'shared_test_workspace',entity,p_action,jsonb_build_object('membership_id',a.membership_id,'department',a.department_code));
 result:=jsonb_build_object('id',entity,'action',p_action,'saved_at',now());
 INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response) VALUES(org,auth.uid(),p_request_id,payload_hash,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.mutate_shared_test_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_shared_test_workspace(text,jsonb,uuid) TO authenticated;

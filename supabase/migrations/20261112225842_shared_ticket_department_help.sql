-- Shared TEST cross-department ticket help. The receiving department gets a
-- minimal request record; the original ticket, project, asset and thread remain private.
ALTER TABLE public.business_items DROP CONSTRAINT business_items_kind_check;
ALTER TABLE public.business_items ADD CONSTRAINT business_items_kind_check
  CHECK (kind IN ('allocation','expense','ticket','ticket_help_request','profile','template','assignment','channel','message'));

DO $ticket_help$
DECLARE
  fn text;
  before text;
  anchor text;
BEGIN
  fn := pg_get_functiondef('private.business_visible(public.business_items,jsonb)'::regprocedure);
  before := fn;
  anchor := ' IF role=''viewer'' THEN RETURN false; END IF;';
  fn := replace(fn, anchor,
    ' IF p.kind=''ticket_help_request'' THEN'||E'\n'||
    '  RETURN role=''admin'' OR p.owner_id=mid OR (role<>''viewer'' AND dept=''SIT'') OR (role=''department_lead'' AND p.department_id=private.shared_test_member_department(mid));'||E'\n'||
    ' END IF;'||E'\n'||anchor);
  IF fn = before THEN RAISE EXCEPTION 'TICKET_HELP_VISIBILITY_PATCH_FAILED'; END IF;
  EXECUTE fn;

  fn := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  before := fn;
  anchor := ' ELSIF p_action=''ticket_create'' THEN';
  fn := replace(fn, anchor,
    ' ELSIF p_action=''ticket_dispatch_help'' THEN'||E'\n'||
    '  IF NOT is_service THEN RAISE EXCEPTION ''SERVICE_AUTHORITY_REQUIRED''; END IF;'||E'\n'||
    '  SELECT * INTO t FROM business_items WHERE id=NULLIF(data->>''ticketId'','''')::uuid AND organization_id=org AND kind=''ticket'' AND private.business_visible(business_items,to_jsonb(a)) FOR UPDATE;'||E'\n'||
    '  IF NOT FOUND THEN RAISE EXCEPTION ''TICKET_REQUIRED''; END IF;'||E'\n'||
    '  next_state:=NULLIF(data->>''departmentCode'','''');'||E'\n'||
    '  SELECT id INTO project FROM departments WHERE organization_id=org AND active AND code=next_state AND code<>''SIT'';'||E'\n'||
    '  IF project IS NULL THEN RAISE EXCEPTION ''INVALID_HELP_DEPARTMENT''; END IF;'||E'\n'||
    '  IF length(trim(COALESCE(data->>''summary'','''')))<8 OR length(trim(COALESCE(data->>''summary'','''')))>4000 THEN RAISE EXCEPTION ''HELP_SUMMARY_REQUIRED''; END IF;'||E'\n'||
    '  IF EXISTS(SELECT 1 FROM business_items h WHERE h.organization_id=org AND h.kind=''ticket_help_request'' AND h.payload->>''ticketId''=t.id::text AND h.payload->>''departmentCode''=next_state AND h.payload->>''status''<>''Closed'') THEN RAISE EXCEPTION ''HELP_REQUEST_ALREADY_OPEN''; END IF;'||E'\n'||
    '  INSERT INTO business_items(organization_id,kind,owner_id,department_id,project_id,payload) VALUES(org,''ticket_help_request'',mid,project,NULL,jsonb_build_object(''ticketId'',t.id,''ticketReference'',''TKT-''||left(t.id::text,8),''departmentCode'',next_state,''departmentName'',(SELECT name FROM departments WHERE id=project),''summary'',trim(data->>''summary''),''status'',''Requested'',''requestedBy'',a.display_name,''createdAt'',now())) RETURNING id INTO item_id;'||E'\n'||
    ' ELSIF p_action=''ticket_help_response'' THEN'||E'\n'||
    '  IF i.kind IS DISTINCT FROM ''ticket_help_request'' OR NOT (a.role=''admin'' OR (a.role=''department_lead'' AND i.department_id=private.shared_test_member_department(mid))) THEN RAISE EXCEPTION ''HELP_RESPONSE_AUTHORITY_REQUIRED''; END IF;'||E'\n'||
    '  IF i.payload->>''status''<>''Requested'' THEN RAISE EXCEPTION ''HELP_REQUEST_NOT_PENDING''; END IF;'||E'\n'||
    '  IF length(trim(COALESCE(data->>''response'','''')))<3 OR length(trim(COALESCE(data->>''response'','''')))>4000 THEN RAISE EXCEPTION ''HELP_RESPONSE_REQUIRED''; END IF;'||E'\n'||
    '  UPDATE business_items SET payload=i.payload||jsonb_build_object(''response'',trim(data->>''response''),''status'',''Responded'',''respondedBy'',a.display_name,''respondedAt'',now()),version=version+1,updated_at=now() WHERE id=i.id;'||E'\n'||
    ' ELSIF p_action=''ticket_help_close'' THEN'||E'\n'||
    '  IF i.kind IS DISTINCT FROM ''ticket_help_request'' OR NOT is_service THEN RAISE EXCEPTION ''SERVICE_AUTHORITY_REQUIRED''; END IF;'||E'\n'||
    '  IF i.payload->>''status''<>''Responded'' THEN RAISE EXCEPTION ''HELP_RESPONSE_REQUIRED_BEFORE_CLOSE''; END IF;'||E'\n'||
    '  UPDATE business_items SET payload=i.payload||jsonb_build_object(''status'',''Closed'',''closedBy'',a.display_name,''closedAt'',now()),version=version+1,updated_at=now() WHERE id=i.id;'||E'\n'||anchor);
  IF fn = before THEN RAISE EXCEPTION 'TICKET_HELP_MUTATION_PATCH_FAILED'; END IF;
  EXECUTE fn;

  fn := pg_get_functiondef('private.business_notify(uuid)'::regprocedure);
  before := fn;
  anchor := '  (i.kind IN (''expense'',''assignment'',''ticket'') AND m.id=i.owner_id) OR'||E'\n';
  fn := replace(fn, anchor,
    anchor||'  (i.kind=''ticket_help_request'' AND (m.id=i.owner_id OR m.role=''admin'' OR (m.role=''department_lead'' AND private.shared_test_member_department(m.id)=i.department_id))) OR'||E'\n');
  IF fn = before THEN RAISE EXCEPTION 'TICKET_HELP_NOTIFICATION_PATCH_FAILED'; END IF;
  EXECUTE fn;
END
$ticket_help$;

REVOKE ALL ON FUNCTION private.business_visible(public.business_items,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) TO authenticated;

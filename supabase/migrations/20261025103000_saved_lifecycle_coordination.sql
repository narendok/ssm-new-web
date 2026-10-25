-- Expose saved lifecycle notes/history only through the existing authorized coordination projection.
CREATE OR REPLACE FUNCTION public.get_project_coordination() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public SET timezone='Asia/Kolkata' AS $$
DECLARE a record;
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.role='viewer' THEN RAISE EXCEPTION 'COORDINATION_ACCESS_DENIED'; END IF;
 RETURN jsonb_build_object('records',COALESCE((SELECT jsonb_agg(jsonb_build_object(
 'id',r.id,'reference',r.reference,'title',CASE WHEN private.shared_test_record_visible(r.id) THEN r.title ELSE r.record_type||' · '||COALESCE(d.code,'department') END,
 'type',r.record_type,'status',r.status,'area',lower(COALESCE(d.code,r.area)),
 'fields',jsonb_strip_nulls(jsonb_build_object(
 'projectId',COALESCE(r.fields->>'projectId',r.fields->>'project_id',(SELECT l.source_record_id::text FROM record_links l JOIN operational_records parent ON parent.id=l.source_record_id WHERE l.organization_id=r.organization_id AND l.target_record_id=r.id AND parent.record_type='Project' AND parent.archived_at IS NULL ORDER BY l.id LIMIT 1)),'projectCode',r.fields->>'projectCode','stage',r.stage,
 'lifecycleStage',r.stage,'targetDate',r.fields->>'targetDate','dependsOn',r.fields->>'dependsOn','requiredInputs',r.fields->>'requiredInputs',
 'enquiryId',r.fields->>'enquiryId','owner',COALESCE(r.fields->>'owner',(SELECT m.display_name FROM organization_members m WHERE m.organization_id=r.organization_id AND m.user_id=r.created_by AND m.active LIMIT 1)),'scope',CASE WHEN private.shared_test_record_visible(r.id) THEN r.fields->>'scope' ELSE r.fields->>'coordinationSummary' END,
 'stageHistory',CASE WHEN private.shared_test_record_visible(r.id) THEN r.fields->>'stageHistory' ELSE NULL END,'stageRemark',CASE WHEN private.shared_test_record_visible(r.id) THEN r.fields->>'stageRemark' ELSE NULL END,'nextAction',CASE WHEN private.shared_test_record_visible(r.id) THEN r.fields->>'nextAction' ELSE NULL END,'fixtureRunId',CASE WHEN private.shared_test_record_visible(r.id) THEN r.fields->>'fixtureRunId' ELSE NULL END,
 'customer',CASE WHEN private.shared_test_record_visible(r.id) THEN r.fields->>'customer' ELSE NULL END))
 )) FROM operational_records r LEFT JOIN departments d ON d.id=r.department_id WHERE r.organization_id=a.organization_id AND r.archived_at IS NULL),'[]') ||
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'reference','TASK-'||left(t.id::text,8),'title',t.title,'type','Task','status',t.status,'area',lower(d.code),'priority',t.priority,
 'fields',jsonb_strip_nulls(jsonb_build_object('projectId',t.record_id,'department',d.code,'dueDate',to_char(t.due_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD'),'assignee',m.display_name))))
 FROM tasks t LEFT JOIN departments d ON d.id=t.department_id LEFT JOIN organization_members m ON m.id=t.assignee_id
 WHERE t.organization_id=a.organization_id AND (private.shared_test_scope(t.organization_id,t.department_id) OR t.assignee_id=a.membership_id)),'[]'),
 'documents',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'type',d.document_type,'linkedRecordRefs',jsonb_build_array(d.record_id::text)))
 FROM documents d WHERE d.organization_id=a.organization_id AND private.shared_test_scope(d.organization_id,d.department_id)),'[]'));

END $$;
REVOKE ALL ON FUNCTION public.get_project_coordination() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_project_coordination() TO authenticated;

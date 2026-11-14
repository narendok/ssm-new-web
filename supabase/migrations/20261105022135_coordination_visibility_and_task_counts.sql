CREATE OR REPLACE FUNCTION public.get_project_coordination()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET "TimeZone" TO 'Asia/Kolkata'
AS $function$
DECLARE a record; visible_records uuid[];
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.role='viewer' OR a.is_client THEN RAISE EXCEPTION 'COORDINATION_ACCESS_DENIED'; END IF;
 SELECT coalesce(array_agg(r.id),'{}'::uuid[]) INTO visible_records FROM public.operational_records r WHERE r.organization_id=a.organization_id AND r.archived_at IS NULL AND private.shared_test_record_visible(r.id);
 RETURN jsonb_build_object('records',COALESCE((SELECT jsonb_agg(jsonb_build_object(
 'id',r.id,'reference',r.reference,'title',CASE WHEN r.id=ANY(visible_records) THEN r.title ELSE r.record_type||' · '||COALESCE(d.code,'department') END,
 'type',r.record_type,'status',r.status,'area',lower(COALESCE(d.code,r.area)),
 'fields',jsonb_strip_nulls(jsonb_build_object(
 'projectId',COALESCE(r.fields->>'projectId',r.fields->>'project_id',(SELECT l.source_record_id::text FROM record_links l JOIN operational_records parent ON parent.id=l.source_record_id WHERE l.organization_id=r.organization_id AND l.target_record_id=r.id AND parent.record_type='Project' AND parent.archived_at IS NULL ORDER BY l.id LIMIT 1)),'projectCode',r.fields->>'projectCode','stage',r.stage,
 'lifecycleStage',coalesce(r.fields->>'currentStage',r.fields->>'recordStage',r.fields->>'hwStage',r.fields->>'lifecycleStage',r.stage),
 'currentStage',CASE WHEN r.id=ANY(visible_records) THEN coalesce(r.fields->>'currentStage',r.stage) END,
 'legacyStage',r.stage,
 'projectTaskCount',CASE WHEN r.record_type='Project' AND r.id=ANY(visible_records) THEN (SELECT count(*)::text FROM public.tasks t WHERE t.record_id=r.id AND t.organization_id=a.organization_id) END,
 'projectCompletedTaskCount',CASE WHEN r.record_type='Project' AND r.id=ANY(visible_records) THEN (SELECT count(*)::text FROM public.tasks t WHERE t.record_id=r.id AND t.organization_id=a.organization_id AND lower(t.status) IN ('complete','completed','done')) END,
 'companyPhase',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'companyPhase' END,
 'portfolioStatus',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'portfolioStatus' END,
 'track',CASE WHEN r.id=ANY(visible_records) THEN coalesce(r.fields->>'track',r.fields->>'projectTrack') END,
 'lifecycleBaseline',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'lifecycleBaseline' END,
 'completedStages',CASE WHEN r.id=ANY(visible_records) THEN (r.fields->'completedStages')::text END,
 'omittedStages',CASE WHEN r.id=ANY(visible_records) THEN (r.fields->'omittedStages')::text END,
 'certificationRequired',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'certificationRequired' END,'targetDate',r.fields->>'targetDate','dependsOn',r.fields->>'dependsOn','requiredInputs',r.fields->>'requiredInputs',
 'enquiryId',r.fields->>'enquiryId','owner',COALESCE(r.fields->>'owner',(SELECT m.display_name FROM organization_members m WHERE m.organization_id=r.organization_id AND m.user_id=r.created_by AND m.active LIMIT 1)),'scope',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'scope' ELSE r.fields->>'coordinationSummary' END,
 'stageHistory',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'stageHistory' ELSE NULL END,'stageRemark',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'stageRemark' ELSE NULL END,'nextAction',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'nextAction' ELSE NULL END,'fixtureRunId',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'fixtureRunId' ELSE NULL END,
 'outcome',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'outcome' ELSE NULL END,'terminalReason',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'terminalReason' ELSE NULL END,'totalPlannedUnits',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'totalPlannedUnits' ELSE NULL END,'lotQuantity',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'lotQuantity' ELSE NULL END,'acceptedUnits',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'acceptedUnits' ELSE NULL END,'heldUnits',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'heldUnits' ELSE NULL END,'pendingInspectionUnits',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'pendingInspectionUnits' ELSE NULL END,'remainingPlannedUnits',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'remainingPlannedUnits' ELSE NULL END,
 'customer',CASE WHEN r.id=ANY(visible_records) THEN r.fields->>'customer' ELSE NULL END))
 )) FROM operational_records r LEFT JOIN departments d ON d.id=r.department_id WHERE r.organization_id=a.organization_id AND r.archived_at IS NULL),'[]') ||
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'reference','TASK-'||left(t.id::text,8),'title',t.title,'type','Task','status',t.status,'area',lower(d.code),'priority',t.priority,
 'fields',jsonb_strip_nulls(jsonb_build_object('projectId',t.record_id,'department',d.code,'dueDate',to_char(t.due_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD'),'assignee',m.display_name))))
 FROM tasks t LEFT JOIN departments d ON d.id=t.department_id LEFT JOIN organization_members m ON m.id=t.assignee_id
 WHERE t.organization_id=a.organization_id AND (private.shared_test_scope(t.organization_id,t.department_id) OR t.assignee_id=a.membership_id)),'[]'),
 'documents',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'type',d.document_type,'linkedRecordRefs',CASE WHEN d.record_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(d.record_id::text) END))
 FROM documents d WHERE d.organization_id=a.organization_id AND private.shared_test_scope(d.organization_id,d.department_id)),'[]'));

END $function$;

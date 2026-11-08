-- Synthetic internal workflow demonstration only. No release, stock posting or customer acceptance.
-- Complete the fictional feasibility intake through the same guarded business RPCs.
DO $scenario$
DECLARE admin_user uuid; actor uuid; source public.operational_records%ROWTYPE; project public.operational_records%ROWTYPE;
 task public.tasks%ROWTYPE; approval public.approvals%ROWTYPE; result jsonb; review_id uuid;
BEGIN
 IF (SELECT count(*) FROM public.organizations)<>1 OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE name='TEST ONLY · SSM-new1 synthetic workspace') THEN RAISE EXCEPTION 'ISOLATED_TEST_ORG_REQUIRED'; END IF;
 SELECT user_id INTO admin_user FROM public.organization_members WHERE role='admin' AND active AND display_name='TEST Executive Admin';
 IF admin_user IS NULL THEN RAISE EXCEPTION 'SYNTHETIC_TEST_ADMIN_REQUIRED'; END IF;
 SELECT * INTO source FROM public.operational_records WHERE title='TEST · Orion Controls modular bench sensor pilot' AND record_type='Opportunity' AND archived_at IS NULL ORDER BY created_at DESC LIMIT 1;
 IF source.id IS NULL THEN RAISE EXCEPTION 'RUN_TEST_DISPATCH_FIRST'; END IF;
 FOR task IN SELECT * FROM public.tasks WHERE record_id=source.id AND status<>'Complete' LOOP
  SELECT member.user_id INTO actor FROM public.departments department JOIN public.organization_members member ON member.id=department.lead_member_id AND member.active AND member.role='department_lead' WHERE department.id=task.department_id AND department.organization_id=source.organization_id;
  IF actor IS NULL THEN RAISE EXCEPTION 'ACTIVE_TEST_DEPARTMENT_LEAD_REQUIRED'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM public.mutate_shared_test_workspace('update_task',jsonb_build_object('id',task.id,'expected_updated_at',task.updated_at,'status','Complete'),gen_random_uuid());
 END LOOP;
 FOR approval IN SELECT * FROM public.approvals WHERE record_id=source.id AND outcome='pending' LOOP
  SELECT member.user_id INTO actor FROM public.departments department JOIN public.organization_members member ON member.id=department.lead_member_id AND member.active AND member.role='department_lead' WHERE department.id=approval.reviewer_department_id AND department.organization_id=source.organization_id;
  IF actor IS NULL THEN RAISE EXCEPTION 'ACTIVE_TEST_REVIEWER_REQUIRED'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM public.mutate_shared_test_workspace('decide_approval',jsonb_build_object('id',approval.id,'expected_updated_at',approval.updated_at,'outcome','approved','notes','Synthetic TEST feasibility simulation only: reviewed fictional intake assumptions. No real customer acceptance, certification or product release.'),gen_random_uuid());
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub',admin_user::text,true);
 SELECT * INTO source FROM public.operational_records WHERE id=source.id;
 IF nullif(source.fields->>'trackDecisionAt','') IS NULL THEN
  PERFORM public.decide_shared_test_track_after_feasibility(jsonb_build_object('opportunityId',source.id,'expectedUpdatedAt',source.updated_at,'track','hardware_firmware'),gen_random_uuid());
 END IF;
 SELECT * INTO project FROM public.operational_records WHERE reference='HLPL-TEST-ORION-PHASES-20261107' AND record_type='Project';
 IF project.id IS NULL THEN
  SELECT * INTO source FROM public.operational_records WHERE id=source.id;
  result:=public.start_project_from_feasibility(jsonb_build_object('opportunityId',source.id,'expectedUpdatedAt',source.updated_at,'reference','HLPL-TEST-ORION-PHASES-20261107','title','TEST · Orion modular bench sensor pilot'),gen_random_uuid());
  SELECT * INTO project FROM public.operational_records WHERE id=(result->>'id')::uuid;
 END IF;
 IF project.fields->>'currentStage'='CM_01' THEN
  FOR task IN SELECT * FROM public.tasks WHERE record_id=project.id AND stage_code='CM_01' AND status<>'Complete' LOOP
   SELECT member.user_id INTO actor FROM public.departments department JOIN public.organization_members member ON member.id=department.lead_member_id AND member.active WHERE department.id=task.department_id;
   PERFORM set_config('request.jwt.claim.sub',actor::text,true);
   PERFORM public.mutate_shared_test_workspace('update_task',jsonb_build_object('id',task.id,'expected_updated_at',task.updated_at,'status','Complete'),gen_random_uuid());
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub',admin_user::text,true);
  SELECT * INTO project FROM public.operational_records WHERE id=project.id;
  IF NOT coalesce(project.fields->'completedStages','[]'::jsonb) ? 'CM_01' THEN
   result:=public.mutate_shared_test_workspace('request_stage_completion',jsonb_build_object('project_id',project.id,'stage_code','CM_01','expected_updated_at',project.updated_at,'notes','Synthetic TEST intake captured from the reviewed fictional opportunity; not a product approval.'),gen_random_uuid());
   review_id:=(result->>'id')::uuid;
   SELECT * INTO approval FROM public.approvals WHERE record_id=review_id AND outcome='pending';
   SELECT member.user_id INTO actor FROM public.departments department JOIN public.organization_members member ON member.id=department.lead_member_id AND member.active WHERE department.id=approval.reviewer_department_id;
   PERFORM set_config('request.jwt.claim.sub',actor::text,true);
   PERFORM public.mutate_shared_test_workspace('decide_approval',jsonb_build_object('id',approval.id,'expected_updated_at',approval.updated_at,'outcome','approved','notes','Synthetic TEST intake-only decision; no product release or customer acceptance.'),gen_random_uuid());
  END IF;
  PERFORM set_config('request.jwt.claim.sub',admin_user::text,true);
  SELECT * INTO project FROM public.operational_records WHERE id=project.id;
  PERFORM public.mutate_shared_test_workspace('advance_stage',jsonb_build_object('project_id',project.id,'target_stage','G0_01','expected_updated_at',project.updated_at),gen_random_uuid());
 END IF;
END $scenario$;
SELECT r.id,r.reference,r.fields->>'currentStage' current_stage,r.fields->>'companyPhase' phase,(r.fields->>'lifecycleBaseline')::jsonb->>'id' revision,
 (SELECT jsonb_agg(jsonb_build_object('title',t.title,'department',d.code,'assignee',m.display_name,'status',t.status) ORDER BY t.order_index) FROM public.tasks t JOIN public.departments d ON d.id=t.department_id LEFT JOIN public.organization_members m ON m.id=t.assignee_id WHERE t.record_id=r.id AND t.stage_code='G0_01') generated_tasks
FROM public.operational_records r WHERE r.reference='HLPL-TEST-ORION-PHASES-20261107';

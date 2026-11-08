-- All permitted web/mobile coordination reads must use the pinned current stage;
-- retain the legacy stage as history rather than replacing canonical data with it.
DO $patch$
DECLARE d text; marker text; replacement text;
BEGIN
 d:=pg_get_functiondef('public.get_project_coordination()'::regprocedure);
 marker:='''lifecycleStage'',r.stage';
 IF strpos(d,marker)=0 THEN RAISE EXCEPTION 'COORDINATION_STAGE_PATCH_PRECONDITION'; END IF;
 replacement:=$fields$'lifecycleStage',coalesce(r.fields->>'currentStage',r.fields->>'recordStage',r.fields->>'hwStage',r.fields->>'lifecycleStage',r.stage),
 'currentStage',CASE WHEN private.shared_test_record_visible(r.id) THEN coalesce(r.fields->>'currentStage',r.stage) END,
 'legacyStage',r.stage,
 'companyPhase',CASE WHEN private.shared_test_record_visible(r.id) THEN r.fields->>'companyPhase' END,
 'portfolioStatus',CASE WHEN private.shared_test_record_visible(r.id) THEN r.fields->>'portfolioStatus' END,
 'track',CASE WHEN private.shared_test_record_visible(r.id) THEN coalesce(r.fields->>'track',r.fields->>'projectTrack') END,
 'lifecycleBaseline',CASE WHEN private.shared_test_record_visible(r.id) THEN r.fields->>'lifecycleBaseline' END,
 'completedStages',CASE WHEN private.shared_test_record_visible(r.id) THEN (r.fields->'completedStages')::text END,
 'omittedStages',CASE WHEN private.shared_test_record_visible(r.id) THEN (r.fields->'omittedStages')::text END,
 'certificationRequired',CASE WHEN private.shared_test_record_visible(r.id) THEN r.fields->>'certificationRequired' END$fields$;
 d:=replace(d,marker,replacement);
 d:=replace(d,'a.role=''viewer'' THEN','a.role=''viewer'' OR a.is_client THEN');
 EXECUTE d;
END $patch$;

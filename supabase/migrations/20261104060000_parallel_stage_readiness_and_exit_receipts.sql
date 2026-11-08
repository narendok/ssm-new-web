-- Parallel department stages can activate when their own prerequisites are reviewed.
-- Evidence belongs to the stage being completed, not whichever parallel stage was last opened.
CREATE FUNCTION private.assert_project_stage_evidence(p_project uuid,p_stage text,p_definition jsonb DEFAULT NULL) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.operational_records%ROWTYPE; stage jsonb; kind text;
BEGIN
 SELECT * INTO r FROM public.operational_records WHERE id=p_project;
 IF nullif(r.fields->>'lifecycleBaseline','') IS NULL THEN RETURN; END IF;
 stage:=p_definition;
 IF stage IS NULL THEN SELECT value INTO stage FROM jsonb_array_elements((r.fields->>'lifecycleBaseline')::jsonb->'stages') WHERE value->>'code'=p_stage; END IF;
 FOR kind IN SELECT jsonb_array_elements_text(coalesce(stage->'exitTypes','[]'::jsonb)) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.operational_records evidence WHERE evidence.organization_id=r.organization_id AND evidence.record_type=kind AND lower(evidence.status::text) IN ('approved','released') AND evidence.archived_at IS NULL
   AND (evidence.fields->>'projectId' IN (r.id::text,r.reference) OR EXISTS(SELECT 1 FROM public.record_links WHERE source_record_id=r.id AND target_record_id=evidence.id AND organization_id=r.organization_id))
   AND coalesce(evidence.fields->>'recordStage',evidence.fields->>'hwStage',evidence.fields->>'lifecycleStage',evidence.stage)=p_stage
   AND (kind !~* '(schematic|gerber|step|cad|firmware (binary|release)|production binary|hex|pcb layout|3d model)' OR private.has_record_original_object(evidence.id))) THEN RAISE EXCEPTION 'REQUIRED_STAGE_EXIT_EVIDENCE_MISSING: %',kind; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.assert_project_stage_evidence(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;

DO $patch$
DECLARE d text; before_text text; after_text text;
BEGIN
 d:=pg_get_functiondef('private.sync_pinned_lifecycle_work()'::regprocedure);
 before_text:='  IF EXISTS(SELECT 1 FROM public.tasks WHERE record_id=NEW.id AND stage_code=previous AND lower(status) NOT IN (''complete'',''completed'',''done'',''approved'',''cancelled'')) THEN RAISE EXCEPTION ''CURRENT_STAGE_WORK_INCOMPLETE''; END IF;';
 IF strpos(d,before_text)=0 THEN RAISE EXCEPTION 'PARALLEL_ENGINE_PATCH_PRECONDITION'; END IF;
 d:=replace(d,before_text,'');
 d:=regexp_replace(d,'  FOR required_type IN SELECT jsonb_array_elements_text\(s->''exitTypes''\)[\s\S]*?  END LOOP;','','');
 EXECUTE d;
 d:=pg_get_functiondef('private.canonical_stage_work_snapshot(uuid,text)'::regprocedure);
 before_text:=' IF stage IS NULL THEN RAISE EXCEPTION ''PINNED_STAGE_MISSING''; END IF;';
 IF strpos(d,before_text)=0 THEN RAISE EXCEPTION 'EVIDENCE_SNAPSHOT_PATCH_PRECONDITION'; END IF;
 d:=replace(d,before_text,before_text||chr(10)||' PERFORM private.assert_project_stage_evidence(p_project,p_stage,stage);');
 EXECUTE d;
 d:=pg_get_functiondef('private.activate_canonical_stage(jsonb)'::regprocedure);
 before_text:=' -- Recheck approval snapshots for prerequisites completed under this contract.';
 IF strpos(d,before_text)=0 THEN RAISE EXCEPTION 'EVIDENCE_ACTIVATION_PATCH_PRECONDITION'; END IF;
 after_text:=' IF nullif(r.fields->>''lifecycleBaseline'','''') IS NOT NULL THEN FOREACH requested_stage IN ARRAY req LOOP PERFORM private.assert_project_stage_evidence(r.id,requested_stage); END LOOP; requested_stage:=trim(p_payload->>''target_stage''); END IF;';
 d:=replace(d,before_text,after_text||chr(10)||before_text);
 EXECUTE d;
END $patch$;

-- Retain the existing BEFORE UPDATE evidence trigger. Enforce every newly completed stage
-- and every prerequisite of an activation, including prerequisites from parallel departments.
CREATE OR REPLACE FUNCTION private.require_binary_stage_exit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE code text; target text; track text;
BEGIN
 IF NEW.record_type<>'Project' OR NOT private.is_shared_test_org(NEW.organization_id) OR nullif(OLD.fields->>'lifecycleBaseline','') IS NULL THEN RETURN NEW; END IF;
 FOR code IN SELECT jsonb_array_elements_text(coalesce(NEW.fields->'completedStages','[]'::jsonb)) LOOP
  IF NOT coalesce(OLD.fields->'completedStages','[]'::jsonb) ? code THEN PERFORM private.assert_project_stage_evidence(OLD.id,code); END IF;
 END LOOP;
 target:=coalesce(NEW.fields->>'currentStage',NEW.stage,'CM_01');track:=coalesce(NEW.fields->>'track',NEW.fields->>'projectTrack');
 IF target IS DISTINCT FROM coalesce(OLD.fields->>'currentStage',OLD.stage,'CM_01') THEN
  FOREACH code IN ARRAY private.project_stage_prerequisites(OLD.id,target,track) LOOP PERFORM private.assert_project_stage_evidence(OLD.id,code); END LOOP;
 END IF;
 RETURN NEW;
END $$;

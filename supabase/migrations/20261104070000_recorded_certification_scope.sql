-- Scope is a recorded QA/Admin decision, not an implicit certificate or automatic approval.
ALTER FUNCTION private.ensure_canonical_stage_tasks(uuid,text) RENAME TO ensure_canonical_stage_tasks_before_pinned;
CREATE FUNCTION private.ensure_canonical_stage_tasks(p_project uuid,p_stage text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.operational_records WHERE id=p_project AND nullif(fields->>'lifecycleBaseline','') IS NOT NULL) THEN RETURN; END IF;
 PERFORM private.ensure_canonical_stage_tasks_before_pinned(p_project,p_stage);
END $$;
REVOKE ALL ON FUNCTION private.ensure_canonical_stage_tasks(uuid,text),private.ensure_canonical_stage_tasks_before_pinned(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.set_project_certification_scope(p_payload jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; r public.operational_records%ROWTYPE; replay record; digest text; result jsonb; required boolean; reason text; decision uuid; omissions jsonb; baseline jsonb;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.is_client OR NOT private.is_shared_test_org(a.organization_id) OR (a.role<>'admin' AND (a.role<>'department_lead' OR a.department_code<>'QA')) THEN RAISE EXCEPTION 'CERTIFICATION_SCOPE_AUTHORITY_REQUIRED'; END IF;
 IF p_request_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload->'required') IS DISTINCT FROM 'boolean' OR octet_length(p_payload::text)>8192 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.organization_id::text,410));
 digest:=encode(sha256(convert_to('certification_scope'||p_payload::text,'UTF8')),'hex');
 SELECT * INTO replay FROM private.shared_test_requests WHERE organization_id=a.organization_id AND actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN IF replay.request_hash<>digest THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF; RETURN replay.response; END IF;
 SELECT * INTO r FROM public.operational_records WHERE id=(p_payload->>'projectId')::uuid AND organization_id=a.organization_id AND record_type='Project' AND archived_at IS NULL AND private.shared_test_record_visible(id) FOR UPDATE;
 IF NOT FOUND OR nullif(r.fields->>'lifecycleBaseline','') IS NULL THEN RAISE EXCEPTION 'PINNED_PROJECT_REQUIRED'; END IF;
 IF nullif(p_payload->>'expectedUpdatedAt','') IS NULL OR r.updated_at IS DISTINCT FROM (p_payload->>'expectedUpdatedAt')::timestamptz THEN RAISE EXCEPTION 'STALE_PROJECT'; END IF;
 required:=(p_payload->>'required')::boolean;reason:=trim(p_payload->>'reason');
 IF reason IS NULL OR length(reason)<10 THEN RAISE EXCEPTION 'DECISION_REASON_REQUIRED'; END IF;
 IF r.fields ? 'certificationRequired' AND (r.fields->>'certificationRequired')::boolean=required THEN RAISE EXCEPTION 'CERTIFICATION_SCOPE_ALREADY_RECORDED'; END IF;
 IF coalesce(r.fields->'completedStages','[]'::jsonb) ? 'CL_01' OR EXISTS(SELECT 1 FROM public.tasks WHERE record_id=r.id AND (stage_code ~ '^C[0-9]' OR stage_code='HW_37'))
  OR (r.fields ? 'certificationRequired' AND coalesce(r.fields->'completedStages','[]'::jsonb) ? 'CM_03') THEN RAISE EXCEPTION 'USE_REQUIREMENTS_AMENDMENT_FOR_STARTED_CERTIFICATION_SCOPE'; END IF;
 baseline:=(r.fields->>'lifecycleBaseline')::jsonb;
 IF required AND EXISTS(SELECT 1 FROM generate_series(1,15) n WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(baseline->'stages') s WHERE s->>'code'='C'||lpad(n::text,2,'0'))) THEN RAISE EXCEPTION 'CERTIFICATION_STAGES_REQUIRED_IN_BASELINE'; END IF;
 omissions:=coalesce(r.fields->'omittedStages','{}'::jsonb);
 IF required AND omissions ? 'HW_37' AND omissions->'HW_37'->>'source' IS DISTINCT FROM 'certification_scope' THEN RAISE EXCEPTION 'CONFLICTING_HOMOLOGATION_OMISSION_REQUIRES_REVIEW'; END IF;
 INSERT INTO private.project_lifecycle_decisions(organization_id,project_id,action,previous_baseline,stage_code,reason,created_by)
 VALUES(a.organization_id,r.id,'set_certification',r.fields->>'lifecycleBaseline',CASE WHEN required THEN 'CERT_REQUIRED' ELSE 'CERT_NOT_REQUIRED' END,reason,auth.uid()) RETURNING id INTO decision;
 IF required THEN omissions:=omissions-'HW_37';
 ELSIF public.is_stage_applicable_to_track('HW_37',coalesce(r.fields->>'track',r.fields->>'projectTrack')) THEN
  omissions:=omissions||jsonb_build_object('HW_37',jsonb_build_object('reason',reason,'source','certification_scope','decisionId',decision,'decidedBy',a.membership_id,'decidedAt',now()));
 END IF;
 UPDATE public.operational_records SET fields=fields||jsonb_build_object('certificationRequired',required,'certificationScopeDecision',decision,'omittedStages',omissions),updated_at=now(),updated_by=auth.uid() WHERE id=r.id;
 INSERT INTO public.audit_events(organization_id,actor_id,entity_type,entity_id,action,detail) VALUES(a.organization_id,auth.uid(),'project',r.id,'certification_scope_decided',jsonb_build_object('required',required,'reason',reason,'decisionId',decision));
 result:=jsonb_build_object('id',decision,'projectId',r.id,'required',required);
 INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response) VALUES(a.organization_id,auth.uid(),p_request_id,digest,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.set_project_certification_scope(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_project_certification_scope(jsonb,uuid) TO authenticated;

DO $patch$
DECLARE d text;
BEGIN
 d:=pg_get_functiondef('private.project_stage_prerequisites(uuid,text,text)'::regprocedure);
 d:=replace(d,' required:=ARRAY(', ' IF p_stage=''CL_01'' AND nullif(r.fields->>''lifecycleBaseline'','''') IS NOT NULL THEN IF NOT r.fields ? ''certificationRequired'' THEN RAISE EXCEPTION ''CERTIFICATION_SCOPE_DECISION_REQUIRED''; END IF; IF r.fields->>''certificationRequired''=''true'' AND NOT ''C15''=ANY(canonical) THEN canonical:=array_append(canonical,''C15''); END IF; END IF;'||chr(10)||' required:=ARRAY(');
 d:=replace(d,'WHERE public.is_stage_applicable_to_track(code,p_track) AND NOT','WHERE public.is_stage_applicable_to_track(code,p_track) AND (code !~ ''^C[0-9]'' OR r.fields->>''certificationRequired''=''true'') AND NOT');
 EXECUTE d;
 d:=pg_get_functiondef('private.guard_direct_project_lifecycle_changes()'::regprocedure);
 d:=replace(d,'OR NEW.fields->''omittedStages'' IS DISTINCT FROM OLD.fields->''omittedStages''','OR NEW.fields->''omittedStages'' IS DISTINCT FROM OLD.fields->''omittedStages'' OR NEW.fields->''certificationRequired'' IS DISTINCT FROM OLD.fields->''certificationRequired''');
 EXECUTE d;
 d:=pg_get_functiondef('private.activate_canonical_stage(jsonb)'::regprocedure);
 d:=replace(d,' owner_id:=private.canonical_stage_department', ' IF nullif(r.fields->>''lifecycleBaseline'','''') IS NOT NULL AND requested_stage ~ ''^C[0-9]'' AND r.fields->>''certificationRequired'' IS DISTINCT FROM ''true'' THEN RAISE EXCEPTION ''CERTIFICATION_SCOPE_NOT_APPLICABLE''; END IF;'||chr(10)||' owner_id:=private.canonical_stage_department');
 EXECUTE d;
 d:=pg_get_functiondef('private.assert_project_stage_evidence(uuid,text,jsonb)'::regprocedure);
 d:=replace(d,'schematic|gerber|step|cad|firmware','certificate|schematic|gerber|step|cad|firmware');
 EXECUTE d;
 d:=pg_get_functiondef('private.infer_deliverable_record_stage()'::regprocedure);
 d:=replace(d,'WHEN ''Firmware release'' THEN ''FW_12'' END','WHEN ''Firmware release'' THEN ''FW_12'' WHEN ''Certificate'' THEN ''C14'' END');
 EXECUTE d;
END $patch$;

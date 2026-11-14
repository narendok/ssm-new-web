-- Stage RACI is part of the immutable lifecycle definition pinned by projects.
-- Historical definitions without RACI retain their original execution contract.
ALTER FUNCTION private.validate_lifecycle_definition(jsonb) RENAME TO validate_lifecycle_definition_before_raci;
CREATE FUNCTION private.validate_lifecycle_definition(d jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s jsonb; role text; values_json jsonb;
BEGIN
 PERFORM private.validate_lifecycle_definition_before_raci(d);
 FOR s IN SELECT value FROM jsonb_array_elements(d->'stages') LOOP
  IF NOT s ? 'raci' THEN CONTINUE; END IF;
  IF jsonb_typeof(s->'raci') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_STAGE_RACI'; END IF;
  FOREACH role IN ARRAY ARRAY['R','A','C','I'] LOOP
   values_json:=s->'raci'->role;
   IF jsonb_typeof(values_json) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_STAGE_RACI'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(values_json) v WHERE jsonb_typeof(v)<>'string' OR v#>>'{}' !~ '^[A-Z][A-Z0-9]*$')
     OR (SELECT count(*) FROM jsonb_array_elements(values_json))<>(SELECT count(DISTINCT v) FROM jsonb_array_elements(values_json) v) THEN RAISE EXCEPTION 'INVALID_STAGE_RACI'; END IF;
  END LOOP;
  IF jsonb_array_length(s->'raci'->'R')=0 OR jsonb_array_length(s->'raci'->'A')<>1
   OR NOT (s->'raci'->'R') ? (s->>'department') THEN RAISE EXCEPTION 'RACI_RESPONSIBLE_AND_ACCOUNTABLE_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(s->'tasks') t WHERE NOT (s->'raci'->'R') ? (t->>'department')) THEN RAISE EXCEPTION 'TASK_OWNER_NOT_RACI_RESPONSIBLE'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.validate_lifecycle_definition(jsonb),private.validate_lifecycle_definition_before_raci(jsonb) FROM PUBLIC,anon,authenticated;

-- Resolve the revision that generated work, preserving routing after a reviewed migration.
CREATE FUNCTION private.project_stage_responsibility(p_project uuid,p_stage text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.operational_records%ROWTYPE; definition jsonb; original jsonb; stage jsonb;
BEGIN
 SELECT * INTO r FROM public.operational_records WHERE id=p_project;
 IF nullif(r.fields->>'lifecycleBaseline','') IS NULL THEN RETURN NULL; END IF;
 definition:=(r.fields->>'lifecycleBaseline')::jsonb;
 SELECT l.definition INTO original FROM private.lifecycle_revisions l WHERE l.organization_id=r.organization_id AND EXISTS(
  SELECT 1 FROM public.tasks t WHERE t.record_id=r.id AND t.stage_code=p_stage AND t.template_task_key LIKE 'LC-TG:'||(l.definition->>'id')||':'||p_stage||':%') ORDER BY l.version LIMIT 1;
 IF original IS NOT NULL THEN definition:=original; END IF;
 SELECT value INTO stage FROM jsonb_array_elements(definition->'stages') WHERE value->>'code'=p_stage;
 RETURN stage->'raci';
END $$;
REVOKE ALL ON FUNCTION private.project_stage_responsibility(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.project_stage_accountable_department(p_project uuid,p_stage text,p_fallback uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE raci jsonb; result uuid; org uuid;
BEGIN
 raci:=private.project_stage_responsibility(p_project,p_stage);
 IF raci IS NULL THEN RETURN p_fallback; END IF;
 SELECT organization_id INTO org FROM public.operational_records WHERE id=p_project;
 SELECT id INTO result FROM public.departments WHERE organization_id=org AND active AND code=raci->'A'->>0 AND code<>'CLIENT';
 IF result IS NULL THEN RAISE EXCEPTION 'ACCOUNTABLE_DEPARTMENT_UNAVAILABLE'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.project_stage_accountable_department(uuid,text,uuid) FROM PUBLIC,anon,authenticated;

-- Reuse existing independent approvals, evidence snapshots, concurrency and signer checks.
DO $patch$
DECLARE d text; needle text;
BEGIN
 d:=pg_get_functiondef('private.request_canonical_stage_review(jsonb)'::regprocedure);
 needle:='IF a.role<>''admin'' AND private.shared_test_member_department(a.membership_id) IS DISTINCT FROM owner_id THEN RAISE EXCEPTION ''STAGE_REVIEW_DENIED''; END IF;';
 IF strpos(d,needle)=0 THEN RAISE EXCEPTION 'RACI_REVIEW_PATCH_PRECONDITION'; END IF;
 d:=replace(d,needle,'IF a.role<>''admin'' AND ((private.project_stage_responsibility(r.id,stage) IS NULL AND private.shared_test_member_department(a.membership_id) IS DISTINCT FROM owner_id) OR (private.project_stage_responsibility(r.id,stage) IS NOT NULL AND NOT ((private.project_stage_responsibility(r.id,stage)->''R'') ? a.department_code))) THEN RAISE EXCEPTION ''STAGE_REVIEW_DENIED''; END IF;');
 needle:='VALUES(a.organization_id,owner_id,review_id,owner_id,';
 IF strpos(d,needle)=0 THEN RAISE EXCEPTION 'RACI_REVIEWER_PATCH_PRECONDITION'; END IF;
 d:=replace(d,needle,'VALUES(a.organization_id,owner_id,review_id,private.project_stage_accountable_department(r.id,stage,owner_id),');
 EXECUTE d;
END $patch$;

-- Reject unavailable departments when publishing new defaults, before any project is created.
DO $patch$
DECLARE d text; needle text;
BEGIN
 d:=pg_get_functiondef('public.mutate_lifecycle_workspace(text,jsonb,uuid)'::regprocedure);
 needle:='definition:=p_payload->''definition''; PERFORM private.validate_lifecycle_definition(definition);';
 IF strpos(d,needle)=0 THEN RAISE EXCEPTION 'RACI_SETTINGS_PATCH_PRECONDITION'; END IF;
 d:=replace(d,needle,needle||' IF EXISTS(SELECT 1 FROM jsonb_array_elements(definition->''stages'') s CROSS JOIN LATERAL jsonb_each(coalesce(s->''raci'',''{}''::jsonb)) role CROSS JOIN LATERAL jsonb_array_elements_text(role.value) department(code) WHERE role.key IN (''R'',''A'',''C'',''I'') AND NOT EXISTS(SELECT 1 FROM public.departments dep WHERE dep.organization_id=a.organization_id AND dep.active AND dep.code=department.code AND dep.code<>''CLIENT'')) THEN RAISE EXCEPTION ''RACI_DEPARTMENT_UNAVAILABLE''; END IF;');
 EXECUTE d;
END $patch$;

CREATE FUNCTION private.guard_stage_raci_task_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE raci jsonb; department_code text;
BEGIN
 IF NEW.stage_code IS NULL OR NEW.record_id IS NULL THEN RETURN NEW; END IF;
 raci:=private.project_stage_responsibility(NEW.record_id,NEW.stage_code);
 IF raci IS NULL THEN RETURN NEW; END IF;
 SELECT code INTO department_code FROM public.departments WHERE id=NEW.department_id AND organization_id=NEW.organization_id AND active;
 IF department_code IS NULL OR NOT (raci->'R') ? department_code THEN RAISE EXCEPTION 'TASK_OWNER_NOT_RACI_RESPONSIBLE'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_stage_raci_task_owner() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tasks_guard_stage_raci_owner BEFORE INSERT OR UPDATE OF department_id,record_id,stage_code ON public.tasks
FOR EACH ROW EXECUTE FUNCTION private.guard_stage_raci_task_owner();


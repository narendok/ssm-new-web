-- Feasibility precedes project creation, so pin the settings used by its dispatch separately.
-- The existing request hash is computed before settings resolution, preserving retry identity.
DO $patch$
DECLARE d text; needle text;
BEGIN
 d:=pg_get_functiondef('public.mutate_sales_intake(jsonb,uuid)'::regprocedure);
 needle:='review_count integer:=0; requested boolean; due timestamptz;';
 IF strpos(d,needle)=0 THEN RAISE EXCEPTION 'FEASIBILITY_RACI_DECLARATION_PRECONDITION'; END IF;
 d:=replace(d,needle,'raci_definition jsonb; raci_stage jsonb; raci_task jsonb; raci_order integer:=0; '||needle);
 needle:='selected:=p_payload->''feasibilityDepts'';';
 IF strpos(d,needle)=0 THEN RAISE EXCEPTION 'FEASIBILITY_RACI_DISPATCH_PRECONDITION'; END IF;
 d:=replace(d,needle,$code$
  SELECT definition INTO raci_definition FROM private.lifecycle_revisions WHERE organization_id=a.organization_id ORDER BY version DESC LIMIT 1;
  SELECT stage_row.value INTO raci_stage FROM jsonb_array_elements(coalesce(raci_definition->'stages','[]'::jsonb)) stage_row WHERE stage_row.value->>'code'='CM_02';
  IF p_payload ? 'feasibilityRaciRevision' AND p_payload->>'feasibilityRaciRevision' IS DISTINCT FROM raci_definition->>'id' THEN RAISE EXCEPTION 'FEASIBILITY_SETTINGS_CHANGED: Reload the dispatch preview'; END IF;
  selected:=coalesce(raci_stage->'raci'->'R',p_payload->'feasibilityDepts');
 $code$);
 needle:='''feasibilityDispatchedAt'',now());';
 IF strpos(d,needle)=0 THEN RAISE EXCEPTION 'FEASIBILITY_RACI_PIN_PRECONDITION'; END IF;
 d:=replace(d,needle,needle||$code$
  IF raci_stage ? 'raci' THEN fields:=fields||jsonb_build_object('feasibilityRaci',raci_stage->'raci','feasibilityRaciRevision',raci_definition->>'id','feasibilityLifecycleBaseline',raci_definition::text); END IF;
 $code$);
 needle:='INSERT INTO public.tasks(organization_id,department_id,record_id,title,priority,assignee_id,due_at,created_by)';
 IF strpos(d,needle)=0 THEN RAISE EXCEPTION 'FEASIBILITY_TASK_DEFAULTS_PRECONDITION'; END IF;
 d:=replace(d,needle,$code$
   IF raci_stage ? 'raci' THEN
    FOR raci_task IN SELECT task_row.value FROM jsonb_array_elements(raci_stage->'tasks') task_row WHERE task_row.value->>'department'=review_code LOOP
     raci_order:=raci_order+1;
     INSERT INTO public.tasks(organization_id,department_id,record_id,title,description,priority,assignee_id,due_at,created_by,stage_code,is_custom,order_index,template_task_key)
     VALUES(a.organization_id,reviewer,entity,(raci_task->>'title')||' · '||reference,coalesce(raci_task->>'description',''),'High',assigned,due,auth.uid(),'CM_02',false,raci_order,'FEASIBILITY:'||(raci_definition->>'id')||':'||entity::text||':'||(raci_task->>'id'));
    END LOOP;
   ELSE
 $code$||needle);
 needle:='VALUES(a.organization_id,reviewer,entity,''Feasibility · ''||reference,''High'',assigned,due,auth.uid());';
 IF strpos(d,needle)=0 THEN RAISE EXCEPTION 'FEASIBILITY_TASK_FALLBACK_PRECONDITION'; END IF;
 d:=replace(d,needle,needle||' END IF;');
 EXECUTE d;
END $patch$;

CREATE FUNCTION private.guard_configured_feasibility_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source public.operational_records%ROWTYPE; stage jsonb; department_code text; revision text;
BEGIN
 IF NEW.outcome<>'approved' OR OLD.outcome='approved' THEN RETURN NEW; END IF;
 SELECT * INTO source FROM public.operational_records WHERE id=NEW.record_id AND organization_id=NEW.organization_id;
 IF source.record_type<>'Opportunity' OR nullif(source.fields->>'feasibilityLifecycleBaseline','') IS NULL THEN RETURN NEW; END IF;
 SELECT value INTO stage FROM jsonb_array_elements((source.fields->>'feasibilityLifecycleBaseline')::jsonb->'stages') WHERE value->>'code'='CM_02';
 SELECT code INTO department_code FROM public.departments WHERE id=NEW.reviewer_department_id AND organization_id=NEW.organization_id;
 revision:=source.fields->>'feasibilityRaciRevision';
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(stage->'tasks') template WHERE template->>'department'=department_code AND NOT EXISTS(
   SELECT 1 FROM public.tasks t WHERE t.record_id=source.id AND t.department_id=NEW.reviewer_department_id AND t.template_task_key='FEASIBILITY:'||revision||':'||source.id::text||':'||(template->>'id') AND t.status='Complete')) THEN RAISE EXCEPTION 'CONFIGURED_FEASIBILITY_WORK_INCOMPLETE'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_configured_feasibility_review() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER approvals_require_configured_feasibility_work BEFORE UPDATE OF outcome ON public.approvals FOR EACH ROW EXECUTE FUNCTION private.guard_configured_feasibility_review();

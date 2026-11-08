import fs from 'node:fs';
import {additionalLifecycleStages,extensionApplicableTracks,STAGE_DELIVERABLE_BINDINGS} from '../src/lib/lifecycle-stage-extensions.ts';
const path='supabase/migrations/20261107043504_complete_phase_stage_registry.sql';
const q=value=>`'${String(value).replaceAll("'","''")}'`;
const arr=values=>`ARRAY[${values.map(q).join(',')}]::text[]`;
const stages=additionalLifecycleStages();
const inserts=stages.map(stage=>`(${[stage.code,stage.phase,stage.name,stage.department].map(q).join(',')},${arr(stage.prerequisites)},${arr(extensionApplicableTracks(stage.code))},${q(stage.tasks[0].title)},${q(stage.department)},${q(stage.tasks[1].title)},${q(stage.department)})`).join(',\n');
const bindings=STAGE_DELIVERABLE_BINDINGS.map(item=>`(${q(item.stage)},${q(item.recordType)},${q(item.family)},${q(item.title)},${item.original},${q(item.deliverables)})`).join(',\n');
fs.writeFileSync(path,`-- Additive template registration. No organization records, approvals or project pins are rewritten.
-- Source row 77 had no identifier; G8_04 is allocated for its Phase-8 handover stage.
INSERT INTO public.canonical_stage_templates(stage_code,phase_code,name,default_owner,prerequisites,applicable_tracks,t01_title,t01_owner,t02_title,t02_owner) VALUES
${inserts}
ON CONFLICT(stage_code) DO NOTHING;

CREATE TABLE private.stage_deliverable_bindings(
 stage_code text NOT NULL REFERENCES public.canonical_stage_templates(stage_code),
 record_type text PRIMARY KEY, family_code text NOT NULL, title text NOT NULL,
 requires_original boolean NOT NULL, required_deliverables text NOT NULL
);
ALTER TABLE private.stage_deliverable_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.stage_deliverable_bindings FROM PUBLIC,anon,authenticated;
INSERT INTO private.stage_deliverable_bindings VALUES
${bindings};

CREATE FUNCTION private.guard_stage_deliverable_record() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE binding record; project public.operational_records%ROWTYPE; stage jsonb; owner_id uuid;
BEGIN
 IF NEW.record_type NOT LIKE 'Stage evidence · %' OR NOT private.is_shared_test_org(NEW.organization_id) THEN RETURN NEW; END IF;
 SELECT * INTO binding FROM private.stage_deliverable_bindings WHERE record_type=NEW.record_type;
 IF NOT FOUND THEN RAISE EXCEPTION 'UNREGISTERED_STAGE_DELIVERABLE'; END IF;
 SELECT * INTO project FROM public.operational_records WHERE organization_id=NEW.organization_id AND record_type='Project' AND archived_at IS NULL AND (id::text=NEW.fields->>'projectId' OR reference=NEW.fields->>'projectId');
 IF project.id IS NULL OR nullif(project.fields->>'lifecycleBaseline','') IS NULL THEN RAISE EXCEPTION 'PINNED_PROJECT_REQUIRED'; END IF;
 IF auth.uid() IS NOT NULL AND NOT private.shared_test_record_visible(project.id) THEN RAISE EXCEPTION 'PROJECT_DENIED'; END IF;
 SELECT value INTO stage FROM jsonb_array_elements((project.fields->>'lifecycleBaseline')::jsonb->'stages') WHERE value->>'code'=binding.stage_code;
 IF stage IS NULL OR NOT coalesce(stage->'exitTypes','[]'::jsonb) ? NEW.record_type THEN RAISE EXCEPTION 'DELIVERABLE_NOT_IN_PROJECT_SETTINGS'; END IF;
 SELECT id INTO owner_id FROM public.departments WHERE organization_id=NEW.organization_id AND active AND code=stage->>'department';
 IF owner_id IS NULL OR owner_id IS DISTINCT FROM NEW.department_id THEN RAISE EXCEPTION 'STAGE_DELIVERABLE_DEPARTMENT_MISMATCH'; END IF;
 IF NOT public.is_stage_applicable_to_track(binding.stage_code,coalesce(project.fields->>'track',project.fields->>'projectTrack')) THEN RAISE EXCEPTION 'STAGE_NOT_APPLICABLE_TO_TRACK'; END IF;
 NEW.fields:=NEW.fields||jsonb_build_object('recordStage',binding.stage_code,'catalogueFamily',binding.family_code,'requiredDeliverables',binding.required_deliverables);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_stage_deliverable_record() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage_deliverable_record BEFORE INSERT OR UPDATE ON public.operational_records FOR EACH ROW EXECUTE FUNCTION private.guard_stage_deliverable_record();

CREATE FUNCTION private.route_stage_deliverable_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE evidence public.operational_records%ROWTYPE; project_id uuid; binding record;
BEGIN
 IF NOT private.is_shared_test_org(NEW.organization_id) THEN RETURN NEW; END IF;
 SELECT * INTO evidence FROM public.operational_records WHERE id=NEW.record_id AND organization_id=NEW.organization_id;
 SELECT * INTO binding FROM private.stage_deliverable_bindings WHERE record_type=evidence.record_type;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT id INTO project_id FROM public.operational_records WHERE organization_id=NEW.organization_id AND record_type='Project' AND (id::text=evidence.fields->>'projectId' OR reference=evidence.fields->>'projectId');
 IF project_id IS NULL THEN RAISE EXCEPTION 'PINNED_PROJECT_REQUIRED'; END IF;
 IF TG_OP='INSERT' THEN
  NEW.reviewer_department_id:=private.project_stage_accountable_department(project_id,binding.stage_code,evidence.department_id);
  IF EXISTS(SELECT 1 FROM public.approvals WHERE organization_id=NEW.organization_id AND record_id=NEW.record_id AND reviewer_department_id=NEW.reviewer_department_id AND evidence_revision=NEW.evidence_revision AND outcome='pending') THEN RAISE EXCEPTION 'REVIEW_ALREADY_PENDING'; END IF;
 ELSIF NEW.outcome='approved' AND OLD.outcome IS DISTINCT FROM NEW.outcome AND binding.requires_original AND NOT private.has_record_original_object(evidence.id) THEN
  RAISE EXCEPTION 'VERIFIED_ORIGINAL_REQUIRED';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.route_stage_deliverable_approval() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_route_stage_deliverable_approval BEFORE INSERT OR UPDATE OF outcome ON public.approvals FOR EACH ROW EXECUTE FUNCTION private.route_stage_deliverable_approval();

DO $patch$
DECLARE definition text; needle text;
BEGIN
 definition:=pg_get_functiondef('private.assert_project_stage_evidence(uuid,text,jsonb)'::regprocedure);
 needle:='kind !~* ''(certificate|schematic|gerber|step|cad|firmware (binary|release)|production binary|hex|pcb layout|3d model)''';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'STAGE_DELIVERABLE_EVIDENCE_PATCH_PRECONDITION'; END IF;
 definition:=replace(definition,needle,'('||needle||' AND NOT EXISTS(SELECT 1 FROM private.stage_deliverable_bindings binding WHERE binding.record_type=kind AND binding.requires_original))');
 EXECUTE definition;
END $patch$;
`);
console.log(`Prepared ${stages.length} registered stages and ${STAGE_DELIVERABLE_BINDINGS.length} document bindings.`);

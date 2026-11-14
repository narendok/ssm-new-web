const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

test("feasibility task timelines are checked against the configured parent-stage duration", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '10000000-0000-4000-8000-000000000001'::uuid $$;
    CREATE TABLE public.project_input_sheets (
      id uuid PRIMARY KEY, organization_id uuid NOT NULL, status text NOT NULL,
      revision integer NOT NULL DEFAULT 1, version integer NOT NULL, department_estimates jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.project_input_events (
      sheet_id uuid, actor_id uuid, action text, revision integer, details jsonb
    );
    CREATE TABLE public.departments (id uuid, organization_id uuid, code text, active boolean, lead_member_id uuid);
    CREATE TABLE private.lifecycle_revisions (id uuid, organization_id uuid, version integer, definition jsonb);
    CREATE TABLE public.organization_members (id uuid PRIMARY KEY, organization_id uuid, department_id uuid, active boolean, role text);
    CREATE TABLE public.department_roles (id uuid PRIMARY KEY, organization_id uuid, department_id uuid, active boolean, hierarchy_level smallint);
    CREATE TABLE public.department_role_assignments (role_id uuid, member_id uuid, active boolean);
    CREATE TABLE public.role_permissions (role_id uuid, permission_key text, allowed boolean);
    CREATE FUNCTION public.resolve_test_membership() RETURNS TABLE (
      membership_id uuid, is_client boolean, role text, department_code text, organization_id uuid
    ) LANGUAGE sql STABLE AS $$
      SELECT '10000000-0000-4000-8000-000000000002'::uuid, false, 'department_lead', 'EHW', '10000000-0000-4000-8000-000000000003'::uuid
    $$;
    CREATE FUNCTION private.project_input_visible(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
    CREATE FUNCTION private.shared_test_member_department(member uuid) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT department_id FROM public.organization_members WHERE id=member $$;
    CREATE FUNCTION private.validate_lifecycle_definition(jsonb) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
    CREATE FUNCTION public.has_department_permission(_organization_id uuid,_department_id uuid,_permission_key text) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT _department_id='10000000-0000-4000-8000-000000000010'::uuid OR EXISTS(
        SELECT 1 FROM public.department_role_assignments a JOIN public.department_roles r ON r.id=a.role_id
        JOIN public.role_permissions p ON p.role_id=r.id WHERE r.organization_id=_organization_id AND r.department_id=_department_id
          AND a.member_id='10000000-0000-4000-8000-000000000002'::uuid AND a.active AND r.active AND p.allowed AND p.permission_key=_permission_key)
    $$;
  `);
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261112142900_stage_duration_feasibility_plans.sql"), "utf8");
  await db.exec(migration);
  await db.exec(`
    CREATE FUNCTION public.get_project_input_sheets() RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public AS $$
    DECLARE a record; BEGIN SELECT * INTO a FROM public.resolve_test_membership(); RETURN jsonb_build_object('sheets',COALESCE((SELECT jsonb_agg(
        CASE
          WHEN a.role = 'admin' OR a.department_code = 'FIN' THEN to_jsonb(s)
          ELSE jsonb_set(
            to_jsonb(s), '{department_estimates}',
            CASE WHEN a.department_code IS NOT NULL AND s.department_estimates ? a.department_code
              THEN jsonb_build_object(a.department_code, s.department_estimates->a.department_code)
              ELSE '{}'::jsonb END,
            true
          )
        END
      ) FROM public.project_input_sheets s),'[]'::jsonb)); END $$;
    CREATE FUNCTION public.mutate_project_input_sheet(p_action text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
    DECLARE a record; review_dept text; BEGIN IF false THEN
      IF a.department_code IS DISTINCT FROM review_dept THEN RAISE EXCEPTION 'INPUT_DEPARTMENT_DENIED'; END IF;
      IF a.role<>'department_lead' THEN RAISE EXCEPTION 'INPUT_REVIEW_LEAD_REQUIRED'; END IF;
      IF EXISTS(SELECT 1 FROM public.organization_members m WHERE true AND private.shared_test_member_department(m.id)=private.shared_test_member_department(a.membership_id)) THEN NULL; END IF;
    END IF; RETURN '{}'::jsonb; END $$;
  `);
  await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261112144252_configured_department_feasibility_work.sql"), "utf8"));
  const org = "10000000-0000-4000-8000-000000000003";
  const sheet = "10000000-0000-4000-8000-000000000004";
  const lifecycleId = "10000000-0000-4000-8000-000000000005";
  const definition = {
    phaseDurations: { TG_0: { minWorkingDays: 2, maxWorkingDays: 8 } },
    stages: [
      { code: "HW_01", phase: "TG_0", durationDays: 3, tasks: [{ id: "T01", department: "EHW" }] },
      { code: "MMF_01", phase: "TG_0", durationDays: 3, tasks: [{ id: "T02", department: "MMF" }] },
    ],
  };
  await db.query("SELECT private.validate_lifecycle_definition($1::jsonb)", [JSON.stringify(definition)]);
  await assert.rejects(
    () => db.query("SELECT private.validate_lifecycle_definition($1::jsonb)", [JSON.stringify({ ...definition, stages: [{ ...definition.stages[0], durationDays: 0 }] })]),
    /INVALID_LIFECYCLE_STAGE_DURATION/,
  );
  await db.query("INSERT INTO public.project_input_sheets(id,organization_id,status,version) VALUES($1,$2,'Draft',1)", [sheet, org]);
  await db.query("INSERT INTO public.departments VALUES('10000000-0000-4000-8000-000000000010',$1,'EHW',true,'10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000011',$1,'MMF',true,NULL),('10000000-0000-4000-8000-000000000012',$1,'QA',true,NULL)", [org]);
  await db.query("INSERT INTO public.organization_members(id,organization_id,department_id,active,role) VALUES('10000000-0000-4000-8000-000000000002',$1,'10000000-0000-4000-8000-000000000010',true,'department_lead')", [org]);
  await db.query("INSERT INTO public.department_roles VALUES('10000000-0000-4000-8000-000000000020',$1,'10000000-0000-4000-8000-000000000011',true,1),('10000000-0000-4000-8000-000000000021',$1,'10000000-0000-4000-8000-000000000012',true,2)", [org]);
  await db.query("INSERT INTO public.department_role_assignments VALUES('10000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000002',true),('10000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000002',true)");
  await db.query("INSERT INTO public.role_permissions VALUES('10000000-0000-4000-8000-000000000020','records:edit',true),('10000000-0000-4000-8000-000000000021','records:edit',true)");
  await db.query("INSERT INTO private.lifecycle_revisions VALUES($1,$2,1,$3::jsonb)", [lifecycleId, org, JSON.stringify(definition)]);
  const estimate = {
    lifecycleRevisionId: lifecycleId,
    currency: "INR",
    plannedDurationDays: 4,
    stageDurationDays: { HW_01: 3, MMF_01: 3 },
    taskPlan: { "HW_01:T01": { stageCode: "HW_01", phase: "TG_0", effortHours: 4, startOffsetDays: 0, durationDays: 1 } },
  };
  await assert.rejects(
    () => db.query("SELECT public.save_project_department_feasibility_estimate($1,1,$2::jsonb)", [sheet, JSON.stringify({ ...estimate, taskPlan: { "HW_01:T01": { ...estimate.taskPlan["HW_01:T01"], startOffsetDays: 2, durationDays: 2 } } })]),
    /FEASIBILITY_TASK_TIMELINE_INVALID/,
  );
  const saved = await db.query("SELECT public.save_project_department_feasibility_estimate($1,1,$2::jsonb) result", [sheet, JSON.stringify(estimate)]);
  assert.equal(saved.rows[0].result.department_estimates.EHW.stageDurationDays.HW_01, 3);
  assert.equal((await db.query("SELECT version FROM public.project_input_sheets WHERE id=$1", [sheet])).rows[0].version, 2);
  const secondEstimate = {
    ...estimate,
    departmentCode: "MMF",
    taskPlan: { "MMF_01:T02": { stageCode: "MMF_01", phase: "TG_0", effortHours: 6, startOffsetDays: 1, durationDays: 2 } },
  };
  const secondSaved = await db.query("SELECT public.save_project_department_feasibility_estimate($1,2,$2::jsonb) result", [sheet, JSON.stringify(secondEstimate)]);
  assert.equal(secondSaved.rows[0].result.department_estimates.MMF.taskPlan["MMF_01:T02"].effortHours, 6);
  assert.equal(secondSaved.rows[0].result.department_estimates.MMF.departmentCode, undefined, "routing selector is not stored as estimate data");
  await assert.rejects(
    () => db.query("SELECT public.save_project_department_feasibility_estimate($1,3,$2::jsonb)", [sheet, JSON.stringify({ ...secondEstimate, departmentCode: "QA", taskPlan: { "HW_01:T01": estimate.taskPlan["HW_01:T01"] } })]),
    /FEASIBILITY_ESTIMATE_DEPARTMENT_DENIED/,
  );
  const visible = await db.query("SELECT public.get_project_input_sheets() result");
  const estimates = visible.rows[0].result.sheets[0].department_estimates;
  assert.deepEqual(Object.keys(estimates).sort(), ["EHW", "MMF"], "member sees only their primary and explicitly assigned department estimates");
  assert.equal((await db.query("SELECT version FROM public.project_input_sheets WHERE id=$1", [sheet])).rows[0].version, 3);
});

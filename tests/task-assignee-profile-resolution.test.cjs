const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

const root = path.resolve(__dirname, "..");
const strictLevelMigration = path.join(
  root,
  "supabase/migrations/20261115005534_20261114094441_require_explicit_task_assignee_role_level.sql",
);
const strictResolutionMigration = path.join(
  root,
  "supabase/migrations/20261115005613_20261115003152_strict_lifecycle_task_assignee_resolution.sql",
);
const uuid = (n) => `31000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("new lifecycle tasks use only one exact role profile and never silently fall back", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA private;
    CREATE TABLE public.departments (id uuid PRIMARY KEY, organization_id uuid, code text, active boolean, lead_member_id uuid);
    CREATE TABLE public.department_roles (id uuid PRIMARY KEY, organization_id uuid, department_id uuid, active boolean, hierarchy_level smallint);
    CREATE TABLE public.department_role_assignments (id uuid PRIMARY KEY, role_id uuid, member_id uuid, active boolean);
    CREATE TABLE public.organization_members (id uuid PRIMARY KEY, organization_id uuid, active boolean, role text);
    CREATE TABLE public.task_generation_events (id text PRIMARY KEY, organization_id uuid, department_id uuid, task jsonb, assignee_id uuid);

    CREATE FUNCTION private.validate_lifecycle_task_assignee_roles(p_organization uuid, p_definition jsonb)
    RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
    DECLARE stage_row jsonb; task_row jsonb; level_key text; role_id uuid; department_id uuid;
    BEGIN
      FOR stage_row IN SELECT value FROM jsonb_array_elements(p_definition->'stages') LOOP
        FOR task_row IN SELECT value FROM jsonb_array_elements(COALESCE(stage_row->'tasks','[]'::jsonb)) LOOP
          SELECT d.id INTO department_id FROM public.departments d
          WHERE d.organization_id=p_organization AND d.code=task_row->>'department' AND d.active AND d.code<>'CLIENT';
          IF department_id IS NULL THEN RAISE EXCEPTION 'LIFECYCLE_TASK_DEPARTMENT_UNAVAILABLE'; END IF;
          FOR level_key IN SELECT unnest(ARRAY['L1','L2','L3','L4']) LOOP
            role_id:=NULLIF(task_row->'assigneeRoleLevels'->>level_key,'')::uuid;
            IF role_id IS NULL AND level_key='L1' THEN role_id:=NULLIF(task_row->>'assigneeRoleId','')::uuid; END IF;
            IF role_id IS NULL THEN CONTINUE; END IF;
            IF NOT EXISTS(SELECT 1 FROM public.department_roles r WHERE r.id=role_id AND r.organization_id=p_organization AND r.department_id=department_id AND r.active AND (r.hierarchy_level IS NULL OR r.hierarchy_level=substring(level_key from 2)::smallint)) THEN
              RAISE EXCEPTION 'LIFECYCLE_TASK_ROLE_LEVEL_OR_DEPARTMENT_MISMATCH: %',level_key;
            END IF;
          END LOOP;
        END LOOP;
      END LOOP;
    END $$;
    REVOKE ALL ON FUNCTION private.validate_lifecycle_task_assignee_roles(uuid,jsonb) FROM PUBLIC,anon,authenticated;

    CREATE FUNCTION private.sync_pinned_lifecycle_work()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
    DECLARE
      role_level text;
      selected_role uuid;
      task jsonb;
      dept uuid;
      holder_count integer;
      assignee uuid;
    BEGIN
    dept:=NEW.department_id;
    task:=NEW.task;
    assignee:=NULL;
    FOR role_level IN SELECT unnest(ARRAY['L4','L3','L2','L1']) LOOP
      selected_role:=NULLIF(task->'assigneeRoleLevels'->>role_level,'')::uuid;
      IF selected_role IS NULL AND role_level='L1' THEN selected_role:=NULLIF(task->>'assigneeRoleId','')::uuid; END IF;
      IF selected_role IS NULL THEN CONTINUE; END IF;
      SELECT count(DISTINCT m.id),min(m.id::text)::uuid INTO holder_count,assignee
      FROM public.department_roles r
      JOIN public.department_role_assignments ra ON ra.role_id=r.id AND ra.active
      JOIN public.organization_members m ON m.id=ra.member_id AND m.organization_id=NEW.organization_id AND m.active AND m.role IN ('department_lead','member')
      WHERE r.id=selected_role AND r.organization_id=NEW.organization_id AND r.department_id=dept AND r.active;
      IF holder_count=1 THEN EXIT; END IF;
      assignee:=NULL;
    END LOOP;
    IF assignee IS NULL THEN
      SELECT m.id INTO assignee FROM public.departments d
      JOIN public.organization_members m ON m.id=d.lead_member_id AND m.organization_id=NEW.organization_id
        AND m.active AND m.role IN ('department_lead','member')
      WHERE d.id=dept;
    END IF;
    NEW.assignee_id:=assignee;
    RETURN NEW;
    END $$;
    REVOKE ALL ON FUNCTION private.sync_pinned_lifecycle_work() FROM PUBLIC,anon,authenticated;
    CREATE TRIGGER resolve_task_assignee BEFORE INSERT ON public.task_generation_events
      FOR EACH ROW EXECUTE FUNCTION private.sync_pinned_lifecycle_work();

    INSERT INTO public.departments VALUES ('${uuid(1)}','${uuid(10)}','EHW',true,'${uuid(100)}');
    INSERT INTO public.organization_members VALUES
      ('${uuid(100)}','${uuid(10)}',true,'department_lead'),
      ('${uuid(101)}','${uuid(10)}',true,'member'),
      ('${uuid(102)}','${uuid(10)}',true,'member'),
      ('${uuid(103)}','${uuid(10)}',true,'member'),
      ('${uuid(104)}','${uuid(10)}',true,'member');
    INSERT INTO public.department_roles VALUES
      ('${uuid(2)}','${uuid(10)}','${uuid(1)}',true,2),
      ('${uuid(3)}','${uuid(10)}','${uuid(1)}',true,3),
      ('${uuid(4)}','${uuid(10)}','${uuid(1)}',true,4),
      ('${uuid(5)}','${uuid(10)}','${uuid(1)}',true,2),
      ('${uuid(6)}','${uuid(10)}','${uuid(1)}',true,1);
    INSERT INTO public.department_role_assignments VALUES
      ('${uuid(20)}','${uuid(2)}','${uuid(101)}',true),
      ('${uuid(21)}','${uuid(3)}','${uuid(102)}',true),
      ('${uuid(22)}','${uuid(3)}','${uuid(103)}',true),
      ('${uuid(23)}','${uuid(5)}','${uuid(104)}',true),
      ('${uuid(24)}','${uuid(6)}','${uuid(100)}',true);
  `);

  await db.exec(fs.readFileSync(strictLevelMigration, "utf8"));
  await db.exec(fs.readFileSync(strictResolutionMigration, "utf8"));

  const insertTask = async (id, task) => {
    await db.query(
      "INSERT INTO public.task_generation_events(id,organization_id,department_id,task) VALUES ($1,$2,$3,$4::jsonb)",
      [id, uuid(10), uuid(1), JSON.stringify(task)],
    );
    const result = await db.query(
      "SELECT assignee_id FROM public.task_generation_events WHERE id=$1",
      [id],
    );
    return result.rows[0].assignee_id;
  };

  assert.equal(await insertTask("exact-l2", { assigneeRoleLevels: { L2: uuid(2) } }), uuid(101));
  assert.equal(
    await insertTask("empty-l4", { assigneeRoleLevels: { L4: uuid(4) } }),
    null,
    "empty L4 does not fall back to the department lead",
  );
  assert.equal(await insertTask("multiple-holders", { assigneeRoleLevels: { L3: uuid(3) } }), null);
  assert.equal(
    await insertTask("multiple-profiles", { assigneeRoleLevels: { L1: uuid(6), L2: uuid(2) } }),
    null,
  );
  assert.equal(
    await insertTask("no-profile", {}),
    null,
    "an unconfigured template does not silently use the department lead",
  );
  assert.equal(await insertTask("legacy-l1-alias", { assigneeRoleId: uuid(6) }), uuid(100));
  assert.equal(await insertTask("wrong-level", { assigneeRoleLevels: { L3: uuid(5) } }), null);

  await assert.rejects(
    db.query("SELECT private.validate_lifecycle_task_assignee_roles($1,$2::jsonb)", [
      uuid(10),
      JSON.stringify({
        stages: [
          { tasks: [{ department: "EHW", assigneeRoleLevels: { L1: uuid(6), L2: uuid(2) } }] },
        ],
      }),
    ]),
    /LIFECYCLE_TASK_MULTIPLE_ASSIGNEE_PROFILES/,
  );

  const functionResult = await db.query(
    "SELECT pg_get_functiondef('private.sync_pinned_lifecycle_work()'::regprocedure) AS definition",
  );
  assert.match(functionResult.rows[0].definition, /SECURITY DEFINER/);
  assert.match(functionResult.rows[0].definition, /SET search_path TO ''/);
});

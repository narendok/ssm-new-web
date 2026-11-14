const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(
  root,
  "supabase/migrations/20261114094441_require_explicit_task_assignee_role_level.sql",
);
const uuid = (n) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("L1-L4 task assignees require an explicit matching department-role level", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    CREATE SCHEMA private;
    CREATE TABLE public.departments (id uuid PRIMARY KEY, organization_id uuid, code text, active boolean);
    CREATE TABLE public.department_roles (id uuid PRIMARY KEY, organization_id uuid, department_id uuid, active boolean, hierarchy_level smallint);
    CREATE FUNCTION private.validate_lifecycle_task_assignee_roles(p_organization uuid, p_definition jsonb)
    RETURNS void LANGUAGE plpgsql AS $$
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

    CREATE FUNCTION private.sync_pinned_lifecycle_work()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE role_level text; selected_role uuid; dept uuid; holder_count integer;
    BEGIN
      SELECT count(*) INTO holder_count FROM public.department_roles r
      WHERE r.id=selected_role AND r.organization_id=NEW.organization_id AND r.department_id=dept AND r.active;
      RETURN NEW;
    END $$;

    INSERT INTO public.departments VALUES ('${uuid(1)}','${uuid(10)}','EHW',true);
    INSERT INTO public.department_roles VALUES
      ('${uuid(2)}','${uuid(10)}','${uuid(1)}',true,NULL),
      ('${uuid(3)}','${uuid(10)}','${uuid(1)}',true,2);
  `);

  await db.exec(fs.readFileSync(migrationPath, "utf8"));

  const taskDefinition = (level, roleId) =>
    JSON.stringify({
      stages: [{ tasks: [{ department: "EHW", assigneeRoleLevels: { [level]: roleId } }] }],
    });
  const invoke = (level, roleId) =>
    db.query("SELECT private.validate_lifecycle_task_assignee_roles($1,$2::jsonb)", [
      uuid(10),
      taskDefinition(level, roleId),
    ]);

  await invoke("L2", uuid(3));
  await assert.rejects(invoke("L1", uuid(3)), /LIFECYCLE_TASK_ROLE_LEVEL_OR_DEPARTMENT_MISMATCH/);
  await assert.rejects(invoke("L1", uuid(2)), /LIFECYCLE_TASK_ROLE_LEVEL_OR_DEPARTMENT_MISMATCH/);

  const resolver = await db.query(
    "SELECT pg_get_functiondef('private.sync_pinned_lifecycle_work()'::regprocedure) AS definition",
  );
  assert.match(
    resolver.rows[0].definition,
    /r\.hierarchy_level=substring\(role_level from 2\)::smallint/,
  );
});

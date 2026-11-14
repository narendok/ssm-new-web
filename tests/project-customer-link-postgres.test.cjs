const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

const migrationPath = path.resolve(
  __dirname,
  "../supabase/migrations/20261114114704_editable_shared_project_customer_link.sql",
);
const orgId = "20000000-0000-4000-8000-000000000001";
const actorId = "20000000-0000-4000-8000-000000000002";
const memberId = "20000000-0000-4000-8000-000000000003";
const salesDepartmentId = "20000000-0000-4000-8000-000000000004";
const projectId = "20000000-0000-4000-8000-000000000005";
const sourceProjectId = "20000000-0000-4000-8000-000000000006";
const customerId = "20000000-0000-4000-8000-000000000007";
const alternateCustomerId = "20000000-0000-4000-8000-000000000008";
const archivedCustomerId = "20000000-0000-4000-8000-000000000009";
const opportunityId = "20000000-0000-4000-8000-000000000010";
const requestId = "20000000-0000-4000-8000-000000000011";
const createdAt = "2026-11-14T00:00:00.000Z";

test("draft Project Customer links are searchable-master writes with Sales scope, idempotency, and source checks", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE TABLE public.test_actor (
      organization_id uuid, membership_id uuid, role text, department_code text, is_client boolean
    );
    CREATE FUNCTION public.resolve_test_membership()
    RETURNS TABLE(organization_id uuid, membership_id uuid, role text, department_code text, is_client boolean)
    LANGUAGE sql STABLE AS $$ SELECT * FROM public.test_actor $$;
    CREATE FUNCTION private.is_shared_test_org(p_org uuid) RETURNS boolean
    LANGUAGE sql STABLE AS $$ SELECT p_org = '${orgId}'::uuid $$;
    CREATE FUNCTION private.shared_test_member_has_department(p_member uuid, p_department uuid) RETURNS boolean
    LANGUAGE sql STABLE AS $$
      SELECT p_member = '${memberId}'::uuid AND p_department = '${salesDepartmentId}'::uuid
        AND COALESCE(current_setting('test.sales_access', true), 'false') = 'true'
    $$;
    CREATE TABLE public.departments (id uuid, organization_id uuid, code text, active boolean);
    INSERT INTO public.departments VALUES ('${salesDepartmentId}','${orgId}','SAL',true);
    CREATE TABLE public.operational_records (
      id uuid PRIMARY KEY, organization_id uuid, record_type text, archived_at timestamptz,
      status text, reference text, title text, fields jsonb, updated_at timestamptz, updated_by uuid
    );
    INSERT INTO public.operational_records VALUES
      ('${projectId}','${orgId}','Project',NULL,'draft','PRJ-01','Draft project','{"scope":"External","lifecycleStage":"G0_01","customer":"Legacy customer text"}'::jsonb,'${createdAt}','${actorId}'),
      ('${sourceProjectId}','${orgId}','Project',NULL,'draft','PRJ-02','Source-linked project','{"sourceOpportunityId":"${opportunityId}","scope":"External"}'::jsonb,'${createdAt}','${actorId}'),
      ('${customerId}','${orgId}','Customer',NULL,'approved','CUS-01','Fictional customer A','{}'::jsonb,'${createdAt}','${actorId}'),
      ('${alternateCustomerId}','${orgId}','Customer',NULL,'approved','CUS-02','Fictional customer B','{}'::jsonb,'${createdAt}','${actorId}'),
      ('${archivedCustomerId}','${orgId}','Customer',NULL,'archived','CUS-03','Archived customer','{}'::jsonb,'${createdAt}','${actorId}'),
      ('${opportunityId}','${orgId}','Opportunity',NULL,'approved','OPP-01','Source opportunity','{"customerId":"${customerId}"}'::jsonb,'${createdAt}','${actorId}');
    GRANT SELECT ON public.operational_records TO authenticated;
    CREATE TABLE private.shared_test_requests (
      organization_id uuid, actor_id uuid, request_id uuid, request_hash text, response jsonb,
      created_at timestamptz DEFAULT now(), PRIMARY KEY(organization_id, actor_id, request_id)
    );
    CREATE TABLE public.audit_events (
      id bigserial PRIMARY KEY, organization_id uuid, actor_id uuid, entity_type text,
      entity_id uuid, action text, detail jsonb, created_at timestamptz DEFAULT now()
    );
    GRANT SELECT ON public.audit_events TO authenticated;
    INSERT INTO public.test_actor VALUES ('${orgId}','${memberId}','admin','SAL',false);
  `);
  await db.exec(fs.readFileSync(migrationPath, "utf8"));

  const security = await db.query(`
    SELECT
      (SELECT prosecdef FROM pg_proc WHERE oid='public.set_shared_project_customer_link(uuid,uuid,timestamptz,uuid)'::regprocedure) AS public_is_definer,
      (SELECT prosecdef FROM pg_proc WHERE oid='private.set_shared_project_customer_link(uuid,uuid,timestamptz,uuid)'::regprocedure) AS private_is_definer,
      has_function_privilege('authenticated','public.set_shared_project_customer_link(uuid,uuid,timestamptz,uuid)','EXECUTE') AS authenticated_can_call,
      has_function_privilege('anon','public.set_shared_project_customer_link(uuid,uuid,timestamptz,uuid)','EXECUTE') AS anon_can_call
  `);
  assert.deepEqual(security.rows[0], {
    public_is_definer: false,
    private_is_definer: true,
    authenticated_can_call: true,
    anon_can_call: false,
  });

  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [actorId]);
  await db.exec("SET ROLE authenticated");
  const args = [projectId, customerId, createdAt, requestId];
  const result = await db.query(
    "SELECT public.set_shared_project_customer_link($1,$2,$3,$4) AS result",
    args,
  );
  assert.deepEqual(result.rows[0].result, { projectId, customerId });
  const linked = await db.query("SELECT fields, updated_by, updated_at FROM public.operational_records WHERE id=$1", [projectId]);
  assert.deepEqual(linked.rows[0].fields, {
    scope: "External",
    lifecycleStage: "G0_01",
    customerId,
    customer_id: customerId,
    customer: "Fictional customer A",
    customerName: "Fictional customer A",
    customer_name: "Fictional customer A",
    customerCode: "CUS-01",
    customer_code: "CUS-01",
  });
  assert.equal(linked.rows[0].updated_by, actorId);
  assert.equal((await db.query("SELECT count(*)::int AS count FROM public.audit_events")).rows[0].count, 1);
  const replay = await db.query(
    "SELECT public.set_shared_project_customer_link($1,$2,$3,$4) AS result",
    args,
  );
  assert.deepEqual(replay.rows[0].result, result.rows[0].result, "retry returns the original result without duplicate audit");
  await assert.rejects(
    db.query("SELECT public.set_shared_project_customer_link($1,$2,$3,$4)", [projectId, alternateCustomerId, createdAt, requestId]),
    /REQUEST_ID_REUSED/,
  );
  await assert.rejects(
    db.query("SELECT public.set_shared_project_customer_link($1,$2,$3,$4)", [projectId, archivedCustomerId, linked.rows[0].updated_at, "20000000-0000-4000-8000-000000000012"]),
    /CUSTOMER_LINK_INVALID/,
  );
  await assert.rejects(
    db.query("SELECT public.set_shared_project_customer_link($1,$2,$3,$4)", [projectId, alternateCustomerId, createdAt, "20000000-0000-4000-8000-000000000013"]),
    /STALE_PROJECT/,
  );
  await assert.rejects(
    db.query("SELECT public.set_shared_project_customer_link($1,$2,$3,$4)", [sourceProjectId, alternateCustomerId, createdAt, "20000000-0000-4000-8000-000000000014"]),
    /PROJECT_CUSTOMER_MUST_MATCH_SOURCE_OPPORTUNITY/,
  );
  await db.exec("RESET ROLE");
  await db.exec("UPDATE public.test_actor SET role='department_lead'; SELECT set_config('test.sales_access','true',false)");
  await db.exec("SET ROLE authenticated");
  const leadResult = await db.query(
    "SELECT public.set_shared_project_customer_link($1,$2,$3,$4) AS result",
    [projectId, null, (await db.query("SELECT updated_at FROM public.operational_records WHERE id=$1", [projectId])).rows[0].updated_at, "20000000-0000-4000-8000-000000000015"],
  );
  assert.equal(leadResult.rows[0].result.customerId, null, "authorized Sales lead may clear an unanchored draft link");
  await db.exec("RESET ROLE");
  await db.exec("UPDATE public.test_actor SET role='member'");
  await db.exec("SET ROLE authenticated");
  await assert.rejects(
    db.query("SELECT public.set_shared_project_customer_link($1,$2,$3,$4)", [projectId, customerId, createdAt, "20000000-0000-4000-8000-000000000016"]),
    /PROJECT_CUSTOMER_LINK_EDIT_DENIED/,
  );
});

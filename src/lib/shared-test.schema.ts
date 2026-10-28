import { z } from "zod";
export type SharedJson =
  string | number | boolean | null | SharedJson[] | { [key: string]: SharedJson };
const jsonSchema: z.ZodType<SharedJson> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(jsonSchema),
  ]),
);

export const sharedTestActionSchema = z.enum([
  "create_project",
  "create_record",
  "update_record",
  "create_task",
  "create_custom_task",
  "update_task",
  "cancel_task",
  "delete_task",
  "advance_stage",
  "request_approval",
  "decide_approval",
  "create_document",
  "sync_canonical_sample_pack",
  "sync_scenario_test_fixtures",
]);
export const sharedTestMutationSchema = z.object({
  action: sharedTestActionSchema,
  payload: z.record(jsonSchema),
  requestId: z.string().uuid(),
});
const id = z.string().uuid();
const nullableId = id.nullable();
export const sharedTestSnapshotSchema = z.object({
  membership: z.object({
    organization_id: id,
    organization_name: z.string(),
    membership_id: id,
    display_name: z.string(),
    role: z.enum(["admin", "department_lead", "member", "viewer"]),
    department_code: z.string().nullable(),
    department_name: z.string().nullable(),
    is_client: z.boolean(),
  }),
  serverTime: z.string(),
  departments: z.array(
    z.object({ id, code: z.string(), name: z.string(), lead_member_id: nullableId }),
  ),
  members: z.array(
    z.object({
      id,
      display_name: z.string().nullable(),
      role: z.string(),
      department_id: nullableId,
    }),
  ),
  records: z.array(
    z.object({
      id,
      department_id: nullableId,
      reference: z.string(),
      title: z.string(),
      record_type: z.string(),
      status: z.string(),
      stage: z.string().nullable(),
      notes: z.string(),
      fields: z.record(jsonSchema),
      updated_at: z.string(),
    }),
  ),
  tasks: z.array(
    z.object({
      id,
      department_id: nullableId,
      record_id: nullableId,
      title: z.string(),
      status: z.string(),
      priority: z.string(),
      assignee_id: nullableId,
      due_at: z.string().nullable(),
      updated_at: z.string(),
    }),
  ),
  approvals: z.array(
    z.object({
      id,
      title: z.string(),
      department_id: nullableId,
      reviewer_department_id: nullableId,
      record_id: nullableId,
      outcome: z.string(),
      decision_notes: z.string(),
      evidence_record_id: nullableId,
      evidence_document_id: nullableId,
      evidence_revision: z.string().nullable(),
      updated_at: z.string(),
      decided_at: z.string().nullable(),
    }),
  ),
  documents: z.array(
    z.object({
      id,
      department_id: nullableId,
      record_id: nullableId,
      title: z.string(),
      document_type: z.string(),
      updated_at: z.string(),
    }),
  ),
  audit: z.array(z.object({ id, action: z.string(), created_at: z.string(), detail: jsonSchema })),
});
export type SharedTestSnapshot = z.infer<typeof sharedTestSnapshotSchema>;
export type SharedTestAction = z.infer<typeof sharedTestActionSchema>;

import { z } from "zod";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const customerChangeScopeSchema = z.object({
  tracks: z.array(z.string().min(1).max(200)).max(100),
  stages: z.array(z.string().min(1).max(200)).max(100),
  documents: z.array(z.string().min(1).max(200)).max(100),
  bom: z.array(z.string().min(1).max(200)).max(100),
  reusableAssets: z.array(z.string().min(1).max(200)).max(100),
});

export const customerChangeImpactSchema = z.object({
  id: z.string().uuid(),
  department_id: z.string().uuid(),
  department_code: z.string(),
  impact_scope: customerChangeScopeSchema,
  status: z.enum(["Pending", "Assessed"]),
  assessment: z.string(),
  outcome: z.string(),
  assessed_by: z.string().uuid().nullable(),
  assessed_at: z.string().nullable(),
  version: z.number().int().positive(),
  updated_at: z.string(),
});

export const customerChangeEventSchema = z.object({
  id: z.string().uuid(),
  actor_id: z.string().uuid(),
  actor_name: z.string().nullable(),
  action: z.string(),
  request_version: z.number().int().positive(),
  details: z.record(z.string(), jsonValueSchema),
  created_at: z.string(),
});

export const customerChangeRequestSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  project_record_id: z.string().uuid(),
  input_sheet_id: z.string().uuid(),
  requested_by: z.string().uuid(),
  title: z.string(),
  customer_reference: z.string(),
  description: z.string(),
  rationale: z.string(),
  status: z.enum(["Draft", "Impact review", "Pending approval", "Returned", "Approved", "Rejected"]),
  baseline_revision: z.number().int().positive(),
  baseline_version: z.number().int().positive(),
  before_values: z.record(z.string(), jsonValueSchema),
  proposed_values: z.record(z.string(), jsonValueSchema),
  version: z.number().int().positive(),
  decision_notes: z.string(),
  approved_revision: z.number().int().positive().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  impacts: z.array(customerChangeImpactSchema).optional(),
  events: z.array(customerChangeEventSchema).optional(),
});

export const customerChangeSnapshotSchema = z.object({
  requests: z.array(customerChangeRequestSchema),
});

export const customerChangeMutationSchema = z.object({
  action: z.enum(["create", "update_draft", "submit", "assess_impact", "decide"]),
  payload: z.record(z.string(), jsonValueSchema),
  operationId: z.string().uuid(),
});

export type CustomerChangeRequest = z.infer<typeof customerChangeRequestSchema>;
export type CustomerChangeImpact = z.infer<typeof customerChangeImpactSchema>;
export type CustomerChangeScope = z.infer<typeof customerChangeScopeSchema>;

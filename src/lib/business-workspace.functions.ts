import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type BusinessItem = {
  id: string;
  kind: string;
  ownerId: string | null;
  departmentId: string | null;
  projectId: string | null;
  version: number;
  data: Record<string, Json | undefined>;
};
export type BusinessSnapshot = {
  items: BusinessItem[];
  serverTime: string;
  membership: {
    membership_id: string;
    display_name: string;
    role: string;
    department_code: string | null;
  };
  departments: { id: string; code: string; name: string }[];
  members: { id: string; name: string; role: string; departmentId: string | null }[];
  projects: { id: string; reference: string; title: string; currentStage: string | null }[];
  surveyResults: { template_id: string; response_count: number; answers: Json[] | null }[];
  notifications: { itemId: string; kind: string; event: string; at: string }[];
  votes: { message_id: string; choice: number; total: number; my_vote: boolean }[];
};
const snapshot = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      kind: z.string(),
      ownerId: z.string().nullable(),
      departmentId: z.string().nullable(),
      projectId: z.string().nullable(),
      version: z.number().int(),
      data: z.record(z.unknown()),
    }),
  ),
  membership: z.object({
    membership_id: z.string(),
    display_name: z.string(),
    role: z.string(),
    department_code: z.string().nullable(),
  }),
  departments: z.array(z.object({ id: z.string(), code: z.string(), name: z.string() })),
  members: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      role: z.string(),
      departmentId: z.string().nullable(),
    }),
  ),
  projects: z.array(z.object({ id: z.string(), reference: z.string(), title: z.string(), currentStage: z.string().nullable() })),
  surveyResults: z.array(
    z.object({
      template_id: z.string(),
      response_count: z.number(),
      answers: z.array(z.unknown()).nullable(),
    }),
  ),
  notifications: z.array(
    z.object({ itemId: z.string(), kind: z.string(), event: z.string(), at: z.string() }),
  ),
  votes: z.array(
    z.object({
      message_id: z.string(),
      choice: z.number(),
      total: z.number(),
      my_vote: z.boolean(),
    }),
  ),
  serverTime: z.string(),
});
export type BusinessAction =
  | "allocate"
  | "request_expense"
  | "approve_expense"
  | "reject_expense"
  | "post_expense"
  | "ticket_create"
  | "ticket_reply"
  | "ticket_status"
  | "save_profile"
  | "publish_template"
  | "submit_assignment"
  | "channel_create"
  | "send_message"
  | "poll_vote"
  | "review_training";
const mutation = z.object({
  action: z.enum([
    "allocate",
    "request_expense",
    "approve_expense",
    "reject_expense",
    "post_expense",
    "ticket_create",
    "ticket_reply",
    "ticket_status",
    "save_profile",
    "publish_template",
    "submit_assignment",
    "channel_create",
    "send_message",
    "poll_vote",
    "review_training",
  ]),
  payload: z.record(z.unknown()),
  requestId: z.string().uuid(),
});
interface Rpc {
  rpc(
    name: string,
    args?: Record<string, Json>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}
export const getBusinessWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as unknown as Rpc).rpc(
      "get_business_workspace",
    );
    if (error) throw new Error(error.message);
    return snapshot.parse(data) as BusinessSnapshot;
  });
export const mutateBusinessWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => mutation.parse(data))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await (context.supabase as unknown as Rpc).rpc(
      "mutate_business_workspace",
      { p_action: data.action, p_payload: data.payload as Json, p_request_id: data.requestId },
    );
    if (error) throw new Error(error.message);
    return z.object({ saved: z.literal(true), id: z.string().uuid() }).parse(result) as Json;
  });

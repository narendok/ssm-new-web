import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  customerChangeMutationSchema,
  customerChangeRequestSchema,
  customerChangeSnapshotSchema,
} from "./customer-change.schema";
import type { Json } from "@/integrations/supabase/types";

interface CustomerChangeRpc {
  rpc(
    name: "get_customer_change_requests" | "mutate_customer_change_request",
    args?: Record<string, Json>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

export const getCustomerChangeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ projectId: z.string().uuid().optional() }))
  .handler(async ({ context, data }) => {
    const args: Record<string, Json> = { p_project_id: data.projectId ?? null };
    const { data: result, error } = await (
      context.supabase as unknown as CustomerChangeRpc
    ).rpc("get_customer_change_requests", args);
    if (error) throw new Error(error.message);
    return customerChangeSnapshotSchema.parse(result);
  });

export const mutateCustomerChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(customerChangeMutationSchema)
  .handler(async ({ context, data }) => {
    const { data: result, error } = await (
      context.supabase as unknown as CustomerChangeRpc
    ).rpc("mutate_customer_change_request", {
      p_action: data.action,
      p_payload: data.payload as Json,
      p_operation_id: data.operationId,
    });
    if (error) throw new Error(error.message);
    return customerChangeRequestSchema.parse(result);
  });

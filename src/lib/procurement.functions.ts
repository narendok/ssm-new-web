import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { procurementDraftSchema, procurementDraftPayload } from "./procurement-draft";
import { sharedTestSnapshotSchema } from "./shared-test.schema";
import type { Json } from "@/integrations/supabase/types";

interface ProcurementRpc {
  rpc(
    name: string,
    args?: Record<string, Json>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}
export const createSharedProcurementDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(procurementDraftSchema.parse)
  .handler(async ({ context, data }) => {
    const client = context.supabase as unknown as ProcurementRpc;
    const snapshot = await client.rpc("get_shared_test_workspace");
    if (snapshot.error) throw new Error(snapshot.error.message);
    const payload = procurementDraftPayload(data, sharedTestSnapshotSchema.parse(snapshot.data));
    const result = await client.rpc("mutate_shared_test_workspace", {
      p_action: "create_record",
      p_payload: payload,
      p_request_id: data.requestId,
    });
    if (result.error) throw new Error(result.error.message);
    return result.data as Json;
  });

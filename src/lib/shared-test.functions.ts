import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  sharedTestMutationSchema,
  sharedTestResetSchema,
  sharedTestSnapshotSchema,
} from "./shared-test.schema";
import type { Json } from "@/integrations/supabase/types";

// Narrow bridge until generated Supabase types include the installed shared TEST RPCs.
interface SharedTestRpc {
  rpc(
    name: "get_shared_test_workspace" | "mutate_shared_test_workspace" | "reset_shared_test_sample_pack",
    args?: Record<string, Json>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}
export const getSharedTestWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as unknown as SharedTestRpc).rpc(
      "get_shared_test_workspace",
    );
    if (error) throw new Error(error.message);
    return sharedTestSnapshotSchema.parse(data);
  });
export const mutateSharedTestWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => sharedTestMutationSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await (context.supabase as unknown as SharedTestRpc).rpc(
      "mutate_shared_test_workspace",
      {
        p_action: data.action,
        p_payload: data.payload as Json,
        p_request_id: data.requestId,
      },
    );
    if (error) throw new Error(error.message);
    return result as Json;
  });

export const resetSharedTestSamplePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => sharedTestResetSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await (context.supabase as unknown as SharedTestRpc).rpc(
      "reset_shared_test_sample_pack",
      { p_run_id: data.runId, p_request_id: data.requestId },
    );
    if (error) throw new Error(error.message);
    return result as Json;
  });

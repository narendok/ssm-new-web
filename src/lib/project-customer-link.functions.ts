import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface ProjectCustomerLinkRpc {
  rpc(
    name: "set_shared_project_customer_link",
    args: {
      p_project_id: string;
      p_customer_id: string | null;
      p_expected_updated_at: string;
      p_request_id: string;
    },
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

const input = z.object({
  projectId: z.string().uuid(),
  customerId: z.string().uuid().nullable(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  requestId: z.string().uuid(),
});
const output = z.object({ projectId: z.string().uuid(), customerId: z.string().uuid().nullable() });

export const setSharedProjectCustomerLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => input.parse(data))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await (context.supabase as unknown as ProjectCustomerLinkRpc).rpc(
      "set_shared_project_customer_link",
      {
        p_project_id: data.projectId,
        p_customer_id: data.customerId,
        p_expected_updated_at: data.expectedUpdatedAt,
        p_request_id: data.requestId,
      },
    );
    if (error) throw new Error(error.message);
    return output.parse(result);
  });

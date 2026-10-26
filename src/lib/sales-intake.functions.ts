import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const payload = z.object({
  mode: z.enum(["enquiry", "opportunity", "convert", "dispatch"]),
  sourceId: z.string().uuid().optional(), expectedUpdatedAt: z.string().optional(),
  title: z.string().max(300).optional(), customerId: z.string().uuid().optional(),
  customerName: z.string().optional(), customerCode: z.string().optional(),
  spocName: z.string().optional(), spocEmail: z.string().optional(),
  scopeSummary: z.string().optional(), targetVolume: z.string().optional(), targetClosureDate: z.string().optional(),
  track: z.enum(["turnkey", "software", "firmware", "ready_made"]).optional(),
  dispatchFeasibility: z.boolean().optional(), feasibilityDepts: z.array(z.string()).optional(),
  parameterValues: z.record(z.string()).optional(),
});
export type SalesIntakePayload = z.infer<typeof payload>;
export const saveSalesIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({payload, requestId: z.string().uuid()}))
  .handler(async ({data, context}): Promise<{id: string; reference: string; sheetId: string; reviewCount: number}> => {
    const rpc = context.supabase as unknown as {rpc(name: string,args: Record<string,Json>): Promise<{data: Json;error: {message: string} | null}>};
    const result = await rpc.rpc("mutate_sales_intake", {p_payload: data.payload as Json,p_request_id: data.requestId});
    if (result.error) throw new Error(result.error.message);
    const parsed=z.object({id:z.string().uuid(),reference:z.string(),sheetId:z.string().uuid(),reviewCount:z.number().int()}).parse(result.data);
    return parsed;
  });

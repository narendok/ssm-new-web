import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { InputSheet } from "./project-inputs";
import type { Json } from "@/integrations/supabase/types";
export type InputEvent = {
  id: string;
  sheet_id: string;
  actor_name: string;
  action: string;
  revision: number;
  created_at: string;
  details: Record<string, Json>;
};
export type InputSnapshot = { sheets: InputSheet[]; events: InputEvent[] };
export const getProjectInputs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InputSnapshot> => {
    const rpc = context.supabase as unknown as {
      rpc(name: string): Promise<{ data: Json; error: { message: string } | null }>;
    };
    const { data, error } = await rpc.rpc("get_project_input_sheets");
    if (error) throw new Error(error.message);
    return data as unknown as InputSnapshot;
  });
const request = z.object({
  action: z.enum([
    "create",
    "input",
    "respond",
    "review_response",
    "approve",
    "revise",
    "client_evidence",
    "link_project",
    "assign_owner",
    "add_parameter",
  ]),
  payload: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});
export const mutateProjectInputs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(request)
  .handler(async ({ data, context }): Promise<InputSheet> => {
    const rpc = context.supabase as unknown as {
      rpc(
        name: string,
        args: { p_action: string; p_payload: Json },
      ): Promise<{ data: Json; error: { message: string } | null }>;
    };
    const result = await rpc.rpc("mutate_project_input_sheet", {
      p_action: data.action,
      p_payload: data.payload,
    });
    if (result.error) throw new Error(result.error.message);
    return result.data as unknown as InputSheet;
  });

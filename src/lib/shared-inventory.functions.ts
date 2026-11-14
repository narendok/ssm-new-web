import { createServerFn } from "@tanstack/react-start";
import type { Json } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  sharedInventoryEventInputSchema,
  sharedInventoryEventResultSchema,
  sharedInventoryPartCatalogSchema,
} from "./shared-inventory.schema";

interface SharedInventoryRpc {
  rpc(name: "get_shared_inventory_part_catalog"): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  rpc(name: "record_shared_inventory_event", args: { p_action: string; p_payload: Json }): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export const getSharedInventoryPartCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as unknown as SharedInventoryRpc).rpc(
      "get_shared_inventory_part_catalog",
    );
    if (error) throw new Error(error.message);
    return sharedInventoryPartCatalogSchema.parse(data);
  });

export const recordSharedInventoryEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(sharedInventoryEventInputSchema)
  .handler(async ({ data, context }) => {
    const { action, ...payload } = data;
    const { data: result, error } = await (context.supabase as unknown as SharedInventoryRpc).rpc(
      "record_shared_inventory_event",
      { p_action: action, p_payload: payload as Json },
    );
    if (error) throw new Error(error.message);
    return sharedInventoryEventResultSchema.parse(result);
  });

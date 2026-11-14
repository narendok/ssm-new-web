import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sharedInventoryPartCatalogSchema } from "./shared-inventory.schema";

interface SharedInventoryRpc {
  rpc(name: "get_shared_inventory_part_catalog"): Promise<{
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

import { z } from "zod";

export const sharedInventoryPartCatalogSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    reference: z.string(),
    title: z.string(),
    status: z.string(),
    mpn: z.string().nullable(),
    category: z.string().nullable(),
    subcategory: z.string().nullable(),
    primaryDepartment: z.string().nullable(),
    departmentViews: z.array(z.string()),
    sampleDataNotice: z.string().nullable(),
    isDemo: z.boolean(),
  })),
  stockLedgerAvailable: z.literal(false),
});

export type SharedInventoryPartMaster = z.infer<typeof sharedInventoryPartCatalogSchema>["items"][number];

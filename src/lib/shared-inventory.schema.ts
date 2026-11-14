import { z } from "zod";

const item = z.object({
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
  onHand: z.number(),
  held: z.number(),
  allocated: z.number(),
  available: z.number(),
  unit: z.string(),
  stockNotice: z.string(),
});

export const sharedInventoryPartCatalogSchema = z.object({
  items: z.array(item),
  stockLedgerAvailable: z.boolean(),
  projects: z.array(z.object({ id: z.string().uuid(), reference: z.string(), title: z.string() })),
  roles: z.array(z.object({
    id: z.string().uuid(), name: z.string(), departmentCode: z.string(),
    hierarchyLevel: z.number().int().min(1).max(4),
  })),
  receiptOptions: z.array(z.object({
    purchaseOrderId: z.string().uuid(), purchaseOrderReference: z.string(),
    supplierId: z.string().uuid(), supplierReference: z.string(), supplierName: z.string(),
    projectId: z.string().uuid(), projectReference: z.string(),
    partId: z.string().uuid(), partReference: z.string(),
    orderedQuantity: z.number(), receivedQuantity: z.number(), remainingQuantity: z.number(),
  })),
  assignments: z.array(z.object({
    id: z.string().uuid(),
    partId: z.string().uuid(),
    partReference: z.string(),
    partTitle: z.string(),
    projectId: z.string().uuid(),
    projectReference: z.string(),
    roleId: z.string().uuid(),
    roleName: z.string(),
    departmentCode: z.string(),
    hierarchyLevel: z.number().int().min(1).max(4),
    quantity: z.number(),
    assignedAt: z.string(),
    location: z.string(),
    bin: z.string(),
    note: z.string(),
  })),
  movements: z.array(z.object({
    id: z.string().uuid(),
    partId: z.string().uuid(),
    partReference: z.string(),
    eventKind: z.string(),
    onHandDelta: z.number(),
    heldDelta: z.number(),
    allocatedDelta: z.number(),
    location: z.string(),
    bin: z.string(),
    lotCode: z.string().nullable(),
    dateCode: z.string().nullable(),
    createdAt: z.string(),
    note: z.string(),
    isDemo: z.boolean(),
  })),
});

export type SharedInventoryPartMaster = z.infer<typeof sharedInventoryPartCatalogSchema>["items"][number];
export type SharedInventoryAssignment = z.infer<typeof sharedInventoryPartCatalogSchema>["assignments"][number];
export type SharedInventoryMovement = z.infer<typeof sharedInventoryPartCatalogSchema>["movements"][number];

const commonEvent = {
  requestId: z.string().uuid(),
  partId: z.string().uuid(),
  quantity: z.number().positive().max(1_000_000),
  location: z.string().trim().min(1).max(120),
  bin: z.string().trim().max(60).default(""),
  note: z.string().trim().min(3).max(500),
};

export const sharedInventoryEventInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign"), ...commonEvent,
    projectId: z.string().uuid(), roleId: z.string().uuid(), memberId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("return"), ...commonEvent,
    assignmentId: z.string().uuid(), disposition: z.enum(["usable", "scrap", "rejected", "unusable"]).default("usable"),
  }),
  z.object({ action: z.literal("consume"), ...commonEvent, assignmentId: z.string().uuid() }),
  z.object({
    action: z.literal("receipt"), ...commonEvent,
    purchaseOrderId: z.string().uuid(), supplierId: z.string().uuid(),
    lotCode: z.string().trim().max(120).optional(), dateCode: z.string().trim().max(80).optional(),
  }),
  z.object({ action: z.literal("hold"), ...commonEvent }),
  z.object({ action: z.literal("release_hold"), ...commonEvent }),
  z.object({ action: z.literal("adjustment"), ...commonEvent, direction: z.enum(["increase", "decrease"]) }),
]);

export const sharedInventoryEventResultSchema = z.object({
  eventId: z.string().uuid(),
  assignmentId: z.string().uuid().nullable(),
  idempotent: z.boolean(),
  action: z.string().optional(),
  partId: z.string().uuid().optional(),
  quantity: z.number().optional(),
});

export type SharedInventoryEventInput = z.infer<typeof sharedInventoryEventInputSchema>;

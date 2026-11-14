import { z } from "zod";
import type { SharedTestSnapshot } from "./shared-test.schema";
import { isSelectableMasterStatus } from "./shared-master-options";

export const procurementDraftSchema = z.object({
  kind: z.enum(["quotation", "order"]),
  requestId: z.string().uuid(),
  projectId: z.string().uuid(),
  supplierId: z.string().uuid(),
  sourceQuotationId: z.string().uuid().nullable(),
  sourceQuotationRevision: z.string().trim().min(1).max(40).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  requiredDate: z.string().date(),
  notes: z.string().max(8000),
  items: z
    .array(
      z.object({
        partId: z.string().uuid().nullable(),
        description: z.string().trim().min(1).max(500),
        quantity: z.number().finite().positive().max(1e9),
        unitPrice: z.number().finite().nonnegative().max(1e9),
      }),
    )
    .min(1)
    .max(100),
});
export type ProcurementDraft = z.infer<typeof procurementDraftSchema>;

export function procurementSupplierOptions<T extends { status: string }>(
  suppliers: readonly T[],
  kind: ProcurementDraft["kind"],
) {
  return suppliers.filter(
    (supplier) =>
      isSelectableMasterStatus(supplier.status) &&
      (kind === "quotation" || supplier.status === "approved"),
  );
}

export function quotationDraftValues(fields: Record<string, unknown>) {
  const items = procurementDraftSchema.shape.items.safeParse(fields["items"]);
  const currency = procurementDraftSchema.shape.currency.safeParse(fields["currency"]);
  if (!items.success || !currency.success)
    throw new Error(
      "This quotation has incomplete item or currency details. Review its source record before conversion.",
    );
  return { items: items.data, currency: currency.data };
}

/** Derive saved labels and estimates on the server from the current authorized masters. */
export function procurementDraftPayload(input: ProcurementDraft, snapshot: SharedTestSnapshot) {
  const draft = procurementDraftSchema.parse(input);
  const project = snapshot.records.find(
    (record) =>
      record.id === draft.projectId &&
      record.record_type === "Project" &&
      isSelectableMasterStatus(record.status),
  );
  const supplier = snapshot.supplierOptions.find(
    (option) => option.id === draft.supplierId && isSelectableMasterStatus(option.status),
  );
  const department = snapshot.departments.find((item) => item.code === "PUR");
  if (!project || !supplier || !department)
    throw new Error("Choose an available project and supplier from the current shared masters.");
  if (draft.kind === "order" && supplier.status !== "approved")
    throw new Error(
      "A purchase order draft requires an approved supplier. Pending suppliers can receive a quotation request first.",
    );
  const source = draft.sourceQuotationId
    ? snapshot.records.find(
        (record) =>
          record.id === draft.sourceQuotationId && record.record_type === "Supplier quotation",
      )
    : undefined;
  if (
    draft.sourceQuotationId &&
    (draft.kind !== "order" ||
      !source ||
      !["approved", "released"].includes(source.status) ||
      source.fields["supplierId"] !== supplier.id ||
      source.fields["projectId"] !== project.id ||
      !draft.sourceQuotationRevision ||
      String(source.fields["revision"] ?? "") !== draft.sourceQuotationRevision)
  ) {
    throw new Error(
      "The source quotation must still be approved at the selected revision and match this project and supplier. Refresh and select it again.",
    );
  }
  if (!draft.sourceQuotationId && draft.sourceQuotationRevision)
    throw new Error("A source quotation revision requires a selected quotation.");
  const items = draft.items.map((item) => {
    const part = item.partId
      ? snapshot.partOptions.find(
          (option) => option.id === item.partId && isSelectableMasterStatus(option.status),
        )
      : undefined;
    if (item.partId && !part)
      throw new Error("A selected part is no longer available. Refresh the master list.");
    return {
      ...item,
      partReference: part?.reference ?? "",
      partName: part?.title ?? "",
      lineAmount: Math.round(item.quantity * item.unitPrice * 100) / 100,
    };
  });
  const totalAmount = Math.round(items.reduce((sum, item) => sum + item.lineAmount, 0) * 100) / 100;
  if (!Number.isSafeInteger(Math.round(totalAmount * 100)))
    throw new Error("The total exceeds the supported amount.");
  const recordType = draft.kind === "order" ? "Purchase order" : "Supplier quotation";
  const code = draft.kind === "order" ? "PO" : "SQUO";
  const projectCode = project.reference.replace(/^HLPL-/, "");
  return {
    project_id: project.id,
    department_id: department.id,
    record_type: recordType,
    reference: `HLPL-${projectCode}-PUR-${code}-${draft.requestId.slice(0, 8).toUpperCase()}-01`,
    title: `${recordType} · ${supplier.title}`,
    notes: draft.notes,
    fields: {
      revision: "01",
      projectId: project.id,
      projectCode: project.reference,
      supplierId: supplier.id,
      supplierCode: supplier.reference,
      supplierName: supplier.title,
      currency: draft.currency,
      requiredDate: draft.requiredDate,
      items,
      totalAmount,
      sourceQuotationId: source?.id ?? "",
      sourceQuotationReference: source?.reference ?? "",
      sourceQuotationRevision: source ? String(source.fields["revision"] ?? "") : "",
      commercialState: "Draft",
    },
  };
}

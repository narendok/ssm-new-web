import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Plus, ShoppingCart } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { SharedMasterSelect } from "./SharedMasterSelect";
import { getSharedTestWorkspace } from "@/lib/shared-test.functions";
import { createSharedProcurementDraft } from "@/lib/procurement.functions";
import { getSharedDepartmentRoleConfiguration } from "@/lib/department-roles.functions";
import { memberHasDepartmentPermission } from "@/lib/shared-department-access";
import { isSelectableMasterStatus } from "@/lib/shared-master-options";
import type { TestMembership } from "@/lib/test-auth.functions";
import type { ProcurementDraft } from "@/lib/procurement-draft";
import { procurementSupplierOptions, quotationDraftValues } from "@/lib/procurement-draft";
import { businessDate } from "@/lib/business-date";

const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const value = (input: unknown) => (typeof input === "string" ? input : "");
type Line = { partId: string; description: string; quantity: string; unitPrice: string };
const emptyLine = (): Line => ({ partId: "", description: "", quantity: "1", unitPrice: "" });
export function SharedProcurementWorkspace({
  membership,
  view,
  onOpenRecords,
}: {
  membership: TestMembership;
  view: "orders" | "quotations";
  onOpenRecords: (type: string) => void;
}) {
  const load = useServerFn(getSharedTestWorkspace),
    write = useServerFn(createSharedProcurementDraft),
    loadRoles = useServerFn(getSharedDepartmentRoleConfiguration);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["shared-test-workspace", membership.organizationId, membership.membershipId],
    queryFn: () => load(),
    refetchInterval: 15000,
    retry: false,
  });
  const roles = useQuery({
    queryKey: [
      "shared-department-role-configuration",
      membership.organizationId,
      membership.membershipId,
    ],
    queryFn: () => loadRoles(),
    enabled: !membership.isClient,
    retry: false,
    refetchInterval: 30000,
  });
  const [search, setSearch] = useState(""),
    [scope, setScope] = useState("");
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState(""),
    [supplierId, setSupplierId] = useState(""),
    [quotationId, setQuotationId] = useState("");
  const [quotationRevision, setQuotationRevision] = useState("");
  const [currency, setCurrency] = useState("INR"),
    [requiredDate, setRequiredDate] = useState(businessDate()),
    [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const lock = useRef(false),
    retry = useRef<{ signature: string; id: string } | null>(null);
  const data = query.data;
  const projects =
    data?.records.filter(
      (record) => record.record_type === "Project" && isSelectableMasterStatus(record.status),
    ) ?? [];
  const suppliers = procurementSupplierOptions(
    data?.supplierOptions ?? [],
    view === "orders" ? "order" : "quotation",
  );
  const parts = data?.partOptions.filter((part) => isSelectableMasterStatus(part.status)) ?? [];
  const recordType = view === "orders" ? "Purchase order" : "Supplier quotation";
  const records = data?.records.filter((record) => record.record_type === recordType) ?? [];
  const quotations =
    data?.records.filter(
      (record) =>
        record.record_type === "Supplier quotation" &&
        ["approved", "released"].includes(record.status) &&
        record.fields["projectId"] === projectId &&
        record.fields["supplierId"] === supplierId,
    ) ?? [];
  const canCreate =
    !membership.isClient &&
    memberHasDepartmentPermission(
      data?.departments.find((department) => department.code === "PUR"),
      roles.data?.roles ?? [],
      membership.membershipId,
      membership.role,
      "records:create",
    );
  const filtered = records.filter(
    (record) =>
      (!scope || record.fields["projectId"] === scope) &&
      [
        record.reference,
        record.title,
        value(record.fields["supplierName"]),
        value(record.fields["projectCode"]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }
  function start() {
    setProjectId(scope);
    setSupplierId("");
    setQuotationId("");
    setQuotationRevision("");
    setCurrency("INR");
    setRequiredDate(businessDate());
    setLines([emptyLine()]);
    setNotes("");
    setError("");
    retry.current = null;
    setOpen(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !canCreate) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const draft = {
      kind: view === "orders" ? "order" : "quotation",
      projectId,
      supplierId,
      sourceQuotationId: quotationId || null,
      sourceQuotationRevision: quotationId ? quotationRevision : null,
      currency: currency.trim().toUpperCase(),
      requiredDate,
      notes,
      items: lines.map((line) => ({
        partId: line.partId || null,
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      })),
    } as Omit<ProcurementDraft, "requestId">;
    const signature = JSON.stringify(draft);
    if (retry.current?.signature !== signature)
      retry.current = { signature, id: crypto.randomUUID() };
    try {
      await write({ data: { ...draft, requestId: retry.current.id } });
      retry.current = null;
      setOpen(false);
      setNotice(
        `${recordType} draft saved to shared TEST. Review and approval are still required.`,
      );
      await cache.invalidateQueries({ queryKey: ["shared-test-workspace"] });
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Save failed. Your draft is preserved.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            {view === "orders" ? (
              <ShoppingCart className="size-5 text-primary" />
            ) : (
              <FileText className="size-5 text-primary" />
            )}
            {view === "orders" ? "Purchase Orders (POs)" : "Quotations & Vendor Pricing"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Shared TEST · {records.length} records
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenRecords(recordType)}>
            Reviews & documents
          </Button>
          {canCreate && (
            <Button size="sm" onClick={start}>
              <Plus className="mr-1 size-4" />
              New {view === "orders" ? "PO" : "quotation"} draft
            </Button>
          )}
        </div>
      </header>
      {notice && (
        <p role="status" className="text-xs text-primary">
          {notice}
        </p>
      )}
      {query.isPending ? (
        <p>Loading shared procurement records…</p>
      ) : query.isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 p-4">
          <p>Shared procurement records could not be loaded.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-2">
            <input
              className={field}
              aria-label="Search procurement records"
              placeholder="Search reference, supplier or project…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <SharedMasterSelect
              label="Procurement project filter"
              value={scope}
              onChange={setScope}
              options={projects.map((project) => ({
                value: project.id,
                label: `${project.reference} · ${project.title}`,
              }))}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-3">Reference / Project</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Draft estimate</th>
                  <th className="p-3">Required date</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((record) => {
                  const supplier = data?.supplierOptions.find(
                    (item) => item.id === record.fields["supplierId"],
                  );
                  const project = projects.find((item) => item.id === record.fields["projectId"]);
                  return (
                    <tr key={record.id}>
                      <td className="p-3">
                        <p className="font-mono">{record.reference}</p>
                        <p className="text-muted-foreground">
                          {project?.reference ||
                            value(record.fields["projectCode"]) ||
                            "Not linked"}
                        </p>
                      </td>
                      <td className="p-3">
                        {supplier?.title || value(record.fields["supplierName"]) || "Not linked"}
                      </td>
                      <td className="p-3">
                        {typeof record.fields["totalAmount"] === "number"
                          ? `${value(record.fields["currency"])} ${record.fields["totalAmount"].toLocaleString("en-IN")}`
                          : "Not recorded"}
                      </td>
                      <td className="p-3">
                        {value(record.fields["requiredDate"]) || "Not recorded"}
                      </td>
                      <td className="p-3">{record.status}</td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      {records.length
                        ? "No records match this filter."
                        : `No shared ${view === "orders" ? "purchase orders" : "supplier quotations"} are recorded.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>New {recordType.toLowerCase()} draft</DialogTitle>
            <DialogDescription>
              Save for review. This does not issue an order, commit funds or post stock.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={save}>
            <div className="grid gap-3 sm:grid-cols-2">
              <SharedMasterSelect
                required
                label="Project"
                value={projectId}
                onChange={(id) => {
                  setProjectId(id);
                  setQuotationId("");
                  setQuotationRevision("");
                }}
                options={projects.map((project) => ({
                  value: project.id,
                  label: `${project.reference} · ${project.title}`,
                }))}
              />
              <SharedMasterSelect
                required
                label="Supplier"
                value={supplierId}
                onChange={(id) => {
                  setSupplierId(id);
                  setQuotationId("");
                  setQuotationRevision("");
                }}
                options={suppliers.map((supplier) => ({
                  value: supplier.id,
                  label: `${supplier.reference} · ${supplier.title} · ${supplier.status}`,
                }))}
              />
            </div>
            {view === "orders" && (
              <SharedMasterSelect
                label="Approved source quotation (optional)"
                value={quotationId}
                onChange={(id) => {
                  if (!id) {
                    setQuotationId("");
                    setQuotationRevision("");
                    return;
                  }
                  const source = quotations.find((quote) => quote.id === id);
                  if (!source) return;
                  try {
                    const saved = quotationDraftValues(source.fields);
                    setLines(
                      saved.items.map((item) => ({
                        partId: item.partId || "",
                        description: item.description,
                        quantity: String(item.quantity),
                        unitPrice: String(item.unitPrice),
                      })),
                    );
                    setCurrency(saved.currency);
                    setQuotationId(id);
                    setQuotationRevision(String(source.fields["revision"] ?? ""));
                    setError("");
                  } catch (failure) {
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : "Quotation details could not be loaded.",
                    );
                  }
                }}
                options={quotations.map((quote) => ({
                  value: quote.id,
                  label: `${quote.reference} · ${quote.title}`,
                }))}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs">
                Currency
                <input
                  required
                  maxLength={3}
                  pattern="[A-Za-z]{3}"
                  className={field}
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                />
              </label>
              <label className="grid gap-1 text-xs">
                Required date
                <input
                  required
                  type="date"
                  className={field}
                  value={requiredDate}
                  onChange={(event) => setRequiredDate(event.target.value)}
                />
              </label>
            </div>
            <div className="space-y-3">
              {lines.map((line, index) => (
                <fieldset key={index} className="space-y-2 rounded-lg border border-border p-3">
                  <legend className="px-1 text-xs font-medium">Item {index + 1}</legend>
                  <SharedMasterSelect
                    label={`Part ${index + 1} (optional)`}
                    value={line.partId}
                    onChange={(id) => {
                      const part = parts.find((item) => item.id === id);
                      updateLine(index, {
                        partId: id,
                        ...(part ? { description: part.title } : {}),
                      });
                    }}
                    options={parts.map((part) => ({
                      value: part.id,
                      label: `${part.reference} · ${part.title}`,
                    }))}
                  />
                  <label className="grid gap-1 text-xs">
                    Item / service description
                    <input
                      required
                      maxLength={500}
                      className={field}
                      value={line.description}
                      onChange={(event) => updateLine(index, { description: event.target.value })}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1 text-xs">
                      Quantity
                      <input
                        required
                        type="number"
                        min="0.000001"
                        step="any"
                        className={field}
                        value={line.quantity}
                        onChange={(event) => updateLine(index, { quantity: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Unit price
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        className={field}
                        value={line.unitPrice}
                        onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                      />
                    </label>
                  </div>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                    >
                      Remove item
                    </Button>
                  )}
                </fieldset>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={lines.length >= 100}
              onClick={() => setLines((current) => [...current, emptyLine()])}
            >
              Add item
            </Button>
            <label className="grid gap-1 text-xs">
              Notes
              <textarea
                maxLength={8000}
                className={field}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button disabled={busy || !projectId || !supplierId}>
                {busy ? "Saving…" : "Save shared draft"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

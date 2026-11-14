import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building, Plus, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { InlineSupplierModal, type SupplierRecordItem } from "./InlineMasterModals";
import { getSharedTestWorkspace, mutateSharedTestWorkspace } from "@/lib/shared-test.functions";
import { sharedSupplierDirectory } from "@/lib/shared-supplier-directory";
import type { TestMembership } from "@/lib/test-auth.functions";
import { getSharedDepartmentRoleConfiguration } from "@/lib/department-roles.functions";
import { memberHasDepartmentPermission } from "@/lib/shared-department-access";

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : "Not recorded";
export function SharedSupplierDirectoryWorkspace({
  membership,
  onOpenDocument,
}: {
  membership: TestMembership;
  onOpenDocument: (documentId: string) => void;
}) {
  const load = useServerFn(getSharedTestWorkspace),
    write = useServerFn(mutateSharedTestWorkspace);
  const cache = useQueryClient();
  const loadRoles = useServerFn(getSharedDepartmentRoleConfiguration);
  const roleConfiguration = useQuery({
    queryKey: [
      "shared-department-role-configuration",
      membership.organizationId,
      membership.membershipId,
    ],
    queryFn: () => loadRoles(),
    enabled: !membership.isClient,
    refetchInterval: 30000,
    retry: false,
  });
  const query = useQuery({
    queryKey: ["shared-test-workspace", membership.organizationId, membership.membershipId],
    queryFn: () => load(),
    refetchInterval: 15000,
    retry: false,
  });
  const [search, setSearch] = useState(""),
    [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const saving = useRef(false);
  const suppliers = query.data ? sharedSupplierDirectory(query.data) : [];
  const selected = suppliers.find((supplier) => supplier.id === selectedId);
  const filtered = suppliers.filter((supplier) =>
    [
      supplier.title,
      supplier.reference,
      supplier.status,
      ...Object.values(supplier.fields).filter((value) => typeof value === "string"),
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  // Server permission checks remain authoritative, including delegated department roles.
  const canCreate =
    !membership.isClient &&
    memberHasDepartmentPermission(
      query.data?.departments.find((item) => item.code === "PUR"),
      roleConfiguration.data?.roles ?? [],
      membership.membershipId,
      membership.role,
      "records:create",
    );
  async function createSupplier(supplier: SupplierRecordItem) {
    if (!canCreate) throw new Error("Purchasing or Admin access is required.");
    if (saving.current) throw new Error("Supplier save is already in progress.");
    saving.current = true;
    try {
      const requestId = supplier.operationId || crypto.randomUUID();
      const department = query.data?.departments.find((item) => item.code === "PUR");
      if (!department) throw new Error("Purchasing department is unavailable.");
      const result = (await write({
        data: {
          action: "create_record",
          requestId,
          payload: {
            record_type: "Supplier",
            department_id: department.id,
            reference: `HLPL-SUP-${requestId.slice(0, 8).toUpperCase()}`,
            title: supplier.name,
            fields: {
              name: supplier.name,
              category: supplier.category,
              spocName: supplier.spocName,
              spocEmail: supplier.spocEmail,
              spocPhone: supplier.spocPhone,
              verification_status: "Pending_Verification",
              revision: "01",
            },
            notes: "Supplier registration · Pending Verification",
          },
        },
      })) as { id?: string } | null;
      if (!result?.id) throw new Error("The save did not return a canonical supplier ID.");
      setNotice(`${supplier.name} saved to the shared supplier master. Verification is pending.`);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["shared-test-workspace"] }),
        cache.invalidateQueries({ queryKey: ["business-workspace"] }),
        cache.invalidateQueries({ queryKey: ["expense-settings"] }),
      ]);
    } finally {
      saving.current = false;
    }
  }
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Building className="size-5 text-primary" />
            Approved Supplier List (ASL) & Vendor Governance
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Shared TEST supplier master · {suppliers.length} suppliers
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-4" />
            Add Supplier
          </Button>
        )}
      </header>
      {notice && (
        <p role="status" className="text-xs text-primary">
          {notice}
        </p>
      )}
      {query.isPending ? (
        <p>Loading shared suppliers…</p>
      ) : query.isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 p-4">
          <p>Shared supplier data could not be loaded.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <label className="flex items-center gap-2 border-b border-border p-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              aria-label="Search shared suppliers"
              placeholder="Search supplier, code or contact…"
              className="w-full bg-transparent text-sm outline-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Documents</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-secondary/25">
                    <td className="p-3">
                      <button
                        className="font-semibold text-primary hover:underline"
                        onClick={() => setSelectedId(supplier.id)}
                      >
                        {supplier.title}
                      </button>
                      <p className="mt-1 font-mono text-muted-foreground">{supplier.reference}</p>
                    </td>
                    <td className="p-3">{text(supplier.fields["category"])}</td>
                    <td className="p-3">
                      {text(supplier.fields["spocName"])}
                      <p className="text-muted-foreground">{text(supplier.fields["spocEmail"])}</p>
                    </td>
                    <td className="p-3">{supplier.status}</td>
                    <td className="p-3">{supplier.documents.length}</td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedId(supplier.id)}
                      >
                        Dossier
                      </Button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      {suppliers.length
                        ? "No suppliers match this search."
                        : "No authorized supplier records."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>
              {selected?.reference} · {selected?.status}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ["Category", "category"],
                  ["Contact", "spocName"],
                  ["Email", "spocEmail"],
                  ["Phone", "spocPhone"],
                  ["Warranty", "warrantyPeriod"],
                  ["IATF expiry", "iatfExpiryDate"],
                  ["ISO 9001 expiry", "iso9001ExpiryDate"],
                  ["Verification", "verification_status"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words">{text(selected.fields[key!])}</dd>
                  </div>
                ))}
              </dl>
              {!selected.hasDetails && (
                <p className="text-xs text-muted-foreground">
                  Your account can select this supplier; its detailed record is outside your current
                  access.
                </p>
              )}
              {selected.notes && <p className="whitespace-pre-wrap text-xs">{selected.notes}</p>}
              <section className="border-t border-border pt-3">
                <h2 className="mb-2 text-sm font-semibold">Controlled documents</h2>
                {selected.documents.length ? (
                  selected.documents.map((document) => (
                    <button
                      key={document.id}
                      className="block py-1 text-left text-xs text-primary underline"
                      onClick={() => onOpenDocument(document.id)}
                    >
                      {document.title} · {document.document_type}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No authorized documents linked to this supplier.
                  </p>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {createOpen && (
        <InlineSupplierModal
          onClose={() => setCreateOpen(false)}
          onSupplierCreated={createSupplier}
        />
      )}
    </section>
  );
}

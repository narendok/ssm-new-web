import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Building2, LoaderCircle, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSharedTestWorkspace, mutateSharedTestWorkspace } from "@/lib/shared-test.functions";
import { sharedCustomerDirectory } from "@/lib/shared-customer-directory";
import type { TestMembership } from "@/lib/test-auth.functions";

type CustomerDraft = { name: string; division: string; contact: string; email: string; phone: string; location: string; gstin: string };
const emptyDraft: CustomerDraft = { name: "", division: "", contact: "", email: "", phone: "", location: "", gstin: "" };

export function SharedCustomerDirectoryWorkspace({ membership, onBack }: { membership: TestMembership; onBack: () => void }) {
  const load = useServerFn(getSharedTestWorkspace);
  const write = useServerFn(mutateSharedTestWorkspace);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<CustomerDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["shared-customer-directory", membership.membershipId],
    queryFn: () => load(),
    refetchInterval: 15_000,
    retry: false,
  });
  const customers = useMemo(() => query.data ? sharedCustomerDirectory(query.data) : [], [query.data]);
  const filtered = customers.filter(customer => [customer.name, customer.code, customer.division, customer.spocName, customer.spocEmail, customer.gstin]
    .some(value => value.toLowerCase().includes(search.trim().toLowerCase())));
  const canCreate = !membership.isClient && (membership.role === "admin" || (membership.role === "department_lead" && membership.departmentCode === "SAL"));

  async function createCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate || busy || !draft.name.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    const requestId = crypto.randomUUID();
    const reference = `HLPL-CUS-${requestId.replace(/-/g, "").toUpperCase()}`;
    try {
      const result = await write({
        data: {
          action: "create_record",
          requestId,
          payload: {
            record_type: "Customer",
            reference,
            title: draft.name.trim(),
            fields: {
              revision: "01",
              name: draft.name.trim(),
              division: draft.division.trim(),
              spocName: draft.contact.trim(),
              spocEmail: draft.email.trim(),
              spocPhone: draft.phone.trim(),
              cityState: draft.location.trim(),
              gstin: draft.gstin.trim(),
            },
          },
        },
      }) as { id?: string } | null;
      if (!result?.id) throw new Error("The shared save did not return a canonical customer ID.");
      setDraft(emptyDraft);
      setCreateOpen(false);
      setNotice(`${reference} saved to the shared customer master.`);
      try {
        await query.refetch();
      } catch {
        setNotice(`${reference} saved to the shared customer master. Refresh the directory to load the latest entry.`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Customer save failed. Your entries are still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
      <div>
        <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-1 h-7 px-2 text-xs text-muted-foreground" onClick={onBack}><ArrowLeft className="mr-1 size-3.5"/>Back</Button>
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Building2 className="size-5 text-primary"/>Customer Master</h1>
        <p className="mt-1 text-xs text-muted-foreground">Shared TEST directory · IDs and names are reused by Sales, project and document workflows.</p>
      </div>
      {canCreate && <Button type="button" size="sm" onClick={() => { setError(""); setCreateOpen(true); }}><Plus className="mr-1 size-4"/>Add customer</Button>}
    </div>

    {notice && <p role="status" className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">{notice}</p>}
    {query.isLoading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/>Loading shared customer records…</div>
      : query.isError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><p className="font-medium">Shared customer data could not be loaded.</p><p className="mt-1 text-xs text-muted-foreground">No browser-local examples are shown as a fallback.</p><Button className="mt-3" type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button></div>
      : <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 p-3">
          <div className="text-xs font-medium">{customers.length} shared customer{customers.length === 1 ? "" : "s"}</div>
          <label className="relative"><Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground"/><input aria-label="Search shared customers" className="h-8 w-64 max-w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring" placeholder="Search customers…" value={search} onChange={event => setSearch(event.target.value)}/></label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-2.5">Customer</th><th className="px-4 py-2.5">Division</th><th className="px-4 py-2.5">Contact</th><th className="px-4 py-2.5">GSTIN</th><th className="px-4 py-2.5">Location</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Opportunities</th></tr></thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map(customer => <tr key={customer.id} className="hover:bg-muted/20"><td className="px-4 py-3"><div className="font-medium">{customer.name}</div><div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{customer.code}</div></td><td className="px-4 py-3">{customer.division || "—"}</td><td className="px-4 py-3">{customer.spocName || "—"}{customer.spocEmail && <div className="text-[10px] text-muted-foreground">{customer.spocEmail}</div>}</td><td className="px-4 py-3 font-mono">{customer.gstin || "—"}</td><td className="px-4 py-3">{customer.cityState || "—"}</td><td className="px-4 py-3">{customer.status}</td><td className="px-4 py-3 text-right">{customer.activeOpportunitiesCount}</td></tr>)}
              {!filtered.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{customers.length ? "No customers match this search." : "No customer records are available to this membership."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>}

    <Dialog open={createOpen} onOpenChange={open => { if (!busy) setCreateOpen(open); }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Add customer to shared master</DialogTitle><DialogDescription>The saved customer ID is reused by Sales and other authorized workflows. Enter only details you have verified.</DialogDescription></DialogHeader>
      <form className="space-y-3" onSubmit={createCustomer}>
        <label className="grid gap-1 text-xs font-medium">Customer name *<input autoFocus required maxLength={180} className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={draft.name} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))}/></label>
        <label className="grid gap-1 text-xs font-medium">Division / business unit<input maxLength={180} className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={draft.division} onChange={event => setDraft(value => ({ ...value, division: event.target.value }))}/></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium">Primary contact<input maxLength={160} className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={draft.contact} onChange={event => setDraft(value => ({ ...value, contact: event.target.value }))}/></label><label className="grid gap-1 text-xs font-medium">Contact email<input type="email" maxLength={254} className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={draft.email} onChange={event => setDraft(value => ({ ...value, email: event.target.value }))}/></label></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium">Phone<input maxLength={40} className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={draft.phone} onChange={event => setDraft(value => ({ ...value, phone: event.target.value }))}/></label><label className="grid gap-1 text-xs font-medium">City / State<input maxLength={120} className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={draft.location} onChange={event => setDraft(value => ({ ...value, location: event.target.value }))}/></label></div>
        <label className="grid gap-1 text-xs font-medium">GSTIN / tax reference<input maxLength={40} className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={draft.gstin} onChange={event => setDraft(value => ({ ...value, gstin: event.target.value }))}/></label>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-border pt-3"><Button type="button" variant="outline" disabled={busy} onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={busy || !draft.name.trim()}>{busy ? "Saving…" : "Save shared customer"}</Button></div>
      </form>
    </DialogContent></Dialog>
  </div>;
}

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTravelPolicy, saveTravelPolicy, type TravelPolicy, type TravelPolicySettings } from "@/lib/expense-settings.functions";
import { SharedMasterSelect } from "@/components/SharedMasterSelect";
import { Button } from "./ui/button";

export function TravelPolicySettings({
  departments,
  accountKey,
}: {
  accountKey: string;
  departments: { id: string; code: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [department, setDepartment] = useState("");
  const [message, setMessage] = useState("");
  const load = useServerFn(getTravelPolicy);
  const query = useQuery({
    queryKey: ["travel-policy", accountKey, department || null],
    queryFn: () => load({ data: { department: department || null } }),
    enabled: open,
  });
  useEffect(() => {
    if (!query.data || query.data.isAdmin || !query.data.ownDepartment || department) return;
    setDepartment(query.data.ownDepartment);
  }, [query.data, department]);
  const choices = useMemo(() => departments.filter((item) => item.code !== "CLIENT" && (query.data?.isAdmin || item.id === query.data?.ownDepartment)), [departments, query.data?.isAdmin, query.data?.ownDepartment]);

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Travel policy</h2>
        <p className="text-xs text-muted-foreground">Shared INR policy matrix. Admin publishes company rules; OPS leads can edit their own department limits within those caps.</p>
        </div>
        <Button variant="outline" onClick={() => setOpen((value) => !value)}>
          {open ? "Close policy" : "Configure travel policy"}
        </Button>
      </div>
      {open && (
        query.error ? <div role="alert" className="text-sm text-destructive">{query.error.message}</div> :
        !query.data ? <p className="text-sm text-muted-foreground">Loading shared policy…</p> :
        !query.data.canView ? <p className="text-sm text-muted-foreground">Travel policy settings are available to Admin and Operations leads.</p> : (
          <PolicyEditor
            key={`${department}:${query.data.companyVersion}:${query.data.departmentVersion}`}
            data={query.data}
            department={department}
            departments={choices}
            onDepartmentChange={setDepartment}
            onMessage={setMessage}
          />
        )
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
    </section>
  );
}

function PolicyEditor({
  data,
  department,
  departments,
  onDepartmentChange,
  onMessage,
}: {
  data: TravelPolicySettings;
  department: string;
  departments: { id: string; code: string; name: string }[];
  onDepartmentChange: (id: string) => void;
  onMessage: (message: string) => void;
}) {
  const policy = department ? data.departmentDraft ?? data.department ?? data.company : data.companyDraft ?? data.company;
  const [draft, setDraft] = useState<TravelPolicy>(policy);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveTravelPolicy);
  const cache = useQueryClient();
  const canManage = department ? data.canManageDepartment : data.canManageCompany;
  const isOpsScope = Boolean(department && !data.isAdmin);

  function updateBand(index: number, field: "hotelMetro" | "hotelOther" | "mealsPerDay" | "localPerDay", value: string) {
    const amount = value === "" ? 0 : Number(value);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) return;
    setDraft((current) => ({ ...current, bands: current.bands.map((band, i) => i === index ? { ...band, [field]: amount } : band) }));
  }

  async function submit(publish: boolean) {
    setBusy(true);
    onMessage("");
    try {
      if (publish && !draft.effectiveFrom) throw new Error("Choose an effective date before publishing.");
      await save({ data: {
        department: department || null,
        version: department ? data.departmentVersion : data.companyVersion,
        value: { ...draft, status: isOpsScope ? "Active" : "Draft" },
        publish,
      } });
      onMessage(isOpsScope ? "Department policy saved within the published company caps." : publish ? "Travel policy published to the shared workspace." : "Travel policy draft saved to the shared workspace.");
      await cache.invalidateQueries({ queryKey: ["travel-policy"] });
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not save travel policy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {data.isAdmin ? (
        <SharedMasterSelect
          label="Travel policy scope"
          value={department}
          onChange={onDepartmentChange}
          options={[
            { value: "", label: "Company policy" },
            ...departments.map(item => ({ value: item.id, label: `${item.code} · ${item.name} override` })),
          ]}
        />
      ) : (
        <p className="rounded border bg-muted/30 p-2 text-sm">
          Department scope · {departments.find(item => item.id === department)?.name || "Operations"}
        </p>
      )}
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        {policy.status === "Active" ? `Published policy${policy.effectiveFrom ? ` · effective ${policy.effectiveFrom}` : ""}.` : "Illustrative Indian-company sample · Draft only. Confirm city tiers and amounts with Finance before publishing; no legal or universal standard is implied."}
        {department && <span className="block mt-1">Department limits cannot exceed the company policy. OPS leads can edit their own department; Admin can manage any department.</span>}
        <span className="block mt-1 font-medium">When an Active policy is effective, the server checks the assigned employee band, itemized trip estimate, per-day caps and advance ceiling. Over-cap requests need a reason and Finance/Admin review before normal approvals continue.</span>
        {isOpsScope && <span className="block mt-1">Saving department limits publishes them immediately within the company ceiling; only Admin can publish the company policy.</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">Employee band</th><th className="p-2">Hotel / night · Metro</th><th className="p-2">Hotel / night · Other</th><th className="p-2">Meals / day</th><th className="p-2">Local travel / day</th></tr></thead>
          <tbody>{draft.bands.map((band, index) => <tr className="border-b" key={band.id}>
            <th className="p-2 text-left font-medium">{band.label}</th>
            {(["hotelMetro", "hotelOther", "mealsPerDay", "localPerDay"] as const).map((field) => <td className="p-2" key={field}>
              <label className="sr-only" htmlFor={`${band.id}-${field}`}>{band.label} {field}</label>
              <div className="flex items-center gap-1"><span>₹</span><input id={`${band.id}-${field}`} aria-label={`${band.label} ${field}`} type="number" min="0" max="1000000" step="100" className="w-28 rounded border bg-background p-2" disabled={!canManage} value={band[field]} onChange={(event) => updateBand(index, field, event.target.value)} /></div>
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Advance ceiling (% of approved estimate)<input aria-label="Advance ceiling percent" type="number" min="0" max="100" className="rounded border bg-background p-2" value={draft.advancePercent} disabled={!canManage} onChange={(event) => setDraft((current) => ({ ...current, advancePercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)) }))} /></label>
        <label className="flex items-center gap-2 self-end rounded border p-2 text-sm"><input aria-label="One unsettled advance per requester" type="checkbox" checked={department ? data.company.oneOpenAdvance : draft.oneOpenAdvance} disabled={!canManage || Boolean(department)} onChange={(event) => setDraft((current) => ({ ...current, oneOpenAdvance: event.target.checked }))} />One unsettled advance per requester</label>
      </div>
      {data.isAdmin && <label className="grid max-w-xs gap-1 text-sm">Effective from<input aria-label="Policy effective date" type="date" className="rounded border bg-background p-2" value={draft.effectiveFrom ?? ""} disabled={!canManage} onChange={(event) => setDraft((current) => ({ ...current, effectiveFrom: event.target.value || null }))} /></label>}
      <p className="text-xs text-muted-foreground">An Active policy applies to new requests whose travel date is on or after its effective date. Existing requests and cash/budget balances are not changed. Approved locations come from the shared accounting catalogue.</p>
      {canManage ? <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void submit(false)}>{busy ? "Saving…" : isOpsScope ? "Save department limits" : "Save draft"}</Button>
        {data.isAdmin && <Button disabled={busy} onClick={() => void submit(true)}>{busy ? "Saving…" : department ? "Publish department limits" : "Publish company policy"}</Button>}
      </div> : <p className="text-sm text-muted-foreground">This role can view the policy but cannot change it.</p>}
    </div>
  );
}

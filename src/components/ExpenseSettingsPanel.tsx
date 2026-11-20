import { Fragment, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getExpenseCatalogue,
  saveExpenseCatalogue,
  manageExpenseLocation,
  reviewExpenseLocation,
  type ExpenseCatalogue,
} from "@/lib/expense-settings.functions";
import { Button } from "./ui/button";
import { SharedMasterSelect } from "./SharedMasterSelect";
import { parseExpenseServices } from "@/lib/expense-service-editor";
import { TravelPolicySettings } from "./TravelPolicySettings";

type ServiceOption = ExpenseCatalogue["services"][number];
const line = (service: ServiceOption) =>
  [service.name, service.category, service.provider, service.cycle, service.owner].join(" | ");

export function ExpenseSettingsPanel({
  departments,
  accountKey,
  canViewTravelPolicy,
}: {
  accountKey: string;
  departments: { id: string; code: string; name: string }[];
  canViewTravelPolicy: boolean;
}) {
  const [scope, setScope] = useState("");
  const [open, setOpen] = useState(false);
  const load = useServerFn(getExpenseCatalogue);
  const query = useQuery({
    queryKey: ["expense-settings", accountKey, scope],
    queryFn: () => load({ data: { department: scope || null } }),
    enabled: open,
  });
  return (
    <Fragment>
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Expense settings</h2>
          <p className="text-xs text-muted-foreground">
            Finance controls request categories; department leads maintain their service catalogue.
          </p>
        </div>
        <Button variant="outline" onClick={() => setOpen(!open)}>
          {open ? "Close settings" : "Configure expenses"}
        </Button>
      </div>
      {open && (
        <>
          <div className="grid gap-1 text-sm">
            <span>Settings scope</span>
            <SharedMasterSelect
              label="expense settings scope"
              value={scope}
              onChange={setScope}
              options={[
                { value: "", label: "Company defaults" },
                ...departments
                  .filter((department) => department.code !== "CLIENT")
                  .map((department) => ({ value: department.id, label: department.name })),
              ]}
            />
          </div>
          {query.error ? (
            <p role="alert">{query.error.message}</p>
          ) : query.data ? (
            <Editor key={`${scope}:${query.data.version}`} scope={scope} data={query.data} />
          ) : (
            <p>Loading settings…</p>
          )}
        </>
      )}
    </section>
    {canViewTravelPolicy && <TravelPolicySettings accountKey={accountKey} departments={departments} />}
    </Fragment>
  );
}

function Editor({ scope, data }: { scope: string; data: ExpenseCatalogue }) {
  const [tab, setTab] = useState<"categories" | "services" | "locations">("categories");
  const [categories, setCategories] = useState(data.categories.join("\n"));
  const [services, setServices] = useState(data.services.map(line).join("\n"));
  const [supplierByService, setSupplierByService] = useState<Record<string, string>>(
    () => Object.fromEntries(data.services.filter(service => service.supplierId).map(service => [service.id, service.supplierId!])),
  );
  const [ops, setOps] = useState(data.operationsEnabled);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveExpenseCatalogue),
    cache = useQueryClient();
  async function submit(kind: "categories" | "services") {
    setBusy(true);
    setMessage("");
    try {
      const serviceValues = parseExpenseServices(services, data.services).map(service => {
        const supplierId = supplierByService[service.id] ?? data.services.find(existing => existing.id === service.id)?.supplierId;
        const supplier = supplierId ? data.suppliers.find(option => option.id === supplierId) : undefined;
        return { ...service, provider: supplier?.title ?? service.provider, ...(supplierId ? { supplierId } : {}) };
      });
      if (
        kind === "services" &&
        (serviceValues.some((s) => !s.name || !s.category) ||
          new Set(serviceValues.map((s) => s.id)).size !== serviceValues.length)
      )
        throw new Error("Each service needs a unique name and category.");
      await save({
        data: {
          department: scope || null,
          version: data.version,
          value: {
            categories: categories
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            purposes: data.purposes,
            operationsEnabled: ops,
            services: kind === "services" ? serviceValues : data.services,
          },
        },
      });
      setMessage(
        kind === "services"
          ? "Department services saved to shared TEST."
          : "Finance categories saved to shared TEST.",
      );
      await cache.invalidateQueries({ queryKey: ["expense-settings"] });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={tab === "categories" ? "default" : "outline"}
          onClick={() => setTab("categories")}
        >
          Finance categories
        </Button>
        <Button
          type="button"
          variant={tab === "services" ? "default" : "outline"}
          onClick={() => setTab("services")}
        >
          Services
        </Button>
        {(data.canManageLocations||data.canReviewLocations)&&<Button type="button" variant={tab==="locations"?"default":"outline"} onClick={()=>setTab("locations")}>Locations</Button>}
      </div>
      {tab === "categories" ? (
        <>
          <p className="text-xs text-muted-foreground">
            One Finance category is chosen per request. Existing requests keep their saved values.
            These defaults do not set approval limits or tax treatment.
          </p>
          <label className="grid gap-1 text-sm">
            Finance categories
            <textarea
              aria-label="Finance categories"
              disabled={!data.canManage}
              className="min-h-64 rounded border bg-background p-3 text-sm"
              value={categories}
              onChange={(e) => setCategories(e.target.value)}
            />
          </label>
          {!scope && data.isAdmin && (
            <label className="flex gap-2 text-sm">
              <input type="checkbox" checked={ops} onChange={(e) => setOps(e.target.checked)} />
              Allow Operations (OPS/HROPS) department leads to manage expense options
            </label>
          )}
          {data.canManage ? (
            <Button disabled={busy} onClick={() => void submit("categories")}>
              {busy ? "Saving…" : "Save categories"}
            </Button>
          ) : (
            <p className="text-xs">
              Finance/Admin manage these options. Operations access can be enabled by Admin.
            </p>
          )}
        </>
      ) : tab==="services" ? (
        <>
          <p className="text-xs text-muted-foreground">
            One service per line: name | finance category | provider | billing cycle | responsible
            owner. Link each service to the canonical Supplier master when a supplier is known;
            linked supplier names are refreshed from that record. Department leads manage only
            their own department. Company defaults are Admin-managed.
          </p>
          <label className="grid gap-1 text-sm">
            Services
            <textarea
              aria-label="Department services"
              disabled={!data.canManageServices}
              className="min-h-64 rounded border bg-background p-3 text-sm font-mono"
              value={services}
              onChange={(e) => setServices(e.target.value)}
              placeholder="GitHub subscription | Software & Subscriptions | GitHub | Monthly | Software lead"
            />
          </label>
          {parseExpenseServices(services, data.services).map(service => (
            <div key={service.id} className="grid gap-1 text-xs">
              <span className="font-medium">Supplier for {service.name}</span>
              <SharedMasterSelect
                label={`Supplier for ${service.name}`}
                value={supplierByService[service.id] ?? data.services.find(existing => existing.id === service.id)?.supplierId ?? ""}
                options={data.suppliers.map(supplier => ({ value: supplier.id, label: `${supplier.reference} · ${supplier.title} · ${supplier.status}` }))}
                onChange={value => setSupplierByService(current => ({ ...current, [service.id]: value }))}
              />
            </div>
          ))}
          {data.canManageServices ? (
            <Button disabled={busy} onClick={() => void submit("services")}>
              {busy ? "Saving…" : "Save services"}
            </Button>
          ) : (
            <p className="text-xs">
              Admin or the selected department lead can manage this catalogue.
            </p>
          )}
        </>
      ) : (
        <ExpenseLocationSettings data={data} onChanged={()=>void cache.invalidateQueries({queryKey:["expense-settings"]})}/>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}

function ExpenseLocationSettings({data,onChanged}:{data:ExpenseCatalogue;onChanged:()=>void}) {
  const manage=useServerFn(manageExpenseLocation),review=useServerFn(reviewExpenseLocation);
  const [name,setName]=useState(""),[city,setCity]=useState(""),[tier,setTier]=useState<"metro"|"other">("other"),[reason,setReason]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  async function addLocation(){setBusy(true);setMessage("");try{await manage({data:{id:null,name:name.trim(),city:city.trim(),cityTier:tier,active:true}});setMessage("Approved location saved to the shared catalogue.");setName("");setCity("");onChanged();}catch(error){setMessage(error instanceof Error?error.message:"Could not save location.");}finally{setBusy(false);}}
  async function decide(id:string,outcome:"approve"|"reject",locationTier?:"metro"|"other") {setBusy(true);setMessage("");try{await review({data:{id,outcome,...(outcome==="approve"?{cityTier:locationTier}:{reason:reason.trim()})}});setMessage(outcome==="approve"?"Location approved and added to the shared catalogue.":"Location request rejected.");setReason("");onChanged();}catch(error){setMessage(error instanceof Error?error.message:"Could not review location request.");}finally{setBusy(false);}}
  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">These organization-scoped locations feed travel requests in Web and Android. New locations stay unavailable until approved; city tier is assigned by Admin/Finance during approval.</p>
    {data.canManageLocations&&<div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
      <input className="rounded border bg-background px-2 py-1.5 text-sm" aria-label="Location name" placeholder="Location / facility" value={name} onChange={event=>setName(event.target.value)}/>
      <input className="rounded border bg-background px-2 py-1.5 text-sm" aria-label="Location city" placeholder="City" value={city} onChange={event=>setCity(event.target.value)}/>
      <div className="flex items-center gap-1" role="group" aria-label="City tier">
        {([{ value: "metro", label: "Metro" }, { value: "other", label: "Other city" }] as const).map(option => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={tier === option.value ? "default" : "outline"}
            aria-pressed={tier === option.value}
            onClick={() => setTier(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <Button type="button" disabled={busy||name.trim().length<2||city.trim().length<2} onClick={()=>void addLocation()}>{busy?"Saving…":"Add location"}</Button>
    </div>}
    <div className="space-y-2">{data.locations.length?data.locations.map(location=><div key={location.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm"><span><strong>{location.reference} · {location.name}</strong><span className="text-muted-foreground"> · {location.city} · {location.cityTier==="metro"?"Metro":"Other city"}</span></span></div>):<p className="text-sm">No approved locations are configured.</p>}</div>
    {data.canReviewLocations&&<div className="space-y-2"><h3 className="text-sm font-medium">Location requests awaiting review</h3>{data.locationRequests.length?data.locationRequests.map(request=><div key={request.id} className="space-y-2 rounded-lg border p-3 text-sm"><p><strong>{request.name} · {request.city}</strong><span className="text-muted-foreground"> · requested by {request.requesterName||"workspace member"}</span></p><p>{request.reason}</p><div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={busy} variant="outline" onClick={()=>void decide(request.id,"approve","metro")}>Approve · Metro</Button><Button type="button" size="sm" disabled={busy} variant="outline" onClick={()=>void decide(request.id,"approve","other")}>Approve · Other city</Button><Button type="button" size="sm" disabled={busy||reason.trim().length<3} variant="destructive" onClick={()=>void decide(request.id,"reject")}>Reject</Button></div></div>):<p className="text-sm text-muted-foreground">No pending requests.</p>}<input className="w-full rounded border bg-background px-2 py-1.5 text-sm" aria-label="Location rejection reason" placeholder="Reason required when rejecting" value={reason} onChange={event=>setReason(event.target.value)}/></div>}
    {message&&<p role="status" className="text-sm">{message}</p>}
  </div>;
}

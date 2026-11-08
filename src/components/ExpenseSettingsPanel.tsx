import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getExpenseCatalogue,
  saveExpenseCatalogue,
  type ExpenseCatalogue,
} from "@/lib/expense-settings.functions";
import { Button } from "./ui/button";

type ServiceOption = ExpenseCatalogue["services"][number];
const line = (service: ServiceOption) =>
  [service.name, service.category, service.provider, service.cycle, service.owner].join(" | ");
function parseServices(value: string): ServiceOption[] {
  return value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const parts = row.split("|").map((part) => part.trim());
      const name = parts[0] || "";
      const category = parts[1] || "";
      const provider = parts[2] || "";
      const cycle = parts[3] || "Annual";
      const owner = parts[4] || "Requesting department lead";
      return {
        id: name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80),
        name,
        category,
        provider,
        cycle,
        owner,
      };
    });
}

export function ExpenseSettingsPanel({
  departments,
  accountKey,
}: {
  accountKey: string;
  departments: { id: string; code: string; name: string }[];
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
          <label className="grid gap-1 text-sm">
            Settings scope
            <select
              className="rounded border bg-background p-2"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="">Company defaults</option>
              {departments
                .filter((d) => d.code !== "CLIENT")
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </label>
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
  );
}

function Editor({ scope, data }: { scope: string; data: ExpenseCatalogue }) {
  const [tab, setTab] = useState<"categories" | "services">("categories");
  const [categories, setCategories] = useState(data.categories.join("\n"));
  const [services, setServices] = useState(data.services.map(line).join("\n"));
  const [ops, setOps] = useState(data.operationsEnabled);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveExpenseCatalogue),
    cache = useQueryClient();
  async function submit(kind: "categories" | "services") {
    setBusy(true);
    setMessage("");
    try {
      const serviceValues = parseServices(services);
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
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            One service per line: name | finance category | provider | billing cycle | responsible
            owner. Department leads manage only their own department. Company defaults are
            Admin-managed.
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
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}

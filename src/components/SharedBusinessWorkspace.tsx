import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getBusinessWorkspace,
  mutateBusinessWorkspace,
  type BusinessItem,
  type BusinessAction,
} from "@/lib/business-workspace.functions";
import type { TestMembership } from "@/lib/test-auth.functions";
import { businessDate } from "@/lib/business-date";
import { User, ShieldCheck, GraduationCap, ClipboardList, Wallet, Receipt } from "lucide-react";
import { budgetSummaries, personalAssignments } from "@/lib/business-presentation";

type Question = { id: string; label: string; type: string; required: boolean; options?: string[] };
const input = "rounded-md border border-input bg-background px-2 py-1.5 text-sm w-full";
const card = "rounded-xl border border-border/70 bg-card p-4 shadow-xs";
const str = (v: unknown) => (typeof v === "string" ? v : "");
const money = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-IN") : "—");
export function SharedBusinessWorkspace({
  view,
  membership,
}: {
  view: string;
  membership: TestMembership;
}) {
  const load = useServerFn(getBusinessWorkspace),
    write = useServerFn(mutateBusinessWorkspace);
  const query = useQuery({
    queryKey: ["business-workspace", membership.organizationId, membership.membershipId],
    queryFn: () => load(),
    refetchInterval: 15000,
    retry: 1,
  });
  const [action, setAction] = useState<BusinessAction | null>(null),
    [target, setTarget] = useState<BusinessItem | null>(null),
    [values, setValues] = useState<Record<string, string>>({}),
    [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [audience, setAudience] = useState<string[]>([]),
    [questions, setQuestions] = useState<Question[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [channel, setChannel] = useState("");
  const pending = useRef<{ signature: string; id: string } | null>(null);
  const [profileTab, setProfileTab] = useState("details");
  const [budgetTab, setBudgetTab] = useState("requests");
  const lock = useRef(false);
  async function save(
    kind: BusinessAction,
    item: BusinessItem | null,
    data: Record<string, unknown>,
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const payload = { ...(item ? { id: item.id, version: item.version } : {}), data };
    const signature = JSON.stringify([kind, payload]);
    if (pending.current?.signature !== signature)
      pending.current = { signature, id: crypto.randomUUID() };
    try {
      await write({ data: { action: kind, payload, requestId: pending.current.id } });
      pending.current = null;
      setNotice("Saved to your shared workspace.");
      setAction(null);
      await query.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed. Your form is preserved.");
      void query.refetch();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  function open(
    kind: BusinessAction,
    item: BusinessItem | null = null,
    defaults: Record<string, string> = {},
  ) {
    setAction(kind);
    setTarget(item);
    setValues(defaults);
    setQuestions([]);
    setAudience([]);
    setAnswers({});
    setError("");
  }
  const data = query.data;
  if (query.isPending) return <div className={card}>Loading shared records…</div>;
  if (query.error || !data)
    return (
      <section className={card}>
        <h1 className="text-lg font-semibold">Shared workspace unavailable</h1>
        <p role="alert" className="text-sm text-destructive mt-2">
          {query.error instanceof Error ? query.error.message : "No data returned"}
        </p>
        <p className="text-sm text-muted-foreground my-3">
          This module requires the business-workspace migration on the configured backend. No
          sandbox data is substituted.
        </p>
        <Button onClick={() => void query.refetch()}>Retry</Button>
      </section>
    );
  if (data.membership.role === "viewer" && view !== "tickets")
    return (
      <section className={card}>
        <h1 className="text-lg font-semibold">Access restricted</h1>
        <p className="text-sm text-muted-foreground">
          This workspace is available to internal employees only.
        </p>
      </section>
    );
  const actor = data.membership,
    admin = actor.role === "admin",
    lead = actor.role === "department_lead",
    fin = admin || (lead && actor.department_code === "FIN"),
    hr = admin || (lead && ["HR", "HROPS"].includes(actor.department_code || "")),
    service = admin || actor.department_code === "SIT";
  const items = data.items,
    deptName = (id: string | null) => data.departments.find((d) => d.id === id)?.code || "—";
  const by = (kind: string) => items.filter((i) => i.kind === kind);
  const filter = (rows: BusinessItem[]) =>
    rows.filter((i) => JSON.stringify(i.data).toLowerCase().includes(search.toLowerCase()));
  const own = items.find((i) => i.kind === "profile" && i.ownerId === actor.membership_id);
  const assignmentTemplate =
    target?.kind === "assignment"
      ? items.find((i) => i.id === target.data["templateId"])
      : undefined;
  const title: Record<string, string> = {
    budgets: "Budgets & Expenses",
    tickets: "Tickets",
    profile: "My Profile",
    hr_admin: "HR",
    communication: "Team Chat",
  };
  function field(name: string, label: string, type = "text", required = true) {
    return (
      <label className="grid gap-1 text-xs" key={name}>
        {label}
        <input
          className={input}
          type={type}
          required={required}
          value={values[name] || ""}
          onChange={(e) => setValues({ ...values, [name]: e.target.value })}
        />
      </label>
    );
  }
  function select(
    name: string,
    label: string,
    options: { value: string; label: string }[],
    required = false,
  ) {
    return (
      <label className="grid gap-1 text-xs">
        {label}
        <select
          className={input}
          required={required}
          value={values[name] || ""}
          onChange={(e) => setValues({ ...values, [name]: e.target.value })}
        >
          <option value="">{required ? "Choose…" : "None / department work"}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!action) return;
    let payload: Record<string, unknown> = { ...values };
    if (action === "send_message")
      payload = {
        ...payload,
        tags: (values["tags"] || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
    if (action === "allocate")
      payload = {
        ...payload,
        allocatedAmount: Number(values["allocatedAmount"]),
        financeLimit: values["financeLimit"] ? Number(values["financeLimit"]) : null,
      };
    if (action === "request_expense") payload = { ...payload, amount: Number(values["amount"]) };
    if (action === "post_expense")
      payload = { ...payload, actualAmount: Number(values["actualAmount"]) };
    if (action === "publish_template")
      payload = {
        ...payload,
        audienceIds: audience,
        questions,
        isAnonymous: values["isAnonymous"] === "yes",
        cadenceDays: Number(values["cadenceDays"] || 0),
        dueDate: values["dueDate"],
      };
    if (action === "submit_assignment")
      payload = { answers, acknowledged: values["acknowledged"] === "yes" };
    if (action === "channel_create")
      payload = { ...payload, memberIds: Array.from(new Set([...audience, actor.membership_id])) };
    if (action === "ticket_reply")
      payload = { ...payload, isInternalNote: values["isInternalNote"] === "yes" };
    if (action === "send_message" && values["pollOptions"])
      payload = {
        ...payload,
        poll: {
          question: values["pollQuestion"],
          options: values["pollOptions"]
            .split(/[|\n]/)
            .map((x) => x.trim())
            .filter(Boolean),
          closesAt: new Date(values["closesAt"]!).toISOString(),
        },
      };
    void save(action, target, payload);
  }
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{title[view] || "Workspace"}</h1>
          <p className="text-xs text-muted-foreground">
            {actor.display_name}{" "}
            <span
              className="rounded border border-border px-1 ml-1"
              title="Authenticated shared records"
            >
              TEST
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {view === "budgets" && actor.role !== "viewer" && (
            <Button
              size="sm"
              onClick={() =>
                open("request_expense", null, { currency: "INR", requiredDate: businessDate() })
              }
            >
              New request
            </Button>
          )}
          {view === "budgets" && fin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => open("allocate", null, { currency: "INR", startDate: businessDate() })}
            >
              Add allocation
            </Button>
          )}
          {view === "tickets" && (
            <Button
              size="sm"
              onClick={() =>
                open("ticket_create", null, { priority: "Normal", category: "General" })
              }
            >
              New ticket
            </Button>
          )}
          {view === "hr_admin" && hr && (
            <Button
              size="sm"
              onClick={() =>
                open("publish_template", null, {
                  type: "form",
                  dueDate: businessDate(),
                  cadenceDays: "0",
                })
              }
            >
              Create policy / training / form
            </Button>
          )}
          {view === "communication" && (admin || lead) && (
            <Button size="sm" onClick={() => open("channel_create")}>
              New channel
            </Button>
          )}
        </div>
      </header>
      {!["profile", "budgets"].includes(view) && data.notifications.length > 0 && (
        <details className="rounded-lg border border-border/60 px-3 py-2 text-xs">
          <summary className="cursor-pointer">Recent updates ({data.notifications.length})</summary>
          <ul className="mt-2 space-y-1">
            {data.notifications.slice(0, 8).map((n) => (
              <li key={`${n.itemId}:${n.event}`}>
                {n.kind} · {n.itemId.slice(0, 8)} · {new Date(n.at).toLocaleString("en-IN")}
              </li>
            ))}
          </ul>
        </details>
      )}
      {notice && (
        <p
          role="status"
          className="rounded border border-emerald-500/30 p-2 text-sm text-emerald-700 dark:text-emerald-400"
        >
          {notice}
        </p>
      )}
      {error && !action && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {view !== "profile" && <input
        className={`${input} max-w-sm`}
        aria-label="Search this workspace"
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />}
      {view === "budgets" && (
        <>
          {budgetSummaries(items).map(summary => <section key={summary.currency} aria-label={`Budget summary ${summary.currency}`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[["Allocated", summary.allocated], ["Committed", summary.committed], ["Spent", summary.spent], ["Available", summary.available]].map(([label, value]) => <article key={String(label)} className={`${card} border-l-4 ${label === "Available" ? "border-l-emerald-500" : label === "Committed" ? "border-l-amber-500" : "border-l-primary/60"}`}><p className="text-xs text-muted-foreground">{String(label)}</p><p className="mt-1 text-lg font-semibold">{summary.currency} {money(value)}</p></article>)}
          </section>)}
          <nav aria-label="Budget sections" className="flex gap-1 rounded-lg border border-border/50 bg-muted p-1">
            {[["requests", "Expense Requests", Receipt], ["allocations", "Budget Allocations", Wallet]].map(([key, label, Icon]) => {
              const Symbol = Icon as typeof Wallet;
              return <button key={String(key)} type="button" aria-pressed={budgetTab === key} onClick={() => setBudgetTab(String(key))} className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${budgetTab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><Symbol className="size-4" />{String(label)}</button>;
            })}
          </nav>
          <div hidden={budgetTab !== "allocations"}>
          <section className="grid gap-3 md:grid-cols-3">
            {by("allocation").map((i) => (
              <article key={i.id} className={card}>
                <h2 className="text-sm font-semibold">
                  {deptName(i.departmentId)} · {str(i.data["category"])}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {str(i.data["periodId"])} · {str(i.data["currency"])}
                </p>
                <dl className="grid grid-cols-2 gap-2 text-xs mt-3">
                  {[
                    ["Allocated", i.data["allocatedAmount"]],
                    ["Committed", i.data["committedAmount"]],
                    ["Spent", i.data["spentAmount"]],
                    [
                      "Available",
                      Number(i.data["allocatedAmount"]) -
                        Number(i.data["committedAmount"]) -
                        Number(i.data["spentAmount"]),
                    ],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-muted-foreground">{String(label)}</dt>
                      <dd>{money(value)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </section>
          {!by("allocation").length && <p className="text-sm text-muted-foreground">No permitted budget allocations.</p>}
          </div>
          <div hidden={budgetTab !== "requests"}>
          <section className="space-y-2">
            {filter(by("expense")).map((i) => (
              <article
                key={i.id}
                className={`${card} flex flex-wrap items-center justify-between gap-3`}
              >
                <div>
                  <p className="font-mono text-xs text-primary">EXP-{i.id.slice(0, 8)}</p>
                  <h2 className="text-sm font-medium">{str(i.data["purpose"])}</h2>
                  <p className="text-xs text-muted-foreground">
                    {str(i.data["requesterName"])} · {deptName(i.departmentId)} ·{" "}
                    {str(i.data["category"])} · {str(i.data["currency"])} {money(i.data["amount"])}
                  </p>
                  <p className="mt-2 inline-flex rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium">{str(i.data["status"]).replaceAll("_", " ")}</p>
                </div>
                <div className="flex gap-2">
                  {i.ownerId !== actor.membership_id &&
                    ((i.data["status"] === "Pending_Dept_Review" && (admin || lead)) ||
                      (i.data["status"] === "Pending_Finance" && fin) ||
                      (i.data["status"] === "Pending_Admin" && admin)) && (
                      <>
                        <Button size="sm" onClick={() => open("approve_expense", i)}>
                          Review / approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => open("reject_expense", i)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  {i.data["status"] === "Approved" && fin && i.ownerId !== actor.membership_id && (
                    <Button
                      size="sm"
                      onClick={() =>
                        open("post_expense", i, { actualAmount: String(i.data["amount"]) })
                      }
                    >
                      Post actuals
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </section>
          {!by("expense").length && (
            <p className="text-sm text-muted-foreground">
              No permitted expense requests. Requests do not require a project.
            </p>
          )}
          </div>
        </>
      )}
      {view === "tickets" && (
        <section className="space-y-3">
          {filter(by("ticket")).map((i) => (
            <article key={i.id} className={card}>
              <p className="font-mono text-xs text-primary">
                TKT-{i.id.slice(0, 8)} · {str(i.data["source"])}
              </p>
              <div className="flex justify-between gap-3">
                <h2 className="text-sm font-semibold">{str(i.data["subject"])}</h2>
                <span className="text-xs">{str(i.data["status"])}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {str(i.data["requesterName"])} · {str(i.data["priority"])}
              </p>
              <p className="text-sm whitespace-pre-wrap my-2">{str(i.data["description"])}</p>
              <details className="text-xs">
                <summary className="cursor-pointer">Discussion & history</summary>
                {(Array.isArray(i.data["replies"]) ? i.data["replies"] : []).map((r, index) => {
                  const reply = r as Record<string, unknown>;
                  return (
                    <div className="border-l-2 border-border pl-3 my-2" key={index}>
                      <strong>{str(reply["authorName"])}</strong>
                      {reply["isInternalNote"] === true && <span> · Internal</span>}
                      <p className="whitespace-pre-wrap">{str(reply["message"])}</p>
                    </div>
                  );
                })}
              </details>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => open("ticket_reply", i)}>
                  Reply
                </Button>
                {service && (
                  <Button size="sm" onClick={() => open("ticket_status", i)}>
                    Update status
                  </Button>
                )}
              </div>
            </article>
          ))}
          {!by("ticket").length && (
            <p className="text-sm text-muted-foreground">No permitted tickets.</p>
          )}
        </section>
      )}
      {view === "profile" && (
        <>
          <p className="text-xs text-muted-foreground">Personal employment details, assigned policies, training and feedback forms.</p>
          <nav aria-label="My Profile sections" className="flex gap-1 overflow-x-auto rounded-lg border border-border/50 bg-muted p-1">
            {[["details", "My Details", User], ["policy", "Policies", ShieldCheck], ["training", "Training", GraduationCap], ["form", "Forms & Surveys", ClipboardList]].map(([key, label, Icon]) => {
              const Symbol = Icon as typeof User;
              return <button key={String(key)} type="button" aria-pressed={profileTab === key} onClick={() => setProfileTab(String(key))} className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${profileTab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><Symbol className="size-4" />{String(label)}</button>;
            })}
          </nav>
          <div hidden={profileTab !== "details"}>
          <section className={`${card} border-t-4 border-t-emerald-500`}>
            <h2 className="font-semibold text-sm">{actor.display_name}</h2>
            <p className="text-xs text-muted-foreground">
              {actor.department_code || "Department not recorded"} ·{" "}
              {actor.role.replaceAll("_", " ")}
            </p>
            <dl className="grid md:grid-cols-3 gap-3 text-sm mt-3">
              {[
                "employeeCode",
                "email",
                "phone",
                "roleTitle",
                "joiningDate",
                "facilityLocation",
                "emergencyContact",
              ].map((key) => (
                <div key={key}>
                  <dt className="text-xs text-muted-foreground">
                    {({ employeeCode: "Employee Code", email: "Email", phone: "Phone", roleTitle: "Role", joiningDate: "Joining Date", facilityLocation: "Location", emergencyContact: "Emergency Contact" } as Record<string,string>)[key]}
                  </dt>
                  <dd>{str(own?.data[key]) || "Not recorded"}</dd>
                </div>
              ))}
            </dl>
          </section>
          </div>
          {profileTab !== "details" && <>
          {personalAssignments(items, actor.membership_id, profileTab)
            .map((i) => {
              const template = items.find((t) => t.id === i.data["templateId"]);
              return (
                <article key={i.id} className={`${card} flex items-center justify-between gap-3`}>
                  <div>
                    <h3 className="text-sm font-medium">
                      {str(template?.data["title"]) || "Published assignment"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {str(template?.data["type"])} · due {str(i.data["dueDate"])} ·{" "}
                      {str(i.data["status"])}
                    </p>
                  </div>
                  {!["Completed", "Submitted"].includes(str(i.data["status"])) && (
                    <Button size="sm" onClick={() => open("submit_assignment", i)}>
                      Open
                    </Button>
                  )}
                </article>
              );
            })}
          {!personalAssignments(items, actor.membership_id, profileTab).length && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No assigned {profileTab === "form" ? "forms or surveys" : profileTab === "policy" ? "policies" : "training"}.</p>}
          </>}
          <p className="text-xs text-muted-foreground">
            Issued letters and equipment remain in their original controlled document and asset
            registers. No sample personnel records are substituted.
          </p>
        </>
      )}
      {view === "hr_admin" &&
        (hr ? (
          <>
            <section className={card}>
              <h2 className="text-sm font-semibold mb-3">Team directory</h2>
              <div className="space-y-2">
                {data.members.map((m) => {
                  const profile = items.find((i) => i.kind === "profile" && i.ownerId === m.id);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 border-b border-border/40 pb-2"
                    >
                      <div>
                        <p className="text-sm">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {deptName(m.departmentId)} · {m.role.replaceAll("_", " ")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          open("save_profile", profile || null, {
                            memberId: m.id,
                            ...Object.fromEntries(
                              Object.entries(profile?.data || {}).map(([k, v]) => [k, str(v)]),
                            ),
                          })
                        }
                      >
                        Edit details
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="space-y-2">
              <h2 className="font-semibold text-sm">Training review</h2>
              {by("assignment")
                .filter((i) => i.data["status"] === "Submitted")
                .map((i) => (
                  <article key={i.id} className={card}>
                    <p className="text-sm">
                      {data.members.find((m) => m.id === i.ownerId)?.name} ·{" "}
                      {str(items.find((t) => t.id === i.data["templateId"])?.data["title"])}
                    </p>
                    {i.ownerId !== actor.membership_id && (
                      <Button size="sm" onClick={() => open("review_training", i)}>
                        Verify completion
                      </Button>
                    )}
                  </article>
                ))}
            </section>
            <section className="space-y-2">
              <h2 className="font-semibold text-sm">Published activities</h2>
              {filter(by("template")).map((i) => (
                <article key={i.id} className={card}>
                  <h3 className="text-sm font-semibold">{str(i.data["title"])}</h3>
                  <p className="text-xs text-muted-foreground">
                    {str(i.data["type"])} · version {String(i.data["revision"])} · due{" "}
                    {str(i.data["dueDate"])}
                  </p>
                  <p className="text-xs whitespace-pre-wrap mt-2">{str(i.data["description"])}</p>
                  {data.surveyResults.find((r) => r.template_id === i.id)?.answers && (
                    <details className="text-xs mt-2">
                      <summary>Responses</summary>
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(
                          data.surveyResults.find((r) => r.template_id === i.id)?.answers,
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  )}
                  <p className="text-xs mt-2">
                    Completion:{" "}
                    {
                      by("assignment").filter(
                        (a) => a.data["templateId"] === i.id && a.data["status"] === "Completed",
                      ).length
                    }{" "}
                    / {by("assignment").filter((a) => a.data["templateId"] === i.id).length}
                  </p>
                  {i.data["isAnonymous"] === true && (
                    <p className="text-xs text-muted-foreground">
                      Anonymous responses: detailed results withheld below five responses;
                      completion does not link to answer rows.
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      open("publish_template", null, {
                        title: str(i.data["title"]),
                        type: str(i.data["type"]),
                        description: str(i.data["description"]),
                        dueDate: businessDate(),
                        cadenceDays: String(i.data["cadenceDays"] || 0),
                      });
                      setQuestions((i.data["questions"] as unknown as Question[]) || []);
                      setAudience((i.data["audienceIds"] as string[]) || []);
                    }}
                  >
                    Create revised version
                  </Button>
                </article>
              ))}
            </section>
          </>
        ) : (
          <p role="alert">HR administration access is restricted.</p>
        ))}
      {view === "communication" && (
        <div className="grid md:grid-cols-[200px_1fr] gap-3">
          <aside className={card}>
            {by("channel").map((i) => (
              <button
                className={`w-full text-left text-sm rounded p-2 ${channel === i.id ? "bg-primary/10 text-primary" : ""}`}
                key={i.id}
                onClick={() => setChannel(i.id)}
              >
                #{str(i.data["name"])}
              </button>
            ))}
          </aside>
          <section className={`${card} space-y-3`}>
            {!channel ? (
              <p className="text-sm text-muted-foreground">Select a permitted channel.</p>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={() => open("send_message", null, { channelId: channel, type: "update" })}
                >
                  New message / poll
                </Button>
                {filter(by("message").filter((i) => i.data["channelId"] === channel)).map((i) => (
                  <article className="border-b border-border/50 pb-3" key={i.id}>
                    <p className="text-xs text-muted-foreground">
                      {str(i.data["senderName"])} · {str(i.data["senderDept"])} ·{" "}
                      {str(i.data["createdAt"])}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{str(i.data["text"])}</p>
                    {i.data["poll"] &&
                      typeof i.data["poll"] === "object" &&
                      !Array.isArray(i.data["poll"]) && (
                        <div className="mt-2 space-y-2">
                          <p className="text-xs font-medium">{str(i.data["poll"]["question"])}</p>
                          {(Array.isArray(i.data["poll"]["options"])
                            ? i.data["poll"]["options"]
                            : []
                          ).map((option, index) => {
                            const vote = data.votes.find(
                              (v) => v.message_id === i.id && v.choice === index,
                            );
                            const closeTime = Date.parse(
                              str((i.data["poll"] as Record<string, unknown>)["closesAt"]),
                            );
                            const closed = !Number.isFinite(closeTime) || closeTime <= Date.now();
                            return (
                              <button
                                key={index}
                                disabled={busy || closed}
                                className={`block rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50 ${vote?.my_vote ? "bg-primary/10" : ""}`}
                                onClick={() => void save("poll_vote", i, { choice: index })}
                              >
                                {str(option)} · {vote?.total || 0}
                                {closed ? " · Closed" : ""}
                              </button>
                            );
                          })}
                        </div>
                      )}
                  </article>
                ))}
              </>
            )}
          </section>
        </div>
      )}
      <Dialog
        open={Boolean(action)}
        onOpenChange={(value) => {
          if (!value && !busy) setAction(null);
        }}
      >
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{action?.replaceAll("_", " ")}</DialogTitle>
            <DialogDescription>
              Changes save to the shared account with your actual identity.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            {action === "allocate" && (
              <>
                {select(
                  "departmentId",
                  "Department",
                  data.departments
                    .filter((d) => d.code !== "CLIENT")
                    .map((d) => ({ value: d.id, label: d.name })),
                  true,
                )}
                {field("category", "Category")}
                {field("allocatedAmount", "Approved allocation", "number")}
                {field("currency", "Currency")}
                {field("periodId", "Period reference")}
                {field("startDate", "Start", "date")}
                {field("endDate", "End", "date")}
                {field(
                  "financeLimit",
                  "Configured Finance approval limit (blank requires Admin)",
                  "number",
                  false,
                )}
                {select(
                  "projectId",
                  "Project",
                  data.projects.map((p) => ({ value: p.id, label: p.reference })),
                )}
              </>
            )}
            {action === "request_expense" && (
              <>
                {field("purpose", "Purpose")}
                {field("category", "Category")}
                {field("amount", "Estimate", "number")}
                {field("currency", "Currency")}
                {field("requiredDate", "Required date", "date")}
                {!actor.department_code &&
                  select(
                    "departmentId",
                    "Department",
                    data.departments
                      .filter((d) => d.code !== "CLIENT")
                      .map((d) => ({ value: d.id, label: d.name })),
                    true,
                  )}
                {select(
                  "projectId",
                  "Project",
                  data.projects.map((p) => ({ value: p.id, label: p.reference })),
                )}
              </>
            )}
            {action === "approve_expense" && (
              <>
                {target?.data["status"] === "Pending_Dept_Review" ? (
                  <p className="text-sm">Forward this request to Finance review.</p>
                ) : (
                  select(
                    "allocationId",
                    "Exact allocation",
                    by("allocation")
                      .filter(
                        (i) =>
                          i.departmentId === target?.departmentId &&
                          i.projectId === target?.projectId &&
                          i.data["category"] === target?.data["category"] &&
                          i.data["currency"] === target?.data["currency"],
                      )
                      .map((i) => ({
                        value: i.id,
                        label: `${str(i.data["periodId"])} · ${str(i.data["category"])} · ${money(i.data["allocatedAmount"])}`,
                      })),
                    true,
                  )
                )}
              </>
            )}
            {action === "post_expense" && (
              <>
                {field("actualAmount", "Verified actual amount", "number")}
                {field("postingRef", "Finance posting reference")}
                {field("evidenceRef", "Receipt / invoice evidence reference")}
              </>
            )}
            {action === "reject_expense" && field("reason", "Reason")}
            {action === "review_training" &&
              field("evidenceRef", "Attendance / assessment evidence reference")}
            {action === "ticket_create" && (
              <>
                {field("subject", "Subject")}
                {field("description", "Description")}
                {field("category", "Category")}
                {select(
                  "priority",
                  "Priority",
                  ["Critical", "High", "Normal", "Low"].map((x) => ({ value: x, label: x })),
                  true,
                )}
                {select(
                  "projectId",
                  "Project",
                  data.projects.map((p) => ({ value: p.id, label: p.reference })),
                )}
              </>
            )}
            {action === "ticket_reply" && (
              <>
                {field("message", "Reply")}
                {(service || actor.department_code === "SAL") &&
                  select(
                    "isInternalNote",
                    "Visibility",
                    [
                      { value: "yes", label: "Internal note" },
                      { value: "no", label: "Requester-visible reply" },
                    ],
                    true,
                  )}
              </>
            )}
            {action === "ticket_status" && (
              <>
                {select(
                  "status",
                  "Status",
                  ["Assigned", "In Progress", "Waiting", "Resolved", "Closed", "Open"].map((x) => ({
                    value: x,
                    label: x,
                  })),
                  true,
                )}
                {field("reason", "Reason (required to reopen)", "text", false)}
              </>
            )}
            {action === "save_profile" && (
              <>
                {[
                  "employeeCode",
                  "email",
                  "phone",
                  "roleTitle",
                  "joiningDate",
                  "facilityLocation",
                  "emergencyContact",
                ].map((key) =>
                  field(
                    key,
                    key.replace(/([A-Z])/g, " $1"),
                    key === "joiningDate" ? "date" : "text",
                    false,
                  ),
                )}
              </>
            )}
            {action === "publish_template" && (
              <>
                {field("title", "Title")}
                {select(
                  "type",
                  "Activity",
                  [
                    { value: "policy", label: "Policy" },
                    { value: "training", label: "Training" },
                    { value: "form", label: "Form / feedback / survey" },
                  ],
                  true,
                )}
                {field("description", "Content / instructions")}
                {field("dueDate", "First due date", "date")}
                {field("cadenceDays", "Recurrence in days (0 = once)", "number")}
                {values["type"] === "form" &&
                  select(
                    "isAnonymous",
                    "Response privacy",
                    [
                      { value: "no", label: "Identified response" },
                      { value: "yes", label: "Anonymous answers; separate completion tracking" },
                    ],
                    true,
                  )}
                <fieldset className="rounded border border-border p-2">
                  <legend className="text-xs">Audience</legend>
                  {data.members.map((m) => (
                    <label className="flex gap-2 text-xs py-1" key={m.id}>
                      <input
                        type="checkbox"
                        checked={audience.includes(m.id)}
                        onChange={(e) =>
                          setAudience(
                            e.target.checked
                              ? [...audience, m.id]
                              : audience.filter((id) => id !== m.id),
                          )
                        }
                      />
                      {m.name} · {deptName(m.departmentId)}
                    </label>
                  ))}
                </fieldset>
                {values["type"] !== "policy" && (
                  <fieldset className="space-y-2">
                    <legend className="text-xs">Questions</legend>
                    {questions.map((q, index) => (
                      <div key={q.id} className="rounded border border-border p-2 space-y-2">
                        <input
                          aria-label={`Question ${index + 1}`}
                          className={input}
                          required
                          value={q.label}
                          placeholder="Question"
                          onChange={(e) =>
                            setQuestions(
                              questions.map((x) =>
                                x.id === q.id ? { ...x, label: e.target.value } : x,
                              ),
                            )
                          }
                        />
                        <select
                          className={input}
                          value={q.type}
                          onChange={(e) =>
                            setQuestions(
                              questions.map((x) =>
                                x.id === q.id ? { ...x, type: e.target.value } : x,
                              ),
                            )
                          }
                        >
                          {["text", "number", "choice", "rating", "boolean", "date"].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                        {q.type === "choice" && (
                          <input
                            className={input}
                            required
                            placeholder="Choices separated by |"
                            value={(q.options || []).join("|")}
                            onChange={(e) =>
                              setQuestions(
                                questions.map((x) =>
                                  x.id === q.id ? { ...x, options: e.target.value.split("|") } : x,
                                ),
                              )
                            }
                          />
                        )}
                        <label className="text-xs flex gap-2">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) =>
                              setQuestions(
                                questions.map((x) =>
                                  x.id === q.id ? { ...x, required: e.target.checked } : x,
                                ),
                              )
                            }
                          />
                          Required
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setQuestions(questions.filter((x) => x.id !== q.id))}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setQuestions([
                          ...questions,
                          { id: crypto.randomUUID(), label: "", type: "text", required: true },
                        ])
                      }
                    >
                      Add question
                    </Button>
                  </fieldset>
                )}
              </>
            )}
            {action === "submit_assignment" && assignmentTemplate && (
              <>
                <h3 className="text-sm font-semibold">{str(assignmentTemplate.data["title"])}</h3>
                <p className="text-sm whitespace-pre-wrap">
                  {str(assignmentTemplate.data["description"])}
                </p>
                {assignmentTemplate.data["isAnonymous"] === true && (
                  <p className="text-xs text-muted-foreground">
                    Answers are stored without your member/assignment ID. Completion is tracked
                    separately. Results are withheld below five responses; do not include
                    identifying text in answers.
                  </p>
                )}
                {assignmentTemplate.data["type"] === "policy" ? (
                  <label className="text-sm flex gap-2">
                    <input
                      type="checkbox"
                      required
                      checked={values["acknowledged"] === "yes"}
                      onChange={(e) =>
                        setValues({ ...values, acknowledged: e.target.checked ? "yes" : "no" })
                      }
                    />
                    I acknowledge this published policy version.
                  </label>
                ) : (
                  ((assignmentTemplate.data["questions"] as unknown as Question[]) || []).map(
                    (q) => (
                      <label className="grid gap-1 text-xs" key={q.id}>
                        {q.label}
                        {q.required ? " *" : ""}
                        {q.type === "choice" || q.type === "boolean" ? (
                          <select
                            className={input}
                            required={q.required}
                            value={String(answers[q.id] ?? "")}
                            onChange={(e) =>
                              setAnswers({
                                ...answers,
                                [q.id]:
                                  q.type === "boolean" ? e.target.value === "true" : e.target.value,
                              })
                            }
                          >
                            <option value="">Choose…</option>
                            {(q.type === "boolean" ? ["true", "false"] : q.options || []).map(
                              (o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ),
                            )}
                          </select>
                        ) : (
                          <input
                            className={input}
                            type={
                              q.type === "number" || q.type === "rating"
                                ? "number"
                                : q.type === "date"
                                  ? "date"
                                  : "text"
                            }
                            required={q.required}
                            min={q.type === "rating" ? 1 : undefined}
                            max={q.type === "rating" ? 5 : undefined}
                            value={String(answers[q.id] ?? "")}
                            onChange={(e) =>
                              setAnswers({
                                ...answers,
                                [q.id]:
                                  q.type === "number" || q.type === "rating"
                                    ? Number(e.target.value)
                                    : e.target.value,
                              })
                            }
                          />
                        )}
                      </label>
                    ),
                  )
                )}
              </>
            )}
            {action === "channel_create" && (
              <>
                {field("name", "Channel name")}
                {field("topic", "Topic", "text", false)}
                <fieldset>
                  <legend className="text-xs">Selected members</legend>
                  {data.members.map((m) => (
                    <label className="flex gap-2 text-xs py-1" key={m.id}>
                      <input
                        type="checkbox"
                        checked={audience.includes(m.id) || m.id === actor.membership_id}
                        disabled={m.id === actor.membership_id}
                        onChange={(e) =>
                          setAudience(
                            e.target.checked
                              ? [...audience, m.id]
                              : audience.filter((id) => id !== m.id),
                          )
                        }
                      />
                      {m.name}
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            {action === "send_message" && (
              <>
                {field("text", "Message")}
                {field("type", "Conversation type")}
                {field("tags", "Tags separated by commas", "text", false)}
                {field("pollQuestion", "Poll question (optional)", "text", false)}
                {field("pollOptions", "Poll options separated by | (optional)", "text", false)}
                {values["pollOptions"] && field("closesAt", "Poll closes at", "datetime-local")}
              </>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={busy || (action === "publish_template" && !audience.length)}
                type="submit"
              >
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

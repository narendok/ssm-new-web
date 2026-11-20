import { useState } from "react";
import { DepartmentBudgetsWorkspace } from "./DepartmentBudgetsWorkspace";
import { Button } from "./ui/button";
import { budgetSummaries } from "@/lib/business-presentation";
import { businessDate } from "@/lib/business-date";
import type { BusinessSnapshot, BusinessAction, BusinessItem } from "@/lib/business-workspace.functions";
import type { TestMembership } from "@/lib/test-auth.functions";

const text = (value: unknown) => typeof value === "string" ? value : "";
const money = (value: unknown) => typeof value === "number" ? value.toLocaleString("en-IN") : "—";

export function SharedBudgetPresentation({ data, membership, onAction }: {
  data: BusinessSnapshot;
  membership: TestMembership;
  onAction: (action: BusinessAction, item: BusinessItem | null, values?: Record<string, string>) => void;
}) {
  const [search, setSearch] = useState("");
  const actor = data.membership;
  const admin = actor.role === "admin";
  const lead = actor.role === "department_lead";
  const finance = admin || (lead && actor.department_code === "FIN");
  const procurement = admin || (lead && actor.department_code === "PUR");
  const allocations = data.items.filter(item => item.kind === "allocation");
  const approvedAllocations = allocations.filter(item => item.data["status"] === undefined || item.data["status"] === "Approved");
  const requests = data.items.filter(item => item.kind === "expense");
  const searchTerm = search.trim().toLowerCase();
  const filtered = requests.filter(item => `EXP-${item.id.slice(0, 8)} ${JSON.stringify(item.data)}`.toLowerCase().includes(searchTerm));
  const exceptions = filtered.filter(item => item.data["status"] === "Pending_Policy_Exception");
  const department = (id: string | null) => data.departments.find(value => value.id === id)?.code || "—";
  const tableClass = "w-full text-left text-xs";
  const cell = "px-3 py-3";
  const box = "overflow-x-auto rounded-xl border border-border bg-card shadow-sm";
  const headers = (labels: string[]) => <thead className="border-b border-border bg-muted/60 text-muted-foreground"><tr>{labels.map(label => <th key={label} className="px-3 py-2.5">{label}</th>)}</tr></thead>;

  return <DepartmentBudgetsWorkspace
    persona={{ id: actor.membership_id, label: actor.display_name, person: actor.display_name, kind: admin ? "admin" : lead ? "lead" : "member" }}
    testMembership={membership}
    allocations={[]}
    expenseRequests={[]}
    sharedPresentation={{
      requestCount: requests.length,
      allocationCount: allocations.length,
      onNewRequest: () => onAction("request_expense", null, { currency: "INR", requiredDate: businessDate(), requestType: "travel" }),
      actions: finance ? <Button size="sm" variant="outline" onClick={() => onAction("allocate", null, { currency: "INR", startDate: businessDate() })}>Add allocation</Button> : undefined,
      summary: <>
        {budgetSummaries(data.items).map(summary => <section key={summary.currency} className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label={`Budget summary ${summary.currency}`}>
          {[["Approved Allocation", summary.allocated], ["Committed Reserves", summary.committed], ["Posted Actuals", summary.spent], ["Available Balance", summary.available]].map(([label, value]) => <article key={String(label)} className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-xs text-muted-foreground">{String(label)}</p><p className="mt-1 text-xl font-black">{summary.currency} {money(value)}</p></article>)}
        </section>)}
        {!approvedAllocations.length && <p className="rounded-xl border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">No approved allocation is recorded. Requests remain available; approval requires a valid allocation.</p>}
      </>,
      allocations: <div className={box}><table className={tableClass}>
        {headers(["Department / Category", "Period", "Status", "Currency", "Allocated", "Committed", "Spent", "Available", "Actions"])}
        <tbody>{allocations.map(item => {
          const status = text(item.data["status"]) || "Approved";
          const approved = status === "Approved";
          const canReview = finance && status === "Pending_Approval" && item.ownerId !== actor.membership_id;
          const available = Number(item.data["allocatedAmount"]) - Number(item.data["committedAmount"]) - Number(item.data["spentAmount"]);
          return <tr key={item.id} className="border-b border-border/40">
            <td className={cell}>{department(item.departmentId)} · {text(item.data["category"])}</td><td className={cell}>{text(item.data["periodId"])}</td><td className={cell}>{status.replaceAll("_", " ")}</td><td className={cell}>{text(item.data["currency"])}</td>
            {["allocatedAmount", "committedAmount", "spentAmount"].map(key => <td key={key} className={cell}>{approved ? money(item.data[key]) : "—"}</td>)}
            <td className={`${cell} font-bold`}>{approved ? money(available) : "—"}</td><td className={cell}>{canReview && <div className="flex gap-2"><Button size="sm" onClick={() => onAction("approve_allocation", item)}>Approve</Button><Button size="sm" variant="outline" onClick={() => onAction("reject_allocation", item)}>Reject</Button></div>}</td>
          </tr>;
        })}{!allocations.length && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No permitted allocations.</td></tr>}</tbody>
      </table></div>,
      requests: <div className="space-y-3">
        {exceptions.length > 0 && <section className="rounded-xl border border-amber-400/50 bg-amber-50/60 p-3 dark:bg-amber-950/20">
          <h3 className="text-sm font-semibold">Travel-policy exceptions awaiting Finance review · {exceptions.length}</h3>
          <div className="mt-2 space-y-2">{exceptions.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-xs">
            <div><p className="font-medium">EXP-{item.id.slice(0, 8)} · {text(item.data["requesterName"])} · {department(item.departmentId)}</p><p className="text-muted-foreground">Estimate {text(item.data["currency"])} {money(item.data["travelEstimate"])} · ceiling {text(item.data["currency"])} {money(item.data["travelAdvanceCap"])} · {text(item.data["travelPolicyExceptionReason"])}</p></div>
            {finance && item.ownerId !== actor.membership_id && <div className="flex gap-2"><Button size="sm" onClick={() => onAction("approve_travel_exception", item)}>Approve exception</Button><Button size="sm" variant="outline" onClick={() => onAction("reject_travel_exception", item)}>Reject</Button></div>}
          </article>)}</div>
        </section>}
        <input aria-label="Search expense requests" className="h-8 max-w-sm rounded-lg border border-input bg-background px-3 text-xs" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search reference, category, details…" />
        <div className={box}><table className={tableClass}>
          {headers(["Reference / Requester", "Request / Category", "Amount", "Request details", "Status", "Actions"])}
          <tbody>{filtered.map(item => {
            const status = text(item.data["status"]);
            const exception = status === "Pending_Policy_Exception";
            const canReview = item.ownerId !== actor.membership_id && ((status === "Pending_Dept_Review" && (admin || lead)) || (status === "Pending_Procurement" && procurement) || (status === "Pending_Finance" && finance) || (status === "Pending_Admin" && admin));
            return <tr key={item.id} className="border-b border-border/40">
              <td className={cell}><p className="font-mono text-primary">EXP-{item.id.slice(0, 8)}</p>{text(item.data["requesterName"])}</td>
              <td className={cell}>{text(item.data["requestType"] || "travel").replaceAll("_", " ")} · {text(item.data["category"])} · {department(item.departmentId)}</td>
              <td className={`${cell} whitespace-nowrap font-semibold`}>{text(item.data["currency"])} {money(item.data["amount"])}</td>
              <td className={cell}>
                {text(item.data["serviceCatalogueName"]) && <p className="font-medium">{text(item.data["serviceCatalogueName"])}</p>}
                {item.data["itemOrService"] && <p className="text-muted-foreground">{text(item.data["itemOrService"])}{item.data["quantity"] ? ` · Qty ${String(item.data["quantity"])}` : ""}</p>}
                {item.data["destination"] && <p className="text-muted-foreground">{text(item.data["destination"])}{item.data["travelStartDate"] ? ` · ${text(item.data["travelStartDate"])} to ${text(item.data["travelEndDate"])}` : ""}</p>}
                {item.data["travelEstimate"] && <p className="text-muted-foreground">Estimate {text(item.data["currency"])} {money(item.data["travelEstimate"])} · cap {text(item.data["currency"])} {money(item.data["travelAdvanceCap"])}</p>}
                {item.data["travelPolicyExceptionReason"] && <p className="text-amber-700 dark:text-amber-300">Policy exception: {text(item.data["travelPolicyExceptionReason"])}</p>}
                {item.data["merchant"] && <p className="text-muted-foreground">{text(item.data["merchant"])}{item.data["expenseDate"] ? ` · ${text(item.data["expenseDate"])}` : ""}</p>}
                {item.data["quotationReference"] && <p className="text-muted-foreground">Quote / invoice: {text(item.data["quotationReference"])}</p>}
              </td>
              <td className={cell}><span className="rounded-full border border-border px-2 py-1">{status.replaceAll("_", " ")}</span></td>
              <td className={cell}><div className="flex flex-wrap gap-2">
                {canReview && <><Button size="sm" onClick={() => onAction("approve_expense", item)}>{status === "Pending_Procurement" ? "Review / forward to Finance" : "Review / approve"}</Button><Button size="sm" variant="outline" onClick={() => onAction("reject_expense", item)}>Reject</Button></>}
                {exception && finance && item.ownerId !== actor.membership_id && <><Button size="sm" onClick={() => onAction("approve_travel_exception", item)}>Approve exception</Button><Button size="sm" variant="outline" onClick={() => onAction("reject_travel_exception", item)}>Reject</Button></>}
                {status === "Approved" && finance && item.ownerId !== actor.membership_id && <Button size="sm" onClick={() => onAction("post_expense", item, { actualAmount: String(item.data["amount"]) })}>Post actuals</Button>}
              </div></td>
            </tr>;
          })}{!filtered.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No matching permitted expense requests.</td></tr>}</tbody>
        </table></div>
      </div>,
    }}
  />;
}

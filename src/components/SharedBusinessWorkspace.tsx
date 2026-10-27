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
import { SharedBudgetPresentation } from "./SharedBudgetPresentation";
import { EmployeeSelfServiceWorkspace } from "./EmployeeSelfServiceWorkspace";
import { sharedChatPresentation } from "@/lib/shared-chat-presentation";
import { TeamCommunicationWorkspace, type TeamChatDraftCache } from "./TeamCommunicationWorkspace";
import { HRAdministrationWorkspace } from "./HRAdministrationWorkspace";
import { ServiceTicketsWorkspace } from "./ServiceTicketsWorkspace";
import type { ServiceTicket } from "@/lib/service-tickets";
import { personalAssignments } from "@/lib/business-presentation";

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
    [search, setSearch] = useState("");
  const pending = useRef<{ signature: string; id: string } | null>(null);

  const lock = useRef(false);
  const chatDraftCache=useRef<TeamChatDraftCache>({channelId:"",channels:{},replyId:null,replyText:""});
  async function save(
    kind: BusinessAction,
    item: BusinessItem | null,
    data: Record<string, unknown>,
  ) {
    if (lock.current) return false;
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
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed. Your form is preserved.");
      void query.refetch();
      return false;
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
      {notice&&<p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">{notice}</p>}
      {error&&!action&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      {view==="budgets"&&<SharedBudgetPresentation data={data} membership={membership} onAction={open}/>}
          {view === "tickets" && <ServiceTicketsWorkspace
        currentUser={{role:admin?"admin":actor.role==="viewer"?"client":actor.role,name:actor.display_name,email:"",department:actor.department_code||undefined}}
        tickets={by("ticket").map(i=>({id:i.id,reference:`TKT-${i.id.slice(0,8)}`,source:str(i.data["source"]),requesterName:str(i.data["requesterName"]),requesterEmail:"",requesterDepartment:str(i.data["requesterDept"]),subject:str(i.data["subject"]),description:str(i.data["description"]),category:str(i.data["category"]),priority:str(i.data["priority"]),status:str(i.data["status"]),projectId:i.projectId||undefined,assetId:str(i.data["assetId"])||undefined,assignedOwner:str(i.data["assignedOwner"])||undefined,slaDueHours:0,createdAt:str(i.data["createdAt"]),updatedAt:str(i.data["updatedAt"]),replies:Array.isArray(i.data["replies"])?i.data["replies"]:[],history:Array.isArray(i.data["history"])?i.data["history"]:[]} as ServiceTicket))}
        onUpdateTickets={()=>{}}
        sharedActions={{onCreate:()=>open("ticket_create",null,{priority:"Normal",category:"General"}),onStatus:id=>{const ticket=by("ticket").find(i=>i.id===id);if(ticket)open("ticket_status",ticket);},onReply:async(id,text,internal)=>{const ticket=by("ticket").find(i=>i.id===id);return ticket?await save("ticket_reply",ticket,{message:text,isInternalNote:service&&internal}):false;}}}
      />}
      {view === "profile" && <EmployeeSelfServiceWorkspace
        persona={{id:actor.membership_id,label:actor.display_name,person:actor.display_name,kind:admin?"admin":lead?"lead":"member"}}
        testMembership={membership}
        sharedProfile={{id:actor.membership_id,name:actor.display_name,employeeCode:str(own?.data["employeeCode"])||"Not recorded",email:str(own?.data["email"])||"Not recorded",phone:str(own?.data["phone"])||"Not recorded",departmentCode:actor.department_code||"Not recorded",departmentName:data.departments.find(d=>d.code===actor.department_code)?.name||"Not recorded",roleTitle:str(own?.data["roleTitle"])||"Not recorded",securityClearance:str(own?.data["securityClearance"])||"Not recorded",facilityLocation:str(own?.data["facilityLocation"])||"Not recorded",emergencyContact:str(own?.data["emergencyContact"])||"Not recorded",joiningDate:str(own?.data["joiningDate"])||"Not recorded",status:"Not recorded"}}
        letters={[]} policies={[]} trainings={[]} forms={[]} assets={[]}
        sharedCounts={{policies:personalAssignments(items,actor.membership_id,"policy").filter(i=>!["Completed","Submitted"].includes(str(i.data["status"]))).length,training:personalAssignments(items,actor.membership_id,"training").length,forms:personalAssignments(items,actor.membership_id,"form").length}}
        sharedSection={section=>{
          if(section==="letters"||section==="assets")return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{section==="letters"?"Issued letters remain in the controlled personnel document register. No linked personal letters are available in this view yet.":"Assigned equipment remains in the original asset register. No linked personal equipment is available in this view yet."}</div>;
          const type=section==="policies"?"policy":section==="forms"?"form":section;
          const assignments=personalAssignments(items,actor.membership_id,type);
          return <div className="space-y-3">{assignments.map(i=>{
            const template=items.find(t=>t.id===i.data["templateId"]);
            return <article key={i.id} className={`${card} flex items-center justify-between gap-3`}><div><h3 className="text-sm font-semibold">{str(template?.data["title"])||"Published assignment"}</h3><p className="mt-1 text-xs text-muted-foreground">{str(template?.data["type"])} · {str(i.data["status"])}{i.data["dueDate"]?` · Due ${str(i.data["dueDate"])}`:""}</p></div>{!["Completed","Submitted"].includes(str(i.data["status"]))&&<Button size="sm" onClick={()=>open("submit_assignment",i)}>Open</Button>}</article>;
          })}{!assignments.length&&<p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No {section==="forms"?"forms or surveys":section} assigned to your account.</p>}</div>;
        }}
      />}
      {view === "hr_admin" &&
        (hr ? (
          <HRAdministrationWorkspace currentUser={{role:actor.role,name:actor.display_name,department:actor.department_code||undefined}} policies={[]} trainings={[]} forms={[]} onUpdatePolicies={()=>{}} onUpdateTrainings={()=>{}} onUpdateForms={()=>{}}
            sharedCounts={{employees:data.members.length,policies:by("template").filter(i=>i.data["type"]==="policy").length,trainings:by("template").filter(i=>i.data["type"]==="training").length,forms:by("template").filter(i=>["form","survey"].includes(str(i.data["type"]))).length}}
            sharedSection={section=><>
            <div className="flex justify-end"><Button size="sm" onClick={()=>open("publish_template",null,{type:section==="policies"?"policy":section==="trainings"?"training":"form",dueDate:businessDate(),cadenceDays:"0"})}>Create policy / training / form</Button></div>
            <section hidden={section!=="directory"} className={card}>
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
            <section hidden={section!=="trainings"} className="space-y-2">
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
            <section hidden={section==="directory"} className="space-y-2">
              <h2 className="font-semibold text-sm">Published activities</h2>
              {filter(by("template")).filter(i=>section==="policies"?i.data["type"]==="policy":section==="trainings"?i.data["type"]==="training":["form","survey"].includes(str(i.data["type"]))).map((i) => (
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
          </>}/>
        ) : (
          <p role="alert">HR administration access is restricted.</p>
        ))}
      {view === "communication" && <TeamCommunicationWorkspace persona={{id:actor.membership_id,label:actor.display_name,person:actor.display_name,kind:admin?"admin":lead?"lead":"member"}} sharedChat={{
        ...sharedChatPresentation(data),busy,draftCache:chatDraftCache,
        onCreateChannel:admin||lead?()=>open("channel_create"):undefined,
        onSend:(channelId,text,isUrgent,replyToId,meta)=>save("send_message",null,{channelId,text,isUrgent,...(replyToId?{replyToId}:{}),type:meta?.type||"update",tags:meta?.tags||[]}),
        onVote:(messageId,optionId)=>{const message=items.find(i=>i.id===messageId&&i.kind==="message");return message?save("poll_vote",message,{choice:Number(optionId)}):Promise.resolve(false);},
        onPoll:(channelId,question,options,closesAt)=>save("send_message",null,{channelId,text:question,type:"poll",tags:[],poll:{question,options,closesAt:new Date(closesAt).toISOString()}}),
      }}/>}
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

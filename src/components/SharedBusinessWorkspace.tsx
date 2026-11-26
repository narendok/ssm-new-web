import { useOrganizationConfiguration } from '@/lib/organization-configuration';
import { getEffectiveTravelPolicy, getExpenseCatalogue, requestExpenseLocation } from '@/lib/expense-settings.functions';
import { suggestExpenseCategoryForStage } from '@/lib/expense-suggestions';
import { ExpenseSettingsPanel } from './ExpenseSettingsPanel';
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
import type { DepartmentHelpRequest, ServiceTicket } from "@/lib/service-tickets";
import { personalAssignments } from "@/lib/business-presentation";
import { SharedMasterSelect } from "./SharedMasterSelect";
import { mergeCanonicalSupplierOptions } from "@/lib/shared-master-options";
import { evaluateTravelEstimate, travelDateValidationMessage } from "@/lib/expense-validation";
import { getEmployeeLetterDownload, getEmployeeProfileCatalogue } from "@/lib/employee-profile.functions";

type Question = { id: string; label: string; type: string; required: boolean; options?: string[] };
const input = "rounded-md border border-input bg-background px-2 py-1.5 text-sm w-full";
const card = "rounded-xl border border-border/70 bg-card p-4 shadow-xs";
const str = (v: unknown) => (typeof v === "string" ? v : "");
const helpStatus = (value: unknown): DepartmentHelpRequest["status"] =>
  value === "In Progress" || value === "Responded" || value === "Closed" ? value : "Requested";
const money = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-IN") : "—");
export function canonicalSupplierDisplay(
  supplierId: unknown,
  savedName: unknown,
  suppliers: { id: string; reference: string; title: string }[],
) {
  const id = str(supplierId);
  const supplier = id ? suppliers.find((item) => item.id === id) : undefined;
  return supplier ? `${supplier.reference} · ${supplier.title}` : str(savedName);
}
function ExpenseLocationRequest({onRequested,disabled}:{onRequested:()=>void;disabled:boolean}) {
  const send=useServerFn(requestExpenseLocation);
  const [open,setOpen]=useState(false),[name,setName]=useState(""),[city,setCity]=useState(""),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  return <div className="space-y-2">
    <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={()=>setOpen(value=>!value)}>{open?"Cancel location request":"Location not listed? Request it"}</Button>
    {open&&<div className="grid gap-2 rounded-md border p-3">
      <p className="text-xs text-muted-foreground">Finance/Admin reviews proposed locations. A requested location cannot be used until approved.</p>
      <input className={input} aria-label="Requested location name" placeholder="Facility / location name" value={name} onChange={event=>setName(event.target.value)}/>
      <input className={input} aria-label="Requested location city" placeholder="City" value={city} onChange={event=>setCity(event.target.value)}/>
      <input className={input} aria-label="Why this location is needed" placeholder="Reason for adding this location" value={reason} onChange={event=>setReason(event.target.value)}/>
      <Button type="button" size="sm" disabled={busy||disabled||name.trim().length<2||city.trim().length<2||reason.trim().length<3} onClick={()=>{
        setBusy(true);setMessage("");
        void send({data:{name:name.trim(),city:city.trim(),reason:reason.trim(),requestId:crypto.randomUUID()}}).then(()=>{setMessage("Sent to Finance/Admin for review.");setName("");setCity("");setReason("");onRequested();}).catch(error=>setMessage(error instanceof Error?error.message:"Location request failed.")).finally(()=>setBusy(false));
      }}>{busy?"Sending…":"Request location review"}</Button>
      {message&&<p role="status" className="text-xs">{message}</p>}
    </div>}
  </div>;
}
export function SharedBusinessWorkspace({
  view,
  membership,
  departmentScopeCode,
  adminAllDepartments,
}: {
  view: string;
  membership: TestMembership;
  departmentScopeCode: string | null;
  adminAllDepartments: boolean;
}) {
  const departmentConfiguration=useOrganizationConfiguration(membership.membershipId);
  const load = useServerFn(getBusinessWorkspace),
    write = useServerFn(mutateBusinessWorkspace);
  const loadEmployeeProfileCatalogue = useServerFn(getEmployeeProfileCatalogue);
  const downloadEmployeeLetter = useServerFn(getEmployeeLetterDownload);
  const query = useQuery({
    queryKey: ["business-workspace", membership.organizationId, membership.membershipId],
    queryFn: () => load(),
    refetchInterval: 15000,
    retry: 1,
  });
  const employeeProfileCatalogueQuery = useQuery({
    queryKey: ["employee-profile-catalogue", membership.organizationId, membership.membershipId],
    queryFn: () => loadEmployeeProfileCatalogue(),
    enabled: view === "hr_admin" && (membership.role === "admin" || (membership.role === "department_lead" && ["HR", "HROPS"].includes(membership.departmentCode || ""))),
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
  const [employeeLetterLinks, setEmployeeLetterLinks] = useState<Record<string, string>>({});
  const loadExpenseCatalogue=useServerFn(getExpenseCatalogue);
  const loadEffectiveTravelPolicy=useServerFn(getEffectiveTravelPolicy);
  const workspaceAdmin = membership.role === "admin";
  const fixedExpenseDepartment = query.data?.departments.find((department) =>
    department.code.toUpperCase() ===
      (workspaceAdmin ? departmentScopeCode : membership.departmentCode)?.toUpperCase(),
  ) || (!adminAllDepartments ? query.data?.departments.find((department) =>
    department.code.toUpperCase() === membership.departmentCode?.toUpperCase(),
  ) : undefined);
  const expenseDepartment = action === "allocate"
    ? values["departmentId"] || (adminAllDepartments ? null : fixedExpenseDepartment?.id || null)
    : adminAllDepartments
      ? values["departmentId"] || null
      : fixedExpenseDepartment?.id || null;
  const expenseOptions=useQuery({queryKey:['expense-settings',membership.organizationId,expenseDepartment],queryFn:()=>loadExpenseCatalogue({data:{department:expenseDepartment}}),enabled:view==='budgets'&&Boolean(expenseDepartment)});
  const effectiveTravelPolicyQuery=useQuery({
    queryKey:['effective-travel-policy',membership.organizationId,membership.membershipId,expenseDepartment,values['travelStartDate']||businessDate()],
    queryFn:()=>loadEffectiveTravelPolicy({data:{department:expenseDepartment!,travelDate:values['travelStartDate']||businessDate()}}),
    enabled:action==='request_expense'&&(values['requestType']||'travel')==='travel'&&Boolean(expenseDepartment),
  });
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
      setNotice(kind === "save_profile" || kind === "request_profile_change"
        ? "Profile change sent for the required review. The existing baseline remains active until approved."
        : "Saved to your shared workspace.");
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
  function prepareEmployeeLetter(item: BusinessItem) {
    void downloadEmployeeLetter({data:{itemId:item.id}})
      .then(result=>setEmployeeLetterLinks(previous=>({...previous,[item.id]:result.url})))
      .catch(error=>setError(error instanceof Error?error.message:"Letter review/download is unavailable."));
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
  const canonicalSuppliers = mergeCanonicalSupplierOptions(expenseOptions.data?.suppliers, data.suppliers);
  const expenseProject = data.projects.find(project => project.id === values['projectId']);
  const travelLocation=expenseOptions.data?.locations.find(location=>location.id===values['locationId']);
  const travelDays=(()=>{
    const start=values['travelStartDate'],end=values['travelEndDate'];
    if(!start||!end)return 0;
    const startTime=Date.parse(`${start}T00:00:00Z`),endTime=Date.parse(`${end}T00:00:00Z`);
    return Number.isFinite(startTime)&&Number.isFinite(endTime)&&endTime>=startTime?Math.floor((endTime-startTime)/86400000)+1:0;
  })();
  const activeTravelPolicy=effectiveTravelPolicyQuery.data?.isEffective?effectiveTravelPolicyQuery.data:undefined;
  const travelEstimatePreview=activeTravelPolicy?.band&&travelLocation?evaluateTravelEstimate({
    band:activeTravelPolicy.band,cityTier:travelLocation.cityTier,advancePercent:activeTravelPolicy.policy.advancePercent,
    amount:Number(values['amount']||0),transportEstimate:Number(values['travelTransportEstimate']||0),
    hotelRate:Number(values['travelHotelRate']||0),hotelNights:Number(values['travelHotelNights']||0),
    mealRate:Number(values['travelMealRate']||0),mealDays:Number(values['travelMealDays']||travelDays),
    localRate:Number(values['travelLocalRate']||0),localDays:Number(values['travelLocalDays']||travelDays),tripDays:travelDays,
  }):null;
  const expenseService = expenseOptions.data?.services.find(service => service.id === values['serviceCatalogueId']);
  const expenseCategorySuggestion = suggestExpenseCategoryForStage(
    expenseProject?.currentStage,
    values['requestType'] || 'travel',
    expenseOptions.data?.categories || [],
    expenseService?.category,
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
  const ticketHelpRequests = by("ticket_help_request");
  const ticketRows = by("ticket").map(i=>({id:i.id,reference:`TKT-${i.id.slice(0,8)}`,source:str(i.data["source"]),requesterName:str(i.data["requesterName"]),requesterEmail:"",requesterDepartment:str(i.data["requesterDept"]),subject:str(i.data["subject"]),description:str(i.data["description"]),category:str(i.data["category"]),priority:str(i.data["priority"]),status:str(i.data["status"]),projectId:i.projectId||undefined,assetId:str(i.data["assetId"])||undefined,assignedOwner:str(i.data["assignedOwner"])||undefined,slaDueHours:0,createdAt:str(i.data["createdAt"]),updatedAt:str(i.data["updatedAt"]),replies:Array.isArray(i.data["replies"])?i.data["replies"]:[],history:Array.isArray(i.data["history"])?i.data["history"]:[],departmentHelpRequests:ticketHelpRequests.filter(request=>str(request.data["ticketId"])===i.id).map(request=>({id:request.id,ticketId:i.id,departmentCode:str(request.data["departmentCode"]),departmentName:str(request.data["departmentName"]),summary:str(request.data["summary"]),status:helpStatus(request.data["status"]),requestedBy:str(request.data["requestedBy"]),createdAt:str(request.data["createdAt"]),response:str(request.data["response"])||undefined,respondedBy:str(request.data["respondedBy"])||undefined,respondedAt:str(request.data["respondedAt"])||undefined}))} as ServiceTicket));
  const receivedHelpTickets: ServiceTicket[] = ticketHelpRequests.filter(request=>str(request.data["departmentCode"])===actor.department_code && !ticketRows.some(ticket=>ticket.id===str(request.data["ticketId"]))).map(request=>({id:request.id,reference:str(request.data["ticketReference"]),source:"Internal",requesterName:str(request.data["requestedBy"]),requesterEmail:"",requesterDepartment:"SIT",subject:`Department help · ${str(request.data["ticketReference"])}`,description:str(request.data["summary"]),category:"IT Workstation & Network",priority:"Normal",status:"Waiting",slaDueHours:0,createdAt:str(request.data["createdAt"]),updatedAt:str(request.data["respondedAt"])||str(request.data["createdAt"]),replies:[],history:[],departmentHelpRequests:[{id:request.id,ticketId:str(request.data["ticketId"]),departmentCode:str(request.data["departmentCode"]),departmentName:str(request.data["departmentName"]),summary:str(request.data["summary"]),status:helpStatus(request.data["status"]),requestedBy:str(request.data["requestedBy"]),createdAt:str(request.data["createdAt"]),response:str(request.data["response"])||undefined,respondedBy:str(request.data["respondedBy"])||undefined,respondedAt:str(request.data["respondedAt"])||undefined}]}));
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
          min={type === "number" ? 0 : undefined}
          max={type === "number" ? 1000000000000 : undefined}
          step={type === "number" ? "0.01" : undefined}
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
          onChange={(e) => {
            const value = e.target.value;
            setValues(previous => ({ ...previous, [name]: value }));
          }}
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
  function searchableSelect(name: string, label: string, options: { value: string; label: string }[], required = false) {
    return <SharedMasterSelect label={label} value={values[name] || ""} options={options} required={required} onChange={value => setValues(previous => ({ ...previous, [name]: value }))} />;
  }
  function chooseExpenseService(serviceId: string) {
    const selectedService = expenseOptions.data?.services.find(item => item.id === serviceId);
    const linkedSupplier = selectedService?.supplierId
      ? canonicalSuppliers.find(supplier => supplier.id === selectedService.supplierId)
      : undefined;
    setValues(previous => ({
      ...previous,
      serviceCatalogueId: serviceId,
      ...(selectedService ? {
        itemOrService: selectedService.name,
        // Keep the catalogue's canonical supplier UUID even if the business snapshot has not refreshed yet.
        supplierId: selectedService.supplierId || "",
        supplierOther: "no",
        supplierName: linkedSupplier?.title || selectedService.provider || "",
        billingCycle: selectedService.cycle,
        serviceOwner: selectedService.owner,
      } : {
        itemOrService: "",
        supplierId: "",
        supplierOther: "no",
        supplierName: "",
        billingCycle: "",
        serviceOwner: "",
      }),
    }));
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
    if (action === "request_expense") {
      if (!expenseDepartment) {
        setError("Choose a department before creating the expense request.");
        return;
      }
      if(!expenseOptions.data){setError('Expense settings are unavailable. Retry before submitting.');return;}
      if (!expenseOptions.data.categories.includes(values["category"] || "")) {
        setError("Choose a Finance category configured for the selected department.");
        return;
      }
      if((values['requestType']||'travel')==='travel'){
        const dateError=travelDateValidationMessage(values['travelStartDate'],values['travelEndDate']);
        if(dateError){setError(dateError);return;}
        if(!values['locationId']){setError('Choose an approved shared location.');return;}
        if(effectiveTravelPolicyQuery.error){setError('The applicable travel policy could not be checked. Retry before submitting.');return;}
        if(effectiveTravelPolicyQuery.isPending){setError('Loading the applicable travel policy. Retry in a moment.');return;}
        if(effectiveTravelPolicyQuery.data?.isEffective){
          if(!effectiveTravelPolicyQuery.data.employeeBand||!effectiveTravelPolicyQuery.data.band){setError('HR/Admin must assign your travel-policy band in your shared profile before a capped travel request can be submitted.');return;}
          if(!travelEstimatePreview||travelEstimatePreview.estimate<=0){setError('Enter a valid itemized travel estimate within the trip dates.');return;}
          if(travelEstimatePreview.requiresException&&(values['travelPolicyExceptionReason']||'').trim().length<3){setError('Add a reason for the travel-policy exception so Finance/Admin can review it.');return;}
        }
      }
      payload = { ...payload, departmentId: expenseDepartment, category: values['category'], amount: Number(values['amount']), purchaseKind: values['purchaseKind'] || 'goods', purpose: values['requestType']==='purchase' ? values['itemOrService'] : values['requestType']==='reimbursement' ? values['merchant'] : values['destination'], requestType: values['requestType'] || 'travel', ...(values['requestType']==='travel'?{locationId:values['locationId'],travelHotelRate:values['travelHotelRate']||'0',travelHotelNights:values['travelHotelNights']||'0',travelMealRate:values['travelMealRate']||'0',travelMealDays:values['travelMealDays']||String(travelDays),travelLocalRate:values['travelLocalRate']||'0',travelLocalDays:values['travelLocalDays']||String(travelDays),travelTransportEstimate:values['travelTransportEstimate']||'0',travelPolicyExceptionReason:values['travelPolicyExceptionReason']||''}: {}) };
    }
    if (action === 'request_expense' && values['requestType']==='purchase' && values['purchaseKind']==='service') {
      if (!expenseService) {
        setError('Choose a service from the current department catalogue.');
        return;
      }
      const units=Number(values['serviceSeats']);
      if(!Number.isFinite(units)||units<=0){setError('Enter a positive number of seats / units.');return;}
      const details=[expenseService.name, values['itemOrService']!==expenseService.name?values['itemOrService']:null, 'Request: '+values['serviceAction'], 'Billing: '+values['billingCycle'], 'Seats / units: '+units, 'Owner: '+values['serviceOwner'], values['existingServiceReference']?'Existing reference: '+values['existingServiceReference']:null].filter(Boolean).join(' · ');
      payload={...payload,itemOrService:details,purpose:details};
    }
    if (action === "issue_employee_letter") {
      const selected = employeeProfileCatalogueQuery.data?.letters.find((file) => file.fileId === values["letterFileId"]);
      if (!selected) {
        setError("Choose an available, verified HR controlled-letter original.");
        return;
      }
      payload = { memberId: values["memberId"], fileId: selected.fileId, documentId: selected.documentId, letterType: values["letterType"], referenceNumber: values["referenceNumber"], effectiveDate: values["effectiveDate"] };
    }
    if (action === "assign_employee_asset") {
      if (!employeeProfileCatalogueQuery.data?.assets.some((asset) => asset.id === values["assetRecordId"])) {
        setError("Choose a canonical serial asset from the shared register.");
        return;
      }
      payload = { memberId: values["memberId"], assetRecordId: values["assetRecordId"] };
    }
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
      {view==='budgets'&&<><ExpenseSettingsPanel accountKey={membership.organizationId+membership.membershipId} departments={data.departments} canViewTravelPolicy={admin||(lead&&actor.department_code==="OPS")}/><SharedBudgetPresentation data={data} membership={membership} onAction={open}/></>}
          {view === "tickets" && <ServiceTicketsWorkspace
        ticketGroups={departmentConfiguration.data?.departments.find(d=>d.code==="SIT")?.ticketGroups ?? []}
        departmentOptions={data.departments}
        currentUser={{role:admin?"admin":actor.role==="viewer"?"client":actor.role,name:actor.display_name,email:"",department:actor.department_code||undefined}}
        tickets={[...ticketRows,...receivedHelpTickets]}
        onUpdateTickets={()=>{}}
        sharedActions={{onCreate:category=>open("ticket_create",null,{priority:"Normal",category:category||"General"}),onStatus:id=>{const ticket=by("ticket").find(i=>i.id===id);if(ticket)open("ticket_status",ticket);},onReply:async(id,text,internal)=>{const ticket=by("ticket").find(i=>i.id===id);return ticket?await save("ticket_reply",ticket,{message:text,isInternalNote:service&&internal}):false;},onDispatchHelp:async(ticketId,departmentCode,summary)=>save("ticket_dispatch_help",null,{ticketId,departmentCode,summary}),onHelpResponse:async(requestId,response)=>{const request=by("ticket_help_request").find(item=>item.id===requestId);return request?save("ticket_help_response",request,{response}):false;},onHelpClose:async(requestId)=>{const request=by("ticket_help_request").find(item=>item.id===requestId);return request?save("ticket_help_close",request,{}):false;}}}
      />}
      {view === "profile" && <EmployeeSelfServiceWorkspace
        persona={{id:actor.membership_id,label:actor.display_name,person:actor.display_name,kind:admin?"admin":lead?"lead":"member"}}
        testMembership={membership}
        sharedProfile={{id:actor.membership_id,name:actor.display_name,employeeCode:str(own?.data["employeeCode"])||"Not recorded",email:str(own?.data["email"])||"Not recorded",phone:str(own?.data["phone"])||"Not recorded",departmentCode:actor.department_code||"Not recorded",departmentName:data.departments.find(d=>d.code===actor.department_code)?.name||"Not recorded",roleTitle:str(own?.data["roleTitle"])||"Not recorded",securityClearance:str(own?.data["securityClearance"])||"Not recorded",facilityLocation:str(own?.data["facilityLocation"])||"Not recorded",emergencyContact:str(own?.data["emergencyContact"])||"Not recorded",joiningDate:str(own?.data["joiningDate"])||"Not recorded",status:"Not recorded"}}
        letters={[]} policies={[]} trainings={[]} forms={[]} assets={[]}
        sharedCounts={{letters:by("employee_letter").filter(i=>i.ownerId===actor.membership_id).length,assets:by("employee_asset").filter(i=>i.ownerId===actor.membership_id&&i.data["custodyStatus"]==="Assigned").length,policies:personalAssignments(items,actor.membership_id,"policy").filter(i=>!["Completed","Submitted"].includes(str(i.data["status"]))).length,training:personalAssignments(items,actor.membership_id,"training").length,forms:personalAssignments(items,actor.membership_id,"form").length}}
        pendingProfileChange={by("employee_profile_change").find(i=>i.ownerId===actor.membership_id&&["Pending_HR_Review","Pending_Employee_Acknowledgement"].includes(str(i.data["status"])))}
        onRequestProfileChange={()=>open("request_profile_change",null,{memberId:actor.membership_id,...Object.fromEntries(["employeeCode","email","phone","roleTitle","joiningDate","facilityLocation","emergencyContact"].map(key=>[key,str(own?.data[key])]))})}
        onAcceptProfileChange={()=>{const pending=by("employee_profile_change").find(i=>i.ownerId===actor.membership_id&&i.data["status"]==="Pending_Employee_Acknowledgement");if(pending)void save("acknowledge_profile_change",pending,{});}}
        onRejectProfileChange={()=>{const pending=by("employee_profile_change").find(i=>i.ownerId===actor.membership_id&&i.data["status"]==="Pending_Employee_Acknowledgement");if(pending)open("reject_profile_change",pending);}}
        sharedSection={section=>{
          if(section==="letters"){
            const letters=by("employee_letter").filter(i=>i.ownerId===actor.membership_id);
            return <div className="space-y-3">{letters.map(letter=><article key={letter.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}><div><h3 className="text-sm font-semibold">{str(letter.data["title"])||str(letter.data["letterType"])||"Company letter"}</h3><p className="mt-1 text-xs text-muted-foreground">{str(letter.data["letterType"])} · {str(letter.data["referenceNumber"])} · Effective {str(letter.data["effectiveDate"])} · {str(letter.data["status"])}</p>{letter.data["status"]==="Correction_Requested"&&<p className="mt-1 text-xs text-amber-700">Correction requested: {str(letter.data["correctionReason"])}</p>}</div><div className="flex flex-wrap items-center gap-2">{["Pending_Employee_Acknowledgement","Issued"].includes(str(letter.data["status"]))&&(employeeLetterLinks[letter.id]?<a className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent" href={employeeLetterLinks[letter.id]} target="_blank" rel="noreferrer">Review original</a>:<Button size="sm" variant="outline" onClick={()=>prepareEmployeeLetter(letter)}>Review original</Button>)}{letter.data["status"]==="Pending_Employee_Acknowledgement"&&<><Button size="sm" onClick={()=>void save("acknowledge_employee_letter",letter,{acknowledged:true})}>Accept letter</Button><Button size="sm" variant="outline" onClick={()=>open("reject_employee_letter",letter)}>Request correction</Button></>}</div></article>)}{!letters.length&&<p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No HR-issued letters are linked to your profile yet.</p>}</div>;
          }
          if(section==="assets"){
            const assets=by("employee_asset").filter(i=>i.ownerId===actor.membership_id);
            return <div className="space-y-3">{assets.map(asset=><article key={asset.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}><div><h3 className="text-sm font-semibold">{str(asset.data["assetName"])||str(asset.data["assetTag"])||"Assigned company asset"}</h3><p className="mt-1 text-xs text-muted-foreground">{str(asset.data["assetTag"])} · {str(asset.data["category"])} · Serial {str(asset.data["serialNumber"])} · {str(asset.data["custodyStatus"])}</p></div>{asset.data["custodyStatus"]==="Assigned"&&(asset.data["acknowledged"]===true?<span className="text-xs text-emerald-700">Receipt acknowledged</span>:<Button size="sm" variant="outline" onClick={()=>void save("acknowledge_employee_asset",asset,{})}>Acknowledge receipt</Button>)}</article>)}{!assets.length&&<p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No serial assets are assigned to your employee profile.</p>}</div>;
          }
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
              {employeeProfileCatalogueQuery.isPending&&<p role="status" className="text-xs text-muted-foreground">Loading verified HR documents and serial assets from the shared registers…</p>}
              {employeeProfileCatalogueQuery.error&&<p role="alert" className="text-xs text-destructive">HR issue/assignment catalogue unavailable: {employeeProfileCatalogueQuery.error.message}</p>}
              {!employeeProfileCatalogueQuery.isPending&&!employeeProfileCatalogueQuery.error&&employeeProfileCatalogueQuery.data?.letters.length===0&&<p className="text-xs text-muted-foreground">No verified HR letter originals are available. Upload and verify an HR Letter in the controlled Vault first.</p>}
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
                      <div className="flex flex-wrap gap-2">
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
                        <Button size="sm" variant="outline" disabled={employeeProfileCatalogueQuery.isPending || Boolean(employeeProfileCatalogueQuery.error) || !employeeProfileCatalogueQuery.data?.letters.length} onClick={() => open("issue_employee_letter", null, { memberId: m.id, effectiveDate: businessDate() })}>Issue letter</Button>
                        <Button size="sm" variant="outline" disabled={employeeProfileCatalogueQuery.isPending || Boolean(employeeProfileCatalogueQuery.error) || !employeeProfileCatalogueQuery.data?.assets.length} onClick={() => open("assign_employee_asset", null, { memberId: m.id })}>Assign asset</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 space-y-2 border-t pt-4">
                <h3 className="text-sm font-semibold">Employee profile changes awaiting HR review</h3>
                {by("employee_profile_change").filter(change=>change.data["status"]==="Pending_HR_Review").map(change=><article key={change.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div><p className="text-sm">{data.members.find(m=>m.id===change.ownerId)?.name||"Employee"} · profile update</p><p className="text-xs text-muted-foreground">{str(change.data["reason"])} · baseline v{str(change.data["baseVersion"])||"0"}</p><dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">{Object.entries((change.data["proposedProfile"] as Record<string,unknown>)||{}).filter(([key,value])=>((change.data["baseProfile"] as Record<string,unknown>)||{})[key]!==value).map(([key,value])=><div key={key}><dt className="text-muted-foreground">{key.replace(/([A-Z])/g," $1")}</dt><dd>{String(((change.data["baseProfile"] as Record<string,unknown>)||{})[key]??"—")} → {String(value??"—")}</dd></div>)}</dl></div>
                  {change.ownerId!==actor.membership_id&&<div className="flex gap-2"><Button size="sm" onClick={()=>open("approve_profile_change",change)}>Approve</Button><Button size="sm" variant="outline" onClick={()=>open("reject_profile_change",change)}>Reject</Button></div>}
                </article>)}
                {!by("employee_profile_change").some(change=>change.data["status"]==="Pending_HR_Review")&&<p className="text-xs text-muted-foreground">No employee profile changes awaiting review.</p>}
              </div>
              <div className="mt-5 space-y-2 border-t pt-4">
                <h3 className="text-sm font-semibold">HR profile changes awaiting employee acknowledgment</h3>
                {by("employee_profile_change").filter(change=>change.data["status"]==="Pending_Employee_Acknowledgement").map(change=><article key={change.id} className="rounded-lg border p-3"><p className="text-sm">{data.members.find(m=>m.id===change.ownerId)?.name||"Employee"} · awaiting employee review</p><p className="text-xs text-muted-foreground">{Object.keys((change.data["proposedProfile"] as Record<string,unknown>)||{}).length} proposed profile fields</p></article>)}
              </div>
              <div className="mt-5 space-y-2 border-t pt-4">
                <h3 className="text-sm font-semibold">Letters awaiting HR review</h3>
                {by("employee_letter").filter(letter=>["Review","Correction_Requested"].includes(str(letter.data["status"]))).map(letter=><article key={letter.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><p className="text-sm">{data.members.find(m=>m.id===letter.ownerId)?.name||"Employee"} · {str(letter.data["letterType"])}</p><p className="text-xs text-muted-foreground">{str(letter.data["referenceNumber"])} · Effective {str(letter.data["effectiveDate"])} · {str(letter.data["status"])}</p>{letter.data["status"]==="Correction_Requested"&&<p className="text-xs text-amber-700">{str(letter.data["correctionReason"])}</p>}</div>{letter.ownerId!==actor.membership_id&&(letter.data["status"]==="Review"?<Button size="sm" onClick={()=>void save("approve_employee_letter",letter,{})}>Approve for employee review</Button>:<Button size="sm" variant="outline" onClick={()=>open("issue_employee_letter",null,{memberId:letter.ownerId||"",effectiveDate:businessDate()})}>Issue revised letter</Button>)}</article>)}
                {!by("employee_letter").some(letter=>["Review","Correction_Requested"].includes(str(letter.data["status"])))&&<p className="text-xs text-muted-foreground">No letters awaiting HR review.</p>}
              </div>
              <div className="mt-5 space-y-2 border-t pt-4">
                <h3 className="text-sm font-semibold">Current employee asset custody</h3>
                {by("employee_asset").filter(asset=>asset.data["custodyStatus"]==="Assigned").map(asset=><article key={asset.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><p className="text-sm">{data.members.find(m=>m.id===asset.ownerId)?.name||"Employee"} · {str(asset.data["assetTag"])}</p><p className="text-xs text-muted-foreground">{str(asset.data["assetName"])} · Serial {str(asset.data["serialNumber"])} · {asset.data["acknowledged"]===true?"Acknowledged":"Awaiting acknowledgment"}</p></div><Button size="sm" variant="outline" onClick={()=>open("return_employee_asset",asset)}>Record return</Button></article>)}
                {!by("employee_asset").some(asset=>asset.data["custodyStatus"]==="Assigned")&&<p className="text-xs text-muted-foreground">No serial assets are currently assigned.</p>}
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
            <DialogTitle>{action === 'request_expense' ? 'New expense request' : action?.replaceAll("_", " ")}</DialogTitle>
            <DialogDescription>
              Changes save to the shared workspace with your account identity.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            {action === "allocate" && (
              <>
                <div className="space-y-1">
                  <p className="text-xs">Department</p>
                  <SharedMasterSelect
                    label="allocation department"
                    value={values["departmentId"] || ""}
                    options={data.departments
                      .filter((department) => department.code !== "CLIENT")
                      .map((department) => ({ value: department.id, label: department.name }))}
                    required
                    onChange={(departmentId) =>
                      setValues((previous) => ({ ...previous, departmentId, category: "", projectId: "" }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs">Finance category</p>
                  <SharedMasterSelect
                    label="allocation Finance category"
                    value={values["category"] || ""}
                    options={(expenseOptions.data?.categories || []).map((category) => ({
                      value: category,
                      label: category,
                    }))}
                    required
                    disabled={
                      !values["departmentId"] ||
                      expenseOptions.isPending ||
                      expenseOptions.isFetching ||
                      Boolean(expenseOptions.error) ||
                      !expenseOptions.data?.categories.length
                    }
                    onChange={(category) =>
                      setValues((previous) => ({ ...previous, category }))
                    }
                  />
                  {!values["departmentId"] ? (
                    <p className="text-xs text-muted-foreground">Choose a department to load its configured categories.</p>
                  ) : expenseOptions.isPending || expenseOptions.isFetching ? (
                    <p className="text-xs text-muted-foreground" role="status">Loading department categories…</p>
                  ) : expenseOptions.error ? (
                    <p className="text-xs text-destructive" role="alert">Finance categories are unavailable. Retry before creating an allocation.</p>
                  ) : !expenseOptions.data?.categories.length ? (
                    <p className="text-xs text-muted-foreground">No shared Finance categories are configured for this department.</p>
                  ) : null}
                </div>
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
                {searchableSelect("projectId", "Project", data.projects.map((p) => ({ value: p.id, label: `${p.reference} · ${p.title}${p.currentStage ? ` · ${p.currentStage}` : ""}` })))}
              </>
            )}
            {action === "request_expense" && (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end">
                  {adminAllDepartments ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Department</p>
                      <SharedMasterSelect
                        label="expense department"
                        value={values["departmentId"] || ""}
                        options={data.departments
                          .filter((department) => department.code !== "CLIENT")
                          .map((department) => ({ value: department.id, label: `${department.code} · ${department.name}` }))}
                        required
                        onChange={(departmentId) => setValues((previous) => ({
                          ...previous,
                          departmentId,
                          category: "",
                          locationId: "",
                          serviceCatalogueId: "",
                          supplierId: "",
                        }))}
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs">
                      <span className="text-muted-foreground">Department</span>
                      <span className="truncate font-medium">{fixedExpenseDepartment?.name || "Your department is not configured"}</span>
                    </div>
                  )}
                  {searchableSelect("projectId","Project (optional)",data.projects.map((p)=>({value:p.id,label:`${p.reference} · ${p.title}${p.currentStage?` · ${p.currentStage}`:""}`})))}
                </div>
{expenseProject?.currentStage&&<p className="text-xs text-muted-foreground">Project stage: {expenseProject.currentStage}. Suggestions are optional and never approve spend.</p>}
<div className="grid grid-cols-3 gap-2" role="group" aria-label="Request type">{([{value:'travel',label:'Travel',description:'Travel / advance'},{value:'reimbursement',label:'Reimburse',description:'Reimbursement'},{value:'purchase',label:'Purchase',description:'Purchase'}] as const).map(option=><Button key={option.value} type="button" size="sm" title={option.description} aria-label={option.description} variant={(values['requestType']||'travel')===option.value?'default':'outline'} aria-pressed={(values['requestType']||'travel')===option.value} onClick={()=>setValues(previous=>({...previous,requestType:option.value,category:''}))}>{option.label}</Button>)}</div>
{expenseOptions.error&&<p role="alert">Expense choices could not load. {expenseOptions.error.message}</p>}
<SharedMasterSelect label="Finance category" value={values['category']||''} required disabled={!expenseDepartment||expenseOptions.isPending||expenseOptions.isFetching||Boolean(expenseOptions.error)||!expenseOptions.data?.categories.length} options={(expenseOptions.data?.categories||[]).map(value=>({value,label:value}))} onChange={category=>setValues(previous=>({...previous,category}))}/>
{!expenseDepartment?<p className="text-xs text-muted-foreground">Choose the target department to load its shared Finance categories.</p>:expenseOptions.isPending||expenseOptions.isFetching?<p role="status" className="text-xs text-muted-foreground">Loading department expense settings…</p>:expenseOptions.error?<p role="alert" className="text-xs text-destructive">Department expense settings are unavailable.</p>:!expenseOptions.data?.categories.length?<p className="text-xs text-muted-foreground">No shared Finance categories are configured for this department.</p>:null}
{expenseCategorySuggestion&&<div className="flex items-center justify-between gap-2 rounded-md bg-muted p-2 text-xs"><span>Suggested from request/project context: <strong>{expenseCategorySuggestion}</strong></span>{values['category']!==expenseCategorySuggestion&&<Button type="button" size="sm" variant="outline" onClick={()=>setValues(previous=>({...previous,category:expenseCategorySuggestion}))}>Use suggestion</Button>}</div>}
<p className="text-xs text-muted-foreground">Travel and reimbursement go to Finance; goods and service requests go to Procurement first. Choose one Finance category; no separate business-purpose field is required.</p>
{values['requestType']==='travel'&&<><div className="space-y-1"><p className="text-xs font-medium">Approved travel location</p><SharedMasterSelect label="approved travel location" value={values['locationId']||''} onChange={id=>{const chosen=expenseOptions.data?.locations.find(location=>location.id===id);setValues(previous=>({...previous,locationId:id,destination:chosen?`${chosen.name} · ${chosen.city}`:''}));}} options={(expenseOptions.data?.locations||[]).map(location=>({value:location.id,label:`${location.reference} · ${location.name} · ${location.city}`}))}/>{!(expenseOptions.data?.locations.length)&&<p className="text-xs text-muted-foreground">No approved accounting locations are configured yet.</p>}</div><ExpenseLocationRequest onRequested={()=>void expenseOptions.refetch()} disabled={busy}/><div className="grid grid-cols-2 gap-3">{field('travelStartDate','Travel start','date')}{field('travelEndDate','Travel end','date')}</div>
{Boolean(expenseDepartment)&&effectiveTravelPolicyQuery.isPending&&<p role="status" className="text-xs text-muted-foreground">Checking your effective travel policy…</p>}
{effectiveTravelPolicyQuery.error&&<div className="flex items-center gap-2 text-xs text-destructive"><p role="alert">Travel policy could not be checked. Retry before submitting.</p><Button type="button" size="sm" variant="outline" disabled={effectiveTravelPolicyQuery.isFetching} onClick={()=>void effectiveTravelPolicyQuery.refetch()}>{effectiveTravelPolicyQuery.isFetching?'Retrying…':'Retry'}</Button></div>}
{Boolean(expenseDepartment)&&effectiveTravelPolicyQuery.data&&!effectiveTravelPolicyQuery.data.isEffective&&<p role="status" className="text-xs text-muted-foreground">No published travel policy applies to this department and trip date. Policy caps are checked once Admin or Operations publishes an effective policy.</p>}
{activeTravelPolicy&&<div className="space-y-2 rounded-lg border bg-muted/30 p-3"><div><p className="text-sm font-semibold">Active travel policy · {activeTravelPolicy.employeeBand}</p><p className="text-xs text-muted-foreground">Policy version {activeTravelPolicy.policyVersion} · {travelDays||'Choose dates'} travel day(s) · {travelLocation?`${travelLocation.city} (${travelLocation.cityTier})`:'Choose an approved location'}</p></div>
<div className="grid grid-cols-2 gap-2">{field('travelTransportEstimate','Transport estimate (₹)','number',false)}{field('travelHotelRate','Hotel / night (₹)','number',false)}{field('travelHotelNights','Hotel nights','number',false)}{field('travelMealRate','Meals / day (₹)','number',false)}{field('travelMealDays','Meal days','number',false)}{field('travelLocalRate','Local travel / day (₹)','number',false)}{field('travelLocalDays','Local travel days','number',false)}</div>
{travelEstimatePreview&&<p className="text-xs">Trip estimate <strong>₹{money(travelEstimatePreview.estimate)}</strong> · advance ceiling <strong>₹{money(travelEstimatePreview.advanceCap)}</strong>{travelEstimatePreview.requiresException&&<span className="text-amber-700 dark:text-amber-300"> · Finance/Admin exception review required</span>}</p>}
{travelEstimatePreview?.requiresException&&field('travelPolicyExceptionReason','Reason for exceeding a policy cap','text')}
<p className="text-xs text-muted-foreground">The server checks hotel, meal, local travel and advance limits. Transport is included in the estimate; no transport fare cap is configured.</p></div>}
</>}
{values['requestType']==='reimbursement'&&<>{field('merchant','Merchant / payee')}{field('expenseDate','Expense date','date')}{field('receiptReference','Receipt reference','text',false)}</>}
{values['requestType']==='purchase'&&<><div className="flex gap-2" role="group" aria-label="Purchase type">{(['goods','service'] as const).map(kind=><Button key={kind} type="button" size="sm" variant={(values['purchaseKind']||'goods')===kind?'default':'outline'} aria-pressed={(values['purchaseKind']||'goods')===kind} onClick={()=>setValues(previous=>({...previous,purchaseKind:kind}))}>{kind==='goods'?'Goods / materials':'Service'}</Button>)}</div>{values['purchaseKind']==='service'&&<div className="space-y-3 rounded-lg border p-3"><SharedMasterSelect label="Service catalogue" value={values['serviceCatalogueId']||''} onChange={chooseExpenseService} options={(expenseOptions.data?.services||[]).map(item=>({value:item.id,label:item.name}))}/>{select('serviceAction','Request',[{value:'new',label:'New service'},{value:'renew',label:'Renew existing service'},{value:'seats',label:'Add seats / capacity'}],true)}<div className="grid grid-cols-2 gap-3">{select('billingCycle','Billing cycle',[{value:'Monthly',label:'Monthly'},{value:'Annual',label:'Annual'},{value:'One-time',label:'One-time'}],true)}{field('serviceSeats','Seats / units','number')}</div>{field('serviceOwner','Responsible owner')}{values['serviceAction']!=='new'&&field('existingServiceReference','Existing subscription / contract reference')}</div>}{field('itemOrService','What is needed')}{(values['purchaseKind']||'goods')==='goods'&&field('quantity','Quantity','number')}<div className="space-y-1"><p className="text-xs">Preferred supplier (optional)</p><SharedMasterSelect label="Search supplier" value={values['supplierId']||''} options={[...canonicalSuppliers.map(supplier=>({value:supplier.id,label:`${supplier.reference} · ${supplier.title} · ${supplier.status}`})),{value:'__other__',label:'Other / not listed'}]} onChange={value=>setValues(previous=>({...previous,supplierId:value==='__other__'?'':value,supplierOther:value==='__other__'?'yes':'no',supplierName:value==='__other__'?previous['supplierName']||'':''}))}/></div>{values['supplierOther']==='yes'&&field('supplierName','Supplier name / reference','text',false)}{field('quotationReference','Quote / invoice link or reference (optional)','text',false)}</>}
                {field("amount", values["requestType"] === "travel" ? "Advance requested (₹)" : "Amount requested (₹)", "number")}
                {field("currency", "Currency")}
                {field("requiredDate", "Required date", "date")}
              </>
            )}
            {action === "approve_expense" && (
              <>
                {target?.data["requestType"] === "purchase" && (
                  <dl className="grid gap-2 rounded-lg border p-3 text-sm">
                    {([
                      ["Configured service", "serviceCatalogueName"],
                      ["Purchase details", "itemOrService"],
                      ["Preferred supplier", "supplierName"],
                      ["Quote or invoice reference", "quotationReference"],
                    ] as const).map(([label, key]) => {
                      const value = key === "supplierName"
                        ? canonicalSupplierDisplay(target.data["supplierId"], target.data[key], data.suppliers)
                        : target.data[key];
                      return typeof value === "string" && value.trim() ? (
                        <div key={key}>
                          <dt className="font-medium">{label}</dt>
                          <dd className="break-words text-muted-foreground">{value}</dd>
                        </div>
                      ) : null;
                    })}
                  </dl>
                )}
                {target?.data["status"] === "Pending_Dept_Review" ? (
                  <p className="text-sm">Forward this request to Finance review.</p>
                ) : target?.data["status"] === "Pending_Procurement" ? (
                  <p className="text-sm">Confirm the purchase request has enough sourcing detail, then forward it to Finance for budget review. This does not approve spend.</p>
                ) : (
                  select(
                    "allocationId",
                    "Exact allocation",
                    by("allocation")
                      .filter(
                        (i) =>
                          (i.data["status"] === undefined || i.data["status"] === "Approved") &&
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
            {(action === "approve_travel_exception" || action === "reject_travel_exception") && target && (
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <p className="font-medium">Travel-policy exception review</p>
                <p>{str(target.data["requesterName"])} · {str(target.data["destination"])} · {str(target.data["currency"])} {money(target.data["amount"])}</p>
                <p className="text-xs text-muted-foreground">Trip estimate {str(target.data["currency"])} {money(target.data["travelEstimate"])} · policy advance ceiling {str(target.data["currency"])} {money(target.data["travelAdvanceCap"])}</p>
                <p className="text-xs">Reason: {str(target.data["travelPolicyExceptionReason"]) || "—"}</p>
                {action === "reject_travel_exception" && field("reason", "Decision reason")}
                {action === "approve_travel_exception" && <p className="text-xs text-muted-foreground">This clears the policy exception only; the request continues through its normal approval path.</p>}
              </div>
            )}
            {action === "post_expense" && (
              <>
                {field("actualAmount", "Verified actual amount", "number")}
                {field("postingRef", "Finance posting reference")}
                {field("evidenceRef", "Receipt / invoice evidence reference")}
              </>
            )}
            {(action === "reject_expense" || action === "reject_allocation" || action === "reject_travel_exception") && field("reason", "Reason")}
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
                {searchableSelect("projectId", "Project", data.projects.map((p) => ({ value: p.id, label: `${p.reference} · ${p.title}` })), true)}
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
                {select("travelBand", "Travel policy band", [
                  { value: "staff", label: "Staff / individual contributor" },
                  { value: "manager", label: "Department lead / manager" },
                  { value: "senior", label: "Senior leadership" },
                ])}
                {field("reason","Reason for profile change")}
              </>
            )}
            {action === "request_profile_change" && (
              <>
                <p className="text-xs text-muted-foreground">Your existing profile stays active until HR/Admin approves this request. Provide a reason so the reviewer can verify the change.</p>
                {["employeeCode","email","phone","roleTitle","joiningDate","facilityLocation","emergencyContact"].map(key=>field(key,key.replace(/([A-Z])/g," $1"),key==="joiningDate"?"date":"text",false))}
                {field("reason","Reason for change")}
              </>
            )}
            {action === "approve_profile_change" && target && <div className="space-y-2 rounded-lg border p-3"><p className="text-sm font-medium">Approve this employee’s proposed baseline change?</p><p className="text-xs text-muted-foreground">The current baseline stays active until approval. Reason: {str(target.data["reason"])}</p><dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">{Object.entries((target.data["proposedProfile"] as Record<string,unknown>)||{}).filter(([key,value])=>((target.data["baseProfile"] as Record<string,unknown>)||{})[key]!==value).map(([key,value])=><div key={key}><dt className="text-muted-foreground">{key.replace(/([A-Z])/g," $1")}</dt><dd>{String(((target.data["baseProfile"] as Record<string,unknown>)||{})[key]??"—")} → {String(value??"—")}</dd></div>)}</dl></div>}
            {action === "acknowledge_profile_change" && <p className="text-sm">Accept the proposed HR/Admin change and make it the active employee profile?</p>}
            {action === "reject_profile_change" && <>{field("reason","Reason / correction needed")}</>}
            {action === "reject_employee_letter" && <>{field("reason","Correction requested (required)")}</>}
            {action === "issue_employee_letter" && (
              <>
                <p className="text-xs text-muted-foreground">The issued letter links to a verified HR controlled original; this does not generate or alter the document file.</p>
                {employeeProfileCatalogueQuery.error&&<p role="alert" className="text-xs text-destructive">{employeeProfileCatalogueQuery.error.message}</p>}
                {searchableSelect("letterFileId","Verified HR letter original",(employeeProfileCatalogueQuery.data?.letters||[]).map(file=>({value:file.fileId,label:`${file.title} · ${file.revision} · ${file.originalName}`})),true)}
                {select("letterType","Letter type",["Appointment","Confirmation","Promotion","Relieving","Experience","SOP_Notice","Bonus_Award"].map(value=>({value,label:value.replaceAll("_"," ")})),true)}
                {field("referenceNumber","Official letter reference")}
                {field("effectiveDate","Effective date","date")}
              </>
            )}
            {action === "assign_employee_asset" && (
              <>
                <p className="text-xs text-muted-foreground">Choose an existing shared Asset record with a serial number. Stock inventory and custody assignment remain separate.</p>
                {searchableSelect("assetRecordId","Canonical serial asset",(employeeProfileCatalogueQuery.data?.assets||[]).map(asset=>({value:asset.id,label:`${asset.assetTag} · ${asset.title} · SN ${asset.serialNumber}`})),true)}
              </>
            )}
            {action === "approve_employee_letter" && <p className="text-sm">Approve this verified HR original for the employee to review. It becomes issued only after the employee accepts it.</p>}
            {action === "acknowledge_employee_letter" && <p className="text-sm">Confirm this HR-approved letter after reviewing its verified original.</p>}
            {action === "reject_employee_letter" && <>{field("reason","Correction requested (required)")}</>}
            {action === "acknowledge_employee_asset" && <p className="text-sm">Confirm receipt of the assigned serial asset.</p>}
            {action === "return_employee_asset" && <>{field("reason","Return condition / handover note")}</>}
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

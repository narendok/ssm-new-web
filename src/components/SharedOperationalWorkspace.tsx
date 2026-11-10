import { SharedLifecycleWorkspace } from './SharedLifecycleWorkspace';
import { stageUploadAllowed } from '@/lib/stage-upload-access';
import { attachReusableRevisionToRecord, getLifecycleWorkspace } from '@/lib/lifecycle-workspace.functions';
import { InlineCustomerModal } from "./InlineCustomerModal";
import { SharedSalesPipeline } from "./SharedSalesPipeline";
import { SharedMasterSelect } from "./SharedMasterSelect";
import { sharedMasterOptions } from "@/lib/shared-master-options";
import { automaticRecordReference, procurementTrack, revisionOptions, referenceAtRevision, sharedSupplierOptions } from "@/lib/record-form-options";
import { SharedSupplierSelect } from "./SharedSupplierSelect";
import { InlineSupplierModal, InlinePartModal, type SupplierRecordItem, type PartRecordItem } from "./InlineMasterModals";
import type { RecordField } from "@/lib/record-form-catalogue";
import { hardwareAttachmentForRecordType, hardwareStageForRecordType, recordFormSpec, recordFields, recordFieldValues } from "@/lib/record-form-catalogue";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSharedTestWorkspace, mutateSharedTestWorkspace } from "@/lib/shared-test.functions";
import { registerSharedDocument } from "@/lib/shared-vault.functions";
import { beginControlledDocumentUpload, completeControlledDocumentUpload } from "@/lib/controlled-documents.functions";
import { getCoordination } from "./SharedProjectAnalysis";
import { DepartmentProjectWorkspace } from "./DepartmentProjectWorkspace";
import { SharedTestWorkspace } from "./SharedTestWorkspace";
import { ApprovalsFullPageView, type ApprovalRecord } from "./ApprovalsFullPageView";
import type { TaskRecord, TeamMember } from "./DepartmentLeadCoordinationCenter";
import type { TestMembership } from "@/lib/test-auth.functions";
import type { SharedJson, SharedTestAction } from "@/lib/shared-test.schema";
import { businessDate } from "@/lib/business-date";
import { CANONICAL_STAGE_TEMPLATES } from "@/lib/canonical-lifecycle";
import { COMPANY_PHASES, readLifecycleBaseline } from "@/lib/lifecycle-baseline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
type Register = "Projects" | "Records" | "Tasks" | "Approvals" | "Documents";
export function SharedOperationalWorkspace({
  membership,
  view,
  darkMode,
  onLogout,
  adminDepartment,
  initialProjectScope,
  recordTypeFilter,
  onClearRecordTypeFilter,
  onOpenInputs,
  onOpenVault,
  onOpenTasks,
}: {
  membership: TestMembership;
  view: string;
  darkMode: boolean;
  onLogout: () => Promise<void>;
  adminDepartment?: string;
  initialProjectScope?: string | undefined;
  recordTypeFilter?: string | null | undefined;
  onClearRecordTypeFilter?: (() => void) | undefined;
  onOpenInputs?: ((sourceId?:string) => void) | undefined;
  onOpenVault?: ((documentId?:string,projectId?:string)=>void) | undefined;
  onOpenTasks: () => void;
}) {
  const [reuseOpen,setReuseOpen] = useState(false);
  const [reuseRevisionId,setReuseRevisionId]=useState(''),[reuseAssessment,setReuseAssessment]=useState('');
  const attachReuse=useServerFn(attachReusableRevisionToRecord),loadReuse=useServerFn(getLifecycleWorkspace);
  const reuseOptions=useQuery({queryKey:['lifecycle-workspace',membership.membershipId],queryFn:()=>loadReuse(),retry:false});
  const load = useServerFn(getSharedTestWorkspace),
    coordination = useServerFn(getCoordination),
    write = useServerFn(mutateSharedTestWorkspace),
    registerDocument = useServerFn(registerSharedDocument),
    beginFileUpload = useServerFn(beginControlledDocumentUpload),
    completeFileUpload = useServerFn(completeControlledDocumentUpload);
  const query = useQuery({
    queryKey: ["shared-test-workspace", membership.organizationId, membership.membershipId],
    queryFn: () => load(),
    refetchInterval: 15000,
    retry: 1,
  });
  const common = useQuery({
    queryKey: ["project-coordination", membership.organizationId, membership.membershipId],
    queryFn: () => coordination(),
    refetchInterval: 15000,
    retry: 1,
  });
  const [scope, setScope] = useState(initialProjectScope || "all"),
    [department, setDepartment] = useState(""),
    [advanced, setAdvanced] = useState<Register | null>(null);
  const [form, setForm] = useState<"create_project" | "create_record" | "update_record" | null>(
      null,
    ),
    [recordId, setRecordId] = useState(""),
    [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [recordFile, setRecordFile] = useState<File | null>(null),
    [persistedRecord, setPersistedRecord] = useState<{ id: string; reference: string; revision:string } | null>(null),
    [attachmentDocumentId, setAttachmentDocumentId] = useState<string | null>(null),
    [inlineSupplierOpen, setInlineSupplierOpen] = useState(false),
    [inlinePartOpen, setInlinePartOpen] = useState(false),
    [inlineCustomerOpen, setInlineCustomerOpen] = useState(false);


  const lock = useRef(false),
    createRecordRequestId = useRef<string | null>(null),
    createDocumentRequestId = useRef<string | null>(null),
    createReuseRequestId = useRef<string|null>(null),
    retry = useRef<{ signature: string; id: string } | null>(null);
  async function save(action: SharedTestAction, payload: Record<string, SharedJson>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    const signature = JSON.stringify([action, payload]);
    if (retry.current?.signature !== signature)
      retry.current = { signature, id: crypto.randomUUID() };
    try {
      await write({ data: { action, payload, requestId: retry.current.id } });
      retry.current = null;
      setNotice("Saved to the shared workspace.");
      setForm(null);
      await Promise.all([query.refetch(), common.refetch(), reuseOptions.refetch()]);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed. Your input is preserved.");
      void query.refetch();
      return false;
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  if (query.isPending)
    return <p className="text-sm text-muted-foreground">Loading your shared workspace…</p>;
  if (query.error || !query.data)
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p role="alert">
          {query.error instanceof Error ? query.error.message : "Shared data unavailable"}
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  const data = query.data,
    actor = data.membership;
  const actorDeptId = data.departments.find((d) => d.code === actor.department_code)?.id || "";
  const purDeptId = data.departments.find((d) => d.code === "PUR")?.id || actorDeptId || "";

  const leadsDepartment = (code: string) => data.departments.some((item) => item.code === code && item.lead_member_id === actor.membership_id);
  const canAddCustomer = actor.role === "admin" || actor.department_code === "SAL" || (actor.role === "department_lead" && leadsDepartment("SAL"));
  const canAddSupplier = actor.role === "admin" || actor.department_code === "PUR" || (actor.role === "department_lead" && leadsDepartment("PUR"));
  const canAddPart = actor.role === "admin" || ["EHW", "FW", "SW", "MECH", "PUR"].includes(actor.department_code || "") || (actor.role === "department_lead" && data.departments.some((item) => ["EHW", "FW", "SW", "MECH", "PUR"].includes(item.code) && item.lead_member_id === actor.membership_id));

  async function handleSharedSupplierCreated(supplier: SupplierRecordItem) {
    const requestId = supplier.operationId || crypto.randomUUID();
    const controlledRef = `HLPL-SUP-${requestId.slice(0, 8).toUpperCase()}`;
    const res = (await write({
      data: {
        action: "create_record",
        payload: {
          title: supplier.name,
          reference: controlledRef,
          record_type: "Supplier",
          department_id: purDeptId,
          fields: {
            name: supplier.name,
            category: supplier.category,
            spocName: supplier.spocName,
            spocEmail: supplier.spocEmail || "",
            spocPhone: supplier.spocPhone || "",
            verification_status: "Pending_Verification",
            revision: "01",
          },
          notes: "Inline registered supplier · Pending Verification",
        },
        requestId,
      },
    })) as { id?: string } | null;

    if (!res?.id) {
      throw new Error("Supplier registration failed: No canonical UUID was returned by the database.");
    }

    await Promise.all([query.refetch(), common.refetch()]);
    const createdId = res.id;
    setValues((prev) => ({
      ...prev,
      supplier: createdId,
      supplierId: createdId,
      supplierName: supplier.name,
    }));
    setNotice(`Supplier ${supplier.name} saved to Supplier Master.`);
    setInlineSupplierOpen(false);
  }

  async function handleSharedPartCreated(part: PartRecordItem) {
    const requestId = part.operationId || crypto.randomUUID();
    const controlledRef = `HLPL-PRT-${requestId.slice(0, 8).toUpperCase()}`;
    const res = (await write({
      data: {
        action: "create_record",
        payload: {
          title: `${part.mpn} · ${part.description}`,
          reference: controlledRef,
          record_type: "Part",
          department_id: actorDeptId,
          fields: {
            mpn: part.mpn,
            description: part.description,
            manufacturer: part.manufacturer || "",
            packageFootprint: part.packageFootprint || "",
            category: part.category,
            release_status: "Engineering_Only",
            revision: "01",
          },
          notes: "Inline registered component · Engineering Only",
        },
        requestId,
      },
    })) as { id?: string } | null;

    if (!res?.id) {
      throw new Error("Component part registration failed: No canonical UUID was returned by the database.");
    }

    await Promise.all([query.refetch(), common.refetch()]);
    const createdId = res.id;
    setValues((prev) => ({
      ...prev,
      part: createdId,
      partId: createdId,
      mpn: part.mpn,
    }));
    setNotice(`Component ${part.mpn} saved to Part Master.`);
    setInlinePartOpen(false);
  }
  const targetDeptCode = adminDepartment
    ? (adminDepartment === "sales" ? "SAL" : adminDepartment === "hrops" ? "HR" : adminDepartment.toUpperCase())
    : "";
  const resolvedAdminDept = adminDepartment
    ? data.departments.find(
        (d) =>
          d.id === adminDepartment ||
          d.code.toUpperCase() === targetDeptCode ||
          d.code.toLowerCase() === adminDepartment.toLowerCase()
      )
    : null;
  const selectedDepartment =
    actor.role === "admin"
      ? (resolvedAdminDept?.id || department || data.departments.find((d) => d.code === "EHW")?.id || data.departments[0]?.id || "")
      : actor.role === "department_lead" && resolvedAdminDept?.lead_member_id === actor.membership_id
        ? resolvedAdminDept.id
        : (department || data.departments.find((d) => d.code === actor.department_code)?.id || "");
  const dept = data.departments.find((d) => d.id === selectedDepartment);
  const supplierOptions = sharedSupplierOptions(data.records);
  const originalRecord = data.records.find(r => r.id === recordId);
  const generatedReferenceBase = automaticRecordReference(data.records.find(r => r.id === values["projectId"] && r.record_type === "Project")?.reference || "", dept?.code || "", values["record_type"] || "");
  const revisions = revisionOptions(form === "update_record" ? originalRecord?.reference || "" : generatedReferenceBase, data.records, form === "update_record" ? String(originalRecord?.fields["revision"] || "01") : undefined);
  const selectedRevision = revisions.some(option => option.value === values["revision"]) ? values["revision"]! : revisions[0]!.value;
  const selectedProjectRecord=data.records.find(r=>r.record_type==="Project"&&r.id===values["projectId"]);
  const projectBaseline=readLifecycleBaseline(String(selectedProjectRecord?.fields['lifecycleBaseline']||''));
  const configuredRecordStages=projectBaseline?.stages ?? CANONICAL_STAGE_TEMPLATES.map(stage=>({code:stage.stageCode,name:stage.name,phase:stage.phaseCode,department:stage.defaultOwner,exitTypes:[]}));
  const spec=recordFormSpec(dept?.code || actor.department_code || '',projectBaseline?.stages.filter(stage=>stage.department===dept?.code).flatMap(stage=>stage.exitTypes));
  const projectStageCandidates=[selectedProjectRecord?.fields["currentStage"],selectedProjectRecord?.fields["lifecycleStage"],selectedProjectRecord?.stage].map(value=>typeof value==="string"?value:"").filter(Boolean);
  const projectStageCode=projectStageCandidates.find(code=>configuredRecordStages.some(stage=>stage.code===code))||"";
  const projectStoredStageLabel=projectStageCandidates[0]||"";
  const configuredProjectStage=configuredRecordStages.find(stage=>stage.code===projectStageCode);
  const projectStage=configuredProjectStage ? {...configuredProjectStage,stageCode:configuredProjectStage.code,phaseTitle:configuredProjectStage.phase} : undefined;
  const projectPhaseCode=String(selectedProjectRecord?.fields["companyPhase"]||"");
  const projectPhase=COMPANY_PHASES.find(([code])=>code===projectPhaseCode);
  const mappedAttachment=form==="create_record"?hardwareAttachmentForRecordType(values["record_type"]||""):undefined;
  const attachmentSpec=form==="create_record"&&(mappedAttachment||projectStage)?mappedAttachment||{
    documentType:"Technical document",
    label:`${values["record_type"]||"Record"} supporting original file`,
    accept:".pdf,.doc,.docx,.xlsx,.csv,.zip,.png,.jpg,.jpeg",
    stageCode:projectStageCode,
  }:undefined;
  const attachmentStageCode=attachmentSpec?.stageCode||"";
  const attachmentAllowedAtStage=stageUploadAllowed(configuredRecordStages,projectStageCode,attachmentStageCode,data.tasks.filter(task=>task.record_id===selectedProjectRecord?.id&&task.stage_code&&task.status!=='Cancelled').map(task=>task.stage_code!));

  async function uploadRecordAttachment(documentId: string, file: File, revision: string) {
    if (!file.size || file.size > 25 * 1024 * 1024) throw new Error("Choose a non-empty file up to 25 MB.");
    const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())))
      .map(value => value.toString(16).padStart(2, "0")).join("");
    const upload = await beginFileUpload({ data: {
      documentId, revision, name: file.name,
      contentType: file.type || "application/octet-stream", sizeBytes: file.size, checksum,
    } });
    if (!upload.duplicate) {
      if (!upload.signedUploadUrl) throw new Error("Private upload link is unavailable. Keep this file selected and retry.");
      const response = await fetch(upload.signedUploadUrl, {
        method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file,
      });
      if (!response.ok) throw new Error("Private upload did not finish. Keep this file selected and retry.");
    }
    await completeFileUpload({ data: { fileId: upload.file.id } });
  }

  async function saveNewRecordWithAttachment(payload: Record<string, SharedJson>) {
    if(recordFile&&!attachmentAllowedAtStage){setError("Original upload is available only for the record's mapped current or immediately previous project stage. Check the selected project stage first.");return;}
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    let recordForRetry = persistedRecord;
    try {
      let linkedRecord = persistedRecord;
      if (!linkedRecord) {
        createRecordRequestId.current ||= crypto.randomUUID();
        const result = await write({ data: {
          action: "create_record", payload, requestId: createRecordRequestId.current,
        } }) as { id?: string } | null;
        if (!result?.id) throw new Error("Record save did not return its shared record reference.");
        linkedRecord = { id: result.id, reference: generatedReference, revision:selectedRevision };
        recordForRetry = linkedRecord;
        setPersistedRecord(linkedRecord);
      }

      if(reuseRevisionId){
        if(recordFile)throw new Error('Choose one original: upload a new file or reuse an existing revision.');
        createReuseRequestId.current ||= crypto.randomUUID();
        await attachReuse({data:{recordId:linkedRecord.id,projectId:values['projectId']!,assetRevisionId:reuseRevisionId,assessment:reuseAssessment,requestId:createReuseRequestId.current}});
      } else if (recordFile && attachmentSpec) {
        let documentId = attachmentDocumentId;
        if (!documentId) {
          createDocumentRequestId.current ||= crypto.randomUUID();
          const registered = await registerDocument({ data: {
            requestId: createDocumentRequestId.current,
            payload: {
              title: String(payload["title"] || values["title"] || ""),
              documentType: attachmentSpec.documentType,
              scope: "internal",
              departmentId: selectedDepartment,
              projectId: String(payload["project_id"] || values["projectId"] || ""),
              recordId: linkedRecord.id,
            },
          } });
          documentId = registered.id;
          setAttachmentDocumentId(documentId);
        }
        await uploadRecordAttachment(documentId, recordFile, linkedRecord.revision);
      }

      setNotice(reuseRevisionId?'Record saved with its pinned reusable original for evaluation; no approval or release was recorded.':recordFile
        ? `${linkedRecord.reference} saved with its original file as an internal Draft. It is not approved or released.`
        : "Saved to the shared workspace.");
      setForm(null);
      setRecordFile(null);
      setPersistedRecord(null);
      setAttachmentDocumentId(null);
      createRecordRequestId.current = null;
      createDocumentRequestId.current = null;
      createReuseRequestId.current=null;setReuseRevisionId('');setReuseAssessment('');
      await Promise.all([query.refetch(), common.refetch(), reuseOptions.refetch()]);
    } catch (e) {
      setError(recordForRetry
        ? `Record ${recordForRetry.reference} is saved as a Draft. The file is not complete yet; keep it selected and retry. ${e instanceof Error ? e.message : "Upload failed."}`
        : e instanceof Error ? e.message : "Record save failed. Your input is preserved.");
      void query.refetch();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  const renderFieldInput = (field: RecordField) => {
    if (field.readOnly) {
      return <input className={fieldClass} value={field.automaticLabel || field.automaticValue || ""} readOnly aria-readonly="true" />;
    }
    if (field.master === "suppliers") {
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SharedSupplierSelect
              options={supplierOptions}
              value={values[field.key] || ""}
              onChange={(value) => setValues({ ...values, [field.key]: value, supplierId: value })}
            />
          </div>
          {canAddSupplier && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 h-9 text-xs"
              onClick={() => setInlineSupplierOpen(true)}
            >
              + Add Supplier
            </Button>
          )}
        </div>
      );
    }
    if (field.master === "parts") {
      const partOptions = sharedMasterOptions(data.records, ["Part"]);
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SharedMasterSelect label={field.label} options={partOptions} required={!!field.required}
              value={data.records.find(r => r.record_type === "Part" && [r.id, r.reference].includes(values[field.key] || ""))?.id || values[field.key] || ""}
              onChange={id => { const part = data.records.find(r=>r.id===id); setValues(previous=>({...previous,[field.key]:id,partId:id,mpn:String(part?.fields["mpn"] || "")})); }}/>
          </div>
          {canAddPart && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 h-9 text-xs"
              onClick={() => setInlinePartOpen(true)}
            >
              + Add Part
            </Button>
          )}
        </div>
      );
    }
    if (field.master) {
      if(field.master === 'locations') {
        const locations=sharedMasterOptions(data.records,['Location','Facility']);
        return locations.length ? <SharedMasterSelect label={field.label} options={locations} required={!!field.required} value={values[field.key]||''} onChange={value=>setValues(previous=>({...previous,[field.key]:value}))}/> : <input aria-label={field.label} className={fieldClass} required={!!field.required} placeholder="Record work location" value={values[field.key]||''} onChange={e=>setValues(previous=>({...previous,[field.key]:e.target.value}))}/>;
      }
      const options = field.master === "people"
        ? data.members.filter(m=>m.department_id===selectedDepartment).map(m=>({value:m.id,label:m.display_name || m.id}))
        : sharedMasterOptions(data.records, field.master === "customers" ? ["Customer"] : field.master === "products" ? ["Product", "Project"] : field.master === "routes" ? ["Production route", "Route"] : ["Controlled document"]);
      return <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><SharedMasterSelect label={field.label} options={options} required={!!field.required} value={values[field.key] || ""}
        onChange={id=>setValues(previous=>({...previous,[field.key]:id,...(field.master==="customers" ? {customerId:id} : {})}))}/></div>{field.master === "customers" && canAddCustomer && <Button type="button" variant="outline" size="sm" onClick={()=>setInlineCustomerOpen(true)}>+ Add Customer</Button>}</div>;
    }
    if (field.options) {
      return (
        <select
          className={fieldClass}
          required={field.required}
          value={values[field.key] || ""}
          onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
        >
          <option value="">Choose…</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        className={fieldClass}
        type={field.kind === "date" ? "date" : "text"}
        required={field.required}
        value={values[field.key] || ""}
        onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
      />
    );
  };

  const generatedReference = generatedReferenceBase ? referenceAtRevision(generatedReferenceBase, selectedRevision) : "";
  const source = data.records.filter(
    (r) =>
      !selectedDepartment || r.department_id === selectedDepartment || r.record_type === "Project",
  );
  const byId = new Map((common.error ? [] : common.data?.records || []).map((r) => [r.id, r]));
  const status = (value: string): TaskRecord["status"] =>
    (({
      draft: "Draft",
      open: "Open",
      "in progress": "Open",
      "in review": "In review",
      approved: "Approved",
      released: "Released",
      complete: "Released",
      completed: "Released",
      archived: "Archived",
    })[value.toLowerCase()] || "Open") as TaskRecord["status"];
  const projectRows: TaskRecord[] = source
    .filter((r) => r.record_type === "Project")
    .map((r) => ({
      id: r.id,
      reference: r.reference,
      title: r.title,
      type: r.record_type,
      status: status(r.status),
      priority: "Normal",
      area: (data.departments.find((d)=>d.id===r.department_id)?.code || actor.department_code || "home").toLowerCase(),
      createdAt: r.updated_at,
      updatedAt: r.updated_at,
      notes: r.notes,
      fields: {
        ...Object.fromEntries(
          Object.entries(r.fields).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        ),
        lifecycleStage: String(r.fields["currentStage"]||r.fields["lifecycleStage"]||r.stage||""),
        completedStages: JSON.stringify(r.fields["completedStages"] || r.fields["completed_stages"] || []),
        omittedStages:JSON.stringify(r.fields['omittedStages']||{}),
        certificationRequired:String(r.fields['certificationRequired']??''),
      },
    }));
  const records: TaskRecord[] = [
    ...source
      .filter((r) => r.record_type !== "Project")
      .map((r) => ({
        id: r.id,
        reference: r.reference,
        title: r.title,
        type: r.record_type,
        status: status(r.status),
        priority: "Normal" as const,
        area: (data.departments.find((d)=>d.id===r.department_id)?.code || actor.department_code || "home").toLowerCase(),
        createdAt: r.updated_at,
        updatedAt: r.updated_at,
        notes: r.notes,
        fields: {
          ...Object.fromEntries(
            Object.entries(r.fields).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          ),
          projectId: byId.get(r.id)?.fields["projectId"] || "",
        },
      })),
    ...data.tasks
      .filter(
        (t) =>
          (!selectedDepartment || t.department_id === selectedDepartment) &&
          (actor.role !== "member" || t.assignee_id === actor.membership_id),
      )
      .map((t) => ({
        id: t.id,
        reference: `TASK-${t.id.slice(0, 8)}`,
        title: t.title,
        type: "Task",
        status: status(t.status),
        priority: (["Critical", "High", "Normal", "Low"].includes(t.priority)
          ? t.priority
          : "Normal") as TaskRecord["priority"],
        area: (data.departments.find((d)=>d.id===t.department_id)?.code || actor.department_code || "home").toLowerCase(),
        createdAt: t.updated_at,
        updatedAt: t.updated_at,
        notes: t.description || "",
        fields: {
          projectId: t.record_id || "",
          stageCode: t.stage_code || "",
          assignee: data.members.find((m) => m.id === t.assignee_id)?.display_name || "Unassigned",
          dueDate: t.due_at ? businessDate(new Date(t.due_at)) : "",
          workStatus: t.status === "In Progress" ? "In progress" : "To do",
        },
      })),
  ];
  const team: TeamMember[] = data.members
    .filter((m) => !selectedDepartment || m.department_id === selectedDepartment)
    .map((m) => ({
      name: m.display_name || m.id,
      area: (data.departments.find((d)=>d.id===m.department_id)?.code || actor.department_code || "home").toLowerCase(),
      role: m.role,
      score: "Not recorded",
      level: "Not recorded",
      skills: [],
    }));
  const approvals: ApprovalRecord[] = data.approvals.map((a) => ({
    id: a.id,
    title: a.title,
    recordId: a.record_id || "",
    outcome: ({
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      returned: "Returned",
    }[a.outcome] || "Pending") as ApprovalRecord["outcome"],
    updatedAt: a.updated_at,
    comments: a.decision_notes,
    department: data.departments.find((d) => d.id === a.reviewer_department_id)?.code,
      approverAuthority: data.departments.find((d) => d.id === a.reviewer_department_id)?.code,
    description: a.evidence_revision
      ? `Evidence revision ${a.evidence_revision}`
      : "Evidence not recorded",
  }));
  function openCreate(kind: "create_project" | "create_record") {
    setForm(kind);
    setRecordId("");
    setRecordFile(null);
    setReuseRevisionId('');setReuseAssessment('');createReuseRequestId.current=null;
    setPersistedRecord(null);
    setAttachmentDocumentId(null);
    createRecordRequestId.current = null;
    createDocumentRequestId.current = null;
    const scopedProject=data.records.find((p)=>p.record_type==='Project'&&[p.id,p.reference].includes(scope));
    const scopedBaseline=readLifecycleBaseline(String(scopedProject?.fields['lifecycleBaseline']||''));
    const scopedCandidates=[scopedProject?.fields['currentStage'],scopedProject?.fields['lifecycleStage'],scopedProject?.stage].map(v=>typeof v==='string'?v:'').filter(Boolean);
    const scopedCode=scopedCandidates.find(code=>scopedBaseline?.stages.some(s=>s.code===code));
    const scopedStage=scopedBaseline?.stages.find(s=>s.code===scopedCode);
    const scopedSpec=recordFormSpec(dept?.code||actor.department_code||'',scopedBaseline?.stages.filter(s=>s.department===dept?.code).flatMap(s=>s.exitTypes));
    const defaultRecordType=kind==='create_record'
      ? scopedStage?.exitTypes.find(type=>scopedSpec?.types.includes(type))||spec?.types[0]||''
      : spec?.types[0]||'';
    setValues({
      revision: "01",
      projectId: scopedProject?.id || "",
      record_type: defaultRecordType,
      ...(kind==='create_record'&&scopedStage?{title:`${scopedProject?.title||scopedProject?.reference} · ${scopedStage.name} · Draft`}:{}),
      procurementTrack: procurementTrack(defaultRecordType) || "",
    });
    setError("");
  }
  function openRecord(id: string) {
    const r = data.records.find((r) => r.id === id);
    if (!r) {
      setError("This record is unavailable in your current access. Refresh the workspace and try again.");
      return;
    }
    if (r.record_type === "Project") {
      setScope(r.reference);
      return;
    }
    setRecordId(r.id);
    setValues({
      ...Object.fromEntries(
        Object.entries(r.fields).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
      notes: r.notes,
    });
    setError("");
    setForm("update_record");
  }
  async function updateTask(id: string, patch: Partial<TaskRecord>) {
    const task = data.tasks.find((t) => t.id === id);
    if (!task) return;
    if (patch.status === "Cancelled") {
      const reason = patch.notes || patch.fields?.["cancellation_reason"] || patch.fields?.["reason"];
      if (!reason || String(reason).trim().length < 5) {
        setError("A substantive cancellation reason (minimum 5 characters) is required to cancel a task.");
        return;
      }
      await save("cancel_task", {
        id,
        reason: String(reason).trim(),
        expected_updated_at: task.updated_at,
      });
      return;
    }
    const targetStatus =
      patch.status === "Released" || patch.status === "Approved"
        ? "Complete"
        : patch.status === "In review"
          ? "In review"
          : patch.fields?.["workStatus"] === "In progress"
            ? "In Progress"
            : patch.status === "Open"
              ? "Open"
              : task.status;
    const payload: Record<string, SharedJson> = {
      id,
      status: targetStatus,
      expected_updated_at: task.updated_at,
    };
    if (patch.fields?.["assignee"] !== undefined) {
      if (actor.role !== "department_lead") {
        setError("Only the department lead can reassign tasks.");
        return;
      }
      const matches = data.members.filter(
        (m) =>
          m.display_name === patch.fields!["assignee"] && m.department_id === task.department_id,
      );
      if (matches.length !== 1) {
        setError("Choose one verified department member.");
        return;
      }
      payload["assignee_id"] = matches[0]!.id;
    }
    await save("update_task", payload);
  }
  async function decide(id: string, outcome: string, notes?: string) {
    const approval = data.approvals.find((a) => a.id === id);
    return approval
      ? save("decide_approval", {
          id,
          outcome,
          notes: notes || "",
          expected_updated_at: approval.updated_at,
        })
      : false;
  }
  if (advanced)
    return (
      <section className="space-y-3">
        <Button variant="outline" onClick={() => setAdvanced(null)}>
          Back to project workspace
        </Button>
        <SharedTestWorkspace
          membership={membership}
          initialTab={advanced}
          darkMode={darkMode}
          onLogout={onLogout}
        />
      </section>
    );
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded border border-primary/30 bg-primary/10 px-2 py-1 text-xs">
          TEST · {actor.display_name}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenVault ? onOpenVault() : setAdvanced("Documents")}>
            Document files
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-600">
          {notice}
        </p>
      )}
      {reuseOpen && <SharedLifecycleWorkspace scopeKey={membership.membershipId} mode="assets" onClose={()=>setReuseOpen(false)}/>}
      {busy && <p className="text-xs">Saving…</p>}
      {view === "approvals" ? (
        <ApprovalsFullPageView
          approvals={approvals}
          projects={projectRows}
          records={records}
          currentUser={actor.display_name}
          userRole={actor.role === "member" ? "Employee" : "Lead"}
          onBack={onOpenTasks}
          onApprove={(id, notes) => decide(id, "approved", notes)}
          onReject={(id, reason) => decide(id, "rejected", reason)}
          onReturn={(id, reason) => decide(id, "returned", reason)}
        />
      ) : (
        <DepartmentProjectWorkspace onOpenAssetCatalog={()=>setReuseOpen(true)}
          sharedTestMembership={membership}
          salesPipelineView={(dept?.code || actor.department_code)==="SAL" ? <SharedSalesPipeline snapshot={{...data,records:data.records.filter(r=>!["Enquiry","Opportunity"].includes(r.record_type)||scope==="all"||records.some(row=>row.id===r.id&&[scope,projectRows.find(p=>p.id===scope||p.reference===scope)?.id,projectRows.find(p=>p.id===scope||p.reference===scope)?.reference].includes(row.fields["projectId"])))}} onRefresh={async()=>{await Promise.all([query.refetch(),common.refetch()]);}} onOpenInputs={onOpenInputs}/> : undefined}
          departmentCode={dept?.code || actor.department_code || "ALL"}
          departmentName={dept?.name || actor.department_name || "Projects"}
          lead={
            data.members.find((m) => m.id === dept?.lead_member_id)?.display_name || "Not recorded"
          }
          records={records}
          projects={projectRows}
          documents={data.documents
            .filter((d) => !selectedDepartment || d.department_id === selectedDepartment)
            .map((d) => ({
              id: d.id,
              title: d.title,
              type: d.document_type,
              revision:reuseOptions.data?.files.filter(f=>f.documentId===d.id).map(f=>f.revision).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).at(-1),
              lifecycle:reuseOptions.isPending || reuseOptions.isFetching
                ? 'Checking original · Draft'
                : reuseOptions.error
                  ? 'Original status unavailable · Draft'
                  : reuseOptions.data?.files.some(f=>f.documentId===d.id)
                    ? 'Original available · Draft'
                    : 'No original uploaded · Draft',
              linkedRecordRefs: d.record_id ? [d.record_id] : [],
            }))}
          approvals={approvals}
          team={team}
          projectScope={scope}
          recordTypeFilter={recordTypeFilter}
          onClearRecordTypeFilter={onClearRecordTypeFilter}
          onOpenInputs={onOpenInputs}
          onProjectChange={setScope}
          initialTab={
            view === "assignee" || view === "queue"
              ? "tasks"
              : view === "records"
                ? "records"
                : view === "deliverables"
                  ? "deliverables"
                  : undefined
          }
          onCreateRecord={() => openCreate("create_record")}
          onCreateDeliverable={() => onOpenVault ? onOpenVault(undefined,projectRows.find(p=>p.id===scope||p.reference===scope)?.id) : setAdvanced("Documents")}
          onCreateProject={undefined}
          onOpenRecord={openRecord}
          onOpenApprovals={() => setAdvanced('Approvals')}
          onOpenDocument={id => onOpenVault ? onOpenVault(id,projectRows.find(p=>p.id===scope||p.reference===scope)?.id) : setAdvanced("Documents")}
          onUpdateTask={(id, patch) => void updateTask(id, patch)}
          onRequestStageReview={actor.role === "admin" || actor.role === "department_lead" ? async (projectId, stageCode, notes) => {
            const project = data.records.find(record => record.id === projectId);
            if (!project) return false;
            return await save("request_stage_completion", { project_id: projectId, stage_code: stageCode, notes: notes || "", expected_updated_at: project.updated_at });
          } : undefined}
          onAdvanceStage={actor.role === "admin" || actor.role === "department_lead" ? async (projectId, targetStage, notes) => {
            const project = data.records.find(record => record.id === projectId);
            if (!project) return false;
            return await save("advance_stage", {
              project_id: projectId,
              target_stage: targetStage,
              expected_updated_at: project.updated_at,
              notes: notes || "",
            });
          } : undefined}
          onCreateTask={async (task) => {
            const project = projectRows.find((p) => [p.id, p.reference].includes(task.projectId));
            if (!project) {
              setError("Select a saved project first.");
              return false;
            }
            const matches = data.members.filter(
              (m) =>
                m.display_name === task.assignee &&
                (!selectedDepartment || m.department_id === selectedDepartment),
            );
            if (task.assignee && matches.length !== 1) {
              setError("Choose one verified member.");
              return false;
            }
            return save("create_task", {
              project_id: project.id,
              department_id: selectedDepartment,
              title: task.title,
              priority: task.priority,
              assignee_id: actor.role === "member" ? actor.membership_id : matches[0]?.id || null,
              due_at: task.dueDate
                ? new Date(`${task.dueDate}T17:00:00+05:30`).toISOString()
                : null,
            });
          }}
        />
      )}
      <Dialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setForm(null);
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[85vh] overflow-x-hidden overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form === "update_record"
                ? "Edit original record"
                : form === "create_project"
                  ? "New project"
                  : "New record"}
            </DialogTitle>
            <DialogDescription>
              Saved using your authenticated identity. Formal approvals use their original workflow.
            </DialogDescription>
          </DialogHeader>
          <form
            className="min-w-0 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form) return;
              if (form === "update_record") {
                const original = data.records.find((r) => r.id === recordId);
                if (!original) return;
                const fields: Record<string,string> = {...values, revision:selectedRevision}; const notes = fields["notes"]; delete fields["notes"];
                void save("update_record", {
                  record_id: recordId,
                  expected_updated_at: original.updated_at,
                  fields: { ...original.fields, ...fields },
                  notes: notes || "",
                });
              } else if (form === "create_record") {
                let fields: Record<string, string>;
                try {
                  if (!spec) throw new Error("No record types configured for this department.");
                  fields = recordFieldValues(spec, values["record_type"] || "", {
                    ...values,
                    revision: selectedRevision,
                    ...(procurementTrack(values["record_type"] || "") ? { procurementTrack: procurementTrack(values["record_type"] || "")! } : {}),
                  });
                } catch (error) {
                  setError(error instanceof Error ? error.message : "Invalid record fields.");
                  return;
                }
                void saveNewRecordWithAttachment({
                  title: values["title"] || "",
                  reference: generatedReference,
                  project_id: values["projectId"] || null,
                  department_id: selectedDepartment,
                  record_type: values["record_type"] || "",
                  fields,
                  currentStage:hardwareStageForRecordType(values["record_type"]||"")?.code||attachmentStageCode,
                  lifecycleStage:hardwareStageForRecordType(values["record_type"]||"")?.code||attachmentStageCode,
                  companyPhase:configuredRecordStages.find(stage=>stage.code===(hardwareStageForRecordType(values["record_type"]||"")?.code||attachmentStageCode))?.phase||"",
                  notes: values["notes"] || "",
                });
              } else {
                const fields = {};
                void save(form, {
                  title: values["title"] || "",
                  reference: values["reference"] || "",
                  project_id: values["projectId"] || null,
                  department_id: selectedDepartment,
                  record_type: values["record_type"] || "",
                  fields,
                  notes: values["notes"] || "",
                });
              }
            }}
          >
            {form !== "update_record" && (
              <>
                {["title", "reference"].map((key) => (
                  <label key={key} className="grid gap-1 text-xs">
                    {key === "reference" ? (form === "create_record" ? "Record reference · generated automatically" : "Project code") : "Title"}
                    <input
                      className={fieldClass}
                      required
                      disabled={Boolean(persistedRecord)}
                      value={key === "reference" && form === "create_record" ? generatedReference : values[key] || ""}
                      readOnly={key === "reference" && form === "create_record"}
                      placeholder={key === "reference" && form === "create_record" ? "Select project and record type" : undefined}
                      onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                    />
                  </label>
                ))}
                {form === "create_record" && (
                  <>
                    <label className="grid gap-1 text-xs">
                      Project · choose this searchable field; the generated record reference above is read-only ({projectRows.length} available)
                      <SharedMasterSelect label="Project" required disabled={Boolean(persistedRecord)} options={projectRows.map(p=>({value:p.id,label:`${p.reference} · ${p.title}`}))} value={values["projectId"] || ""} onChange={id=>{
                        const project=data.records.find(r=>r.id===id);
                        const baseline=readLifecycleBaseline(String(project?.fields['lifecycleBaseline']||''));
                        const candidates=[project?.fields['currentStage'],project?.fields['lifecycleStage'],project?.stage].map(v=>typeof v==='string'?v:'').filter(Boolean);
                        const current=candidates.find(code=>baseline?.stages.some(s=>s.code===code));
                        const stageDef=baseline?.stages.find(s=>s.code===current);
                        const nextSpec=recordFormSpec(dept?.code||actor.department_code||'',baseline?.stages.filter(s=>s.department===dept?.code).flatMap(s=>s.exitTypes));
                        const desired=stageDef?.exitTypes.find(type=>nextSpec?.types.includes(type))||'';
                        setValues(previous=>({...previous,projectId:id,...(desired?{['record_type']:desired}:{}),...(!previous['title']&&stageDef?{['title']:`${project?.title||project?.reference} · ${stageDef.name} · Draft`}:{})}));
                      }}/>

                    </label>
                    {values["projectId"]&&<section aria-label="Automatic project phase and stage" className="rounded-md border bg-muted/20 p-2 text-xs sm:col-span-2"><p className="font-medium">Project phase and record stage · automatic</p><p>{projectPhase?`${projectPhase[0]} · ${projectPhase[1]}`:projectStage?.phaseTitle||"Canonical phase not recorded"}</p><p>{projectStage?`${projectStage.stageCode} · ${projectStage.name}`:projectStoredStageLabel?`Legacy stage label: ${projectStoredStageLabel} · canonical stage code not recorded`:"No current lifecycle stage is recorded for this project."}</p>{!projectStage&&projectStoredStageLabel&&<p className="text-muted-foreground">Stage-bound upload stays locked until this legacy label is reconciled to a canonical stage; no phase is guessed.</p>}{mappedAttachment&&projectStage&&<p className="text-muted-foreground">This record’s original is mapped to {mappedAttachment.stageCode}; upload is enabled only at that stage or its immediate predecessor.</p>}</section>}
                    <label className="grid gap-1 text-xs">
                      Record type
                      <select aria-label="Record type" className={fieldClass} required disabled={Boolean(persistedRecord)} value={values["record_type"] || ""}
                        onChange={(e) => { setRecordFile(null); setValues({title: values["title"] || "", reference: values["reference"] || "", projectId: values["projectId"] || "", revision: values["revision"] || "01", notes: values["notes"] || "", record_type: e.target.value, procurementTrack: procurementTrack(e.target.value) || ""}); }}>
                        <option value="">Choose record type…</option>
                        {(spec?.types || []).map(type => {const m=type.match(/^Stage evidence · ((?:G\d|HW|FW|SW)_\d+)$/);const bound=m?configuredRecordStages.find(s=>s.code===m[1]):undefined;return <option key={type} value={type}>{bound?`${bound.code} · ${bound.name} evidence`:type}</option>})}
                      </select>
                    </label>
                    {spec && recordFields(spec, values["record_type"] || "").filter(field => field.key !== "projectId").filter(field => field.key !== "procurementTrack" || !procurementTrack(values["record_type"] || "")).map(field => (
                      <label key={field.key} className="grid gap-1 text-xs">{field.label}
                        {renderFieldInput(field)}
                      </label>
                    ))}
                    {attachmentSpec && (
                      <div className="grid gap-2 text-xs"><label className="grid gap-1 text-xs">
                        {attachmentSpec.label} · optional, attached to this record
                        <input
                          className={fieldClass}
                          aria-label={attachmentSpec.label}
                          type="file"
                          accept={attachmentSpec.accept}
                          disabled={busy || Boolean(attachmentDocumentId) || Boolean(persistedRecord) || !values["projectId"] || !attachmentAllowedAtStage}
                          onChange={event => {setRecordFile(event.target.files?.[0] || null);setReuseRevisionId('');}}
                        />
                        {recordFile && <span className="text-muted-foreground">Selected: {recordFile.name} · {(recordFile.size / 1024).toFixed(1)} KB</span>}
                        <span className="text-muted-foreground">{attachmentAllowedAtStage?`This record is linked to ${attachmentSpec.stageCode}. One Save creates the Draft record and privately links its original. A file does not advance the project or count as approval or release.`:!projectStageCode?"Upload is locked because the selected project has no canonical current-stage code. You can still save the draft record now.":`Upload is locked until the project reaches ${attachmentSpec.stageCode} (or the immediately following stage). Current project stage: ${projectStageCode}.`}</span>
                      </label><label className="grid gap-1">Or reuse an existing original revision<select aria-label="Reuse an existing original revision" className={fieldClass} disabled={busy||Boolean(persistedRecord)||!values['projectId']||!attachmentAllowedAtStage} value={reuseRevisionId} onChange={e=>{setReuseRevisionId(e.target.value);setRecordFile(null);}}><option value="">Upload a new file / no reuse</option>{reuseOptions.data?.assets.map(a=><option key={a.id} value={a.id}>{String(a.definition['title'])} · r{String(a.definition['revision'])} · {String(a.definition['status'])}</option>)}</select></label>{reuseOptions.error&&<p role="alert">Reusable revisions could not be loaded. {attachmentAllowedAtStage?"You can still upload a new original file.":"New uploads remain locked until the selected project’s phase and stage allow this record."}</p>}{reuseRevisionId&&<label className="grid gap-1">Intended use / compatibility<textarea aria-label="Record reuse compatibility" className={fieldClass} required minLength={5} disabled={Boolean(persistedRecord)} value={reuseAssessment} onChange={e=>setReuseAssessment(e.target.value)}/><span>Links the exact original revision for evaluation. Stock and source files remain unchanged.</span></label>}</div>
                    )}
                  </>
                )}
              </>
            )}
                    {form === 'update_record'&&originalRecord?.fields['reusedOriginalDocumentId']&&<div className="rounded border border-border p-3 text-xs"><p>Reused original · revision {String(originalRecord.fields['reusedOriginalRevision'])} · evaluation link</p><p>{String(originalRecord.fields['reuseAssessment'])}</p><button type="button" className="underline" onClick={()=>onOpenVault?.(String(originalRecord.fields['reusedOriginalDocumentId']),String(originalRecord.fields['reusedSourceProjectId']))}>Open source original</button></div>}
                    {form === "update_record" && spec && recordFields(spec, data.records.find(r => r.id === recordId)?.record_type || "").filter(field => field.key !== "projectId").filter(field => field.key !== "procurementTrack" || !procurementTrack(originalRecord?.record_type || "")).map(field => (
                      <label key={field.key} className="grid gap-1 text-xs">{field.label}
                        {renderFieldInput(field)}
                      </label>
                    ))}
            {form !== "create_project" && (
              <label className="grid gap-1 text-xs">
                Revision
                <select className={fieldClass} required disabled={Boolean(persistedRecord)} value={selectedRevision} onChange={e => setValues({...values,revision:e.target.value})}>
                  {revisions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <span className="text-xs text-muted-foreground">Sequence is based on this record reference, not other projects or record types.</span>
              </label>
            )}
            <label className="grid gap-1 text-xs">
              Notes
              <textarea
                className={fieldClass}
                disabled={Boolean(persistedRecord)}
                value={values["notes"] || ""}
                onChange={(e) => setValues({ ...values, notes: e.target.value })}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {persistedRecord && <p role="status" className="text-xs text-muted-foreground">Record {persistedRecord.reference} is saved as a Draft. Complete the selected original-file upload here to finish this one-step entry.</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => { if (persistedRecord && recordFile) setNotice(`${persistedRecord.reference} remains a Draft; its original file was not completed.`); setForm(null); }}>
                Cancel
              </Button>
              <Button disabled={busy || (Boolean(persistedRecord) && !recordFile&&!reuseRevisionId)}>{busy ? recordFile ? "Saving record & private file…" : "Saving record…" : persistedRecord ? "Retry original file" : reuseRevisionId?'Save record & link revision':recordFile ? "Save record & upload original" : "Save record"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {inlineCustomerOpen && <InlineCustomerModal onClose={()=>setInlineCustomerOpen(false)} onSave={async customer=>{
        const result = await write({data:{action:"create_record",requestId:customer.operationId,payload:{record_type:"Customer",reference:`HLPL-CUS-${customer.operationId.slice(0,8).toUpperCase()}`,title:customer.name,fields:{name:customer.name,spocName:customer.contact,spocEmail:customer.email,revision:"01"}}}}) as {id?:string};
        if(!result?.id) throw new Error("Customer save did not return a persisted ID.");
        await query.refetch();
        setValues(previous=>({...previous,customer:result.id!,customerId:result.id!,customerName:customer.name}));
        setInlineCustomerOpen(false);
      }}/>}
      {inlineSupplierOpen && (
        <InlineSupplierModal
          onClose={() => setInlineSupplierOpen(false)}
          onSupplierCreated={handleSharedSupplierCreated}
        />
      )}
      {inlinePartOpen && (
        <InlinePartModal
          onClose={() => setInlinePartOpen(false)}
          onPartCreated={handleSharedPartCreated}
        />
      )}
    </section>
  );
}

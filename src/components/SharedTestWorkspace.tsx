import { automaticRecordReference, procurementTrack, revisionOptions, referenceAtRevision, sharedSupplierOptions } from "@/lib/record-form-options";
import { taskProjectId } from "@/lib/department-scope";
import { stageUploadAllowed } from '@/lib/stage-upload-access';
import { SharedSupplierSelect } from "./SharedSupplierSelect";
import { hardwareAttachmentForRecordType, hardwareStageForRecordType, recordFormSpec, recordFields, recordFieldValues } from "@/lib/record-form-catalogue";
import { CANONICAL_STAGE_TEMPLATES, getRecordedProjectTrack, computeProgressiveStageAndTaskState, recordedCompletedStageCodes } from "@/lib/canonical-lifecycle";
import { COMPANY_PHASES, readLifecycleBaseline, projectLifecycleStages, recordedStageOmissions } from "@/lib/lifecycle-baseline";
import { projectLifecycleContext } from '@/lib/lifecycle-record-presentation';
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSharedTestWorkspace,
  mutateSharedTestWorkspace,
  resetSharedTestSamplePack,
} from "@/lib/shared-test.functions";
import { registerSharedDocument } from "@/lib/shared-vault.functions";
import {
  beginControlledDocumentUpload,
  completeControlledDocumentUpload,
  getControlledDocumentDownload,
  listControlledDocumentFiles,
} from "@/lib/controlled-documents.functions";
import type { SharedJson, SharedTestAction, SharedTestSnapshot } from "@/lib/shared-test.schema";
import type { TestMembership } from "@/lib/test-auth.functions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Tab = "Projects" | "Records" | "Tasks" | "Approvals" | "Documents" | "Activity";
const tabs: Tab[] = ["Projects", "Records", "Tasks", "Approvals", "Documents", "Activity"];
const taskStatuses = ["Open", "In Progress", "In review", "Complete"];
const input = "rounded-md border border-input bg-background px-3 py-2 text-sm";
const button =
  "rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-40 hover:bg-accent";
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—";

export function SharedTestWorkspace({
  membership,
  onLogout,
  darkMode,
  initialTab = "Tasks",
  adminDepartment,
  standaloneDocuments = false,
}: {
  adminDepartment?: string;
  membership: TestMembership;
  onLogout: () => Promise<void>;
  darkMode: boolean;
  initialTab?: Tab | undefined;
  standaloneDocuments?: boolean;
}) {
  const load = useServerFn(getSharedTestWorkspace),
    write = useServerFn(mutateSharedTestWorkspace),
    resetSamplePack = useServerFn(resetSharedTestSamplePack);
  const beginUpload = useServerFn(beginControlledDocumentUpload),
    completeUpload = useServerFn(completeControlledDocumentUpload),
    download = useServerFn(getControlledDocumentDownload),
    listFiles = useServerFn(listControlledDocumentFiles);
  const registerDocument = useServerFn(registerSharedDocument);
  const query = useQuery({
    queryKey: ["shared-test-workspace", membership.organizationId, membership.membershipId],
    queryFn: () => load(),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const [tab, setTab] = useState<Tab>(initialTab),
    [projectId, setProjectId] = useState("all");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [form, setForm] = useState<SharedTestAction | null>(null),
    [values, setValues] = useState<Record<string, string>>({});
  const [reviewer, setReviewer] = useState(""),
    [decisionNotes, setDecisionNotes] = useState("");
  const [fileDocument, setFileDocument] = useState<SharedTestSnapshot["documents"][number] | null>(
    null,
  );
  const [files, setFiles] = useState<Awaited<ReturnType<typeof listFiles>>>([]),
    [file, setFile] = useState<File | null>(null),
    [revision, setRevision] = useState("01");
  const [recordFile,setRecordFile]=useState<File|null>(null),
    [persistedRecord,setPersistedRecord]=useState<{id:string;reference:string;revision:string}|null>(null),
    [recordAttachmentDocumentId,setRecordAttachmentDocumentId]=useState<string|null>(null);
  const [stageTarget, setStageTarget] = useState<Record<string, string>>({});
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentProjectFilter, setDocumentProjectFilter] = useState("all");
  const pendingRequest = useRef<{ signature: string; id: string } | null>(null);
  const createRecordRequestId=useRef<string|null>(null),
    createRecordDocumentRequestId=useRef<string|null>(null);
  async function run(action: SharedTestAction, payload: Record<string, SharedJson>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const signature = JSON.stringify([action, payload]);
      if (pendingRequest.current?.signature !== signature)
        pendingRequest.current = { signature, id: crypto.randomUUID() };
      await write({ data: { action, payload, requestId: pendingRequest.current.id } });
      pendingRequest.current = null;
      await query.refetch();
      setNotice("Saved to shared TEST database.");
      setForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      await query.refetch();
    } finally {
      setBusy(false);
    }
  }
  async function resetCanonicalSamplePack() {
    if (
      !window.confirm(
        "Reset the shared TEST sample pack for every web and app tester? This restores the fictional canonical projects and clears only their sample tasks, reviews, and linked draft records. Other TEST projects, accounts, and uploaded binary files are kept.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await resetSamplePack({
        data: { runId: "LC2-2026-10-28", requestId: crypto.randomUUID() },
      });
      await query.refetch();
      setNotice("Shared TEST sample pack restored for web and app testers.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "TEST sample reset failed.";
      setError(
        /reset_shared_test_sample_pack|schema cache/i.test(message)
          ? "Shared TEST reset is not installed on this backend yet. No sample data was reset."
          : message,
      );
      await query.refetch();
    } finally {
      setBusy(false);
    }
  }
  const data = query.data!;
  if (query.isPending)
    return (
      <main
        className={`${darkMode ? "dark" : ""} grid min-h-screen place-items-center bg-background text-foreground`}
      >
        Loading authenticated shared TEST records…
      </main>
    );
  if (query.error || !data)
    return (
      <main
        className={`${darkMode ? "dark" : ""} grid min-h-screen place-items-center bg-background p-6 text-foreground`}
      >
        <section className="max-w-xl space-y-4">
          <h1 className="text-xl font-semibold">Shared TEST workspace unavailable</h1>
          <p role="alert">
            {query.error instanceof Error
              ? query.error.message
              : "The backend returned no workspace."}
          </p>
          <p>Changes require the shared backend. Your browser-local demo is preserved.</p>
          <button className={button} onClick={() => void query.refetch()}>
            Retry connection
          </button>{" "}
          <button className={button} onClick={() => void onLogout()}>
            Sign out
          </button>
        </section>
      </main>
    );
  const actor = data.membership,
    admin = actor.role === "admin",
    lead = actor.role === "department_lead",
    viewer = actor.role === "viewer";
  const targetDeptCode = adminDepartment ? (adminDepartment === "sales" ? "SAL" : adminDepartment === "hrops" ? "HR" : adminDepartment.toUpperCase()) : "";
  const resolvedAdminDept = adminDepartment ? data.departments.find(d => d.id === adminDepartment || d.code.toUpperCase() === targetDeptCode || d.code.toLowerCase() === adminDepartment.toLowerCase()) : null;
  const ownDepartment = admin ? (resolvedAdminDept?.id || data.departments.find(d => d.code === "EHW")?.id || data.departments[0]?.id) : data.departments.find((d) => d.code === actor.department_code)?.id;
  const selectedDepartment = values["department_id"] || ownDepartment || "";
  const supplierOptions = sharedSupplierOptions(data.records);
  const originalRecord = data.records.find(record => record.id === values["record_id"]);
  const generatedReferenceBase = automaticRecordReference(data.records.find(r => r.id === values["project_id"] && r.record_type === "Project")?.reference || "", data.departments.find(d => d.id === selectedDepartment)?.code || "", values["record_type"] || "");
  const revisions = revisionOptions(form === "update_record" ? originalRecord?.reference || "" : generatedReferenceBase, data.records, form === "update_record" ? String(originalRecord?.fields["revision"] || "01") : undefined);
  const selectedRevision = revisions.some(option => option.value === values["revision"]) ? values["revision"]! : revisions[0]!.value;
  const generatedReference = generatedReferenceBase ? referenceAtRevision(generatedReferenceBase, selectedRevision) : "";
  const projects = data.records.filter((r) => r.record_type === "Project");
  const recordProject=projects.find(project=>project.id===(values["project_id"]||""));
  const recordBaseline=readLifecycleBaseline(String(recordProject?.fields['lifecycleBaseline']||''));
  const configuredRecordStages=recordBaseline?.stages ?? CANONICAL_STAGE_TEMPLATES.map(stage=>({code:stage.stageCode,name:stage.name,phase:stage.phaseCode,department:stage.defaultOwner}));
  const recordDepartmentCode=data.departments.find(d=>d.id===selectedDepartment)?.code||'';
  const spec=recordFormSpec(recordDepartmentCode,recordBaseline?.stages.filter(stage=>stage.department===recordDepartmentCode).flatMap(stage=>stage.exitTypes));
  const recordProjectStageCandidates=[recordProject?.fields["currentStage"],recordProject?.fields["lifecycleStage"],recordProject?.stage].map(value=>typeof value==="string"?value:"").filter(Boolean);
  const recordProjectStageCode=recordProjectStageCandidates.find(code=>configuredRecordStages.some(stage=>stage.code===code))||"";
  const recordProjectStoredStageLabel=recordProjectStageCandidates[0]||"";
  const configuredRecordProjectStage=configuredRecordStages.find(stage=>stage.code===recordProjectStageCode);
  const recordProjectStage=configuredRecordProjectStage ? {...configuredRecordProjectStage,stageCode:configuredRecordProjectStage.code,phaseTitle:configuredRecordProjectStage.phase} : undefined;
  const recordProjectPhaseCode=String(recordProject?.fields["companyPhase"]||"");
  const recordProjectPhase=COMPANY_PHASES.find(([code])=>code===recordProjectPhaseCode);
  const mappedRecordAttachment=form==="create_record"?hardwareAttachmentForRecordType(values["record_type"]||""):undefined;
  const recordAttachmentSpec=form==="create_record"&&(mappedRecordAttachment||recordProjectStage)?mappedRecordAttachment||{
    documentType:"Technical document",
    label:`${values["record_type"]||"Record"} supporting original file`,
    accept:".pdf,.doc,.docx,.xlsx,.csv,.zip,.png,.jpg,.jpeg",
    stageCode:recordProjectStageCode,
  }:undefined;
  const recordAttachmentStageCode=recordAttachmentSpec?.stageCode||"";
  const recordAttachmentAllowed=stageUploadAllowed(configuredRecordStages,recordProjectStageCode,recordAttachmentStageCode,data.tasks.filter(task=>task.record_id===recordProject?.id&&task.stage_code&&task.status!=='Cancelled').map(task=>task.stage_code!));
  const activeProjectId = projectId === "all" || projects.some((project) => project.id === projectId)
    ? projectId
    : "all";
  const projectLinkedRecords = data.records.map((record) => ({
    id: record.id,
    reference: record.reference,
    type: record.record_type,
    fields: record.fields,
  }));
  const taskProject = (recordId: string | null) =>
    taskProjectId({ recordId }, projectLinkedRecords);
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.reference || "—";
  const documentProject = (document: SharedTestSnapshot["documents"][number]) => {
    const record = data.records.find((item) => item.id === document.record_id);
    const projectRefs = [
      document.record_id || "",
      ...["projectId", "project_id", "linkedProjectId", "projectCode", "projectReference", "project"]
        .map((key) => String(record?.fields[key] || "")),
    ];
    return projects.find((project) => projectRefs.includes(project.id) || projectRefs.includes(project.reference));
  };
  const visibleDocuments = data.documents.filter((document) => {
    const project = documentProject(document);
    const record = data.records.find((item) => item.id === document.record_id);
    const searchText = `${document.title} ${document.document_type} ${project?.reference || ""} ${project?.title || ""} ${record?.reference || ""} ${record?.title || ""}`.toLowerCase();
    return (documentProjectFilter === "all" || project?.id === documentProjectFilter) &&
      (!documentSearch.trim() || searchText.includes(documentSearch.trim().toLowerCase()));
  });
  const deptName = (id: string | null) => data.departments.find((d) => d.id === id)?.code || "—";
  const memberName = (id: string | null) =>
    data.members.find((m) => m.id === id)?.display_name || "Unassigned";
  const filteredTasks = data.tasks.filter((task) =>
    activeProjectId === "all" || taskProject(task.record_id) === activeProjectId,
  );
  const filteredRecords = data.records.filter((r) => r.record_type !== "Project");
  const pending = data.approvals.filter((a) => a.outcome === "pending");
  const myTasks = data.tasks.filter(
    (t) => t.assignee_id === actor.membership_id && t.status !== "Complete",
  );
  function open(action: SharedTestAction, initial: Record<string, string> = {}) {
    setError("");
    if(action==="create_record"){
      setRecordFile(null);setPersistedRecord(null);setRecordAttachmentDocumentId(null);
      createRecordRequestId.current=null;createRecordDocumentRequestId.current=null;
    }
    setForm(action);
    setValues({
      project_id: activeProjectId === "all" ? projects[0]?.id || "" : activeProjectId,
      department_id: ownDepartment || data.departments[0]?.id || "",
      fields: '{"revision":"01"}',
      revision: "01",
      ...initial,
    });
  }
  function field(key: string, label: string, type = "text") {
    return (
      <label className="grid gap-1 text-xs" key={key}>
        {label}
        <input
          className={input}
          type={type}
          value={key === "reference" && form === "create_record" ? generatedReference : values[key] || ""}
          readOnly={key === "reference" && form === "create_record"}
          placeholder={key === "reference" && form === "create_record" ? "Select project and record type" : undefined}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        />
      </label>
    );
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, SharedJson> = { ...values };
    try {
      if (form === "create_record" || form === "update_record")
        payload["fields"] = {
          ...JSON.parse(values["fields"] || "{}"),
          revision: selectedRevision,
          scope: values["scope"] || "",
          requirements: values["requirements"] || "",
          acceptanceCriteria: values["acceptanceCriteria"] || "",
        };
      if (form === "create_record") {
        if (!spec) throw new Error("No record types configured for this department.");
        payload["fields"] = {...payload["fields"] as Record<string, SharedJson>, ...recordFieldValues(spec, values["record_type"] || "", {...values,projectId:values['project_id']||'',revision:selectedRevision,...(procurementTrack(values["record_type"] || "") ? {procurementTrack:procurementTrack(values["record_type"] || "")!} : {})})};
        const mappedStage=hardwareStageForRecordType(values["record_type"]||"")?.code||recordAttachmentStageCode;
        if(mappedStage){
          payload["currentStage"]=mappedStage;
          payload["lifecycleStage"]=mappedStage;
          payload["companyPhase"]=configuredRecordStages.find(stage=>stage.code===mappedStage)?.phase||"";
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "The saved record fields could not be read.");
      return;
    }
    if (form === "create_record") payload["reference"] = generatedReference;
    if (values["due_at"]) payload["due_at"] = values["due_at"] + "T12:00:00+05:30";
    if(form==="create_record"&&recordFile){void saveRecordWithOriginal(payload);return;}
    if (form) await run(form, payload);
  }
  async function openFiles(doc: SharedTestSnapshot["documents"][number]) {
    setBusy(true);
    setError("");
    try {
      setFiles(await listFiles({ data: { documentId: doc.id } }));
      setFileDocument(doc);
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "File list failed.");
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (!file || !fileDocument) return;
    setBusy(true);
    setError("");
    try {
      const checksum = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const result = await beginUpload({
        data: {
          documentId: fileDocument.id,
          revision,
          name: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          checksum,
        },
      });
      if (result.signedUploadUrl) {
        const response = await fetch(result.signedUploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!response.ok) throw new Error("Private upload failed. Retry before using this file.");
      }
      await completeUpload({ data: { fileId: result.file.id } });
      setFiles(await listFiles({ data: { documentId: fileDocument.id } }));
      setFile(null);
      setNotice("Private attachment uploaded and checked.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function saveRecordWithOriginal(payload: Record<string,SharedJson>) {
    const selectedFile=recordFile;
    const attachment=recordAttachmentSpec;
    if(!selectedFile||!attachment)return;
    if(!recordAttachmentAllowed){setError("Original upload is available only for the mapped current project stage or its immediately previous stage.");return;}
    if(selectedFile.size<=0||selectedFile.size>25*1024*1024){setError("Choose a non-empty file up to 25 MB.");return;}
    setBusy(true);setError("");setNotice("");
    let saved=persistedRecord;
    try{
      let linked=saved;
      if(!linked){
        createRecordRequestId.current ||= crypto.randomUUID();
        const result=await write({data:{action:"create_record",payload,requestId:createRecordRequestId.current}}) as {id?:string}|null;
        if(!result?.id)throw new Error("Record save did not return its shared reference.");
        linked={id:result.id,reference:generatedReference,revision:selectedRevision};
        saved=linked;setPersistedRecord(linked);
      }
      let documentId=recordAttachmentDocumentId;
      if(!documentId){
        createRecordDocumentRequestId.current ||= crypto.randomUUID();
        const registered=await registerDocument({data:{requestId:createRecordDocumentRequestId.current,payload:{
          title:String(payload["title"]||values["title"]||""),
          documentType:attachment.documentType,
          scope:"internal",
          departmentId:selectedDepartment,
          projectId:String(payload["project_id"]||values["project_id"]||""),
          recordId:linked.id,
        }}});
        documentId=registered.id;setRecordAttachmentDocumentId(documentId);
      }
      const checksum=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await selectedFile.arrayBuffer()))).map(value=>value.toString(16).padStart(2,"0")).join("");
      const uploadResult=await beginUpload({data:{documentId,revision:linked.revision,name:selectedFile.name,contentType:selectedFile.type||"application/octet-stream",sizeBytes:selectedFile.size,checksum}});
      if(!uploadResult.duplicate){
        if(!uploadResult.signedUploadUrl)throw new Error("Private upload link is unavailable. Keep the file selected and retry.");
        const response=await fetch(uploadResult.signedUploadUrl,{method:"PUT",headers:{"Content-Type":selectedFile.type||"application/octet-stream"},body:selectedFile});
        if(!response.ok)throw new Error("Private upload did not finish. Keep the file selected and retry.");
      }
      await completeUpload({data:{fileId:uploadResult.file.id}});
      await query.refetch();
      setNotice(`${linked.reference} saved with its original as an internal Draft. It is not approved or released.`);
      setForm(null);setRecordFile(null);setPersistedRecord(null);setRecordAttachmentDocumentId(null);
      createRecordRequestId.current=null;createRecordDocumentRequestId.current=null;
    }catch(e){
      setError(saved?`Record ${saved.reference} is saved as a Draft. The file is not complete yet; keep it selected and retry. ${e instanceof Error?e.message:"Upload failed."}`:e instanceof Error?e.message:"Record save failed. Your input is preserved.");
      await query.refetch();
    }finally{setBusy(false);}
  }
  async function advanceProject(project: SharedTestSnapshot["records"][number]) {
    const target=stageTarget[project.id];
    if(!target || !projectStageOptions(project).some(stage=>stage.stageCode===target)){setError('Choose an eligible stage from the saved project settings.');return;}
    await run('advance_stage',{project_id:project.id,target_stage:target,expected_updated_at:project.updated_at});
  }
  function projectStageOptions(project:SharedTestSnapshot['records'][number]) {
    const fields=project.fields as Record<string,string>;
    const baseline=readLifecycleBaseline(fields['lifecycleBaseline']),track=getRecordedProjectTrack(fields);
    if(!baseline||!track)return [];
    return computeProgressiveStageAndTaskState({projectId:project.id,track,
      stageDefinitions:projectLifecycleStages(baseline,track,fields['certificationRequired']==='true'),
      completedStageCodes:recordedCompletedStageCodes(fields['completedStages']),
      inProgressStageCodes:[fields['currentStage']||project.stage||''],
      omittedStageCodes:Object.keys(recordedStageOmissions(fields['omittedStages'])),
      enableCertification:fields['certificationRequired']==='true',
    }).stages.filter(stage=>stage.status==='ready');
  }
  return (
    <main className={`${darkMode ? "dark" : ""} min-h-screen bg-background text-foreground`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <p className="text-xs font-bold uppercase text-primary">
            {standaloneDocuments ? "Project Documents & Vault" : `Shared TEST · ${actor.organization_name}`}
          </p>
          <h1 className="text-lg font-semibold">
            {standaloneDocuments ? "Department-accessible project files" : `${actor.display_name} · ${actor.department_code || "Administration"}`}
          </h1>
          <p className="text-xs text-muted-foreground">
            {standaloneDocuments
              ? "Browse controlled document records and their original files and revisions. Access follows your department permissions."
              : `${actor.role} · Updated ${date(data.serverTime)} · refreshes every 10 seconds`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!standaloneDocuments && <span className="text-xs">
            Inbox: {pending.length} reviews · {myTasks.length} assigned tasks
          </span>}
          <button
            className={button}
            disabled={busy || query.isFetching}
            onClick={() => void query.refetch()}
          >
            Refresh
          </button>
          <button className={button} onClick={() => void onLogout()}>
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] space-y-4 p-4 md:p-6">
        {!standaloneDocuments && <nav aria-label="Shared TEST sections" className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item}
              className={`${button} ${tab === item ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => {
                setTab(item);
                setForm(null);
                setError("");
              }}
            >
              {item}
              {item === "Approvals" ? ` (${pending.length})` : ""}
            </button>
          ))}
        </nav>}
        {error && (
          <p
            role="alert"
            className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm"
          >
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded border border-primary/30 p-3 text-sm">
            {notice}
          </p>
        )}
        {viewer ? (
          <section className="rounded-lg border p-6">
            No client releases have been granted. Internal projects, tasks and documents remain
            restricted.
          </section>
        ) : (
          <>
            {tab === "Projects" && (
              <section className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Canonical sample pack entries are synthetic TEST data, not real customer work.
                  Loading or repairing the pack does not approve a lifecycle gate or authorize production.
                </p>
                <div className="flex justify-between items-center gap-2">
                  <h2 className="font-semibold">Shared projects</h2>
                  <div className="flex items-center gap-2">
                    {admin && (
                      <>
                        <button
                          className={button}
                          disabled={busy}
                          onClick={async () => {
                            await run("sync_canonical_sample_pack", { p_run_id: "LC2-2026-10-28" });
                          }}
                        >
                          Sync TEST sample pack (LC2-2026-10-28)
                        </button>
                        <button
                          className={button}
                          disabled={busy}
                          onClick={() => void resetCanonicalSamplePack()}
                        >
                          Reset shared TEST sample data
                        </button>
                      </>
                    )}
                    {(admin || (lead && actor.department_code === "SAL")) && (
                      <button className={button} onClick={() => open("create_project")}>
                        New project
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Project</th>
                        <th>Title</th>
                        <th>Phase / department stage</th>
                        <th>Next stage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p) => (
                        <tr className="border-t" key={p.id}>
                          <td className="p-2 font-mono">{p.reference}</td>
                          <td>{p.title}</td>
                          <td>{Object.values(projectLifecycleContext(p.fields as Record<string,string>)).filter(Boolean).join(' · ') || 'Lifecycle configuration required'}</td>
                          <td>
                            {(admin || (lead && p.department_id === ownDepartment)) && (
                              <div className="flex gap-2">
                                <select
                                  aria-label={`Target stage ${p.reference}`}
                                  className={input}
                                  value={stageTarget[p.id] || ""}
                                  onChange={(e) =>
                                    setStageTarget((v) => ({ ...v, [p.id]: e.target.value }))
                                  }
                                >
                                  <option value="">Choose an eligible stage…</option>
                                  {projectStageOptions(p).map(stage=><option key={stage.stageCode} value={stage.stageCode}>{stage.stageCode} · {stage.name}</option>)}
                                </select>
                                <button
                                  className={button}
                                  disabled={busy || !stageTarget[p.id] || !projectStageOptions(p).length}
                                  onClick={() => void advanceProject(p)}
                                >
                                  Verify & advance
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!projects.length && (
                  <p className="text-sm text-muted-foreground">
                    No shared projects yet. An administrator or Sales lead can create the first
                    project.
                  </p>
                )}
              </section>
            )}
            {tab === "Records" && (
              <section className="space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="font-semibold">Department records & evidence</h2>
                  <button
                    className={button}
                    disabled={!projects.length}
                    onClick={() => open("create_record")}
                  >
                    New record
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  Review department
                  <select
                    className={input}
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                  >
                    <option value="">Choose reviewer</option>
                    {data.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} · {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Reference</th>
                        <th>Record</th>
                        <th>Department</th>
                        <th>Revision</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((r) => (
                        <tr className="border-t" key={r.id}>
                          <td className="p-2 font-mono">{r.reference}</td>
                          <td>
                            {r.title}
                            <details>
                              <summary className="text-xs text-muted-foreground">Fields</summary>
                              <pre className="max-w-lg whitespace-pre-wrap text-xs">
                                {JSON.stringify(r.fields, null, 2)}
                              </pre>
                              <p>{r.notes}</p>
                            </details>
                          </td>
                          <td>{deptName(r.department_id)}</td>
                          <td>{String(r.fields["revision"] || "—")}</td>
                          <td>{r.status}</td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              {(admin || r.department_id === ownDepartment) && (
                                <button
                                  className={button}
                                  disabled={busy}
                                  onClick={() =>
                                    open("update_record", {
                                      record_id: r.id,
                                      expected_updated_at: r.updated_at,
                                      fields: JSON.stringify(r.fields, null, 2),
                                      revision: String(r.fields["revision"] || "01"),
                                      scope: String(r.fields["scope"] || ""),
                                      requirements: String(r.fields["requirements"] || ""),
                                      acceptanceCriteria: String(
                                        r.fields["acceptanceCriteria"] || "",
                                      ),
                                      notes: r.notes,
                                    })
                                  }
                                >
                                  Edit / revise
                                </button>
                              )}
                              {(admin || (lead && r.department_id === ownDepartment)) && (
                                <button
                                  className={button}
                                  disabled={busy || !reviewer}
                                  onClick={() =>
                                    void run("request_approval", {
                                      record_id: r.id,
                                      reviewer_department_id: reviewer,
                                    })
                                  }
                                >
                                  Request review
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filteredRecords.length && (
                  <p className="text-sm text-muted-foreground">
                    No department evidence records are available in your authorized scope.
                  </p>
                )}
              </section>
            )}
            {tab === "Tasks" && (
              <section className="space-y-3">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Task checklist</h2>
                    <p className="text-xs text-muted-foreground">
                      Assignments and progress are shared between signed-in devices.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      aria-label="Task project"
                      className={input}
                      value={activeProjectId}
                      onChange={(e) => setProjectId(e.target.value)}
                    >
                      <option value="all">All projects</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.reference}
                        </option>
                      ))}
                    </select>
                    <button
                      className={button}
                      disabled={!projects.length}
                      onClick={() => open("create_task")}
                    >
                      New task
                    </button>
                  </div>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Done</th>
                        <th>Task</th>
                        <th>Project</th>
                        <th>Assigned to</th>
                        <th>Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task) => {
                        const canEdit =
                          admin ||
                          (lead && task.department_id === ownDepartment) ||
                          (actor.role === "member" && task.assignee_id === actor.membership_id);
                        return (
                          <tr className="border-t" key={task.id}>
                            <td className="p-2">
                              <input
                                aria-label={`Complete ${task.title}`}
                                type="checkbox"
                                checked={task.status === "Complete"}
                                disabled={busy || !canEdit}
                                onChange={(e) =>
                                  void run("update_task", {
                                    id: task.id,
                                    expected_updated_at: task.updated_at,
                                    status: e.target.checked ? "Complete" : "Open",
                                  })
                                }
                              />
                            </td>
                            <td>{task.title}</td>
                            <td className="font-mono text-xs">{projectName(task.record_id)}</td>
                            <td>
                              {admin || lead ? (
                                <select
                                  aria-label={`Assignee ${task.title}`}
                                  className={input}
                                  disabled={busy || !canEdit}
                                  value={task.assignee_id || ""}
                                  onChange={(e) =>
                                    void run("update_task", {
                                      id: task.id,
                                      status: task.status,
                                      expected_updated_at: task.updated_at,
                                      assignee_id: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Unassigned</option>
                                  {data.members
                                    .filter(
                                      (m) =>
                                        m.department_id === task.department_id &&
                                        m.role !== "viewer",
                                    )
                                    .map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.display_name}
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                memberName(task.assignee_id)
                              )}
                            </td>
                            <td className="text-xs">{date(task.due_at)}</td>
                            <td>
                              <div className="flex items-center gap-1">
                                <select
                                  aria-label={`Status ${task.title}`}
                                  className={input}
                                  disabled={busy || !canEdit}
                                  value={task.status}
                                  onChange={(e) =>
                                    void run("update_task", {
                                      id: task.id,
                                      status: e.target.value,
                                      expected_updated_at: task.updated_at,
                                    })
                                  }
                                >
                                  {taskStatuses.map((s) => (
                                    <option key={s}>{s}</option>
                                  ))}
                                </select>
                                {(admin || (lead && task.department_id === ownDepartment)) && task.status !== "Cancelled" && (
                                  <button
                                    type="button"
                                    className="px-1.5 py-0.5 text-xs text-amber-600 hover:underline border border-amber-300 rounded"
                                    disabled={busy}
                                    title="Cancel task with reason"
                                    onClick={async () => {
                                      const reason = window.prompt("Reason for cancellation:", "Superseded or deselected by scope change");
                                      if (reason) {
                                        await run("cancel_task", {
                                          id: task.id,
                                          reason: reason.trim(),
                                          expected_updated_at: task.updated_at,
                                        });
                                      }
                                    }}
                                  >
                                    Cancel
                                  </button>
                                )}
                                {(admin || (lead && task.department_id === ownDepartment)) && !task.assignee_id && task.status === "Open" && (
                                  <button
                                    type="button"
                                    className="px-1.5 py-0.5 text-xs text-red-600 hover:underline border border-red-300 rounded"
                                    disabled={busy}
                                    title="Safely delete unassigned, unused custom task"
                                    onClick={async () => {
                                      if (window.confirm(`Safely delete unassigned task "${task.title}"?`)) {
                                        await run("delete_task", {
                                          id: task.id,
                                          expected_updated_at: task.updated_at,
                                        });
                                      }
                                    }}
                                  >
                                    Del
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!filteredTasks.length && (
                  <p className="text-sm text-muted-foreground">No shared tasks in this scope.</p>
                )}
              </section>
            )}
            {tab === "Approvals" && (
              <section className="space-y-3">
                <h2 className="font-semibold">Cross-department reviews</h2>
                <label className="grid gap-1 text-xs">
                  Decision notes
                  <input
                    className={input}
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                  />
                </label>
                {data.approvals.map((a) => {
                  const canDecide =
                    admin ||
                    (lead && (a.reviewer_department_id || a.department_id) === ownDepartment);
                  return (
                    <article
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                      key={a.id}
                    >
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {deptName(a.department_id)} →{" "}
                          {deptName(a.reviewer_department_id || a.department_id)} · Rev{" "}
                          {a.evidence_revision || "—"} · {a.outcome}
                        </p>
                        {a.decision_notes && <p className="text-sm">{a.decision_notes}</p>}
                      </div>
                      {a.outcome === "pending" && canDecide && (
                        <div className="flex gap-2">
                          {(["approved", "returned", "rejected"] as const).map((outcome) => (
                            <button
                              key={outcome}
                              className={button}
                              disabled={busy}
                              onClick={() =>
                                void run("decide_approval", {
                                  id: a.id,
                                  outcome,
                                  expected_updated_at: a.updated_at,
                                  notes: decisionNotes,
                                })
                              }
                            >
                              {outcome === "approved"
                                ? "Approve"
                                : outcome === "returned"
                                  ? "Return"
                                  : "Reject"}
                            </button>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
                {!data.approvals.length && (
                  <p className="text-sm text-muted-foreground">
                    No reviews in your authorized scope. Request a department review from Records.
                  </p>
                )}
              </section>
            )}
            {tab === "Documents" && (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">Controlled document register</h2>
                  <button
                    className={button}
                    disabled={!data.records.some((r) => r.department_id === ownDepartment || admin)}
                    onClick={() =>
                      open("create_document", {
                        record_id:
                          data.records.find((r) => r.department_id === ownDepartment || admin)
                            ?.id || "",
                      })
                    }
                  >
                    Register document
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input aria-label="Search documents" className={`${input} min-w-48 flex-1`} placeholder="Search title, type or project…" value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} />
                  <select aria-label="Filter documents by project" className={`${input} min-w-48`} value={documentProjectFilter} onChange={(event) => setDocumentProjectFilter(event.target.value)}>
                    <option value="all">All permitted projects</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.reference} · {project.title}</option>)}
                  </select>
                </div>
                {visibleDocuments.map((d) => {
                  const record = data.records.find((item) => item.id === d.record_id);
                  const project = documentProject(d);
                  return (
                  <article key={d.id} className="flex justify-between rounded border p-4">
                    <div>
                      <p>{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.document_type} · {deptName(d.department_id)} · {project ? `${project.reference} · ${project.title}` : record ? `${record.reference} · ${record.title}` : "Common / unlinked"}
                      </p>
                    </div>
                    <button className={button} disabled={busy} onClick={() => void openFiles(d)}>
                      Files & revisions
                    </button>
                  </article>
                  );
                })}
                {!visibleDocuments.length && (
                  <p className="text-sm text-muted-foreground">
                    {data.documents.length ? "No shared documents match these filters." : "No shared document metadata in this scope. Browser-local attachments have not been imported."}
                  </p>
                )}
              </section>
            )}
            {tab === "Activity" && (
              <section className="space-y-3">
                <h2 className="font-semibold">Server audit activity</h2>
                {data.audit.map((e) => (
                  <article className="border-b py-3 text-sm" key={e.id}>
                    <p>
                      {e.action.replaceAll("_", " ")} · {date(e.created_at)}
                    </p>
                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {JSON.stringify(e.detail)}
                    </pre>
                  </article>
                ))}
                {!data.audit.length && (
                  <p className="text-sm text-muted-foreground">No server activity in your scope.</p>
                )}
              </section>
            )}
          </>
        )}
        <Dialog open={Boolean(form)} onOpenChange={(open) => { if (!open && !busy) setForm(null); }}>
          {form && (
          <DialogContent className="w-[calc(100vw-2rem)] max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="capitalize">{form.replaceAll("_", " ")}</DialogTitle>
              <DialogDescription>
                {form === "create_record"
                  ? "Create a project-linked draft record. Stage and reference details are filled from the selected project and record type where available."
                  : form === "create_document"
                    ? "Register a controlled document, then add its original file from Files & revisions. Approval and release remain separate."
                    : "Enter the required details and save to the shared TEST workspace."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => void submit(e)} className="grid min-w-0 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
              {form !== "update_record" && field("title", "Title")}
              {(form === "create_project" || form === "create_record") &&
                field("reference", "Controlled reference (HLPL-…)")}
                {form === "create_record" && <>
                <label className="grid gap-1 text-xs sm:col-span-1">Record type
                  <select className={input} required disabled={Boolean(persistedRecord)} value={values["record_type"] || ""} onChange={e => {setRecordFile(null);setValues(v => ({...v, record_type:e.target.value,procurementTrack:procurementTrack(e.target.value) || ""}));}}>
                    <option value="">Choose record type…</option>{(spec?.types || []).map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                {spec && recordFields(spec,values["record_type"] || "").filter(item => item.key !== "procurementTrack" || !procurementTrack(values["record_type"] || "")).map(item => <label key={item.key} className="grid gap-1 text-xs">{item.label}
                  {item.readOnly ? <input className={input} value={item.automaticLabel || item.automaticValue || ""} readOnly aria-readonly="true" /> : item.master === "suppliers" ? <SharedSupplierSelect options={supplierOptions} value={values[item.key] || ""} onChange={value => setValues(v => ({...v,[item.key]:value}))} /> : item.options ? <select className={input} required={item.required} value={values[item.key] || ""} onChange={e => setValues(v => ({...v,[item.key]:e.target.value}))}><option value="">Choose…</option>{item.options.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input className={input} type={item.kind === "date" ? "date" : "text"} required={item.required} value={values[item.key] || ""} onChange={e => setValues(v => ({...v,[item.key]:e.target.value}))} />}
                </label>)}
              </>}
              {(form === "create_record" || form === "create_task") && (
                <label className="grid gap-1 text-xs">
                  Project
                  <select
                    required
                    className={input}
                    disabled={Boolean(persistedRecord)}
                    value={values["project_id"] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, project_id: e.target.value }))}
                  >
                    <option value="">Select project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.reference} · {p.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {form==="create_record"&&recordProject&&<section aria-label="Automatic project phase and stage" className="rounded-md border bg-muted/20 p-2 text-xs sm:col-span-2"><p className="font-medium">Project phase and record stage · automatic</p><p>{recordProjectPhase?`${recordProjectPhase[0]} · ${recordProjectPhase[1]}`:recordProjectStage?.phaseTitle||"Canonical phase not recorded"}</p><p>{recordProjectStage?`${recordProjectStage.stageCode} · ${recordProjectStage.name}`:recordProjectStoredStageLabel?`Legacy stage label: ${recordProjectStoredStageLabel} · canonical stage code not recorded`:"No current lifecycle stage is recorded for this project."}</p>{!recordProjectStage&&recordProjectStoredStageLabel&&<p className="text-muted-foreground">Stage-bound upload stays locked until this legacy label is reconciled to a canonical stage; no phase is guessed.</p>}{mappedRecordAttachment&&recordProjectStage&&<p className="text-muted-foreground">This record’s original maps to {mappedRecordAttachment.stageCode}; upload is available at that stage or the immediately previous stage.</p>}</section>}
              {form==="create_record"&&recordAttachmentSpec&&<div className="grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3 text-xs sm:col-span-2"><label className="grid gap-1">{recordAttachmentSpec.label} · optional, attached to this record<input className={input} aria-label={recordAttachmentSpec.label} type="file" accept={recordAttachmentSpec.accept} disabled={busy||Boolean(persistedRecord)||!values["project_id"]||!recordAttachmentAllowed} onChange={event=>setRecordFile(event.target.files?.[0]||null)}/>{recordFile&&<span className="text-muted-foreground">Selected: {recordFile.name} · {(recordFile.size/1024).toFixed(1)} KB</span>}<span className="text-muted-foreground">{recordAttachmentAllowed?`One Save creates the Draft record and privately links its original. Upload does not advance the project or count as approval or release.`:!recordProjectStageCode?"Upload is locked because this project has no canonical current-stage code. The Draft record can still be saved now.":`Upload is locked until ${recordAttachmentSpec.stageCode} or its immediately preceding stage. Current project stage: ${recordProjectStageCode}.`}</span></label></div>}
              {admin && (form === "create_record" || form === "create_task") && (
                <label className="grid gap-1 text-xs">
                  Department
                  <select
                    className={input}
                    value={selectedDepartment}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, department_id: e.target.value, assignee_id: "" }))
                    }
                  >
                    {data.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} · {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {form === "create_task" && (
                <>
                  {field("due_at", "Due date", "date")}
                  {actor.role !== "member" && (
                    <label className="grid gap-1 text-xs">
                      Assign to
                      <select
                        className={input}
                        value={values["assignee_id"] || ""}
                        onChange={(e) => setValues((v) => ({ ...v, assignee_id: e.target.value }))}
                      >
                        <option value="">Unassigned</option>
                        {data.members
                          .filter(
                            (m) => m.department_id === selectedDepartment && m.role !== "viewer",
                          )
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.display_name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </>
              )}
              {form === "create_document" && (
                <>
                  <label className="grid gap-1 text-xs">
                    Source record
                    <select
                      className={input}
                      value={values["record_id"] || ""}
                      onChange={(e) => setValues((v) => ({ ...v, record_id: e.target.value }))}
                    >
                      {data.records
                        .filter((r) => admin || r.department_id === ownDepartment)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.reference}
                          </option>
                        ))}
                    </select>
                  </label>
                  {field("document_type", "Document type")}
                </>
              )}
              {(form === "create_record" || form === "update_record") && (
                <>
                  <label className="grid gap-1 text-xs">Revision<select className={input} required value={selectedRevision} onChange={e => setValues(v => ({...v,revision:e.target.value}))}>{revisions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  {field("scope", "Scope")}
                  {field("requirements", "Requirements / review findings")}
                  {field("acceptanceCriteria", "Acceptance criteria")}
                </>
              )}
              {(form === "create_project" ||
                form === "create_record" ||
                form === "update_record") &&
                field("notes", "Notes")}
                {form === "create_record" && !recordAttachmentSpec && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/30 p-2 text-xs sm:col-span-2">
                  <span>Need to draft or upload a project document?</span>
                  <button className={button} type="button" onClick={() => { setForm(null); setTab("Documents"); }}>
                    Open Documents
                  </button>
                </div>
              )}
              <div className="flex gap-2 md:col-span-2">
                <button
                  className={`${button} bg-primary text-primary-foreground`}
                  disabled={busy || (Boolean(persistedRecord)&&!recordFile)}
                  type="submit"
                >
                  {busy&&recordFile?"Saving record & private file…":persistedRecord?"Retry original file":recordFile?"Save record & upload original":form==="create_record"?"Save record to shared TEST":"Save to shared TEST"}
                </button>
                <button className={button} type="button" onClick={() => setForm(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </DialogContent>
          )}
        </Dialog>
        {fileDocument && (
          <section
            role="dialog"
            aria-label="Private document files"
            className="space-y-3 rounded-lg border bg-card p-5"
          >
            <div className="flex justify-between">
              <h2 className="font-semibold">{fileDocument.title} · private revisions</h2>
              <button className={button} onClick={() => setFileDocument(null)}>
                Close
              </button>
            </div>
            {files.map((f) => (
              <div key={f.id} className="flex justify-between border-b py-2 text-sm">
                <span>
                  Rev {f.revision} · {f.original_name}
                </span>
                <button
                  className={button}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const result = await download({ data: { fileId: f.id } });
                      window.open(result.url, "_blank", "noopener,noreferrer");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Download denied.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Download
                </button>
              </div>
            ))}
            {(admin || lead) && (
              <div className="flex flex-wrap gap-2">
                <input
                  aria-label="Private attachment"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <input
                  aria-label="Attachment revision"
                  className={input}
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                />
                <button className={button} disabled={busy || !file} onClick={() => void upload()}>
                  Upload private file
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

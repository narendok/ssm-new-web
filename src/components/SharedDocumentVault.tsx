import { useEffect, useRef, useState, type ReactNode } from "react";
import { readLifecycleBaseline } from '@/lib/lifecycle-baseline';
import { stageUploadAllowed } from '@/lib/stage-upload-access';
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSharedTestWorkspace } from "@/lib/shared-test.functions";
import { getCoordination } from "./SharedProjectAnalysis";
import { getSharedVaultDocuments, registerSharedDocument } from "@/lib/shared-vault.functions";
import { getSharedDepartmentRoleConfiguration } from "@/lib/department-roles.functions";
import { attachmentRevisionOptions,vaultDisplayDocuments,vaultRelatedRecords, type VaultDisplayDocument } from "@/lib/shared-vault";
import { beginControlledDocumentUpload,completeControlledDocumentUpload,getControlledDocumentDownload,listControlledDocumentFiles } from "@/lib/controlled-documents.functions";
import type { TestMembership } from "@/lib/test-auth.functions";
import { SharedMasterSelect } from "./SharedMasterSelect";
import { isSelectableMasterStatus } from "@/lib/shared-master-options";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { CompactFilterSelect,ResponsiveFilterBar } from "./ResponsiveFilterBar";
import { FolderKanban,Upload,ArrowLeft } from "lucide-react";
import { CANONICAL_STAGE_TEMPLATES } from "@/lib/canonical-lifecycle";
import { hardwareAttachmentForRecordType } from "@/lib/record-form-catalogue";
import { buildDocumentDraft, DOCUMENT_FORMATS, draftType, restoreDocumentDraftSnapshot } from "@/lib/document-draft";
import { DocumentStandardViewer, type TemplateSettingsProps } from "./DocumentStandardViewer";

type LibraryProps={documents:VaultDisplayDocument[];departmentContext:string|null;onSelectDocument:(doc:VaultDisplayDocument)=>void;onUploadFile:(file:File|null)=>void;readOnlyReason:string|undefined};
const kinds=["D01 common-document draft index","Technical document","Schematic PDF","Gerber ZIP","Panel ZIP","Stencil PCB fab","Mechanical STEP","Prototype STL/DXF","Firmware binary","Certificate","BOM","Policy / procedure"];
export function SharedDocumentVault({membership,departmentCode,initialDocumentId,initialProjectId,templateSettings,renderLibrary}:{
  membership:TestMembership;departmentCode?:string|undefined;initialDocumentId?:string|undefined;initialProjectId?:string|undefined;
  templateSettings:TemplateSettingsProps;
  renderLibrary:(props:LibraryProps)=>ReactNode;onBack?:()=>void;
}){
  const load=useServerFn(getSharedVaultDocuments),workspace=useServerFn(getSharedTestWorkspace),coordination=useServerFn(getCoordination),register=useServerFn(registerSharedDocument),loadRoleConfiguration=useServerFn(getSharedDepartmentRoleConfiguration);
  const begin=useServerFn(beginControlledDocumentUpload),finish=useServerFn(completeControlledDocumentUpload),list=useServerFn(listControlledDocumentFiles),download=useServerFn(getControlledDocumentDownload);
  const query=useQuery({queryKey:["shared-vault",membership.organizationId,membership.membershipId],queryFn:()=>load(),refetchInterval:15000});
  const people=useQuery({queryKey:["shared-test-workspace",membership.organizationId,membership.membershipId],queryFn:()=>workspace(),refetchInterval:15000});
  const projectsQuery=useQuery({queryKey:["project-coordination",membership.organizationId,membership.membershipId],queryFn:()=>coordination(),refetchInterval:15000});
  const roleConfiguration=useQuery({queryKey:["shared-department-roles",membership.organizationId,membership.membershipId],queryFn:()=>loadRoleConfiguration(),refetchInterval:30000});
  const [projectFilter,setProjectFilter]=useState(initialProjectId||"all"),[selected,setSelected]=useState(initialDocumentId||"");
  const [selectedDepartmentCode,setSelectedDepartmentCode]=useState(departmentCode||membership.departmentCode||"");
  const [create,setCreate]=useState(false),[title,setTitle]=useState(""),[kind,setKind]=useState("Technical document"),[scope,setScope]=useState<"common"|"internal"|"client"|"department">("common"),[draftPreviewOpen,setDraftPreviewOpen]=useState(false);
  const [projectId,setProjectId]=useState(""),[recordId,setRecordId]=useState(""),[draftTemplate,setDraftTemplate]=useState(""),[sourceFileId,setSourceFileId]=useState(""),[sourceFiles,setSourceFiles]=useState<{id:string;label:string}[]>([]);
  const [pendingFile,setPendingFile]=useState<File|null>(null),[file,setFile]=useState<File|null>(null),[revision,setRevision]=useState("01"),[createdDraft,setCreatedDraft]=useState<{id:string;reference:string}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const registrationRequest=useRef<string|null>(null),fileInput=useRef<HTMLInputElement>(null),uploadLock=useRef(false);
  const records=projectsQuery.data?.records||[],projects=records.filter(r=>r.type==="Project"&&isSelectableMasterStatus(r.status)),documents=vaultDisplayDocuments(query.data||[],records);
  const configuredDepartments=roleConfiguration.data?.departments||people.data?.departments.map(d=>({id:d.id,code:d.code,name:d.name,active:true,leadMemberId:null}))||[];
  const manageableDepartmentCodes=membership.role==="admin"
    ?configuredDepartments.map(d=>d.code)
    :configuredDepartments.filter(d=>d.leadMemberId===membership.membershipId||roleConfiguration.data?.roles.some(r=>r.active&&r.memberIds.includes(membership.membershipId)&&r.departmentId===d.id&&r.permissions.includes("documents:manage"))||(!roleConfiguration.data&&membership.role==="department_lead"&&d.code===membership.departmentCode)).map(d=>d.code);
  const availableDepartments=people.data?.departments.filter(d=>membership.role==="admin"||manageableDepartmentCodes.includes(d.code))||[];
  const activeCode=availableDepartments.some(d=>d.code===selectedDepartmentCode)?selectedDepartmentCode:(availableDepartments[0]?.code||selectedDepartmentCode);
  const department=people.data?.departments.find(d=>d.code===activeCode);
  const canManage=!membership.isClient&&!!department&&(membership.role==="admin"||manageableDepartmentCodes.includes(department.code));
  const current=documents.find(d=>d.id===selected);
  const currentProject=current?.projectId?projects.find(p=>p.id===current.projectId):undefined;
  const currentRecord=current?.linkedRecordRefs.map(id=>records.find(r=>r.id===id)).find((r):r is NonNullable<typeof r>=>Boolean(r)&&r?.type!=="Project");
  const savedDraft=current?.autoDraftSnapshot;
  const printableDraft=savedDraft?restoreDocumentDraftSnapshot(savedDraft):undefined;
  const savedDraftStage=savedDraft?.projectRecordId
    ? `${savedDraft.projectPhase||"Phase not captured"} · ${savedDraft.projectStage||"Stage not captured"}`
    : "Common document";
  const stageCode=(value:string|undefined)=>value?.match(/(?:^|\b)((?:G[0-9]|CM|CL|INT|RM|HW|FW|SW|QA|C)_[0-9]{2}|C[0-9]{2})(?:\b|$)/)?.[1];
  const projectStageCode=stageCode(currentProject?.fields["currentStage"]||currentProject?.fields["lifecycleStage"]||currentProject?.fields["stage"]);
  const recordStageCode=hardwareAttachmentForRecordType(currentRecord?.type||"")?.stageCode||stageCode(currentRecord?.fields["recordStage"]||currentRecord?.fields["stageCode"]||currentRecord?.fields["lifecycleStage"]||currentRecord?.fields["stage"]);
  const revisionStages=readLifecycleBaseline(currentProject?.fields['lifecycleBaseline'])?.stages ?? CANONICAL_STAGE_TEMPLATES.map(stage=>({code:stage.stageCode,prerequisites:stage.prerequisites}));
  const stageAllowsRevision=!currentProject||stageUploadAllowed(revisionStages,projectStageCode||'',recordStageCode||'',(people.data?.tasks||[]).filter(task=>task.record_id===currentProject?.id&&task.stage_code&&task.status!=='Cancelled').map(task=>task.stage_code!));
  const canUpload=!!current&&availableDepartments.some(d=>d.id===current.departmentId)&&(membership.role==="admin"||current.departmentId===department?.id);
  const canUploadAtStage=canUpload&&stageAllowsRevision;
  const files=useQuery({queryKey:["controlled-files",membership.organizationId,membership.membershipId,selected],queryFn:()=>list({data:{documentId:selected}}),enabled:!!current});
  const revisions=attachmentRevisionOptions(files.data||[]);
  const nativeSourceRequired=kind==="Panel ZIP"||kind==="Stencil PCB fab";
  const selectedDraftProject=projects.find(record=>record.id===projectId);
  const selectedDraftSource=records.find(record=>record.id===recordId&&record.type!=="Project");
  const stringFields=(fields:Record<string,unknown>)=>Object.fromEntries(Object.entries(fields).filter((entry):entry is [string,string]=>typeof entry[1]==="string"));
  const inferredDraftType=draftType(`${title} ${selectedDraftSource?.type||""}`,selectedDraftSource?.reference||kind);
  const activeDraftType=draftTemplate||inferredDraftType;
  const generatedDraft=buildDocumentDraft(title,selectedDraftSource?.reference||kind,selectedDraftSource?{reference:selectedDraftSource.reference,fields:stringFields(selectedDraftSource.fields)}:undefined,selectedDraftProject?{reference:selectedDraftProject.reference,fields:stringFields(selectedDraftProject.fields)}:undefined,activeDraftType);
  const draftSnapshot=generatedDraft.supported?{
    templateType:generatedDraft.type||null,
    templateVersion:generatedDraft.templateVersion,
    catalogueFamilyId:generatedDraft.catalogueFamilyId,
    sourceRecordId:selectedDraftSource?.id||null,
    projectRecordId:selectedDraftProject?.id||null,
    sourceReference:selectedDraftSource?.reference||null,
    projectReference:selectedDraftProject?.reference||null,
    projectPhase:selectedDraftProject?.fields["companyPhase"]||null,
    projectStage:stageCode(selectedDraftProject?.fields["currentStage"]||selectedDraftProject?.fields["lifecycleStage"]||selectedDraftProject?.fields["stage"])||null,
    classification:generatedDraft.snapshot.classification,
    releaseStatus:"Unissued",
    completionPercentage:generatedDraft.completionPercentage,
    missingFields:generatedDraft.missingFields,
    sections:generatedDraft.sections.map(section=>({title:section.title,rows:section.rows.map(row=>row.map(value=>value??""))})),
  }:undefined;
  useEffect(()=>{setFile(null);setRevision("01");setError("");setDraftPreviewOpen(false);},[selected]);
  useEffect(()=>{if(files.data)setRevision(attachmentRevisionOptions(files.data).at(-1)||"01");},[files.data]);
  useEffect(()=>{
    let active=true;
    if(!create||!nativeSourceRequired||!projectId){setSourceFiles([]);setSourceFileId("");return;}
    const sourceDocs=documents.filter(d=>d.projectId===projectId&&d.type==="Gerber ZIP");
    void Promise.all(sourceDocs.map(async d=>(await list({data:{documentId:d.id}})).filter(f=>!f.superseded_at).map(f=>({id:f.id,label:`${d.title} · Rev ${f.revision} · ${f.original_name}`}))))
      .then(result=>{if(active){const available=result.flat();setSourceFiles(available);setSourceFileId(previous=>available.some(f=>f.id===previous)?previous:"");}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Source packages could not be loaded.");});
    return()=>{active=false;};
  },[create,kind,projectId,query.data,projectsQuery.data]);
  function openRegistration(pending:File|null){
    if(!canManage){setError("Document registration requires the authorized department lead or Admin.");return;}
    setPendingFile(pending);setTitle(pending?.name||"");setRecordId("");setDraftTemplate("");setSourceFileId("");setCreatedDraft(null);registrationRequest.current=null;setError("");setCreate(true);
    if(projectFilter!=="all"&&projects.some(p=>p.id===projectFilter)){setScope("client");setProjectId(projectFilter);}else{setScope("common");setProjectId("");}
  }
  async function uploadOriginal(documentId:string,original:File,uploadRevision:string){
    if(!original.size||original.size>25*1024*1024)throw new Error("Choose a non-empty file up to 25 MB.");
    const checksum=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await original.arrayBuffer()))).map(v=>v.toString(16).padStart(2,"0")).join("");
    const result=await begin({data:{documentId,revision:uploadRevision,name:original.name,contentType:original.type||"application/octet-stream",sizeBytes:original.size,checksum}});
    if(!result.duplicate){
      if(!result.signedUploadUrl)throw new Error("Private upload link is unavailable. Keep this file selected and retry.");
      const response=await fetch(result.signedUploadUrl,{method:"PUT",headers:{"Content-Type":original.type||"application/octet-stream"},body:original});
      if(!response.ok)throw new Error("Private upload did not finish. Keep this file selected and retry.");
    }
    await finish({data:{fileId:result.file.id}});
  }
  async function upload(){
    if(!file||!current||!canUpload||uploadLock.current)return;
    uploadLock.current=true;setBusy(true);setError("");setNotice("");
    try{
      await uploadOriginal(current.id,file,revision);await files.refetch();setFile(null);if(fileInput.current)fileInput.current.value="";
      setNotice("Original file saved privately. This does not approve or release the document.");
    }catch(e){setError(e instanceof Error?e.message:"Upload failed. Your selected file is preserved.");}
    finally{uploadLock.current=false;setBusy(false);}
  }
  if(query.isPending||people.isPending||projectsQuery.isPending)return <p className="text-sm text-muted-foreground">Loading controlled documents…</p>;
  const failure=query.error||people.error||projectsQuery.error;
  if(failure)return <div role="alert" className="space-y-3 rounded border p-4"><p>{failure instanceof Error?failure.message:"Shared document data is unavailable."}</p><Button variant="outline" onClick={()=>{void query.refetch();void people.refetch();void projectsQuery.refetch();}}>Retry</Button></div>;
  return <section className="space-y-4" aria-label="Shared controlled document vault">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><h1 className="shrink-0 text-base font-semibold">Documents & Vault</h1><details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Vault help</summary><p className="mt-1 max-w-lg">Original files, controlled revisions and project references within your access. Uploading a file does not approve or release it.</p></details></div><div className="flex flex-wrap items-center gap-2">{availableDepartments.length>1&&!current&&<CompactFilterSelect label="Department" icon={FolderKanban} value={activeCode} onChange={setSelectedDepartmentCode} options={availableDepartments.map(d=>({value:d.code,label:d.name}))}/>} {current&&<Button size="sm" variant="outline" onClick={()=>setSelected("")}><ArrowLeft className="size-4"/>All documents</Button>}{canManage&&!current&&<Button size="sm" title={projectFilter==="all"?"Add a common document":"Add a document to the selected project"} onClick={()=>openRegistration(null)}><Upload className="size-4"/>Add document</Button>}</div></div>
    {notice&&<p role="status" className="text-xs text-muted-foreground">{notice}</p>}{error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
    {current?<div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold">{current.title}</h2><p className="text-xs text-muted-foreground">{current.type} · Draft · Release not recorded</p><p className="text-xs text-muted-foreground">{current.part||current.id}</p></div>{printableDraft&&<Button size="sm" variant="outline" onClick={()=>setDraftPreviewOpen(true)}>Preview draft / Save PDF</Button>}</div>
      {(currentProject||currentRecord||current.autoDraftSnapshot)&&<details aria-label="Lifecycle and draft source context" className="rounded-lg border bg-muted/20 p-3 text-xs"><summary className="cursor-pointer font-medium">Project, lifecycle & source details</summary><div className="mt-2 grid gap-3 border-t border-border/60 pt-2 sm:grid-cols-2">
        {currentProject&&<div><p className="font-semibold">Project lifecycle context</p><p>{currentProject.reference} · {currentProject.title}</p><p>Project phase: {currentProject.fields["companyPhase"]||"Not recorded"}</p><p>Current stage: {projectStageCode||"Not recorded in the project lifecycle"}</p></div>}
        {currentRecord&&<div><p className="font-semibold">Linked draft parameters</p><p>{currentRecord.reference} · {currentRecord.title}</p><p>Type: {currentRecord.type} · Status: {currentRecord.status}</p><p>Required phase/stage: {recordStageCode||"Not mapped"}</p>{Object.entries(currentRecord.fields).filter(([key,value])=>!/^project(Id|Code)$/.test(key)&&typeof value==="string"&&value.trim()).slice(0,8).map(([key,value])=><p key={key}><span className="capitalize">{key.replace(/([A-Z])/g," $1").replaceAll("_"," ")}</span>: {value}</p>)}</div>}
        {current.autoDraftSnapshot&&<div className="sm:col-span-2"><p className="font-semibold">Auto-draft source snapshot</p><p>Template {current.autoDraftSnapshot.templateType||"unmapped"} · {current.autoDraftSnapshot.templateVersion} · {current.autoDraftSnapshot.catalogueFamilyId||"no catalogue family"} · {current.autoDraftSnapshot.releaseStatus}</p><p>Input source: {current.autoDraftSnapshot.sourceReference||current.autoDraftSnapshot.sourceRecordId||"project fields only"} · Missing owner inputs: {current.autoDraftSnapshot.missingFields.length}</p>{current.autoDraftSnapshot.sections.map(section=><details key={section.title} className="mt-1"><summary className="cursor-pointer">{section.title}</summary>{section.rows.map(([field,value,source])=><p key={field}><span className="font-medium">{field}:</span> {value} <span className="text-muted-foreground">({source})</span></p>)}</details>)}</div>}
        {currentProject&&<p className={`sm:col-span-2 ${stageAllowsRevision?"text-muted-foreground":"text-destructive"}`}>{stageAllowsRevision?"Project document revisions are available for the mapped current stage or its immediate predecessor.":"Revision upload is held: the project stage or linked record stage is missing, unmapped, or outside the current/previous stage window."}</p>}
      </div></details>}
      {files.isPending?<p className="text-xs">Loading private revisions…</p>:files.error?<p role="alert" className="text-xs text-destructive">{files.error.message}</p>:<div className="divide-y rounded border">{files.data?.map(f=><div key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3"><div><p className="text-sm font-medium">{f.original_name}</p><p className="text-xs text-muted-foreground">Rev {f.revision} · {Math.ceil(f.size_bytes/1024)} KB · {!f.originalAvailable?"Original unavailable / upload pending":f.superseded_at?"Historical revision":"Stored original"}</p></div><Button size="sm" variant="outline" disabled={busy||!f.originalAvailable} onClick={async()=>{setBusy(true);setError("");try{const result=await download({data:{fileId:f.id}});window.location.assign(result.url);}catch(e){setError(e instanceof Error?e.message:"Download denied.");}finally{setBusy(false);}}}>Download original</Button></div>)}{!files.data?.length&&<p className="p-3 text-xs text-muted-foreground">No private file has been uploaded for this document.</p>}</div>}
      {canUploadAtStage&&<div className="space-y-2 rounded-lg border border-dashed p-3"><p className="text-xs font-semibold">Add a new file revision to this document · maximum 25 MB</p><div className="flex flex-wrap items-center gap-2"><input ref={fileInput} aria-label="Original document file" type="file" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/><label className="flex items-center gap-2 text-xs">Revision<select aria-label="File revision" className="rounded border bg-background p-2" value={revision} disabled={busy} onChange={e=>setRevision(e.target.value)}>{revisions.map(r=><option key={r} value={r}>{r}{r===revisions.at(-1)?" · Next":" · Existing package"}</option>)}</select></label><Button size="sm" disabled={busy||!file} onClick={()=>void upload()}>{busy?"Saving…":"Upload revision"}</Button></div>{file&&<p className="text-xs">Selected: {file.name}</p>}<p className="text-xs text-muted-foreground">Earlier originals remain in history. Uploading never grants client access or final approval.</p></div>}
      {canUpload&&!stageAllowsRevision&&currentProject&&<p role="note" className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs">This project-linked document is read-only for revisions until its mapped stage is active or immediately previous. Check the project lifecycle and linked draft parameters above.</p>}
    </div>:<><ResponsiveFilterBar label="Vault project"><CompactFilterSelect label="Project" icon={FolderKanban} value={projectFilter} onChange={setProjectFilter} options={[{value:"all",label:"All projects / common documents"},...projects.map(p=>({value:p.id,label:`${p.reference} · ${p.title}`}))]}/></ResponsiveFilterBar>{canManage&&projectFilter==="all"&&<p className="text-xs text-muted-foreground">Add a common document here, or select a project first to create a project document.</p>}{renderLibrary({documents:projectFilter==="all"?documents:documents.filter(d=>d.projectId===projectFilter),departmentContext:department?.id||null,onSelectDocument:doc=>{setSelected(doc.id);setNotice("");},onUploadFile:openRegistration,readOnlyReason:canManage?undefined:"Your role can view authorized files. Registration and upload require the responsible lead or Admin."})}</>}
    {draftPreviewOpen&&current&&savedDraft&&printableDraft&&<DocumentStandardViewer document={{documentId:current.part||current.id,title:current.title,stage:savedDraftStage,project:savedDraft.projectReference||(savedDraft.projectRecordId?"Project reference not captured":"Common / unlinked"),revision:`Rev ${current.revision||"01"}`,date:"Not effective · unissued",status:"Draft · Unissued",preparedBy:{name:"Not recorded",role:"Author",date:"Not recorded",status:"Pending"},reviewedBy:{name:"Department lead",role:"Reviewer",date:"Awaiting review",status:"Pending"},approvedBy:{name:"Authorized approver",role:"Approver",date:"Awaiting release",status:"Pending"}}} draft={printableDraft} source={printableDraft.snapshot.source??undefined} settings={templateSettings} settingsSourceNotice="Header and footer use this browser’s saved settings; shared settings sync is not verified." onClose={()=>setDraftPreviewOpen(false)}/>}
    <Dialog open={create} onOpenChange={open=>{if(!open&&!busy){if(createdDraft){setSelected(createdDraft.id);setNotice(`${createdDraft.reference} remains a Draft; its original file still needs upload.`);}setCreate(false);setPendingFile(null);setCreatedDraft(null);}}}><DialogContent className="w-[calc(100vw-2rem)] max-w-xl overflow-x-hidden"><DialogHeader><DialogTitle>Add document</DialogTitle><DialogDescription>Add a common document or choose a project, enter its details and original file, then save once. Approval and release are separate.</DialogDescription></DialogHeader>
      <form className="min-w-0 space-y-3 [&>*]:min-w-0 [&_button]:max-w-full [&_button]:truncate [&_input]:max-w-full [&_select]:max-w-full" onSubmit={async e=>{e.preventDefault();if(!department||busy)return;setBusy(true);setError("");try{
        if(!createdDraft && nativeSourceRequired && (!sourceFileId || !sourceFiles.some(file=>file.id===sourceFileId))) throw new Error("Choose a current source Gerber revision for this project before saving.");
        let draft=createdDraft;
        if(!draft){registrationRequest.current ||= crypto.randomUUID();const result=await register({data:{requestId:registrationRequest.current,payload:{title,documentType:kind,scope,departmentId:department.id,...(projectId?{projectId}:{}),...(recordId?{recordId}:{}),...(sourceFileId?{sourceFileId}:{}),...(draftSnapshot?{draftSnapshot}:{})}}});draft={id:result.id,reference:result.reference};setCreatedDraft(draft);registrationRequest.current=null;}
        if(!pendingFile){await query.refetch();setSelected(draft.id);setCreate(false);setCreatedDraft(null);setNotice(`${draft.reference} saved as a Draft index. No original file, approval or release is recorded.`);return;}
        await uploadOriginal(draft.id,pendingFile,"01");
        await query.refetch();setSelected(draft.id);setCreate(false);setPendingFile(null);setCreatedDraft(null);setNotice(`${draft.reference} saved with its original file as a Draft. It has not been approved or released.`);
      }catch(e){setError(e instanceof Error?e.message:"The document could not be saved. Your selected file is preserved for retry.");}finally{setBusy(false);}}}>
        <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs">Scope<select disabled={Boolean(createdDraft)} className="rounded border bg-background p-2" value={scope} onChange={e=>{const next=e.target.value as typeof scope;setScope(next);setProjectId("");setRecordId("");setSourceFileId("");setSourceFiles([]);}}><option value="common">Common / standards</option><option value="internal">Internal project</option><option value="client">Client project</option><option value="department">Other department work</option></select></label><label className="grid gap-1 text-xs">Document type<select disabled={Boolean(createdDraft)} className="rounded border bg-background p-2" value={kind} onChange={e=>{setKind(e.target.value);setSourceFileId("");setSourceFiles([]);}}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label></div>
        {(scope==="internal"||scope==="client")&&<SharedMasterSelect label="Project" required value={projectId} disabled={Boolean(createdDraft)} onChange={id=>{setProjectId(id);setRecordId("");setSourceFileId("");setSourceFiles([]);}} options={projects.map(p=>({value:p.id,label:`${p.reference} · ${p.title}`}))}/>}
        <label className="grid gap-1 text-xs">Title<input required disabled={Boolean(createdDraft)} maxLength={300} className="rounded border bg-background p-2" value={title} onChange={e=>setTitle(e.target.value)}/></label>
        {projectId&&(scope==="internal"||scope==="client")&&<SharedMasterSelect label="Related record (optional)" value={recordId} disabled={Boolean(createdDraft)} onChange={setRecordId} options={vaultRelatedRecords(records,projectId).filter(r=>isSelectableMasterStatus(r.status)).map(r=>({value:r.id,label:`${r.reference} · ${r.title}`}))}/>}
        <label className="grid gap-1 text-xs">Draft template<select disabled={Boolean(createdDraft)} className="rounded border bg-background p-2" value={draftTemplate||inferredDraftType||""} onChange={e=>setDraftTemplate(e.target.value)}><option value="">Auto-detect from title and related record</option>{Object.keys(DOCUMENT_FORMATS).sort().map(code=><option key={code} value={code}>{code}</option>)}</select></label>
        {generatedDraft.supported&&<details className="rounded-lg border bg-muted/20 p-3 text-xs"><summary className="cursor-pointer font-semibold">Draft preview · {generatedDraft.type} · {generatedDraft.completionPercentage}% fields sourced</summary><p className="mt-2 text-muted-foreground">Template {generatedDraft.templateVersion} · {generatedDraft.catalogueFamilyId||"No catalogue family"} · {generatedDraft.missingFields.length} fields need owner input. This remains an unissued draft.</p><div className="mt-2 max-h-40 space-y-2 overflow-auto">{generatedDraft.sections.map(section=><div key={section.title}><p className="font-medium">{section.title}</p>{section.rows.map(([field,value,source])=><p key={field}><span className="font-medium">{field}:</span> {value} <span className="text-muted-foreground">({source})</span></p>)}</div>)}</div></details>}
        {!generatedDraft.supported&&<p className="text-xs text-muted-foreground">No matching auto-draft template was found. Choose a template above or upload the controlled original; the system will not invent document values.</p>}
        {nativeSourceRequired&&<SharedMasterSelect label="Source Gerber revision" required value={sourceFileId} disabled={Boolean(createdDraft)} onChange={setSourceFileId} options={sourceFiles.map(f=>({value:f.id,label:f.label}))}/>}
        <label className="grid gap-1 text-xs">Original file · optional for a draft<input aria-label="Original document file" type="file" disabled={busy||Boolean(createdDraft)} onChange={e=>{const next=e.target.files?.[0]||null;setPendingFile(next);if(next&&!title)setTitle(next.name.replace(/\.[^.]+$/,""));}}/></label>
        {pendingFile&&<p className="text-xs text-muted-foreground">Selected: {pendingFile.name} · {(pendingFile.size/1024).toFixed(1)} KB</p>}{!pendingFile&&!createdDraft&&<p className="text-xs text-muted-foreground">Save a metadata-only Draft now, or attach the original file in this same step. No sample file is created.</p>}{createdDraft&&<p className="text-xs text-muted-foreground">Draft {createdDraft.reference} is registered. Retry uploads this same file without making another record.</p>}{error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>{if(createdDraft){setSelected(createdDraft.id);setNotice(`${createdDraft.reference} remains a Draft; its original file still needs upload.`);}setCreate(false);setPendingFile(null);setCreatedDraft(null);}}>Cancel</Button><Button disabled={busy||!title.trim()||((scope==="client"||scope==="internal")&&!projectId)||(nativeSourceRequired&&!sourceFileId)}>{busy?pendingFile?"Saving document & uploading…":"Saving Draft…":createdDraft?"Retry original upload":pendingFile?"Save document & upload original":"Save Draft without original"}</Button></div>
      </form></DialogContent></Dialog>
  </section>;
}

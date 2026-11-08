import { useEffect, useRef, useState, type ReactNode } from "react";
import { readLifecycleBaseline } from '@/lib/lifecycle-baseline';
import { stageUploadAllowed } from '@/lib/stage-upload-access';
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSharedTestWorkspace } from "@/lib/shared-test.functions";
import { getCoordination } from "./SharedProjectAnalysis";
import { getSharedVaultDocuments, registerSharedDocument } from "@/lib/shared-vault.functions";
import { attachmentRevisionOptions,vaultDisplayDocuments, type VaultDisplayDocument } from "@/lib/shared-vault";
import { beginControlledDocumentUpload,completeControlledDocumentUpload,getControlledDocumentDownload,listControlledDocumentFiles } from "@/lib/controlled-documents.functions";
import type { TestMembership } from "@/lib/test-auth.functions";
import { SharedMasterSelect } from "./SharedMasterSelect";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { CompactFilterSelect,ResponsiveFilterBar } from "./ResponsiveFilterBar";
import { FolderKanban,Upload,ArrowLeft } from "lucide-react";
import { CANONICAL_STAGE_TEMPLATES } from "@/lib/canonical-lifecycle";
import { hardwareAttachmentForRecordType } from "@/lib/record-form-catalogue";

type LibraryProps={documents:VaultDisplayDocument[];departmentContext:string|null;onSelectDocument:(doc:VaultDisplayDocument)=>void;onUploadFile:(file:File|null)=>void;readOnlyReason:string|undefined};
const kinds=["Technical document","Schematic PDF","Gerber ZIP","Panel ZIP","Stencil PCB fab","Mechanical STEP","Prototype STL/DXF","Firmware binary","Certificate","BOM","Policy / procedure"];
export function SharedDocumentVault({membership,departmentCode,initialDocumentId,initialProjectId,renderLibrary,onBack}:{
  membership:TestMembership;departmentCode?:string|undefined;initialDocumentId?:string|undefined;initialProjectId?:string|undefined;
  renderLibrary:(props:LibraryProps)=>ReactNode;onBack:()=>void;
}){
  const load=useServerFn(getSharedVaultDocuments),workspace=useServerFn(getSharedTestWorkspace),coordination=useServerFn(getCoordination),register=useServerFn(registerSharedDocument);
  const begin=useServerFn(beginControlledDocumentUpload),finish=useServerFn(completeControlledDocumentUpload),list=useServerFn(listControlledDocumentFiles),download=useServerFn(getControlledDocumentDownload);
  const query=useQuery({queryKey:["shared-vault",membership.organizationId,membership.membershipId],queryFn:()=>load(),refetchInterval:15000});
  const people=useQuery({queryKey:["shared-test-workspace",membership.organizationId,membership.membershipId],queryFn:()=>workspace(),refetchInterval:15000});
  const projectsQuery=useQuery({queryKey:["project-coordination",membership.organizationId,membership.membershipId],queryFn:()=>coordination(),refetchInterval:15000});
  const [projectFilter,setProjectFilter]=useState(initialProjectId||"all"),[selected,setSelected]=useState(initialDocumentId||"");
  const [create,setCreate]=useState(false),[title,setTitle]=useState(""),[kind,setKind]=useState("Technical document"),[scope,setScope]=useState<"common"|"internal"|"client"|"department">("common");
  const [projectId,setProjectId]=useState(""),[recordId,setRecordId]=useState(""),[sourceFileId,setSourceFileId]=useState(""),[sourceFiles,setSourceFiles]=useState<{id:string;label:string}[]>([]);
  const [pendingFile,setPendingFile]=useState<File|null>(null),[file,setFile]=useState<File|null>(null),[revision,setRevision]=useState("01"),[createdDraft,setCreatedDraft]=useState<{id:string;reference:string}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const registrationRequest=useRef<string|null>(null),fileInput=useRef<HTMLInputElement>(null),uploadLock=useRef(false);
  const records=projectsQuery.data?.records||[],projects=records.filter(r=>r.type==="Project"),documents=vaultDisplayDocuments(query.data||[],records);
  const ownerCode=membership.role==="admin"?departmentCode:membership.departmentCode;
  const department=people.data?.departments.find(d=>d.code===ownerCode);
  const canManage=!membership.isClient&&["admin","department_lead"].includes(membership.role)&&!!department;
  const current=documents.find(d=>d.id===selected);
  const currentProject=current?.projectId?projects.find(p=>p.id===current.projectId):undefined;
  const currentRecord=current?.linkedRecordRefs.map(id=>records.find(r=>r.id===id)).find((r):r is NonNullable<typeof r>=>Boolean(r)&&r?.type!=="Project");
  const stageCode=(value:string|undefined)=>value?.match(/(?:^|\b)((?:G[0-9]|CM|CL|INT|RM|HW|FW|SW|QA|C)_[0-9]{2}|C[0-9]{2})(?:\b|$)/)?.[1];
  const projectStageCode=stageCode(currentProject?.fields["currentStage"]||currentProject?.fields["lifecycleStage"]||currentProject?.fields["stage"]);
  const recordStageCode=hardwareAttachmentForRecordType(currentRecord?.type||"")?.stageCode||stageCode(currentRecord?.fields["recordStage"]||currentRecord?.fields["stageCode"]||currentRecord?.fields["lifecycleStage"]||currentRecord?.fields["stage"]);
  const revisionStages=readLifecycleBaseline(currentProject?.fields['lifecycleBaseline'])?.stages ?? CANONICAL_STAGE_TEMPLATES.map(stage=>({code:stage.stageCode,prerequisites:stage.prerequisites}));
  const stageAllowsRevision=!currentProject||stageUploadAllowed(revisionStages,projectStageCode||'',recordStageCode||'',(people.data?.tasks||[]).filter(task=>task.record_id===currentProject?.id&&task.stage_code&&task.status!=='Cancelled').map(task=>task.stage_code!));
  const canUpload=canManage&&(membership.role==="admin"||current?.departmentId===department?.id);
  const canUploadAtStage=canUpload&&stageAllowsRevision;
  const files=useQuery({queryKey:["controlled-files",membership.organizationId,membership.membershipId,selected],queryFn:()=>list({data:{documentId:selected}}),enabled:!!current});
  const revisions=attachmentRevisionOptions(files.data||[]);
  const nativeSourceRequired=kind==="Panel ZIP"||kind==="Stencil PCB fab";
  useEffect(()=>{setFile(null);setRevision("01");setError("");},[selected]);
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
    setPendingFile(pending);setTitle(pending?.name||"");setRecordId("");setSourceFileId("");setCreatedDraft(null);registrationRequest.current=null;setError("");setCreate(true);
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
    <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-3"><h1 className="shrink-0 text-base font-semibold">Documents & Vault</h1><span title="Original files, controlled revisions and project references within your access." className="hidden truncate text-xs text-muted-foreground md:inline">Original files · controlled revisions · project references</span></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={current?()=>setSelected(""):onBack}><ArrowLeft className="size-4"/>{current?"Library":"Workspace"}</Button>{canManage&&!current&&<Button size="sm" title={projectFilter==="all"?"Add a common document":"Add a document to the selected project"} onClick={()=>openRegistration(null)}><Upload className="size-4"/>Add document</Button>}</div></div>
    {notice&&<p role="status" className="text-xs text-muted-foreground">{notice}</p>}{error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
    {current?<div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div><h2 className="font-semibold">{current.title}</h2><p className="text-xs text-muted-foreground">{current.type} · Internal · Draft · Release not recorded</p><p className="text-xs text-muted-foreground">{current.part||current.id}</p></div>
      {(currentProject||currentRecord)&&<section aria-label="Lifecycle context" className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-xs sm:grid-cols-2">
        {currentProject&&<div><p className="font-semibold">Project lifecycle context</p><p>{currentProject.reference} · {currentProject.title}</p><p>Project phase: {currentProject.fields["companyPhase"]||"Not recorded"}</p><p>Current stage: {projectStageCode||"Not recorded in the project lifecycle"}</p></div>}
        {currentRecord&&<div><p className="font-semibold">Linked draft parameters</p><p>{currentRecord.reference} · {currentRecord.title}</p><p>Type: {currentRecord.type} · Status: {currentRecord.status}</p><p>Required phase/stage: {recordStageCode||"Not mapped"}</p>{Object.entries(currentRecord.fields).filter(([key,value])=>!/^project(Id|Code)$/.test(key)&&typeof value==="string"&&value.trim()).slice(0,8).map(([key,value])=><p key={key}><span className="capitalize">{key.replace(/([A-Z])/g," $1").replaceAll("_"," ")}</span>: {value}</p>)}</div>}
        {currentProject&&<p className={`sm:col-span-2 ${stageAllowsRevision?"text-muted-foreground":"text-destructive"}`}>{stageAllowsRevision?"Project document revisions are available for the mapped current stage or its immediate predecessor.":"Revision upload is held: the project stage or linked record stage is missing, unmapped, or outside the current/previous stage window."}</p>}
      </section>}
      {files.isPending?<p className="text-xs">Loading private revisions…</p>:files.error?<p role="alert" className="text-xs text-destructive">{files.error.message}</p>:<div className="divide-y rounded border">{files.data?.map(f=><div key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3"><div><p className="text-sm font-medium">{f.original_name}</p><p className="text-xs text-muted-foreground">Rev {f.revision} · {Math.ceil(f.size_bytes/1024)} KB · {!f.originalAvailable?"Original unavailable / upload pending":f.superseded_at?"Historical revision":"Stored original"}</p></div><Button size="sm" variant="outline" disabled={busy||!f.originalAvailable} onClick={async()=>{setBusy(true);setError("");try{const result=await download({data:{fileId:f.id}});window.location.assign(result.url);}catch(e){setError(e instanceof Error?e.message:"Download denied.");}finally{setBusy(false);}}}>Download original</Button></div>)}{!files.data?.length&&<p className="p-3 text-xs text-muted-foreground">No private file has been uploaded for this document.</p>}</div>}
      {canUploadAtStage&&<div className="space-y-2 rounded-lg border border-dashed p-3"><p className="text-xs font-semibold">Add a new file revision to this document · maximum 25 MB</p><div className="flex flex-wrap items-center gap-2"><input ref={fileInput} aria-label="Original document file" type="file" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/><label className="flex items-center gap-2 text-xs">Revision<select aria-label="File revision" className="rounded border bg-background p-2" value={revision} disabled={busy} onChange={e=>setRevision(e.target.value)}>{revisions.map(r=><option key={r} value={r}>{r}{r===revisions.at(-1)?" · Next":" · Existing package"}</option>)}</select></label><Button size="sm" disabled={busy||!file} onClick={()=>void upload()}>{busy?"Saving…":"Upload revision"}</Button></div>{file&&<p className="text-xs">Selected: {file.name}</p>}<p className="text-xs text-muted-foreground">Earlier originals remain in history. Uploading never grants client access or final approval.</p></div>}
      {canUpload&&!stageAllowsRevision&&currentProject&&<p role="note" className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs">This project-linked document is read-only for revisions until its mapped stage is active or immediately previous. Check the project lifecycle and linked draft parameters above.</p>}
    </div>:<><ResponsiveFilterBar label="Vault project"><CompactFilterSelect label="Project" icon={FolderKanban} value={projectFilter} onChange={setProjectFilter} options={[{value:"all",label:"All projects / common documents"},...projects.map(p=>({value:p.id,label:`${p.reference} · ${p.title}`}))]}/></ResponsiveFilterBar>{canManage&&projectFilter==="all"&&<p className="text-xs text-muted-foreground">Add a common document here, or select a project first to create a project document.</p>}{renderLibrary({documents:projectFilter==="all"?documents:documents.filter(d=>d.projectId===projectFilter),departmentContext:department?.id||null,onSelectDocument:doc=>{setSelected(doc.id);setNotice("");},onUploadFile:openRegistration,readOnlyReason:canManage?undefined:"Your role can view authorized files. Registration and upload require the responsible lead or Admin."})}</>}
    <Dialog open={create} onOpenChange={open=>{if(!open&&!busy){if(createdDraft){setSelected(createdDraft.id);setNotice(`${createdDraft.reference} remains a Draft; its original file still needs upload.`);}setCreate(false);setPendingFile(null);setCreatedDraft(null);}}}><DialogContent className="w-[calc(100vw-2rem)] max-w-xl overflow-x-hidden"><DialogHeader><DialogTitle>Add document</DialogTitle><DialogDescription>Add a common document or choose a project, enter its details and original file, then save once. Approval and release are separate.</DialogDescription></DialogHeader>
      <form className="min-w-0 space-y-3 [&>*]:min-w-0 [&_button]:max-w-full [&_button]:truncate [&_input]:max-w-full [&_select]:max-w-full" onSubmit={async e=>{e.preventDefault();if(!department||busy||!pendingFile)return;setBusy(true);setError("");try{
        let draft=createdDraft;
        if(!draft){registrationRequest.current ||= crypto.randomUUID();const result=await register({data:{requestId:registrationRequest.current,payload:{title,documentType:kind,scope,departmentId:department.id,...(projectId?{projectId}:{}),...(recordId?{recordId}:{}),...(sourceFileId?{sourceFileId}:{})}}});draft={id:result.id,reference:result.reference};setCreatedDraft(draft);registrationRequest.current=null;}
        await uploadOriginal(draft.id,pendingFile,"01");
        await query.refetch();setSelected(draft.id);setCreate(false);setPendingFile(null);setCreatedDraft(null);setNotice(`${draft.reference} saved with its original file as a Draft. It has not been approved or released.`);
      }catch(e){setError(e instanceof Error?e.message:"The document could not be saved. Your selected file is preserved for retry.");}finally{setBusy(false);}}}>
        <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs">Scope<select disabled={Boolean(createdDraft)} className="rounded border bg-background p-2" value={scope} onChange={e=>{const next=e.target.value as typeof scope;setScope(next);setProjectId("");setRecordId("");}}><option value="common">Common / standards</option><option value="internal">Internal project</option><option value="client">Client project</option><option value="department">Other department work</option></select></label><label className="grid gap-1 text-xs">Document type<select disabled={Boolean(createdDraft)} className="rounded border bg-background p-2" value={kind} onChange={e=>setKind(e.target.value)}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label></div>
        {(scope==="internal"||scope==="client")&&<SharedMasterSelect label="Project" required value={projectId} disabled={Boolean(createdDraft)} onChange={id=>{setProjectId(id);setRecordId(id);}} options={projects.map(p=>({value:p.id,label:`${p.reference} · ${p.title}`}))}/>}
        <label className="grid gap-1 text-xs">Title<input required disabled={Boolean(createdDraft)} maxLength={300} className="rounded border bg-background p-2" value={title} onChange={e=>setTitle(e.target.value)}/></label>
        {recordId!==projectId&&<SharedMasterSelect label="Related record (optional)" value={recordId} disabled={Boolean(createdDraft)} onChange={setRecordId} options={records.filter(r=>!projectId||r.id===projectId||[projectId,projects.find(p=>p.id===projectId)?.reference].includes(r.fields["projectId"])).map(r=>({value:r.id,label:`${r.reference} · ${r.title}`}))}/> }
        {nativeSourceRequired&&<SharedMasterSelect label="Source Gerber revision" required value={sourceFileId} disabled={Boolean(createdDraft)} onChange={setSourceFileId} options={sourceFiles.map(f=>({value:f.id,label:f.label}))}/>}
        <label className="grid gap-1 text-xs">Original file · required<input aria-label="Original document file" type="file" disabled={busy||Boolean(createdDraft)} onChange={e=>{const next=e.target.files?.[0]||null;setPendingFile(next);if(next&&!title)setTitle(next.name.replace(/\.[^.]+$/,""));}}/></label>
        {pendingFile&&<p className="text-xs text-muted-foreground">Selected: {pendingFile.name} · {(pendingFile.size/1024).toFixed(1)} KB</p>}{createdDraft&&<p className="text-xs text-muted-foreground">Draft {createdDraft.reference} is registered. Retry uploads this same file without making another record.</p>}{error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>{if(createdDraft){setSelected(createdDraft.id);setNotice(`${createdDraft.reference} remains a Draft; its original file still needs upload.`);}setCreate(false);setPendingFile(null);setCreatedDraft(null);}}>Cancel</Button><Button disabled={busy||!title.trim()||!pendingFile||((scope==="client"||scope==="internal")&&!projectId)||(nativeSourceRequired&&!sourceFileId)}>{busy?"Saving document & uploading…":createdDraft?"Retry original upload":"Save document & upload original"}</Button></div>
      </form></DialogContent></Dialog>
  </section>;
}

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const [pendingFile,setPendingFile]=useState<File|null>(null),[file,setFile]=useState<File|null>(null),[revision,setRevision]=useState("01");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const registrationRequest=useRef<string|null>(null),fileInput=useRef<HTMLInputElement>(null),uploadLock=useRef(false);
  const initialFile=useRef<{id:string;file:File|null}|null>(null);
  const records=projectsQuery.data?.records||[],projects=records.filter(r=>r.type==="Project"),documents=vaultDisplayDocuments(query.data||[],records);
  const ownerCode=membership.role==="admin"?departmentCode:membership.departmentCode;
  const department=people.data?.departments.find(d=>d.code===ownerCode);
  const canManage=!membership.isClient&&["admin","department_lead"].includes(membership.role)&&!!department;
  const current=documents.find(d=>d.id===selected);
  const canUpload=canManage&&(membership.role==="admin"||current?.departmentId===department?.id);
  const files=useQuery({queryKey:["controlled-files",membership.organizationId,membership.membershipId,selected],queryFn:()=>list({data:{documentId:selected}}),enabled:!!current});
  const revisions=attachmentRevisionOptions(files.data||[]);
  const nativeSourceRequired=kind==="Panel ZIP"||kind==="Stencil PCB fab";
  useEffect(()=>{setFile(initialFile.current?.id===selected?initialFile.current.file:null);initialFile.current=null;setRevision("01");setError("");},[selected]);
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
    setPendingFile(pending);setTitle(pending?.name||"");setRecordId("");setSourceFileId("");registrationRequest.current=null;setError("");setCreate(true);
    if(projectFilter!=="all"&&projects.some(p=>p.id===projectFilter)){setScope("client");setProjectId(projectFilter);}else{setScope("common");setProjectId("");}
  }
  async function upload(){
    if(!file||!current||!canUpload||uploadLock.current)return;
    if(!file.size||file.size>25*1024*1024){setError("Choose a non-empty file up to 25 MB.");return;}
    uploadLock.current=true;setBusy(true);setError("");setNotice("");
    try{
      const checksum=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer()))).map(v=>v.toString(16).padStart(2,"0")).join("");
      const result=await begin({data:{documentId:current.id,revision,name:file.name,contentType:file.type||"application/octet-stream",sizeBytes:file.size,checksum}});
      if(result.signedUploadUrl){const response=await fetch(result.signedUploadUrl,{method:"PUT",headers:{"Content-Type":file.type||"application/octet-stream"},body:file});if(!response.ok)throw new Error("Private upload did not finish. Your selected file is preserved for retry.");}
      await finish({data:{fileId:result.file.id}});await files.refetch();setFile(null);if(fileInput.current)fileInput.current.value="";
      setNotice("Original file saved privately. This does not approve or release the document.");
    }catch(e){setError(e instanceof Error?e.message:"Upload failed. Your selected file is preserved.");}
    finally{uploadLock.current=false;setBusy(false);}
  }
  if(query.isPending||people.isPending||projectsQuery.isPending)return <p className="text-sm text-muted-foreground">Loading controlled documents…</p>;
  const failure=query.error||people.error||projectsQuery.error;
  if(failure)return <div role="alert" className="space-y-3 rounded border p-4"><p>{failure instanceof Error?failure.message:"Shared document data is unavailable."}</p><Button variant="outline" onClick={()=>{void query.refetch();void people.refetch();void projectsQuery.refetch();}}>Retry</Button></div>;
  return <section className="space-y-4" aria-label="Shared controlled document vault">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h1 className="text-lg font-semibold">Documents & Vault</h1><p className="text-xs text-muted-foreground">Original files, controlled revisions and project references within your access.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={current?()=>setSelected(""):onBack}><ArrowLeft className="size-4"/>{current?"Library":"Workspace"}</Button>{canManage&&<Button size="sm" onClick={()=>openRegistration(null)}><Upload className="size-4"/>Add document</Button>}</div></div>
    {notice&&<p role="status" className="text-xs text-muted-foreground">{notice}</p>}{error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
    {current?<div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div><h2 className="font-semibold">{current.title}</h2><p className="text-xs text-muted-foreground">{current.type} · Internal · Release not recorded</p><p className="text-xs text-muted-foreground">{current.part||current.id}</p></div>
      {files.isPending?<p className="text-xs">Loading private revisions…</p>:files.error?<p role="alert" className="text-xs text-destructive">{files.error.message}</p>:<div className="divide-y rounded border">{files.data?.map(f=><div key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3"><div><p className="text-sm font-medium">{f.original_name}</p><p className="text-xs text-muted-foreground">Rev {f.revision} · {Math.ceil(f.size_bytes/1024)} KB · {f.superseded_at?"Historical revision":"Stored original"}</p></div><Button size="sm" variant="outline" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{const result=await download({data:{fileId:f.id}});window.location.assign(result.url);}catch(e){setError(e instanceof Error?e.message:"Download denied.");}finally{setBusy(false);}}}>Download original</Button></div>)}{!files.data?.length&&<p className="p-3 text-xs text-muted-foreground">No private file has been uploaded for this document.</p>}</div>}
      {canUpload&&<div className="space-y-2 rounded-lg border border-dashed p-3"><p className="text-xs font-semibold">Attach original file · maximum 25 MB</p><div className="flex flex-wrap items-center gap-2"><input ref={fileInput} aria-label="Original document file" type="file" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/><label className="flex items-center gap-2 text-xs">Revision<select aria-label="File revision" className="rounded border bg-background p-2" value={revision} disabled={busy} onChange={e=>setRevision(e.target.value)}>{revisions.map(r=><option key={r} value={r}>{r}{r===revisions.at(-1)?" · Next":" · Existing package"}</option>)}</select></label><Button size="sm" disabled={busy||!file} onClick={()=>void upload()}>{busy?"Saving…":"Upload privately"}</Button></div>{file&&<p className="text-xs">Selected: {file.name}</p>}<p className="text-xs text-muted-foreground">Earlier originals remain in history. Uploading never grants client access or final approval.</p></div>}
    </div>:<><ResponsiveFilterBar label="Vault project"><CompactFilterSelect label="Project" icon={FolderKanban} value={projectFilter} onChange={setProjectFilter} options={[{value:"all",label:"All projects / common documents"},...projects.map(p=>({value:p.id,label:`${p.reference} · ${p.title}`}))]}/></ResponsiveFilterBar>{renderLibrary({documents:projectFilter==="all"?documents:documents.filter(d=>d.projectId===projectFilter),departmentContext:department?.id||null,onSelectDocument:doc=>{setSelected(doc.id);setNotice("");},onUploadFile:openRegistration,readOnlyReason:canManage?undefined:"Your role can view authorized files. Registration and upload require the responsible lead or Admin."})}</>}
    <Dialog open={create} onOpenChange={open=>{if(!open&&!busy)setCreate(false);}}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Add document</DialogTitle><DialogDescription>Register one shared draft, then attach its original file. No duplicate project or master is created.</DialogDescription></DialogHeader>
      <form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(!department||busy)return;setBusy(true);setError("");registrationRequest.current ||= crypto.randomUUID();try{
        const result=await register({data:{requestId:registrationRequest.current,payload:{title,documentType:kind,scope,departmentId:department.id,...(projectId?{projectId}:{}),...(recordId?{recordId}:{}),...(sourceFileId?{sourceFileId}:{})}}});
        const refreshed=await query.refetch();if(refreshed.error)throw new Error(`Draft ${result.reference} is registered, but the library could not refresh. Retry with this unchanged form to reopen it without duplication.`);registrationRequest.current=null;initialFile.current={id:result.id,file:pendingFile};setSelected(result.id);setCreate(false);setPendingFile(null);setNotice(`${result.reference} registered as a shared Draft. Attach its original file below.`);
      }catch(e){setError(e instanceof Error?e.message:"Registration failed. Your draft is preserved.");}finally{setBusy(false);}}}>
        <label className="grid gap-1 text-xs">Title<input required maxLength={300} className="rounded border bg-background p-2" value={title} onChange={e=>setTitle(e.target.value)}/></label>
        <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs">Scope<select className="rounded border bg-background p-2" value={scope} onChange={e=>{const next=e.target.value as typeof scope;setScope(next);setProjectId("");setRecordId("");}}><option value="common">Common / standards</option><option value="internal">Internal project</option><option value="client">Client project</option><option value="department">Other department work</option></select></label><label className="grid gap-1 text-xs">Document type<select className="rounded border bg-background p-2" value={kind} onChange={e=>setKind(e.target.value)}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label></div>
        {(scope==="internal"||scope==="client")&&<SharedMasterSelect label="Project" required value={projectId} onChange={id=>{setProjectId(id);setRecordId("");}} options={projects.map(p=>({value:p.id,label:`${p.reference} · ${p.title}`}))}/>}
        <SharedMasterSelect label="Related record (optional)" value={recordId} onChange={setRecordId} options={records.filter(r=>!projectId||r.id===projectId||[projectId,projects.find(p=>p.id===projectId)?.reference].includes(r.fields["projectId"])).map(r=>({value:r.id,label:`${r.reference} · ${r.title}`}))}/>
        {nativeSourceRequired&&<SharedMasterSelect label="Source Gerber revision" required value={sourceFileId} onChange={setSourceFileId} options={sourceFiles.map(f=>({value:f.id,label:f.label}))}/>}
        {pendingFile&&<p className="text-xs text-muted-foreground">Selected file retained: {pendingFile.name}</p>}{error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>setCreate(false)}>Cancel</Button><Button disabled={busy||!title.trim()||((scope==="client"||scope==="internal")&&!projectId)||(nativeSourceRequired&&!sourceFileId)}>{busy?"Saving…":"Register draft"}</Button></div>
      </form></DialogContent></Dialog>
  </section>;
}

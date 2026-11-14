import type { SharedTestSnapshot } from "./shared-test.schema";
import type { CustomerRecord, EnquiryOpportunity } from "../components/SalesWorkspaceAndCustomerRegister";
import { sharedCustomerDirectory } from "./shared-customer-directory.ts";

const CANONICAL_TRACKS = new Set(["hardware_only", "firmware_only", "software_only", "hardware_firmware", "firmware_software_existing_hardware", "hardware_firmware_software", "ready_made"]);

export function sharedSalesPipeline(snapshot: SharedTestSnapshot): {customers: CustomerRecord[]; enquiries: EnquiryOpportunity[]} {
  const text=(r: SharedTestSnapshot["records"][number],key: string)=> typeof r.fields[key] === "string" ? r.fields[key] as string : "";
  const distinctValues=(...values:string[])=>[...new Set(values.map(value=>value.trim()).filter(Boolean))];
  const projectsById=new Map<string,{id:string;reference:string}>();
  for(const project of snapshot.records.filter(record=>record.record_type==="Project")) projectsById.set(project.id,{id:project.id,reference:project.reference});
  for(const project of snapshot.projectOptions??[]) if(!projectsById.has(project.id)) projectsById.set(project.id,{id:project.id,reference:project.reference});
  const projects=[...projectsById.values()];
  const linkedProject=(r:SharedTestSnapshot["records"][number])=>{
    const tokens=distinctValues(text(r,"projectId"),text(r,"project_id"),text(r,"linkedProjectId"),text(r,"projectCode"),text(r,"project_code"),text(r,"projectReference"),text(r,"project"));
    const matches=projects.filter(project=>tokens.some(token=>token===project.id||token===project.reference));
    return matches.length===1?matches[0]:undefined;
  };
  // Selector choices come from the authenticated canonical directory, not the
  // department-scoped full-record list. Enrich only records this membership can see.
  const customers = sharedCustomerDirectory(snapshot);
  const enquiries: EnquiryOpportunity[]=snapshot.records.filter(r=>["Enquiry","Opportunity"].includes(r.record_type)).map(r=>{
    const customerIds=distinctValues(text(r,"customerId"),text(r,"customer_id"));
    const customerId=customerIds.length===1?customerIds[0]:"";
    const customerCodes=distinctValues(text(r,"customerCode"),text(r,"customer_code"));
    const customerCode=customerCodes[0]??"";
    const customerById=customerIds.length<=1?customers.find(c=>c.id===customerId):undefined;
    const exactCodeMatches=customerCode ? customers.filter(c=>c.code===customerCode) : [];
    const customer=customerById ?? (customerIds.length===0&&customerCodes.length<=1&&exactCodeMatches.length===1 ? exactCodeMatches[0] : undefined);
    const reviews=snapshot.approvals.filter(a=>a.record_id===r.id && a.evidence_revision===text(r,"revision"));
    const projectTrack=CANONICAL_TRACKS.has(String(r.fields["projectTrack"] || "")) ? String(r.fields["projectTrack"]) as import("./canonical-lifecycle").CanonicalProjectTrack : undefined;
    const required=[...new Set(text(r,"requiredDepartments").split(",").map(s=>s.trim()).filter(Boolean))];
    const signed=required.filter(code=>reviews.some(a=>snapshot.departments.find(d=>d.id===a.reviewer_department_id)?.code===code && a.outcome==="approved"));
    const declined=["rejected","declined","cancelled","closed"].includes(r.status.toLowerCase()) || ["declined","rejected","cancelled"].includes(text(r,"outcome").toLowerCase());
    const project=linkedProject(r);
    const status: EnquiryOpportunity["status"]=declined ? "Declined" : project ? "Project Started" : required.length && signed.length===required.length ? "Feasibility Complete" : reviews.length || text(r,"feasibilityDispatchedAt") ? "Sent for Feasibility" : "Pending Enquiry";
    return {id:r.id,reference:r.reference,kind:r.record_type==="Opportunity"?"opportunity":"enquiry",title:r.title,
      ...(customer?.id || customerId ? {customerId:customer?.id || customerId} : {}),
      customerCode:customer?.code || customerCode,customerName:customer?.name || text(r,"customer"),
      spocName:text(r,"contactPerson") || customer?.spocName || "",spocEmail:text(r,"email") || customer?.spocEmail || "",
      scopeSummary:text(r,"scope") || r.notes,targetVolume:text(r,"quantity"),targetClosureDate:text(r,"targetDate"),salesOwner:text(r,"owner"),
      status,...(projectTrack?{projectTrack}:{}),feasibilityDepartments:required,feasibilitySignedDepts:signed,totalFeasibilityDepts:required.length,linkedProjectCode:project?.reference||text(r,"projectCode")||text(r,"project_code")||text(r,"projectId")||text(r,"project_id")||text(r,"linkedProjectId"),createdAt:r.updated_at,updatedAt:r.updated_at};
  });
  return {customers,enquiries};
}

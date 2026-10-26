import type { SharedTestSnapshot } from "./shared-test.schema";
import type { CustomerRecord, EnquiryOpportunity } from "../components/SalesWorkspaceAndCustomerRegister";

export function sharedSalesPipeline(snapshot: SharedTestSnapshot): {customers: CustomerRecord[]; enquiries: EnquiryOpportunity[]} {
  const text=(r: SharedTestSnapshot["records"][number],key: string)=> typeof r.fields[key] === "string" ? r.fields[key] as string : "";
  const customers: CustomerRecord[] = snapshot.records.filter(r=>r.record_type === "Customer").map(r=>({
    id:r.id,code:r.reference,name:r.title,division:text(r,"division"),spocName:text(r,"spocName"),spocEmail:text(r,"spocEmail"),
    spocPhone:text(r,"spocPhone"),cityState:text(r,"cityState"),gstin:text(r,"gstin"),status:"Prospect",
    activeOpportunitiesCount:snapshot.records.filter(i=>i.record_type === "Opportunity" && text(i,"customerId") === r.id).length,
    assignedLead:text(r,"owner"),createdAt:r.updated_at,
  }));
  const enquiries: EnquiryOpportunity[]=snapshot.records.filter(r=>["Enquiry","Opportunity"].includes(r.record_type)).map(r=>{
    const customer=customers.find(c=>c.id===text(r,"customerId") || c.code===text(r,"customerCode"));
    const reviews=snapshot.approvals.filter(a=>a.record_id===r.id && a.evidence_revision===text(r,"revision"));
    const required=[...new Set(text(r,"requiredDepartments").split(",").map(s=>s.trim()).filter(Boolean))];
    const signed=required.filter(code=>reviews.some(a=>snapshot.departments.find(d=>d.id===a.reviewer_department_id)?.code===code && a.outcome==="approved"));
    const declined=["rejected","declined","cancelled","closed"].includes(r.status.toLowerCase()) || ["declined","rejected","cancelled"].includes(text(r,"outcome").toLowerCase());
    const status: EnquiryOpportunity["status"]=declined ? "Declined" : required.length && signed.length===required.length ? "Feasibility Complete" : reviews.length || text(r,"feasibilityDispatchedAt") ? "Sent for Feasibility" : "Pending Enquiry";
    return {id:r.id,reference:r.reference,kind:r.record_type==="Opportunity"?"opportunity":"enquiry",title:r.title,
      customerCode:customer?.code || text(r,"customerCode"),customerName:customer?.name || text(r,"customer"),
      spocName:text(r,"contactPerson") || customer?.spocName || "",spocEmail:text(r,"email") || customer?.spocEmail || "",
      scopeSummary:text(r,"scope") || r.notes,targetVolume:text(r,"quantity"),targetClosureDate:text(r,"targetDate"),salesOwner:text(r,"owner"),
      status,projectTrack:(["turnkey","software","firmware","ready_made"].includes(text(r,"projectTrack"))?text(r,"projectTrack"):"turnkey") as EnquiryOpportunity["projectTrack"],feasibilityDepartments:required,feasibilitySignedDepts:signed,totalFeasibilityDepts:required.length,linkedProjectCode:text(r,"projectId"),createdAt:r.updated_at,updatedAt:r.updated_at};
  });
  return {customers,enquiries};
}

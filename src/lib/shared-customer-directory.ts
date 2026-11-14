import type { CustomerRecord } from "@/components/SalesWorkspaceAndCustomerRegister";
import type { SharedTestSnapshot } from "@/lib/shared-test.schema";
import { isSelectableMasterStatus } from "./shared-master-options.ts";

const fieldText = (value: unknown) => typeof value === "string" ? value : "";

function customerStatus(value: string): CustomerRecord["status"] {
  const normalized = value.trim().toLowerCase();
  if (!isSelectableMasterStatus(normalized)) return "Inactive";
  if (normalized === "active" || normalized === "released") return "Active";
  return "Prospect";
}

/** Build the directory from authenticated shared options and only enrich them with visible canonical records. */
export function sharedCustomerDirectory(snapshot: SharedTestSnapshot): CustomerRecord[] {
  const records = snapshot.records.filter(record => record.record_type === "Customer");
  const byId = new Map(records.map(record => [record.id, record]));
  const opportunityCounts = new Map<string, number>();

  for (const record of snapshot.records) {
    if (record.record_type !== "Opportunity") continue;
    const linkedIds = [...new Set([fieldText(record.fields["customerId"]), fieldText(record.fields["customer_id"])].map(value => value.trim()).filter(Boolean))];
    const customerId = linkedIds.length === 1 ? linkedIds[0] : "";
    if (customerId) opportunityCounts.set(customerId, (opportunityCounts.get(customerId) ?? 0) + 1);
  }

  const customerIds = new Set<string>();
  const customers = (snapshot.customerOptions ?? []).map(option => {
    customerIds.add(option.id);
    const record = byId.get(option.id);
    return {
      id: option.id,
      code: record?.reference ?? option.reference,
      name: record?.title ?? option.title,
      division: fieldText(record?.fields["division"]),
      spocName: fieldText(record?.fields["spocName"]),
      spocEmail: fieldText(record?.fields["spocEmail"]),
      spocPhone: fieldText(record?.fields["spocPhone"]),
      cityState: fieldText(record?.fields["cityState"]),
      gstin: fieldText(record?.fields["gstin"]),
      status: customerStatus(record?.status ?? option.status),
      activeOpportunitiesCount: opportunityCounts.get(option.id) ?? 0,
      assignedLead: fieldText(record?.fields["owner"]),
      createdAt: record?.updated_at ?? "",
    } satisfies CustomerRecord;
  });

  // Some memberships may see a full customer record without receiving the minimal selector option.
  for (const record of records) {
    if (customerIds.has(record.id)) continue;
    customers.push({
      id: record.id,
      code: record.reference,
      name: record.title,
      division: fieldText(record.fields["division"]),
      spocName: fieldText(record.fields["spocName"]),
      spocEmail: fieldText(record.fields["spocEmail"]),
      spocPhone: fieldText(record.fields["spocPhone"]),
      cityState: fieldText(record.fields["cityState"]),
      gstin: fieldText(record.fields["gstin"]),
      status: customerStatus(record.status),
      activeOpportunitiesCount: opportunityCounts.get(record.id) ?? 0,
      assignedLead: fieldText(record.fields["owner"]),
      createdAt: record.updated_at,
    });
  }

  return customers.sort((a, b) => a.name.localeCompare(b.name));
}

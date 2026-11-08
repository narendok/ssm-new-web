export type DepartmentTicketGroup = 'service' | 'it';

export const departmentTicketGroups: Record<DepartmentTicketGroup, { label: string; categories: string[] }> = {
  service: { label: 'Service Tickets', categories: ['Hardware Fault', 'Firmware / Telemetry', 'Cloud & Gateway', 'Field RMA & Replacement'] },
  it: { label: 'IT Tickets', categories: ['IT Workstation & Network', 'Facility & Power'] },
};

export function configuredTicketGroups(value: unknown, departmentCode: string): DepartmentTicketGroup[] {
  if (Array.isArray(value)) return [...new Set(value.filter((entry): entry is DepartmentTicketGroup => entry === 'service' || entry === 'it'))];
  return departmentCode.replace(/^DEMO-/, '').toUpperCase() === 'SIT' ? ['service', 'it'] : [];
}

export type SharedDepartmentScope = {
  id: string;
  code: string;
  active?: boolean;
  leadMemberId?: string | null;
  lead_member_id?: string | null;
};

export type SharedDepartmentRoleScope = {
  departmentId: string;
  active: boolean;
  memberIds: string[];
  permissions: string[];
};

export function departmentIdsForMember(
  departments: SharedDepartmentScope[],
  roles: SharedDepartmentRoleScope[],
  membershipId: string,
  accountRole: string,
  primaryDepartmentCode: string | null | undefined,
) {
  if (accountRole === 'admin') return departments.filter(d => d.active !== false).map(d => d.id);
  const roleDepartmentIds = new Set(roles
    .filter(role => role.active && role.memberIds.includes(membershipId) && role.permissions.includes('records:view'))
    .map(role => role.departmentId));
  return departments.filter(department => department.active !== false && (
    (department.leadMemberId ?? department.lead_member_id) === membershipId ||
    roleDepartmentIds.has(department.id) ||
    department.code === primaryDepartmentCode
  )).map(department => department.id);
}

export function memberHasDepartmentPermission(
  department: SharedDepartmentScope | undefined,
  roles: SharedDepartmentRoleScope[],
  membershipId: string,
  accountRole: string,
  permission: string,
) {
  if (accountRole === 'admin' || (department && (department.leadMemberId ?? department.lead_member_id) === membershipId)) return true;
  if (!department) return false;
  return roles.some(role => role.active && role.departmentId === department.id && role.memberIds.includes(membershipId) && role.permissions.includes(permission));
}

export function memberHasDepartmentScope(
  department: SharedDepartmentScope | undefined,
  roles: SharedDepartmentRoleScope[],
  membershipId: string,
) {
  if (!department) return false;
  return (department.leadMemberId ?? department.lead_member_id) === membershipId || roles.some(role => role.active && role.departmentId === department.id && role.memberIds.includes(membershipId));
}

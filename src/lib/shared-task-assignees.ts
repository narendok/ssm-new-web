export interface SharedTaskAssigneeMember {
  id: string;
  display_name: string | null;
  role: string;
  department_id: string | null;
}

export interface SharedTaskAssigneeRole {
  id: string;
  departmentId: string;
  name: string;
  active: boolean;
  hierarchyLevel?: number | null | undefined;
  memberIds: string[];
}

export interface SharedTaskAssigneeOption {
  value: string;
  label: string;
  configuredProfile: boolean;
}

const levelNames: Record<number, string> = {
  1: "L1 · Lead",
  2: "L2 · Senior / Specialist",
  3: "L3 · Associate / Technician",
  4: "L4 · Operator / Trainee",
};

/**
 * Resolve selectable assignees from the saved org-chart profiles for one
 * department. Preserve an existing unclassified assignee visibly, but never
 * offer unconfigured people as new profile-based choices.
 */
export function sharedTaskAssigneeOptions(
  departmentId: string | null,
  currentAssigneeId: string | null,
  members: SharedTaskAssigneeMember[],
  roles: SharedTaskAssigneeRole[],
): SharedTaskAssigneeOption[] {
  if (!departmentId) return [];

  const eligibleMembers = members.filter(
    (member) => member.department_id === departmentId && member.role !== "viewer",
  );
  const memberById = new Map(eligibleMembers.map((member) => [member.id, member]));
  const profilesByMember = new Map<string, string[]>();

  for (const role of roles) {
    const level = role.hierarchyLevel;
    if (
      !role.active ||
      role.departmentId !== departmentId ||
      level == null ||
      !levelNames[level]
    ) {
      continue;
    }
    for (const memberId of role.memberIds) {
      if (!memberById.has(memberId)) continue;
      const profile = `${levelNames[level]} · ${role.name}`;
      const profiles = profilesByMember.get(memberId) ?? [];
      profiles.push(profile);
      profilesByMember.set(memberId, profiles);
    }
  }

  const options = [...profilesByMember.entries()]
    .map(([memberId, profiles]) => {
      const member = memberById.get(memberId)!;
      const name = member.display_name?.trim() || "Unnamed member";
      return {
        value: memberId,
        label: `${profiles.join(" / ")} — ${name}`,
        configuredProfile: true,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));

  if (currentAssigneeId && !profilesByMember.has(currentAssigneeId)) {
    const current = memberById.get(currentAssigneeId);
    if (current) {
      options.unshift({
        value: current.id,
        label: `Current assignment · profile not configured — ${current.display_name?.trim() || "Unnamed member"}`,
        configuredProfile: false,
      });
    }
  }

  return options;
}

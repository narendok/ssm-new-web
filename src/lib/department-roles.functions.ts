import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Json } from '@/integrations/supabase/types';

const permissionKeys = [
  'records:view', 'records:create', 'records:edit', 'tasks:assign',
  'approvals:decide', 'documents:manage', 'settings:manage', 'audit:manage', 'documents:approve',
] as const;
const roleConfiguration = z.object({
  canManage: z.boolean(),
  departments: z.array(z.object({ id: z.string().uuid(), code: z.string(), name: z.string(), active: z.boolean(), leadMemberId: z.string().uuid().nullable() })),
  members: z.array(z.object({ id: z.string().uuid(), name: z.string(), role: z.enum(['department_lead', 'member']), departmentId: z.string().uuid().nullable() })),
  roles: z.array(z.object({
    id: z.string().uuid(), departmentId: z.string().uuid(), departmentCode: z.string(), departmentName: z.string(),
    name: z.string(), roleKey: z.string(), active: z.boolean(), updatedAt: z.string(), hierarchyLevel: z.number().int().min(1).max(4).nullable().optional(),
    permissions: z.array(z.enum(permissionKeys)), memberIds: z.array(z.string().uuid()),
  })),
});
export type SharedDepartmentRoleConfiguration = z.infer<typeof roleConfiguration>;
interface Rpc { rpc(name: string, args?: Record<string, Json>): Promise<{ data: unknown; error: { message: string } | null }> }

export const getSharedDepartmentRoleConfiguration = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const response = await (context.supabase as unknown as Rpc).rpc('get_shared_department_role_configuration');
    if (response.error) throw Error(response.error.message);
    return roleConfiguration.parse(response.data);
  });

export const saveSharedDepartmentRole = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    id: z.string().uuid().nullable(), expectedUpdatedAt: z.string().nullable(), departmentId: z.string().uuid(),
    name: z.string().trim().min(2).max(100), roleKey: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/), active: z.boolean(), hierarchyLevel: z.number().int().min(1).max(4).nullable(),
    permissions: z.array(z.enum(permissionKeys)).max(permissionKeys.length), memberIds: z.array(z.string().uuid()).max(100),
  }).parse)
  .handler(async ({ context, data }) => {
    const response = await (context.supabase as unknown as Rpc).rpc('save_shared_department_role', { p_payload: data });
    if (response.error) throw Error(response.error.message);
    return roleConfiguration.parse(response.data);
  });

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Json } from '@/integrations/supabase/types';

const result = z.object({
  canManage: z.boolean(),
  departments: z.array(z.object({id:z.string().uuid(),code:z.string(),name:z.string(),type:z.string(),active:z.boolean(),sortOrder:z.number(),leadMemberId:z.string().uuid().nullable(),updatedAt:z.string(),ticketGroups:z.array(z.enum(["service","it"])).default([]),workspaceDepartmentId:z.string().uuid().nullable().default(null)})),
  leads: z.array(z.object({id:z.string().uuid(),name:z.string(),departmentId:z.string().uuid().nullable()})),
});
export type OrganizationConfiguration = z.infer<typeof result>;
interface Rpc { rpc(name:string,args?:Record<string,Json>):Promise<{data:unknown;error:{message:string}|null}> }
export const getOrganizationConfiguration=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const response=await (context.supabase as unknown as Rpc).rpc('get_organization_configuration');
  if(response.error)throw Error(response.error.message);
  return result.parse(response.data);
});
export const updateOrganizationDepartment=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).validator(z.object({
  ticketGroups:z.array(z.enum(["service","it"])).max(2),workspaceDepartmentId:z.string().uuid().nullable(),id:z.string().uuid(),expectedUpdatedAt:z.string(),name:z.string().trim().min(1).max(160),type:z.string().trim().min(1).max(160),active:z.boolean(),sortOrder:z.number().int().min(0).max(999),leadMemberId:z.string().uuid().nullable(),
}).parse).handler(async({context,data})=>{
  const response=await (context.supabase as unknown as Rpc).rpc('update_organization_department',{p_payload:data});
  if(response.error)throw Error(response.error.message);
  return result.parse(response.data);
});

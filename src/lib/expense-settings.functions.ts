import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Json } from '@/integrations/supabase/types';
const scope = z.object({ department: z.string().uuid().nullable() });
const serviceOption=z.object({id:z.string(),name:z.string(),category:z.string(),provider:z.string(),cycle:z.string(),owner:z.string(),supplierId:z.string().uuid().optional()});
const supplierOption=z.object({id:z.string().uuid(),reference:z.string(),title:z.string(),status:z.string()});
const result = z.object({ categories:z.array(z.string()), purposes:z.array(z.string()), services:z.array(serviceOption).default([]), suppliers:z.array(supplierOption).default([]), operationsEnabled:z.boolean(), version:z.number(), canManage:z.boolean(), canManageServices:z.boolean().default(false), isAdmin:z.boolean() });
export type ExpenseCatalogue = z.infer<typeof result>;
interface Rpc { rpc(name:string,args:Record<string,Json>):Promise<{data:unknown;error:{message:string}|null}> }
export const getExpenseCatalogue=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).validator(scope.parse).handler(async({context,data})=>{
 const r=await (context.supabase as unknown as Rpc).rpc('get_expense_catalogue',{p_department:data.department});
 if(r.error)throw new Error(r.error.message);return result.parse(r.data);
});
export const saveExpenseCatalogue=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).validator(scope.extend({value:z.object({categories:z.array(z.string().trim().min(1).max(160)).min(1).max(100),purposes:z.array(z.string().trim().min(1).max(160)).min(1).max(100),operationsEnabled:z.boolean(),services:z.array(serviceOption).max(80)}),version:z.number().int().nonnegative()}).parse).handler(async({context,data})=>{
 const r=await (context.supabase as unknown as Rpc).rpc('save_expense_catalogue',{p_department:data.department,p_value:data.value,p_version:data.version});
 if(r.error)throw new Error(r.error.message);return result.parse(r.data);
});

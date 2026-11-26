import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Json } from '@/integrations/supabase/types';
import { effectiveTravelPolicyResult, travelPolicySchema, type EffectiveTravelPolicy } from '@/lib/effective-travel-policy.schema';
const scope = z.object({ department: z.string().uuid().nullable() });
const serviceOption=z.object({id:z.string(),name:z.string(),category:z.string(),provider:z.string(),cycle:z.string(),owner:z.string(),supplierId:z.string().uuid().optional()});
const supplierOption=z.object({id:z.string().uuid(),reference:z.string(),title:z.string(),status:z.string()});
const locationOption=z.object({id:z.string().uuid(),reference:z.string(),name:z.string(),city:z.string(),cityTier:z.enum(['metro','other']),active:z.boolean()});
const locationRequest=z.object({id:z.string().uuid(),requesterId:z.string().uuid(),requesterName:z.string().optional(),name:z.string(),city:z.string(),reason:z.string(),status:z.string(),createdAt:z.string()});
const result = z.object({ categories:z.array(z.string()), purposes:z.array(z.string()), services:z.array(serviceOption).default([]), suppliers:z.array(supplierOption).default([]), locations:z.array(locationOption).default([]), locationRequests:z.array(locationRequest).default([]), canManageLocations:z.boolean().default(false), canReviewLocations:z.boolean().default(false), operationsEnabled:z.boolean(), version:z.number(), canManage:z.boolean(), canManageServices:z.boolean().default(false), isAdmin:z.boolean() });
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
export const manageExpenseLocation=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).validator(z.object({id:z.string().uuid().nullable(),name:z.string().trim().min(2).max(160),city:z.string().trim().min(2).max(120),cityTier:z.enum(['metro','other']),active:z.boolean()}).parse).handler(async({context,data})=>{
 const r=await (context.supabase as unknown as Rpc).rpc('manage_expense_location',{p_id:data.id,p_name:data.name,p_city:data.city,p_city_tier:data.cityTier,p_active:data.active});
 if(r.error)throw new Error(r.error.message);return locationOption.parse(r.data);
});
export const requestExpenseLocation=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).validator(z.object({name:z.string().trim().min(2).max(160),city:z.string().trim().min(2).max(120),reason:z.string().trim().min(3).max(500),requestId:z.string().uuid()}).parse).handler(async({context,data})=>{
 const r=await (context.supabase as unknown as Rpc).rpc('request_expense_location',{p_value:{name:data.name,city:data.city,reason:data.reason},p_request_id:data.requestId});
 if(r.error)throw new Error(r.error.message);return z.object({id:z.string().uuid(),name:z.string(),city:z.string(),reason:z.string(),status:z.string(),createdAt:z.string()}).parse(r.data);
});
export const reviewExpenseLocation=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).validator(z.object({id:z.string().uuid(),outcome:z.enum(['approve','reject']),name:z.string().trim().min(2).max(160).optional(),city:z.string().trim().min(2).max(120).optional(),cityTier:z.enum(['metro','other']).optional(),reason:z.string().trim().max(500).optional()}).parse).handler(async({context,data})=>{
 const r=await (context.supabase as unknown as Rpc).rpc('review_expense_location',{p_id:data.id,p_outcome:data.outcome,p_name:data.name??null,p_city:data.city??null,p_city_tier:data.cityTier??null,p_reason:data.reason??null});
 if(r.error)throw new Error(r.error.message);return z.object({id:z.string().uuid(),status:z.string(),location:locationOption.nullable()}).parse(r.data);
});

const travelPolicy = travelPolicySchema;
const travelPolicyResult = z.object({
 company:travelPolicy,companyDraft:travelPolicy.nullable(),department:travelPolicy.nullable(),departmentDraft:travelPolicy.nullable(),companyVersion:z.number().int().nonnegative(),departmentVersion:z.number().int().nonnegative(),
 scopeDepartment:z.string().uuid().nullable(),isAdmin:z.boolean(),canView:z.boolean(),ownDepartment:z.string().uuid().nullable(),
 canManageCompany:z.boolean(),canManageDepartment:z.boolean(),
});
export type TravelPolicy = z.infer<typeof travelPolicy>;
export type TravelPolicySettings = z.infer<typeof travelPolicyResult>;
const travelScope = z.object({department:z.string().uuid().nullable()});
export const getTravelPolicy=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).validator(travelScope.parse).handler(async({context,data})=>{
 const r=await (context.supabase as unknown as Rpc).rpc('get_travel_policy',{p_department:data.department});
 if(r.error)throw new Error(r.error.message);return travelPolicyResult.parse(r.data);
});
export const saveTravelPolicy=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).validator(travelScope.extend({value:travelPolicy,version:z.number().int().nonnegative(),publish:z.boolean()}).parse).handler(async({context,data})=>{
 const r=await (context.supabase as unknown as Rpc).rpc('save_travel_policy',{p_department:data.department,p_value:data.value,p_version:data.version,p_publish:data.publish});
 if(r.error)throw new Error(r.error.message);return travelPolicyResult.parse(r.data);
});

export type { EffectiveTravelPolicy };
export const getEffectiveTravelPolicy=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).validator(z.object({department:z.string().uuid(),travelDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).parse).handler(async({context,data})=>{
 const r=await (context.supabase as unknown as Rpc).rpc('get_effective_travel_policy',{p_department:data.department,p_travel_date:data.travelDate});
 if(r.error)throw new Error(r.error.message);return effectiveTravelPolicyResult.parse(r.data);
});

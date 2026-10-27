import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
const entry=z.object({id:z.string().uuid(),department_id:z.string().uuid(),department_code:z.string(),project_id:z.string().uuid().nullable(),project_code:z.string().nullable(),scope:z.enum(["common","internal","client"]),stage:z.string().nullable(),title:z.string(),rationale:z.string(),source_references:z.array(z.string()),conditions:z.string(),author_id:z.string().uuid(),author_name:z.string(),author_role:z.string(),status:z.enum(["Pending lead review","Recorded","Approved","Rejected"]),reviewer_name:z.string().nullable(),reviewed_at:z.string().nullable(),version:z.number().int(),created_at:z.string()});
const snapshot=z.object({entries:z.array(entry),visibility:z.array(z.object({owner_department_id:z.string().uuid(),viewer_department_id:z.string().uuid(),enabled:z.boolean()}))});
export type SharedDecisionEntry=z.infer<typeof entry>;
export const getSharedDecisions=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const client=context.supabase as unknown as {rpc(name:string,args?:Record<string,Json>):Promise<{data:Json;error:{message:string}|null}>};
  const response=await client.rpc("get_shared_decisions");if(response.error)throw new Error(response.error.message);return snapshot.parse(response.data);
});
const payload=z.object({id:z.string().uuid().optional(),departmentId:z.string().uuid().optional(),projectId:z.string().uuid().optional(),scope:z.enum(["common","internal","client"]).optional(),stage:z.string().max(180).optional(),title:z.string().max(180).optional(),rationale:z.string().max(4000).optional(),conditions:z.string().max(2000).optional(),sourceReferences:z.array(z.string().max(300)).max(20).optional(),expectedVersion:z.number().int().positive().optional(),reason:z.string().max(2000).optional(),viewerDepartmentId:z.string().uuid().optional(),enabled:z.boolean().optional()});
export type SharedDecisionPayload=z.infer<typeof payload>;
export const mutateSharedDecision=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).validator(z.object({action:z.enum(["create","approve","reject","visibility"]),payload,requestId:z.string().uuid()})).handler(async({data,context})=>{
  const client=context.supabase as unknown as {rpc(name:string,args:Record<string,Json>):Promise<{data:Json;error:{message:string}|null}>};
  const response=await client.rpc("mutate_shared_decision",{p_action:data.action,p_payload:data.payload as Json,p_request_id:data.requestId});if(response.error)throw new Error(response.error.message);return z.object({id:z.string().uuid(),saved:z.literal(true)}).parse(response.data);
});

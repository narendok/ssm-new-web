import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

type SerializableJson = string | number | boolean | null | SerializableJson[] | { [key:string]:SerializableJson };
const jsonValue:z.ZodType<SerializableJson>=z.lazy(()=>z.union([z.string(),z.number(),z.boolean(),z.null(),z.array(jsonValue),z.record(jsonValue)]));
const document = z.object({id:z.string().uuid(),department_id:z.string().uuid().nullable(),record_id:z.string().uuid().nullable(),title:z.string(),document_type:z.string(),metadata:z.record(jsonValue),updated_at:z.string()});
export type VaultDocument = z.infer<typeof document>;
export const getSharedVaultDocuments=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context}):Promise<VaultDocument[]>=>{
  const result=await context.supabase.from("documents").select("id,department_id,record_id,title,document_type,metadata,updated_at").order("updated_at",{ascending:false});
  if(result.error)throw new Error(result.error.message);
  return z.array(document).parse(result.data);
});
const registration=z.object({title:z.string().trim().min(1).max(300),documentType:z.string().trim().min(1).max(100),scope:z.enum(["common","internal","client","department"]),departmentId:z.string().uuid(),recordId:z.string().uuid().optional(),projectId:z.string().uuid().optional(),sourceFileId:z.string().uuid().optional()});
export const registerSharedDocument=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(z.object({payload:registration,requestId:z.string().uuid()})).handler(async({data,context}):Promise<{id:string;reference:string;status:string}>=>{
  const rpc=context.supabase as unknown as {rpc(name:string,args:Record<string,Json>):Promise<{data:Json;error:{message:string}|null}>};
  const result=await rpc.rpc("register_controlled_document",{p_payload:data.payload as Json,p_request_id:data.requestId});
  if(result.error)throw new Error(result.error.message);
  return z.object({id:z.string().uuid(),reference:z.string(),status:z.literal("Draft")}).parse(result.data);
});

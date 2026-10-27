import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verifyControlledFileBytes } from "./controlled-file-integrity";

const bucket = "controlled-documents";
const fileInput = z.object({
  documentId: z.string().uuid(),
  revision: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(150),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
  checksum: z
    .string()
    .trim()
    .min(32)
    .max(128)
    .regex(/^[a-fA-F0-9]{32,128}$/, "Checksum must be a valid cryptographic hex digest"),
});

function cleanName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
}

export const beginControlledDocumentUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => fileInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: document, error: documentError } = await context.supabase
      .from("documents")
      .select("id, organization_id, department_id, title")
      .eq("id", data.documentId)
      .single();
    if (documentError || !document || !document.department_id) {
      throw new Error("This controlled document is unavailable for secure upload.");
    }

    const { data: existing, error: existingError } = await context.supabase
      .from("controlled_document_files")
      .select("id, storage_path, original_name, revision, uploaded_at")
      .eq("organization_id", document.organization_id)
      .eq("document_id", document.id)
      .eq("revision", data.revision)
      .eq("checksum", data.checksum)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      const directory=existing.storage_path.split("/").slice(0,-1).join("/");
      const filename=existing.storage_path.split("/").at(-1)||"";
      const stored=await context.supabase.storage.from(bucket).list(directory,{search:filename});
      if(stored.error)throw stored.error;
      if(stored.data?.some(object=>object.name===filename))return {duplicate:true,file:existing,signedUploadUrl:null};
      const retry=await context.supabase.storage.from(bucket).createSignedUploadUrl(existing.storage_path,{upsert:false});
      if(retry.error||!retry.data)throw retry.error??new Error("Unable to resume the private upload.");
      return {duplicate:false,file:existing,signedUploadUrl:retry.data.signedUrl};
    }

    const storagePath = `${document.organization_id}/${document.department_id}/${document.id}/${cleanName(data.revision)}/${data.checksum.slice(0, 16)}-${cleanName(data.name)}`;
    const { data: created, error: insertError } = await context.supabase
      .from("controlled_document_files")
      .insert({
        organization_id: document.organization_id,
        department_id: document.department_id,
        document_id: document.id,
        revision: data.revision,
        storage_path: storagePath,
        original_name: data.name,
        content_type: data.contentType,
        size_bytes: data.sizeBytes,
        checksum: data.checksum,
        uploaded_by: context.userId,
        audit_note: `Secure file registered for ${document.title}`,
      })
      .select("id, storage_path, original_name, revision, uploaded_at")
      .single();
    if (insertError || !created) throw insertError ?? new Error("Unable to register the file.");

    const { data: signed, error: signedError } = await context.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (signedError || !signed) {
      await context.supabase.from("controlled_document_files").delete().eq("id", created.id);
      throw signedError ?? new Error("Unable to create a secure upload link.");
    }
    return { duplicate: false, file: created, signedUploadUrl: signed.signedUrl };
  });

export const completeControlledDocumentUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ fileId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: file, error } = await context.supabase
      .from("controlled_document_files")
      .select("id, storage_path, size_bytes, checksum")
      .eq("id", data.fileId)
      .single();
    if (error || !file) throw new Error("The registered file is unavailable.");
    const directory = file.storage_path.split("/").slice(0, -1).join("/");
    const filename = file.storage_path.split("/").pop() ?? "";
    const { data: object, error: objectError } = await context.supabase.storage
      .from(bucket)
      .list(directory, { search: filename });
    if (objectError || !object?.length) {
      throw new Error("The secure upload did not finish. You can safely retry.");
    }
    const uploadedObj = object.find((o) => o.name === filename);
    if (uploadedObj?.metadata?.size && file.size_bytes && uploadedObj.metadata.size !== file.size_bytes) {
      throw new Error("Uploaded file size does not match registered byte length.");
    }
    const actual=await context.supabase.storage.from(bucket).download(file.storage_path);
    if(actual.error||!actual.data)throw actual.error??new Error("Stored file content is unavailable for verification.");
    await verifyControlledFileBytes(await actual.data.arrayBuffer(),file);
    return { ok: true };
  });

export const getControlledDocumentDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ fileId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: accessRows, error: accessErr } = await context.supabase.rpc("get_controlled_file_access", {
      p_file_id: data.fileId,
    });
    if (accessErr || !accessRows?.[0]) throw new Error(accessErr?.message || "This file is unavailable in your department access.");
    const file = accessRows[0];
    const { data: signed, error: signedError } = await context.supabase.storage
      .from(bucket)
      .createSignedUrl(file.storage_path, 60, { download: file.original_name });
    if (signedError || !signed) throw signedError ?? new Error("Unable to create a secure download link.");
    return { url: signed.signedUrl, expiresInSeconds: 60, checksum: file.checksum, sizeBytes: file.size_bytes };
  });

export const listControlledDocumentFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ documentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: files, error } = await context.supabase
      .from("controlled_document_files")
      .select("id, revision, original_name, content_type, size_bytes, uploaded_at, superseded_at, audit_note")
      .eq("document_id", data.documentId)
      .order("uploaded_at", { ascending: false });
    if (error) throw error;
    return files;
  });

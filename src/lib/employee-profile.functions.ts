import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sharedTestSnapshotSchema } from "@/lib/shared-test.schema";
import { requireVerifiedOriginal } from "@/lib/verified-original.server";

const uuid = z.string().uuid();
const bucket = "controlled-documents";

type EmployeeProfileRpc = {
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
};

export const getEmployeeProfileCatalogue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as unknown as EmployeeProfileRpc;
    const [businessResult, sharedResult] = await Promise.all([
      client.rpc("get_business_workspace"),
      client.rpc("get_shared_test_workspace"),
    ]);
    if (businessResult.error) throw new Error(businessResult.error.message);
    if (sharedResult.error) throw new Error(sharedResult.error.message);
    const business = z.object({
      membership: z.object({ organization_id: uuid, role: z.string(), department_code: z.string().nullable() }),
      departments: z.array(z.object({ id: uuid, code: z.string(), name: z.string() })),
    }).parse(businessResult.data);
    const actor = business.membership;
    const canManage = actor.role === "admin" || (actor.role === "department_lead" && ["HR", "HROPS"].includes(actor.department_code || ""));
    if (!canManage) throw new Error("HR_PROFILE_CATALOGUE_DENIED");

    const shared = sharedTestSnapshotSchema.parse(sharedResult.data);
    const assets = shared.records
      .filter((record) => record.record_type === "Asset")
      .map((record) => ({
        id: record.id,
        reference: record.reference,
        title: record.title,
        assetTag: typeof record.fields["assetTag"] === "string" ? record.fields["assetTag"] : record.reference,
        serialNumber: typeof record.fields["serialNumber"] === "string" ? record.fields["serialNumber"] : "",
        category: typeof record.fields["category"] === "string" ? record.fields["category"] : "",
      }))
      .filter((record) => record.serialNumber.trim().length > 0);

    const hrDepartmentIds = business.departments
      .filter((department) => ["HR", "HROPS"].includes(department.code.toUpperCase()))
      .map((department) => department.id);
    if (!hrDepartmentIds.length) return { assets, letters: [] };

    const { data: docs, error: docsError } = await context.supabase
      .from("documents")
      .select("id,title,document_type,department_id")
      .eq("organization_id", actor.organization_id)
      .in("department_id", hrDepartmentIds)
      .limit(500);
    if (docsError) throw new Error("HR controlled documents are unavailable for your department.");
    const letterDocuments = (docs || []).filter((doc) => /letter/i.test(doc.document_type));
    if (!letterDocuments.length) return { assets, letters: [] };

    const { data: files, error: filesError } = await context.supabase
      .from("controlled_document_files")
      .select("id,document_id,department_id,revision,original_name,size_bytes,checksum,storage_path")
      .eq("organization_id", actor.organization_id)
      .in("department_id", hrDepartmentIds)
      .is("superseded_at", null)
      .order("uploaded_at", { ascending: false })
      .limit(200);
    if (filesError) throw new Error("HR controlled originals are unavailable for your department.");
    const docsById = new Map(letterDocuments.map((doc) => [doc.id, doc]));
    const letters = [];
    for (const file of files || []) {
      const document = docsById.get(file.document_id);
      if (!document || file.size_bytes <= 0 || !/^[a-f0-9]{64}$/i.test(file.checksum)) continue;
      const [access, verification] = await Promise.all([
        client.rpc("get_controlled_file_access", { p_file_id: file.id }),
        client.rpc("get_controlled_original_verification", { p_file_id: file.id }),
      ]);
      const accessRows = Array.isArray(access.data) ? access.data as { storage_path?: string }[] : [];
      const verified = verification.data && typeof verification.data === "object" && (verification.data as { verified?: unknown }).verified === true;
      const storagePath = accessRows[0]?.storage_path;
      if (access.error || verification.error || !verified || !storagePath) continue;
      const directory = storagePath.split("/").slice(0, -1).join("/");
      const filename = storagePath.split("/").at(-1) || "";
      const stored = await context.supabase.storage.from(bucket).list(directory, { search: filename });
      if (stored.error || !stored.data?.some((object) => object.name === filename)) continue;
      letters.push({
        fileId: file.id,
        documentId: document.id,
        title: document.title,
        revision: file.revision,
        originalName: file.original_name,
      });
    }
    return { assets, letters };
  });

export const getEmployeeLetterDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ itemId: uuid }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: accessRows, error } = await (context.supabase as unknown as EmployeeProfileRpc).rpc(
      "get_employee_letter_file_access",
      { p_item_id: data.itemId },
    );
    if (error) throw new Error("This issued letter is unavailable.");
    const parsed = z.array(z.object({ file_id: uuid, storage_path: z.string(), original_name: z.string() })).safeParse(accessRows);
    if (!parsed.success || !parsed.data[0]) throw new Error("This issued letter is unavailable.");
    const [row] = parsed.data;
    await requireVerifiedOriginal(context.supabase, row.file_id);
    const { data: signed, error: signedError } = await context.supabase.storage
      .from(bucket)
      .createSignedUrl(row.storage_path, 60, { download: row.original_name });
    if (signedError || !signed) throw signedError ?? new Error("Unable to create a secure download link.");
    return { url: signed.signedUrl, expiresInSeconds: 60 };
  });

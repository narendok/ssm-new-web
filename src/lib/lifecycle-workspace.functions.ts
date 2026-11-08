import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SharedJson } from "./shared-test.schema";
const json: z.ZodType<SharedJson> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(json), z.record(json)]),
);
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { readLifecycleBaseline } from "./lifecycle-baseline";
import { verifyControlledFileBytes } from "./controlled-file-integrity";
import { requireVerifiedOriginal } from "./verified-original.server";

const snapshot = z.object({
  revision: z.object({ id: z.string().uuid(), definition: json }).nullable(),
  assets: z.array(
    z.object({
      id: z.string().uuid(),
      sourceProject: z.string().uuid(),
      documentId: z.string().uuid(),
      fileId: z.string().uuid(),
      definition: z.record(json),
      createdAt: z.string(),
    }),
  ),
  uses: z.array(
    z.object({
      id: z.string().uuid(),
      projectId: z.string().uuid(),
      assetRevisionId: z.string().uuid(),
      assessment: z.string(),
      createdAt: z.string(),
    }),
  ),
  files: z.array(
    z.object({
      id: z.string().uuid(),
      documentId: z.string().uuid(),
      title: z.string(),
      revision: z.string(),
      checksum: z.string(),
    }),
  ),
});
interface Rpc {
  rpc(
    name: string,
    args?: Record<string, Json>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}
export const setProjectCertificationScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        projectId: z.string().uuid(),
        expectedUpdatedAt: z.string(),
        required: z.boolean(),
        reason: z.string().trim().min(10),
        requestId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { requestId, ...payload } = data;
    const { data: result, error } = await (context.supabase as unknown as Rpc).rpc(
      "set_project_certification_scope",
      { p_payload: payload, p_request_id: requestId },
    );
    if (error) throw Error(error.message);
    return z
      .object({ id: z.string().uuid(), projectId: z.string().uuid(), required: z.boolean() })
      .parse(result);
  });
export const attachReusableRevisionToRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        recordId: z.string().uuid(),
        projectId: z.string().uuid(),
        assetRevisionId: z.string().uuid(),
        assessment: z.string().trim().min(5),
        requestId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const assets = await (context.supabase as unknown as Rpc).rpc("get_lifecycle_workspace");
    if (assets.error) throw Error(assets.error.message);
    const asset = snapshot.parse(assets.data).assets.find((a) => a.id === data.assetRevisionId);
    if (!asset) throw Error("Reusable original is unavailable in this access.");
    await requireVerifiedOriginal(context.supabase, asset.fileId);
    const { requestId, ...payload } = data;
    const { data: result, error } = await (context.supabase as unknown as Rpc).rpc(
      "attach_reusable_revision_to_record",
      { p_payload: payload, p_request_id: requestId },
    );
    if (error) throw Error(error.message);
    return z
      .object({
        id: z.string().uuid(),
        assetRevisionId: z.string().uuid(),
        fileId: z.string().uuid(),
      })
      .parse(result);
  });
export const getProjectLifecycleDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ projectId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await (context.supabase as unknown as Rpc).rpc(
      "get_project_lifecycle_decisions",
      { p_project: data.projectId },
    );
    if (error) throw Error(error.message);
    return z
      .array(
        z.object({
          id: z.string(),
          action: z.string(),
          stageCode: z.string().nullable(),
          reason: z.string(),
          createdAt: z.string(),
          actor: z.string().nullable(),
          previousRevision: z.string().nullable(),
          nextRevision: z.string().nullable(),
        }),
      )
      .parse(result);
  });
export const configureProjectLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        projectId: z.string().uuid(),
        expectedUpdatedAt: z.string(),
        action: z.enum(["omit_optional", "migrate_baseline"]),
        stageCode: z.string().optional(),
        revisionId: z.string().uuid().optional(),
        reason: z.string().trim().min(10),
        requestId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { requestId, ...payload } = data;
    const { data: result, error } = await (context.supabase as unknown as Rpc).rpc(
      "configure_project_lifecycle",
      { p_payload: JSON.parse(JSON.stringify(payload)), p_request_id: requestId },
    );
    if (error) throw Error(error.message);
    return z
      .object({ id: z.string().uuid(), projectId: z.string().uuid(), action: z.string() })
      .parse(result);
  });
export const startLifecycleProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        opportunityId: z.string().uuid(),
        expectedUpdatedAt: z.string(),
        reference: z.string().regex(/^HLPL-[A-Z0-9]+(-[A-Z0-9]+)*$/),
        title: z.string().trim().min(1),
        requestId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { requestId, ...payload } = data;
    const { data: result, error } = await (context.supabase as unknown as Rpc).rpc(
      "start_project_from_feasibility",
      { p_payload: payload, p_request_id: requestId },
    );
    if (error) throw Error(error.message);
    return z.object({ id: z.string().uuid(), reference: z.string() }).parse(result);
  });
export const getLifecycleWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as unknown as Rpc).rpc(
      "get_lifecycle_workspace",
    );
    if (error) throw Error(error.message);
    const parsed = snapshot.parse(data);
    if (parsed.revision && !readLifecycleBaseline(JSON.stringify(parsed.revision.definition)))
      throw Error("The saved lifecycle revision is invalid.");
    return parsed;
  });
export const mutateLifecycleWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        action: z.enum(["save_revision", "publish_asset", "link_asset"]),
        payload: z.record(json),
        requestId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    if (
      data.action === "save_revision" &&
      !readLifecycleBaseline(JSON.stringify(data.payload["definition"]))
    )
      throw Error("Invalid lifecycle definition.");
    if (data.action === "publish_asset") {
      const fileId = z.string().uuid().parse(data.payload["fileId"]);
      const { data: file, error } = await context.supabase
        .from("controlled_document_files")
        .select("storage_path,size_bytes,checksum")
        .eq("id", fileId)
        .single();
      if (error || !file || !file.checksum)
        throw Error("Original file is unavailable within your access.");
      const stored = await context.supabase.storage
        .from("controlled-documents")
        .download(file.storage_path);
      if (stored.error || !stored.data)
        throw Error("Original upload is incomplete or unavailable.");
      await verifyControlledFileBytes(await stored.data.arrayBuffer(), {
        size_bytes: file.size_bytes,
        checksum: file.checksum,
      });
      await requireVerifiedOriginal(context.supabase, fileId);
    }
    if (data.action === "link_asset") {
      const assets = await (context.supabase as unknown as Rpc).rpc("get_lifecycle_workspace");
      if (assets.error) throw Error(assets.error.message);
      const asset = snapshot
        .parse(assets.data)
        .assets.find((a) => a.id === data.payload["assetRevisionId"]);
      if (!asset) throw Error("Reusable original is unavailable in this access.");
      await requireVerifiedOriginal(context.supabase, asset.fileId);
    }
    const { data: result, error } = await (context.supabase as unknown as Rpc).rpc(
      "mutate_lifecycle_workspace",
      { p_action: data.action, p_payload: data.payload as Json, p_request_id: data.requestId },
    );
    if (error) throw Error(error.message);
    return z.object({ id: z.string().uuid(), action: z.string() }).parse(result);
  });

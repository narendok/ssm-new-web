import { createClient } from "npm:@supabase/supabase-js@2.117.2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  try {
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer "))
      return reply({ error: "Authentication required" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!,
      anon = Deno.env.get("SUPABASE_ANON_KEY")!,
      secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: user, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !user.user) return reply({ error: "Invalid session" }, 401);
    const { fileId } = await req.json();
    if (typeof fileId !== "string" || !/^[a-f\d-]{36}$/i.test(fileId))
      return reply({ error: "Valid file reference required" }, 400);
    const { data: access, error: denied } = await client.rpc("get_controlled_file_access", {
      p_file_id: fileId,
    });
    if (denied || !access?.[0]) return reply({ error: "Original unavailable in this access" }, 403);
    const file = access[0];
    if (file.size_bytes <= 0 || file.size_bytes > 26214400)
      return reply({ error: "Original exceeds the supported size" }, 400);
    const { data: existing } = await client.rpc("get_controlled_original_verification", {
      p_file_id: fileId,
    });
    if (existing?.verified) return reply(existing);
    const { data: original, error: missing } = await client.storage
      .from("controlled-documents")
      .download(file.storage_path);
    if (missing || !original) return reply({ error: "Original upload incomplete" }, 409);
    const bytes = await original.arrayBuffer(),
      checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    if (bytes.byteLength !== file.size_bytes || checksum !== file.checksum?.toLowerCase())
      return reply({ error: "Stored original byte length or SHA-256 mismatch" }, 409);
    const verifier = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: receipt, error: failed } = await verifier.rpc("attest_controlled_original", {
      p_file_id: fileId,
      p_actor_id: user.user.id,
      p_checksum: checksum,
      p_size_bytes: bytes.byteLength,
    });
    if (failed || !receipt?.verified)
      return reply({ error: "Original verification receipt could not be saved" }, 409);
    return reply(receipt);
  } catch {
    return reply({ error: "Original verification failed" }, 400);
  }
});

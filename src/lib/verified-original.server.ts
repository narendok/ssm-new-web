import type { SupabaseClient } from "@supabase/supabase-js";
/** Server function bridge: the Edge verifier authenticates again and attests actual immutable stored bytes. */
export async function requireVerifiedOriginal(client: SupabaseClient, fileId: string) {
  const { data, error } = await client.functions.invoke("verify-controlled-original", {
    body: { fileId },
  });
  if (error || !data?.verified) {
    let message = "Stored original verification is unavailable.";
    try {
      if (error && "context" in error) message = (await error.context.json()).error || message;
    } catch {
      /* Do not expose raw transport details or signed URLs. */
    }
    throw Error(data?.error || message);
  }
}

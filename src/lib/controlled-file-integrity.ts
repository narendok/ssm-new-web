/** Verify actual stored bytes, not just browser-supplied metadata or a matching byte count. */
export async function verifyControlledFileBytes(bytes:ArrayBuffer,expected:{size_bytes:number;checksum:string}):Promise<void>{
  if(bytes.byteLength!==expected.size_bytes)throw new Error("Uploaded file size does not match the registered byte length.");
  if(!/^[a-f\d]{64}$/i.test(expected.checksum))throw new Error("A SHA-256 checksum is required before this attachment can be verified.");
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(b=>b.toString(16).padStart(2,"0")).join("");
  if(actual!==expected.checksum.toLowerCase())throw new Error("Uploaded file content does not match the registered SHA-256 checksum.");
}

import { execFileSync } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";

async function prepareGeneratedOutput() {
  if (process.platform !== "win32") return;

  const outputDir = path.resolve(process.cwd(), ".output");
  try {
    if (!(await stat(outputDir)).isDirectory()) return;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }

  // Vite/Nitro replace this ignored build tree. Windows read-only attributes
  // on generated child folders make that cleanup fail with EPERM.
  execFileSync("attrib.exe", ["-R", path.join(outputDir, "*"), "/S", "/D"], {
    cwd: process.cwd(),
    stdio: "ignore",
    windowsHide: true,
  });
  execFileSync("attrib.exe", ["-R", outputDir, "/D"], {
    cwd: process.cwd(),
    stdio: "ignore",
    windowsHide: true,
  });
}

await prepareGeneratedOutput();

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
  cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const mod = { exports: {} };
  cache.set(name, mod.exports);
  const file = path.join(root, "src/lib", name + ".ts");
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("module", "exports", "require", js)(mod, mod.exports, (s) =>
    s.startsWith("./") ? load(s.slice(2)) : require(s),
  );
  return mod.exports;
}
const lifecycle = load("lifecycle-baseline"),
  canonical = load("canonical-lifecycle"),
  catalogue = load("document-catalogue"),
  revision = lifecycle.defaultLifecycleRevision();
const errors = lifecycle.validateLifecycleRevision(revision);
if (errors.length) throw Error(errors.join("; "));
const counts = Object.keys(canonical.CANONICAL_TRACK_METADATA).map((track) => ({
  track,
  withoutCertification: lifecycle.projectLifecycleStages(revision, track).length,
  withCertification: lifecycle.projectLifecycleStages(revision, track, true).length,
}));
const artifact = {
  generatedAt: new Date().toISOString(),
  phases: lifecycle.COMPANY_PHASES,
  stageCount: revision.stages.length,
  seedTaskCount: revision.stages.reduce((n, s) => n + s.tasks.length, 0),
  modeCounts: counts,
  documentFamilyCount: catalogue.CATALOGUE_FAMILIES.length,
  documentExits: catalogue.LIFECYCLE_DOCUMENT_EXITS,
  stages: revision.stages,
};
const outputDir = path.join(os.tmpdir(), "ssm-one-web-test-artifacts", "lifecycle");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "lifecycle-crosswalk.json"), JSON.stringify(artifact, null, 2) + "\n");
console.log(
  JSON.stringify({
    stageCount: artifact.stageCount,
    seedTaskCount: artifact.seedTaskCount,
    documentFamilyCount: artifact.documentFamilyCount,
    counts,
  }),
);

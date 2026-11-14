const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(process.cwd(), "src/routes/index.tsx"), "utf8");
const start = source.indexOf("function CloudSyncPanel(");
const end = source.indexOf("const wizardGuidance = [", start);
const panel = source.slice(start, end);

test("cloud connection reports query errors and never claims browser-local state synced", () => {
  assert.ok(start >= 0 && end > start, "CloudSyncPanel source block must be present");
  assert.match(panel, /const \{ error \} = await supabase\.from\("departments"\)/);
  assert.match(panel, /if \(error\) throw error/);
  assert.match(panel, /setPingStatus\("error"\)/);
  assert.match(panel, /Database reachable \(\$\{latency\}ms\)/);
  assert.match(panel, /No local data was synchronized/);
  assert.match(panel, /Local samples are not synced/);
  assert.match(panel, /This browser only/);
  assert.match(panel, /portal\.departments\.filter\(\(department\) => department\.active\)\.length/);
  assert.match(panel, /Active Department Hubs/);
  assert.doesNotMatch(panel, /executeSync|Sync Local State to Cloud|Cloud sync completed successfully|Last Synced/);
});

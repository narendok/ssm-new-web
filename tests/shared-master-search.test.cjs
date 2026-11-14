const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("shared master search returns only literal label or canonical ID matches", async () => {
  const { filterSharedMasterOptions } = await import("../src/lib/shared-master-options.ts");
  const options = [
    { value: "customer-orion-1", label: "CUS-ORION · Orion Controls" },
    { value: "customer-tata-1", label: "TATA-EV · Tata Motors" },
    { value: "customer-northstar-1", label: "CUS-NS · Northstar Field Systems (DEMO_ONLY)" },
  ];

  assert.deepEqual(filterSharedMasterOptions(options, " Orion "), [options[0]]);
  assert.deepEqual(filterSharedMasterOptions(options, "TATA-EV"), [options[1]]);
  assert.deepEqual(filterSharedMasterOptions(options, "northstar"), [options[2]]);
  assert.deepEqual(filterSharedMasterOptions(options, "missing"), []);
  assert.deepEqual(filterSharedMasterOptions(options, ""), options);

  const component = fs.readFileSync("src/components/SharedMasterSelect.tsx", "utf8");
  assert.match(component, /<Command shouldFilter=\{false\}>/);
  assert.match(component, /onValueChange=\{setSearch\}/);
  assert.match(component, /filterSharedMasterOptions\(options,search\)/);
});

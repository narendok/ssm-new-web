const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("authenticated Shared TEST BOM and ingestion routes do not use local seeded purchasing state", () => {
  const route = read("src/routes/index.tsx");
  const sharedRoute = route.indexOf(
    'testMembership && (view === "smart_bom" || view === "ingestion_gate")',
  );
  const localFallback = route.indexOf("<PurchasingCommandCenter", sharedRoute);
  assert.notEqual(sharedRoute, -1, "both authenticated subviews must have an explicit route");
  assert.ok(
    localFallback > sharedRoute,
    "shared route must win before the browser-local PurchasingCommandCenter fallback",
  );
  assert.match(route.slice(sharedRoute, localFallback), /<SharedSupplyChainWorkspace/);

  const workspace = read("src/components/SharedSupplyChainWorkspace.tsx");
  assert.match(workspace, /getSharedTestWorkspace/);
  assert.match(workspace, /data\?\.partOptions/);
  assert.match(workspace, /data\?\.supplierOptions/);
  assert.match(workspace, /No separate\s+line-item ledger is installed in Shared TEST/);
  assert.match(
    workspace,
    /File parsing and automatic PO creation are not connected to Shared TEST yet/,
  );
  assert.doesNotMatch(workspace, /defaultSuppliers|defaultPurchaseOrders|defaultQuotations/);
});

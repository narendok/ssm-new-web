const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const liveComponent = fs.readFileSync(path.resolve(__dirname, "../src/components/LiveInventoryWorkspace.tsx"), "utf8");
const route = fs.readFileSync(path.resolve(__dirname, "../src/routes/index.tsx"), "utf8");

test("inventory route uses the original full workspace with quantity and assignment tabs", () => {
  assert.match(liveComponent, /Project Material Issuance/);
  assert.match(liveComponent, /onAssign\(issueModalItem\.id/);
  assert.match(liveComponent, /Total On-Hand/);
  assert.match(liveComponent, /Goods Received/);
  assert.match(liveComponent, /Stock Movement History/);

  assert.doesNotMatch(route, /SharedInventoryWorkspace/);
  const inventoryRoute = route.indexOf(': view === "inventory" ?');
  assert.ok(inventoryRoute >= 0, "inventory uses the standard full-page route");
  const branch = route.slice(inventoryRoute, route.indexOf(') : view === "orders"', inventoryRoute));
  assert.match(branch, /<LiveInventoryWorkspace/);
  assert.match(branch, /onMove=\{moveInventory\}/);
  assert.match(branch, /onAssign=\{assignInventory\}/);
});

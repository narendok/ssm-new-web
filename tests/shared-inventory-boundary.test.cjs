const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const liveComponent = fs.readFileSync(path.resolve(__dirname, "../src/components/LiveInventoryWorkspace.tsx"), "utf8");
const route = fs.readFileSync(path.resolve(__dirname, "../src/routes/index.tsx"), "utf8");
const sharedInventory = fs.readFileSync(path.resolve(__dirname, "../src/components/SharedInventoryWorkspace.tsx"), "utf8");

test("inventory route uses the original full workspace with quantity and assignment tabs", () => {
  assert.match(liveComponent, /Project Material Issuance/);
  assert.match(liveComponent, /onAssign\(issueModalItem\.id/);
  assert.match(liveComponent, /Total On-Hand/);
  assert.match(liveComponent, /Goods Received/);
  assert.match(liveComponent, /Stock Movement History/);

  assert.match(route, /SharedInventoryWorkspace/);
  const inventoryRoute = route.indexOf(': view === "inventory" ?');
  assert.ok(inventoryRoute >= 0, "inventory uses the standard full-page route");
  const branch = route.slice(inventoryRoute, route.indexOf(') : view === "orders"', inventoryRoute));
  assert.match(branch, /<LiveInventoryWorkspace/);
  assert.match(branch, /onMove=\{moveInventory\}/);
  assert.match(branch, /onAssign=\{assignInventory\}/);
});

test("browser-local inventory fixtures are clearly distinguished from shared stock", () => {
  assert.match(liveComponent, /Browser-local stock demo\./);
  assert.match(liveComponent, /Shared Part Masters tab reads canonical Part records from Shared TEST/);
  assert.match(liveComponent, /shared stock quantities are not connected yet/i);
  assert.match(liveComponent, /Demo component inventory/);
});

test("authenticated inventory keeps the full demo workspace and adds a canonical shared Part tab", () => {
  assert.match(route, /<SharedInventoryWorkspace[\s\S]*membershipId=\{testMembership\.membershipId\}/);
  assert.match(sharedInventory, /getSharedInventoryPartCatalog/);
  assert.match(sharedInventory, /<LiveInventoryWorkspace/);
  assert.match(liveComponent, /Shared Part Masters/);
  assert.match(liveComponent, /Filter shared parts by category/);
  assert.match(liveComponent, /Filter shared parts by department/);
  assert.match(liveComponent, /Not recorded/);
  assert.match(liveComponent, /part\.id/);
});

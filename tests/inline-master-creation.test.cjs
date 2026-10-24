const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("§14.12: Inline master modal exports and canonical interfaces", () => {
  const filePath = path.resolve(__dirname, "../src/components/InlineMasterModals.tsx");
  assert.ok(fs.existsSync(filePath), "InlineMasterModals.tsx must exist");
  const content = fs.readFileSync(filePath, "utf8");

  assert.ok(content.includes("export function InlineSupplierModal"), "InlineSupplierModal must be exported");
  assert.ok(content.includes("export function InlinePartModal"), "InlinePartModal must be exported");
  assert.ok(content.includes("Pending_Verification"), "Inline supplier master produces draft / pending verification status");
  assert.ok(content.includes("Engineering_Only"), "Inline component master produces engineering-only draft status");
});

test("§14.12: Inline master creation capability gating in RecordForm", () => {
  const filePath = path.resolve(__dirname, "../src/routes/index.tsx");
  const content = fs.readFileSync(filePath, "utf8");

  // Verify capability guards
  assert.ok(content.includes('canAddCustomer = ["sales", "sal", "admin"].includes(area)'), "Customer creation restricted to Sales & Admin");
  assert.ok(content.includes('canAddSupplier = ["pur", "admin"].includes(area)'), "Supplier creation restricted to Purchasing & Admin");
  assert.ok(content.includes('canAddPart = ["ehw", "esw", "mech", "pur", "rnd", "admin"].includes(area)'), "Part creation restricted to Engineering/Purchasing & Admin");

  // Verify ManagedField provides + Add Supplier / + Add Part buttons when authorized
  assert.ok(content.includes('+ Add Supplier'), "ManagedField must render + Add Supplier button");
  assert.ok(content.includes('+ Add Part'), "ManagedField must render + Add Part button");

  // Verify unauthorized users see restrictions
  assert.ok(content.includes('Purchasing restricted'), "Unauthorized users must see purchasing restriction hint");
  assert.ok(content.includes('Engineering restricted'), "Unauthorized users must see engineering restriction hint");
});

test("§14.12: Parent form draft preserved and newly created canonical ID returned selected", () => {
  const filePath = path.resolve(__dirname, "../src/routes/index.tsx");
  const content = fs.readFileSync(filePath, "utf8");

  // Supplier callback sets field without clearing parent form
  assert.ok(
    content.includes("onSupplierCreated={(newSup) => {") &&
    content.includes("setValues((prev) => ({ ...prev, supplier: newSup.name }))"),
    "Inline supplier save sets supplier field and preserves parent values"
  );

  // Part callback sets field without clearing parent form
  assert.ok(
    content.includes("onPartCreated={(newPrt) => {") &&
    content.includes("setValues((prev) => ({ ...prev, part: newPrt.mpn, mpn: newPrt.mpn }))"),
    "Inline part save sets part field and preserves parent values"
  );
});

test("§14.10: Single procurement track derivation without redundant track dropdown", () => {
  const filePath = path.resolve(__dirname, "../src/routes/index.tsx");
  const content = fs.readFileSync(filePath, "utf8");

  // No separate procurementTrack dropdown selector in formSpecs
  assert.ok(!content.includes('options: ["Rapid prototype", "Mass production"]'), "Redundant track selector must not be rendered");
});

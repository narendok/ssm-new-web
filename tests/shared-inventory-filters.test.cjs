const test = require("node:test");
const assert = require("node:assert/strict");
const {
  filterSharedInventoryParts,
  sharedInventoryCategoryOptions,
  sharedInventoryDepartmentOptions,
  UNCATEGORIZED_INVENTORY_FILTER,
  UNMAPPED_INVENTORY_DEPARTMENT_FILTER,
} = require("../src/lib/shared-inventory-filters.ts");

const parts = [
  {
    id: "electronics", reference: "PART-ELE-01", title: "Wireless module", mpn: "WM-01",
    category: " Electronics ", primaryDepartment: "EHW", departmentViews: ["EHW", "FW", "PUR"],
  },
  {
    id: "uncategorized", reference: "PART-OLD-01", title: "Legacy part", mpn: null,
    category: null, primaryDepartment: null, departmentViews: [],
  },
  {
    id: "primary-only", reference: "PART-PUR-01", title: "Packing supply", mpn: "PK-01",
    category: "Packaging", primaryDepartment: "PUR", departmentViews: [],
  },
];

test("Shared TEST filters expose missing categories and department mappings without hiding rows", () => {
  assert.deepEqual(sharedInventoryCategoryOptions(parts), [
    { value: "Electronics", label: "Electronics" },
    { value: "Packaging", label: "Packaging" },
    { value: UNCATEGORIZED_INVENTORY_FILTER, label: "Uncategorized" },
  ]);
  assert.deepEqual(sharedInventoryDepartmentOptions(parts), [
    { value: "EHW", label: "EHW" },
    { value: "FW", label: "FW" },
    { value: "PUR", label: "PUR" },
    { value: UNMAPPED_INVENTORY_DEPARTMENT_FILTER, label: "Unmapped" },
  ]);
  assert.deepEqual(filterSharedInventoryParts(parts, "All", "All", "").map(part => part.id), [
    "electronics", "uncategorized", "primary-only",
  ]);
});

test("uncategorized, department-view and primary-department filters select the intended parts", () => {
  assert.deepEqual(
    filterSharedInventoryParts(parts, UNCATEGORIZED_INVENTORY_FILTER, "All", "").map(part => part.id),
    ["uncategorized"],
  );
  assert.deepEqual(
    filterSharedInventoryParts(parts, "All", UNMAPPED_INVENTORY_DEPARTMENT_FILTER, "").map(part => part.id),
    ["uncategorized"],
  );
  assert.deepEqual(filterSharedInventoryParts(parts, "All", "PUR", "").map(part => part.id), [
    "electronics", "primary-only",
  ]);
  assert.deepEqual(filterSharedInventoryParts(parts, "All", "All", " wm-01 ").map(part => part.id), [
    "electronics",
  ]);
});

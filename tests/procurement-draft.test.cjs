const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(name) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, `../src/lib/${name}.ts`), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", js)(
    (id) => (id === "zod" ? require("zod") : load(id.replace("./", ""))),
    module,
    module.exports,
  );
  return module.exports;
}
const { procurementDraftPayload, procurementSupplierOptions, quotationDraftValues } =
  load("procurement-draft");
test("quotation conversion prefills saved line terms and rejects incomplete legacy values", () => {
  const items = [{ partId: null, description: "TEST calibration", quantity: 2, unitPrice: 12.5 }];
  assert.deepEqual(quotationDraftValues({ currency: "INR", items }), { currency: "INR", items });
  assert.throws(() => quotationDraftValues({ currency: "INR", items: [] }));
  assert.throws(() => quotationDraftValues({ currency: "", items }));
  assert.throws(() =>
    quotationDraftValues({ currency: "INR", items: [{ ...items[0], quantity: -1 }] }),
  );
});
const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const snapshot = {
  departments: [{ id: id(1), code: "PUR" }],
  supplierOptions: [
    { id: id(2), reference: "SUP-1", title: "Current supplier label", status: "approved" },
  ],
  partOptions: [{ id: id(3), reference: "PART-1", title: "Canonical part", status: "draft" }],
  records: [
    {
      id: id(4),
      reference: "HLPL-TEST-PROJECT",
      title: "Project",
      record_type: "Project",
      status: "draft",
      fields: {},
    },
  ],
};
const draft = {
  kind: "order",
  requestId: id(5),
  projectId: id(4),
  supplierId: id(2),
  sourceQuotationId: null,
  sourceQuotationRevision: null,
  currency: "INR",
  requiredDate: "2026-11-20",
  notes: "TEST ONLY",
  items: [{ partId: id(3), description: "Prototype item", quantity: 3, unitPrice: 12.35 }],
};
test("procurement draft derives canonical identity and amounts without inventing financial effects", () => {
  const payload = procurementDraftPayload(draft, snapshot);
  assert.equal(payload.fields.supplierName, "Current supplier label");
  assert.equal(payload.fields.supplierId, id(2));
  assert.equal(payload.fields.projectId, id(4));
  assert.equal(payload.fields.items[0].partReference, "PART-1");
  assert.equal(payload.fields.totalAmount, 37.05);
  assert.equal(payload.fields.commercialState, "Draft");
  assert.equal(payload.status, undefined);
  assert.equal(payload.fields.unitCostInr, undefined);
});
test("unavailable or wrong master IDs fail closed", () => {
  assert.throws(() => procurementDraftPayload({ ...draft, supplierId: id(9) }, snapshot));
  assert.throws(() => procurementDraftPayload({ ...draft, projectId: id(9) }, snapshot));
  assert.throws(() =>
    procurementDraftPayload(draft, {
      ...snapshot,
      supplierOptions: [{ ...snapshot.supplierOptions[0], status: "inactive" }],
    }),
  );
  assert.throws(() =>
    procurementDraftPayload({ ...draft, items: [{ ...draft.items[0], partId: id(9) }] }, snapshot),
  );
});
test("unverified suppliers may receive quotation drafts but cannot be selected for purchase orders", () => {
  const pendingSnapshot = {
    ...snapshot,
    supplierOptions: [{ ...snapshot.supplierOptions[0], status: "draft" }],
  };
  assert.equal(
    procurementDraftPayload({ ...draft, kind: "quotation" }, pendingSnapshot).record_type,
    "Supplier quotation",
  );
  assert.throws(
    () => procurementDraftPayload({ ...draft, kind: "order" }, pendingSnapshot),
    /approved supplier/,
  );
  const suppliers = [
    { id: id(2), status: "approved" },
    { id: id(3), status: "draft" },
    { id: id(4), status: "inactive" },
  ];
  assert.deepEqual(procurementSupplierOptions(suppliers, "order"), [suppliers[0]]);
  assert.deepEqual(procurementSupplierOptions(suppliers, "quotation"), suppliers.slice(0, 2));
});
test("source quotation requires approved status and exact supplier/project links", () => {
  const quote = {
    id: id(6),
    reference: "HLPL-QUO-01",
    record_type: "Supplier quotation",
    status: "approved",
    fields: { supplierId: id(2), projectId: id(4), revision: "02" },
  };
  const withQuote = { ...snapshot, records: [...snapshot.records, quote] };
  const linked = { ...draft, sourceQuotationId: quote.id, sourceQuotationRevision: "02" };
  assert.equal(procurementDraftPayload(linked, withQuote).fields.sourceQuotationId, quote.id);
  for (const changed of [
    { ...quote, status: "draft" },
    { ...quote, fields: { ...quote.fields, supplierId: id(9) } },
    { ...quote, fields: { ...quote.fields, projectId: id(9) } },
  ]) {
    assert.throws(() =>
      procurementDraftPayload(linked, { ...snapshot, records: [...snapshot.records, changed] }),
    );
  }
  assert.throws(
    () => procurementDraftPayload({ ...linked, sourceQuotationRevision: "01" }, withQuote),
    /selected revision/,
  );
  assert.throws(
    () => procurementDraftPayload({ ...draft, sourceQuotationRevision: "02" }, withQuote),
    /revision requires a selected quotation/,
  );
});
test("multi-line drafts accept service descriptions but reject invalid quantities and dates", () => {
  const service = { partId: null, description: "Calibration service", quantity: 1, unitPrice: 25 };
  const payload = procurementDraftPayload(
    { ...draft, kind: "quotation", items: [...draft.items, service] },
    snapshot,
  );
  assert.equal(payload.record_type, "Supplier quotation");
  assert.equal(payload.fields.totalAmount, 62.05);
  assert.throws(() => procurementDraftPayload({ ...draft, requiredDate: "2026-02-30" }, snapshot));
  assert.throws(() =>
    procurementDraftPayload({ ...draft, items: [{ ...service, quantity: -1 }] }, snapshot),
  );
  assert.throws(() =>
    procurementDraftPayload({ ...draft, items: [{ ...service, unitPrice: Infinity }] }, snapshot),
  );
});

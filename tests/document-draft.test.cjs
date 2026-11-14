const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/lib/document-draft.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const draftModule = { exports: {} };
new Function('module', 'exports', compiled)(draftModule, draftModule.exports);
const { buildDocumentDraft, restoreDocumentDraftSnapshot } = draftModule.exports;

test('Word rendition preserves draft status and escaped source data in an A4 document', () => {
  const { unzipSync, strFromU8 } = require('fflate');
  const exporterSource = fs.readFileSync(path.resolve(__dirname, '../src/lib/document-draft-docx.ts'), 'utf8');
  const exporter = ts.transpileModule(exporterSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const wordModule = { exports: {} };
  new Function('module', 'exports', 'require', exporter)(wordModule, wordModule.exports,
    (name) => name === './document-draft' ? draftModule.exports : require(name));
  const { buildDraftDocx } = wordModule.exports;
  const source = { reference: 'ENQ-TEST', fields: { requirements: 'A & B < 10\nSecond line' } };
  const draft = buildDocumentDraft('Statement of Requirements', 'TEST-SOR-01', source);
  const document = { documentId: 'TEST-SOR-01', title: 'Statement of Requirements', revision: 'Rev 01', project: 'TEST project', stage: 'TG_0' };
  const settings = { companyName: 'Test & Co', techCenter: 'Engineering', plantLocation: '', confidentialityNotice: 'Confidential', complianceFooter: 'Controlled record' };
  const parts = unzipSync(buildDraftDocx(document, draft, settings));
  const body = strFromU8(parts['word/document.xml']);
  assert.match(body, /DRAFT · UNISSUED/);
  assert.match(body, /ENQ-TEST/);
  assert.match(body, /A &amp; B &lt; 10.*<w:br\/>.*Second line/);
  assert.match(body, /w:w="11906" w:h="16838"/);
  assert.match(strFromU8(parts['word/header.xml']), /Test &amp; Co/);
  assert.match(strFromU8(parts['word/footer.xml']), /w:instr="PAGE"/);
  assert.throws(() => buildDraftDocx(document, buildDocumentDraft('BOM', 'TEST-BOM-01'), settings), /unavailable/);
});

test('different document types use different sections without hardware boilerplate in commercial or HR records', () => {
  const invoice = buildDocumentDraft('Commercial Tax Invoice', 'HLPL-SLCT-FIN-INV-01');
  const skills = buildDocumentDraft('Annual Skill Matrix', 'HLPL/F/HR/03');
  const bom = buildDocumentDraft('Production BOM', 'HLPL-SLCT-EHW-BOM-01');
  assert.equal(invoice.type, 'INV');
  assert.equal(skills.type, 'SKILL');
  assert.equal(bom.type, 'BOM');
  assert.notDeepEqual(invoice.sections, bom.sections);
  for (const doc of [invoice, skills, bom]) {
    assert.doesNotMatch(JSON.stringify(doc), /STM32|4G LTE|APPROVED|DEMO signature|0-defect/);
    assert.ok(doc.sections.every(section => section.rows.every(row => row[1].startsWith('TBD'))));
  }
});

test('copy source values with provenance; project identification cannot supply invented technical results', () => {
  const source = { reference: 'INV-SOURCE', fields: { buyer: 'Selected buyer', quantity: '12' } };
  const project = { reference: 'PROJECT-B', fields: { quantity: '100', voltage: '24V' } };
  const draft = buildDocumentDraft('Tax Invoice', 'HLPL-B-FIN-INV-01', source, project);
  const rows = draft.sections.flatMap(section => section.rows);
  assert.deepEqual(rows.find(row => row[0] === 'buyer'), ['buyer', 'Selected buyer', 'INV-SOURCE']);
  assert.equal(rows.find(row => row[0] === 'quantity')[1], '12');
  const prs = buildDocumentDraft('Product Requirement Specification', 'HLPL-B-EHW-PRS-01', undefined, project);
  assert.ok(prs.sections.flatMap(section => section.rows).find(row => row[0] === 'voltage')[1].startsWith('TBD'));
});

test('unknown formats explicitly remain unsupported', () => {
  assert.equal(buildDocumentDraft('Unconfigured document', 'CUSTOM-123').supported, false);
});

test('ambiguous and substring-only names stay unsupported; explicit template IDs take precedence', () => {
  assert.equal(buildDocumentDraft('Inventory dashboard', 'generic').supported, false);
  assert.equal(buildDocumentDraft('BOM and QUO', 'generic').supported, false);
  assert.equal(buildDocumentDraft('BOM and QUO', 'generic', undefined, undefined, 'BOM').type, 'BOM');
  assert.equal(buildDocumentDraft('BOM', 'generic', undefined, undefined, 'unknown').supported, false);
});
test('draft snapshots retain source values and identify missing fields independently of later edits', () => {
  const source = { reference: 'SOURCE-1', fields: { lineItems: 'verified items' } };
  const draft = buildDocumentDraft('BOM', 'BOM-1', source);
  source.fields.lineItems = 'later change';
  assert.equal(draft.snapshot.source.fields.lineItems, 'verified items');
  assert.ok(draft.missingFields.includes('mpn'));
  assert.equal(draft.snapshot.releaseStatus, 'Unissued');
});

test('persisted vault draft restores the exact sourced rows and stays unissued for print preview', () => {
  const source = { reference: 'HW-PRS-01', fields: { scope: 'Gateway controller', requirements: 'CAN-FD interface' } };
  const project = { reference: 'HLPL-BCU-02', fields: { customer: 'Northstar', quantity: '12' } };
  const draft = buildDocumentDraft('Product Requirement Specification', 'PRS-01', source, project, 'EHW-PRS');
  const persisted = {
    templateType: draft.type,
    templateVersion: draft.templateVersion,
    catalogueFamilyId: draft.catalogueFamilyId,
    sourceRecordId: 'source-id',
    projectRecordId: 'project-id',
    sourceReference: source.reference,
    projectReference: project.reference,
    projectPhase: 'TG_1',
    projectStage: 'HW_02',
    classification: draft.snapshot.classification,
    releaseStatus: 'Unissued',
    completionPercentage: draft.completionPercentage,
    missingFields: draft.missingFields,
    sections: draft.sections.map(section => ({ title: section.title, rows: section.rows.map(row => row.map(value => value ?? '')) })),
  };
  const restored = restoreDocumentDraftSnapshot(persisted);
  assert.deepEqual(restored.sections, draft.sections);
  assert.equal(restored.snapshot.source.reference, source.reference);
  assert.equal(restored.snapshot.project.reference, project.reference);
  assert.deepEqual(restored.snapshot.project.fields, { companyPhase: 'TG_1', currentStage: 'HW_02' });
  assert.deepEqual(restoreDocumentDraftSnapshot({ ...persisted, projectPhase: null, projectStage: null }).snapshot.project.fields, {});
  assert.equal(restored.snapshot.releaseStatus, 'Unissued');
  assert.match(restored.snapshot.classification, /internal confidential/);
  assert.equal(restoreDocumentDraftSnapshot({ ...persisted, releaseStatus: 'Released' }), undefined);
  assert.equal(restoreDocumentDraftSnapshot({ ...persisted, sections: [{ title: 'bad', rows: [['field', {}]] }] }), undefined);
});

test('client deliverable draft metadata never implies client access by document type', () => {
  const draft = buildDocumentDraft('Customer quotation', 'QUO-01', undefined, undefined, 'QUO');
  assert.match(draft.snapshot.classification, /release and access require explicit authorization/);
  assert.doesNotMatch(draft.snapshot.classification, /client access authorized/i);
});

test('Process 01 domain requirements sheets across all departments isolate domain fields without hardware boilerplate leakage', () => {
  const fwDraft = buildDocumentDraft('Firmware Requirements Spec', 'FW-FRS-01', undefined, undefined, 'FW-FRS');
  const swDraft = buildDocumentDraft('Software Requirements Spec', 'SW-SRS-01', undefined, undefined, 'SW-SRS');
  const mechDraft = buildDocumentDraft('Mechanical Requirements Spec', 'MECH-MRS-01', undefined, undefined, 'MECH-MRS');
  const finDraft = buildDocumentDraft('Financial Feasibility Sheet', 'FIN-CFS-01', undefined, undefined, 'FIN-CFS');
  const sitDraft = buildDocumentDraft('IT Infrastructure Spec', 'SIT-SRS-01', undefined, undefined, 'SIT-SRS');
  const hrDraft = buildDocumentDraft('Competency Readiness Spec', 'HROPS-CRS-01', undefined, undefined, 'HROPS-CRS');

  assert.equal(fwDraft.type, 'FW-FRS');
  assert.equal(swDraft.type, 'SW-SRS');
  assert.equal(mechDraft.type, 'MECH-MRS');
  assert.equal(finDraft.type, 'FIN-CFS');
  assert.equal(sitDraft.type, 'SIT-SRS');
  assert.equal(hrDraft.type, 'HROPS-CRS');

  // Verify firmware contains RTOS and CAN stacks, but not financial or HR fields
  const fwRows = fwDraft.sections.flatMap(s => s.rows).map(r => r[0]);
  assert.ok(fwRows.includes('targetMcu'));
  assert.ok(fwRows.includes('canJ1939Stack'));
  assert.ok(!fwRows.includes('grossMarginPercent'));
  assert.ok(!fwRows.includes('requiredEngineeringHeadcount'));

  // Verify software contains telematics & MQTT endpoints
  const swRows = swDraft.sections.flatMap(s => s.rows).map(r => r[0]);
  assert.ok(swRows.includes('telematicsProtocol'));
  assert.ok(swRows.includes('mqttEndpoints'));

  // Verify mechanical contains IP rating & gasket specifications
  const mechRows = mechDraft.sections.flatMap(s => s.rows).map(r => r[0]);
  assert.ok(mechRows.includes('dimensions'));
  assert.ok(mechRows.includes('ipRating'));

  // Verify financial contains margin & cost targets
  const finRows = finDraft.sections.flatMap(s => s.rows).map(r => r[0]);
  assert.ok(finRows.includes('targetBOMCost'));
  assert.ok(finRows.includes('grossMarginPercent'));

  // All unpopulated fields must strictly start with TBD without synthetic inventions
  for (const doc of [fwDraft, swDraft, mechDraft, finDraft, sitDraft, hrDraft]) {
    assert.doesNotMatch(JSON.stringify(doc), /FreeRTOS 10\.4|AIS-140 Annex 8|IP67 Standard|STM32F4/);
    assert.ok(doc.sections.every(section => section.rows.every(row => row[1].startsWith('TBD'))));
  }
});

test('Separate controlled subtypes (PFMEA/DFMEA, PPAP/PSW, 8D/NCR, ECR/ECO) resolve independently', () => {
  const dfmea = buildDocumentDraft('Design FMEA', 'HLPL-DFMEA-01', undefined, undefined, 'DFMEA');
  const pfmea = buildDocumentDraft('Process FMEA', 'HLPL-PFMEA-01', undefined, undefined, 'PFMEA');
  const ppap = buildDocumentDraft('PPAP Package', 'HLPL-PPAP-01', undefined, undefined, 'PPAP');
  const psw = buildDocumentDraft('Part Submission Warrant', 'HLPL-PSW-01', undefined, undefined, 'PSW');
  const eightD = buildDocumentDraft('8D Report', 'HLPL-8D-01', undefined, undefined, '8D');
  const ncr = buildDocumentDraft('Non-Conformance Report', 'HLPL-NCR-01', undefined, undefined, 'NCR');
  const ecr = buildDocumentDraft('Change Request', 'HLPL-ECR-01', undefined, undefined, 'ECR');
  const eco = buildDocumentDraft('Change Order', 'HLPL-ECO-01', undefined, undefined, 'ECO');

  assert.equal(dfmea.type, 'DFMEA');
  assert.equal(pfmea.type, 'PFMEA');
  assert.notDeepEqual(dfmea.sections, pfmea.sections);

  assert.equal(ppap.type, 'PPAP');
  assert.equal(psw.type, 'PSW');
  assert.notDeepEqual(ppap.sections, psw.sections);

  assert.equal(eightD.type, '8D');
  assert.equal(ncr.type, 'NCR');
  assert.notDeepEqual(eightD.sections, ncr.sections);

  assert.equal(ecr.type, 'ECR');
  assert.equal(eco.type, 'ECO');
  assert.notDeepEqual(ecr.sections, eco.sections);
});

test('Native file attachments and cryptographic SHA-256 metadata are preserved in draft snapshot', () => {
  const sampleAttachment = {
    filename: 'HLPL-SLCT-01-FW-RELEASE.hex',
    format: 'BIN/HEX',
    sizeBytes: 1048576,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    uploadedAt: '2026-10-19T22:00:00Z',
    uploaderName: 'Devon Lane (FW Lead)',
  };
  const source = {
    reference: 'FW-SOURCE-01',
    fields: { targetMcu: 'NXP S32K144' },
    attachments: [sampleAttachment],
  };

  const draft = buildDocumentDraft('Firmware Release Spec', 'FW-FRS-01', source, undefined, 'FW-FRS');
  assert.equal(draft.attachments.length, 1);
  assert.equal(draft.attachments[0].sha256, sampleAttachment.sha256);
  assert.equal(draft.snapshot.source.attachments[0].filename, 'HLPL-SLCT-01-FW-RELEASE.hex');
});

test('Catalogue family IDs map correctly across commercial, engineering, production, and quality deliverables', () => {
  assert.equal(buildDocumentDraft('SOR', 'HLPL-SOR-01', undefined, undefined, 'SOR').catalogueFamilyId, 'D04');
  assert.equal(buildDocumentDraft('Review', 'HLPL-REVIEW-01', undefined, undefined, 'REVIEW').catalogueFamilyId, 'D05');
  assert.equal(buildDocumentDraft('Quotation', 'HLPL-QUO-01', undefined, undefined, 'QUO').catalogueFamilyId, 'D06');
  assert.equal(buildDocumentDraft('FW Spec', 'HLPL-FW-01', undefined, undefined, 'FW-FRS').catalogueFamilyId, 'D08');
  assert.equal(buildDocumentDraft('BOM', 'HLPL-BOM-01', undefined, undefined, 'BOM').catalogueFamilyId, 'D11');
  assert.equal(buildDocumentDraft('PSW', 'HLPL-PSW-01', undefined, undefined, 'PSW').catalogueFamilyId, 'D19');
  assert.equal(buildDocumentDraft('8D', 'HLPL-8D-01', undefined, undefined, '8D').catalogueFamilyId, 'D25');
  assert.equal(buildDocumentDraft('Invoice', 'HLPL-INV-01', undefined, undefined, 'INV').catalogueFamilyId, 'D26');
});


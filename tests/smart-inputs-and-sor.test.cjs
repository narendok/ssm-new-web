const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const {
  SMART_PARAMETER_SPECS,
  deriveDownstreamDocumentSpecs,
} = require('../src/lib/project-smart-inputs.ts');

const {
  STANDARD_SOR_TEMPLATES,
  parseSorText,
} = require('../src/lib/sor-parser.ts');

test('SMART_PARAMETER_SPECS covers critical automotive & electrical parameters with downstream docs', () => {
  const keys = Object.keys(SMART_PARAMETER_SPECS);
  assert.ok(keys.includes('system_voltage'), 'system_voltage spec must exist');
  assert.ok(keys.includes('operating_range'), 'operating_range spec must exist');
  assert.ok(keys.includes('sleep_current'), 'sleep_current spec must exist');
  assert.ok(keys.includes('cellular'), 'cellular spec must exist');
  assert.ok(keys.includes('can'), 'can spec must exist');
  assert.ok(keys.includes('ip'), 'ip rating spec must exist');
  assert.ok(keys.includes('temperature'), 'temperature spec must exist');
  assert.ok(keys.includes('battery'), 'battery spec must exist');

  // Verify system_voltage presets and downstream docs
  const vSpec = SMART_PARAMETER_SPECS['system_voltage'];
  assert.equal(vSpec.unit, 'V DC');
  assert.ok(vSpec.downstreamDocs.includes('PRS'));
  assert.ok(vSpec.downstreamDocs.includes('BOM'));
  assert.ok(vSpec.downstreamDocs.includes('DVPR'));
  assert.ok(vSpec.presets.some(p => p.value.includes('12V')));
  assert.ok(vSpec.presets.some(p => p.value.includes('24V')));

  // Verify operating_range
  const rangeSpec = SMART_PARAMETER_SPECS['operating_range'];
  assert.ok(rangeSpec.presets.some(p => p.value.includes('9V – 36V')));
  assert.ok(rangeSpec.downstreamDocs.includes('PRS'));

  // Verify IP rating
  const ipSpec = SMART_PARAMETER_SPECS['ip'];
  assert.ok(ipSpec.presets.some(p => p.value.includes('IP67')));
  assert.ok(ipSpec.downstreamDocs.includes('PRS'));
  assert.ok(ipSpec.downstreamDocs.includes('DVPR'));
});

test('deriveDownstreamDocumentSpecs generates PRS, SRS, BOM, DVPR and Quotation structures', () => {
  const inputs = {
    system_voltage: { finalValue: '12V DC (Passenger Vehicle / Light Commercial)' },
    operating_range: { finalValue: '9V – 36V DC' },
    sleep_current: { finalValue: '< 2 mA @ 12V' },
    cellular: { finalValue: '4G LTE Cat-1' },
    can: { finalValue: 'Dual CAN 2.0B J1939' },
    ip: { finalValue: 'IP67' },
    temperature: { finalValue: '-40°C to +85°C' },
    quantity: { finalValue: '50,000 units/year' },
    cost: { finalValue: 'Target BOM: ₹2,500' },
  };

  const docs = deriveDownstreamDocumentSpecs(inputs);
  assert.equal(docs.prs.systemVoltage, '12V DC (Passenger Vehicle / Light Commercial)');
  assert.equal(docs.prs.operatingRange, '9V – 36V DC');
  assert.equal(docs.prs.ipRating, 'IP67');
  assert.equal(docs.srs.cellular, '4G LTE Cat-1');
  assert.equal(docs.dvpr.ingressProtection, 'IP67');
  assert.equal(docs.dvpr.tempRange, '-40°C to +85°C');
  assert.equal(docs.quotation.targetVolume, '50,000 units/year');
});

test('STANDARD_SOR_TEMPLATES provides realistic OEM templates with pre-filled Opportunity and feasibility departments', () => {
  assert.ok(STANDARD_SOR_TEMPLATES.length >= 3, 'Must have at least 3 standard templates');

  const tata = STANDARD_SOR_TEMPLATES.find(t => t.id === 'sor-tata-ev-telematics');
  assert.ok(tata, 'Tata EV template must exist');
  assert.equal(tata.parsed.customerCode, 'TATA-EV');
  assert.equal(tata.parsed.projectTrack, 'turnkey');
  assert.equal(tata.parsed.targetVolume, '50,000 units / year');
  assert.equal(tata.parsed.feasibilityDepartments.length, 8, 'All 8 departments selected by default for turnkey');
  assert.ok(tata.parsed.parameterValues.system_voltage.includes('12V'));
  assert.ok(tata.parsed.parameterValues.ip.includes('IP67'));

  const readyMade = STANDARD_SOR_TEMPLATES.find(t => t.id === 'sor-ready-made-obd');
  assert.ok(readyMade, 'Ready-made commercial template must exist');
  assert.equal(readyMade.parsed.projectTrack, 'ready_made');
  // For ready_made, technical depts are waived; SAL and FIN lead
  assert.ok(readyMade.parsed.feasibilityDepartments.includes('SAL'));
  assert.ok(readyMade.parsed.feasibilityDepartments.includes('FIN'));
  assert.equal(readyMade.parsed.feasibilityDepartments.includes('EHW'), false);
});

test('parseSorText extracts structured parameters from raw client text', () => {
  const rawText = `
    Client: Tata Motors Commercial
    Project: Next-Gen Electric Light Commercial Telematics
    System Voltage: 24V DC
    Operating Range: 18V - 36V
    Ingress Protection: IP67
    Cellular: 4G LTE Cat-1 with 2G fallback
    CAN: Dual CAN 2.0B J1939
    Volume: 35,000 units
    Temp: -40 to +85 C
  `;

  const parsed = parseSorText(rawText);
  assert.equal(parsed.customerName, 'Tata Motors Limited · EV Fleet Division');
  assert.ok(parsed.parameterValues.system_voltage.includes('24V'));
  assert.ok(parsed.parameterValues.operating_range.includes('18V – 36V'));
  assert.ok(parsed.parameterValues.ip.includes('IP67'));
  assert.ok(parsed.parameterValues.cellular.includes('4G LTE Cat-1'));
  assert.ok(parsed.parameterValues.can.includes('Dual CAN'));
  assert.ok(parsed.parameterValues.temperature.includes('-40°C to +85°C'));
  assert.equal(parsed.targetVolume, '35000 units / year');
  assert.equal(parsed.feasibilityDepartments.length, 8);
});

test('SalesWorkspaceAndCustomerRegister and ProjectInputsWorkspace include Smart SOR and SmartParameterField', () => {
  const salesFile = fs.readFileSync(path.resolve(__dirname, '../src/components/SalesWorkspaceAndCustomerRegister.tsx'), 'utf8');
  assert.ok(salesFile.includes('SmartSorImporterModal'), 'SmartSorImporterModal must be integrated in Sales');
  assert.ok(salesFile.includes('Smart SOR Importer'), 'Smart SOR Importer button must exist in action bar');
  assert.ok(salesFile.includes('Smart SOR'), 'Smart SOR mini icon must be present on records');

  const inputsFile = fs.readFileSync(path.resolve(__dirname, '../src/components/ProjectInputsWorkspace.tsx'), 'utf8');
  assert.ok(inputsFile.includes('SmartParameterField'), 'SmartParameterField must be used in ProjectInputsWorkspace');
});

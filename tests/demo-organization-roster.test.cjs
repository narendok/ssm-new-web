const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const cache = new Map();
function load(name) {
  const filename = path.resolve(__dirname, `../src/lib/${name}.ts`);
  if (cache.has(filename)) return cache.get(filename);
  const mod = { exports: {} };
  cache.set(filename, mod.exports);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('module', 'exports', 'require', js)(mod, mod.exports, (request) => {
    if (!request.startsWith('.')) return require(request);
    const target = path.resolve(path.dirname(filename), request.endsWith('.ts') ? request : `${request}.ts`);
    return load(path.relative(path.resolve(__dirname, '../src/lib'), target).replace(/\.ts$/, ''));
  });
  cache.set(filename, mod.exports);
  return mod.exports;
}

test('canonical sample roster covers configured departments and correct org-chart levels', () => {
  const { DEMO_ORG_LEVELS, DEMO_ORGANIZATION_DEPARTMENTS, DEMO_ORGANIZATION_ROSTER, DEMO_ORGANIZATION_ADMIN } = load('demo-organization-roster');
  const codes = DEMO_ORGANIZATION_DEPARTMENTS.map((department) => department.code);
  assert.deepEqual(codes, ['SAL', 'EHW', 'FW', 'SW', 'MECH', 'PUR', 'QA', 'EMF', 'MMF', 'FIN', 'SIT', 'HR']);
  assert.ok(!codes.includes('TST'), 'EOL test roles belong to EMF; historical TST is not a configured department');
  for (const department of DEMO_ORGANIZATION_DEPARTMENTS) {
    const people = DEMO_ORGANIZATION_ROSTER.filter((person) => person.departmentCode === department.code);
    assert.equal(people.filter((person) => person.hierarchyLevel === 1).length, 1, `${department.code} has one sample lead`);
    assert.ok(people.length >= 2, `${department.code} has a lead and a sample contributor`);
  }
  assert.deepEqual(DEMO_ORG_LEVELS, {
    1: 'L1 · Lead', 2: 'L2 · Senior / specialist', 3: 'L3 · Associate / technician', 4: 'L4 · Operator / trainee',
  });
  const hardwareLevels = new Set(DEMO_ORGANIZATION_ROSTER.filter((person) => person.departmentCode === 'EHW').map((person) => person.hierarchyLevel));
  assert.deepEqual([...hardwareLevels].sort(), [1, 2, 3, 4]);
  assert.equal(DEMO_ORGANIZATION_ROSTER.find((person) => person.departmentCode === 'EMF' && person.hierarchyLevel === 4).roleTitle, 'EOL Test Operator');
  assert.equal(DEMO_ORGANIZATION_ROSTER.find((person) => person.departmentCode === 'MMF' && person.hierarchyLevel === 1).roleTitle, 'Mechanical Manufacturing Lead');
  assert.ok(DEMO_ORGANIZATION_ROSTER.every((person) => person.status === 'DEMO_ONLY'));
  assert.ok(DEMO_ORGANIZATION_ROSTER.every((person) => person.workEmail.endsWith('.test') && person.workPhone.includes('non-callable') && person.emergencyContactPhone.includes('non-callable')));
  assert.equal(new Set(DEMO_ORGANIZATION_ROSTER.map((person) => person.name)).size, DEMO_ORGANIZATION_ROSTER.length, 'Fictional employee display names are unique');
  assert.ok(DEMO_ORGANIZATION_ROSTER.every((person) => person.name !== person.roleTitle), 'A job title is never shown as an employee name');
  assert.ok(DEMO_ORGANIZATION_ROSTER.every((person) => person.securityClearance === 'Not recorded'));
  const fixtureKeys = DEMO_ORGANIZATION_ROSTER.map((person) => person.fixtureKey);
  assert.equal(new Set(fixtureKeys).size, fixtureKeys.length, 'fixture keys are stable and unique');
  assert.ok(DEMO_ORGANIZATION_ROSTER.every((person) => person.reportsToFixtureKey === DEMO_ORGANIZATION_ADMIN.fixtureKey || fixtureKeys.includes(person.reportsToFixtureKey)));
});

test('profile and team demo data resolve from the canonical roster, never from a second profile list', () => {
  const { DEMO_ORGANIZATION_ROSTER } = load('demo-organization-roster');
  const { DEFAULT_EMPLOYEE_PROFILES, resolveEmployeeProfile } = load('employee-services');
  for (const sample of DEMO_ORGANIZATION_ROSTER) {
    const profile = DEFAULT_EMPLOYEE_PROFILES[sample.fixtureKey];
    assert.equal(profile.name, sample.name);
    assert.equal(profile.employeeCode, sample.employeeCode);
    assert.equal(profile.departmentCode, sample.departmentCode);
    assert.equal(profile.roleTitle, sample.roleTitle);
  }
  const ordinaryHardwareMember = resolveEmployeeProfile({ kind: 'member', id: 'employee-ehw', person: 'EHW TEST Employee', departmentId: 'ehw' });
  assert.equal(ordinaryHardwareMember.name, 'Alex Chen');
  assert.equal(ordinaryHardwareMember.employeeCode, 'DEMO-EHW-003');
  assert.notEqual(ordinaryHardwareMember.name, DEFAULT_EMPLOYEE_PROFILES.ehw.name);
  const source = fs.readFileSync(path.resolve(__dirname, '../src/routes/index.tsx'), 'utf8');
  assert.match(source, /DEMO_ORGANIZATION_ROSTER\.map\(\(profile\) =>/);
  const directory = fs.readFileSync(path.resolve(__dirname, '../src/components/CompanyDirectoryAndLegalHub.tsx'), 'utf8');
  assert.match(directory, /defaultCompanyDirectory: DirectoryContact\[\] = DEMO_ORGANIZATION_ROSTER\.map/);
  const hr = fs.readFileSync(path.resolve(__dirname, '../src/components/HRAdministrationWorkspace.tsx'), 'utf8');
  assert.match(hr, /DEMO_ORGANIZATION_ROSTER\.map\(\(person\) =>/);
});

test('ad hoc local team members use the canonical four levels and do not invent assessments or skills', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentLeadCoordinationCenter.tsx'), 'utf8');
  assert.match(source, /DEMO_ORG_LEVELS/);
  assert.match(source, /Object\.entries\(DEMO_ORG_LEVELS\)/);
  assert.match(source, /Not assessed · DEMO ONLY/);
  assert.match(source, /skills: skillsList/);
  assert.match(source, /No skills recorded/);
  assert.doesNotMatch(source, /3\.70\/4|Level 2 - Practitioner|Level 3 - Independent|Level 4 - Advanced Specialist/);
  assert.doesNotMatch(source, /\["Department Operations", "IATF 16949"\]/);
});

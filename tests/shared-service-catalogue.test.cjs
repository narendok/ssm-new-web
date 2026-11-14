const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('service catalogue is shared and its department writes are role and scope guarded', () => {
  const migration = read('supabase/migrations/20261106050628_shared_department_service_catalogue.sql');
  const validation = read('supabase/migrations/20261106051636_validate_shared_service_catalogue.sql');
  assert.match(migration, /canManageServices/);
  assert.match(migration, /p_department=member_department/);
  assert.match(migration, /FINANCE_OPTIONS_MANAGE_DENIED/);
  assert.match(migration, /SERVICE_CATALOGUE_MANAGE_DENIED/);
  assert.match(validation, /jsonb_typeof\(s->'name'\) IS DISTINCT FROM 'string'/);
  assert.match(validation, /jsonb_typeof\(s->'category'\) IS DISTINCT FROM 'string'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_expense_catalogue\(uuid\),public\.save_expense_catalogue\(uuid,jsonb,integer\) FROM PUBLIC,anon/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.get_expense_catalogue\(uuid\),public\.save_expense_catalogue\(uuid,jsonb,integer\) TO authenticated/);
});

test('web purchase form and settings consume the authenticated catalogue instead of hardcoded services', () => {
  const form = read('src/components/SharedBusinessWorkspace.tsx');
  const settings = read('src/components/ExpenseSettingsPanel.tsx');
  const rpc = read('src/lib/expense-settings.functions.ts');
  const supplierLinks = read('supabase/migrations/20261112142926_service_catalogue_supplier_master_links.sql');
  assert.match(form, /expenseOptions\.data\?\.services/);
  assert.match(form, /searchableSelect\('category','Finance category',\(expenseOptions\.data\?\.categories\|\|\[\]\)\.map\(value=>\(\{value,label:value\}\)\),true\)/,
    'Finance category is a required searchable choice from the saved expense settings');
  assert.match(form, /Project stage: \{expenseProject\.currentStage\}/,
    'expense suggestions label the selected project context as its stage');
  assert.match(form, /<SharedMasterSelect label="Service catalogue"[\s\S]*?options=\{\(expenseOptions\.data\?\.services\|\|\[\]\)\.map\(item=>\(\{value:item\.id,label:item\.name\}\)\)\}/,
    'service is selected from one searchable catalogue selector');
  assert.match(form, /mergeCanonicalSupplierOptions\(expenseOptions\.data\?\.suppliers, data\.suppliers\)/,
    'service and expense pickers merge their authenticated canonical supplier sources by ID');
  assert.match(form, /canonicalSuppliers\.find\(supplier => supplier\.id === selectedService\.supplierId\)/,
    'service selection resolves its supplier using the merged canonical directory');
  assert.match(form, /supplierId: selectedService\.supplierId \|\| ""[\s\S]*?supplierName: linkedSupplier\?\.title \|\| selectedService\.provider \|\| ""/,
    'service selection preserves its canonical supplier ID even if the business snapshot has not refreshed');
  assert.doesNotMatch(form, /companyServiceCatalogue/);
  assert.match(settings, /canManageServices/);
  assert.match(settings, /SharedMasterSelect/);
  assert.match(settings, /supplierByService/);
  assert.match(settings, /Save services/);
  assert.match(rpc, /get_expense_catalogue/);
  assert.match(rpc, /supplierId:z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(supplierLinks, /EXPENSE_SERVICE_SUPPLIER_INVALID/);
  assert.match(supplierLinks, /jsonb_build_object\('provider',supplier\.title\)/);
});

test('expense review resolves supplier display from the current canonical supplier directory', () => {
  const workspace = read('src/components/SharedBusinessWorkspace.tsx');
  assert.match(workspace, /canonicalSupplierDisplay\(target\.data\["supplierId"\], target\.data\[key\], data\.suppliers\)/,
    'review details use the current supplier master name when a canonical supplier ID is linked');
  const helper = workspace.match(/export function canonicalSupplierDisplay\([\s\S]*?\n}\n/);
  assert.ok(helper, 'canonical supplier display helper is present');
  assert.match(helper[0], /suppliers\.find\(\(item\) => item\.id === id\)/);
  assert.match(helper[0], /: str\(savedName\)/,
    'historical supplier snapshot remains available when the current master is not in the caller directory');
});

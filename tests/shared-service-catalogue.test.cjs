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
  assert.match(form, /expenseOptions\.data\?\.services/);
  assert.doesNotMatch(form, /companyServiceCatalogue/);
  assert.match(settings, /canManageServices/);
  assert.match(settings, /Save services/);
  assert.match(rpc, /get_expense_catalogue/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseExpenseServices } = require('../src/lib/expense-service-editor.ts');

const githubId = '00000000-0000-4000-8000-000000000001';
const zohoId = '00000000-0000-4000-8000-000000000002';
const existing = [
  { id: 'cloud', name: 'Cloud hosting & infrastructure', category: 'Software', provider: '', cycle: 'Monthly', owner: 'IT lead' },
  { id: 'github', name: 'GitHub subscription', category: 'Software', provider: 'GitHub', cycle: 'Annual', owner: 'Software lead', supplierId: githubId },
  { id: 'zoho', name: 'Zoho business software', category: 'Software', provider: 'Zoho', cycle: 'Annual', owner: 'Operations lead', supplierId: zohoId },
];

test('unchanged service rows preserve stable catalogue IDs and canonical Supplier IDs', () => {
  const parsed = parseExpenseServices(existing.map(service => [service.name, service.category, service.provider, service.cycle, service.owner].join(' | ')).join('\n'), existing);
  assert.deepEqual(parsed.map(service => service.id), ['cloud', 'github', 'zoho']);
  assert.equal(parsed.find(service => service.id === 'github').supplierId, githubId);
  assert.equal(parsed.find(service => service.id === 'zoho').supplierId, zohoId);
});

test('renaming a service in place preserves its identity and appending a new service creates a new stable slug', () => {
  const parsed = parseExpenseServices([
    'Cloud and backup hosting | Software |  | Monthly | IT lead',
    'GitHub subscription | Software | GitHub | Annual | Software lead',
    'Zoho business software | Software | Zoho | Annual | Operations lead',
    'New service desk | Operations |  | Monthly | IT lead',
  ].join('\n'), existing);
  assert.deepEqual(parsed.map(service => service.id), ['cloud', 'github', 'zoho', 'new-service-desk']);
  assert.equal(parsed.find(service => service.id === 'github').supplierId, githubId);
  assert.equal(parsed.find(service => service.id === 'zoho').supplierId, zohoId);
});

test('reordering exact existing service names keeps their own canonical IDs', () => {
  const parsed = parseExpenseServices([
    'Zoho business software | Software | Zoho | Annual | Operations lead',
    'Cloud hosting & infrastructure | Software |  | Monthly | IT lead',
    'GitHub subscription | Software | GitHub | Annual | Software lead',
  ].join('\n'), existing);
  assert.deepEqual(parsed.map(service => service.id), ['zoho', 'cloud', 'github']);
  assert.equal(parsed[0].supplierId, zohoId);
  assert.equal(parsed[2].supplierId, githubId);
});

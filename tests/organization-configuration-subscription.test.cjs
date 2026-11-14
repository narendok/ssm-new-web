const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

test('concurrent organization consumers and effect remounts keep independent subscriptions', async () => {
  const effects = [];
  const channels = new Map();
  const removed = [];
  const invalidated = [];
  const pendingCleanup = [];
  const cache = { invalidateQueries: ({ queryKey }) => invalidated.push(queryKey) };
  const client = {
    channel(topic) {
      if (channels.has(topic)) return channels.get(topic);
      const channel = {
        topic, subscribed: false,
        on(event, filter, callback) {
          if (this.subscribed) throw new Error('Cannot add callbacks after subscribe');
          this.event = event;
          this.filter = filter;
          this.callback = callback;
          return this;
        },
        subscribe() { this.subscribed = true; return this; },
      };
      channels.set(topic, channel);
      return channel;
    },
    removeChannel(channel) {
      removed.push(channel);
      return new Promise(resolve => pendingCleanup.push(() => {
        channels.delete(channel.topic);
        resolve('ok');
      }));
    },
  };
  const mocks = {
    react: { useEffect: effect => effects.push(effect) },
    '@tanstack/react-query': { useQuery: () => ({}), useQueryClient: () => cache },
    '@tanstack/react-start': { useServerFn: fn => fn },
    '@/integrations/supabase/client': { supabase: client },
    './organization-configuration.functions': { getOrganizationConfiguration: () => ({}) },
    './department-modules': { DEPARTMENT_MODULES: [] },
  };
  const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/organization-configuration.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', js)(name => {
    assert.ok(name in mocks, `Unexpected import ${name}`);
    return mocks[name];
  }, loaded, loaded.exports);
  const { useOrganizationConfiguration } = loaded.exports;

  useOrganizationConfiguration('test-org');
  useOrganizationConfiguration('test-org');
  const cleanupFirst = effects[0]();
  const cleanupSecond = effects[1]();
  assert.equal(channels.size, 2);
  cleanupFirst();
  // React development remounts can run before removeChannel resolves.
  const cleanupRemount = effects[0]();
  assert.equal(channels.size, 3);
  pendingCleanup.shift()();
  assert.equal(channels.size, 2);
  for (const channel of channels.values()) {
    assert.equal(channel.event, 'postgres_changes');
    assert.deepEqual(channel.filter, { event: '*', schema: 'public', table: 'departments' });
  }
  [...channels.values()][0].callback();
  assert.deepEqual(invalidated, [
    ['organization-configuration'], ['shared-test-workspace'],
    ['shared-operational-workspace'], ['project-coordination'], ['lifecycle-workspace'],
  ]);
  cleanupSecond();
  cleanupRemount();
  pendingCleanup.splice(0).forEach(finish => finish());
  assert.equal(channels.size, 0);
  assert.equal(removed.length, 3);

  useOrganizationConfiguration(undefined);
  assert.equal(effects[2](), undefined);
  assert.equal(channels.size, 0);
});

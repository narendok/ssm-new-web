const test = require('node:test');
const assert = require('node:assert/strict');
const { effectiveTravelPolicyResult } = require('../src/lib/effective-travel-policy.schema.ts');

const draftPolicy = {
  currency: 'INR',
  status: 'Draft',
  effectiveFrom: null,
  advancePercent: 80,
  oneOpenAdvance: true,
  cityTiers: ['Metro tier', 'Other cities'],
  bands: [
    { id: 'staff', label: 'Staff', hotelMetro: 0, hotelOther: 0, mealsPerDay: 0, localPerDay: 0 },
    { id: 'manager', label: 'Manager', hotelMetro: 0, hotelOther: 0, mealsPerDay: 0, localPerDay: 0 },
    { id: 'senior', label: 'Senior', hotelMetro: 0, hotelOther: 0, mealsPerDay: 0, localPerDay: 0 },
  ],
};

test('SQL NULL effective status from an undated draft parses as inactive', () => {
  const parsed = effectiveTravelPolicyResult.parse({
    policy: draftPolicy,
    isEffective: null,
    policyVersion: null,
    employeeBand: 'executive',
    band: draftPolicy.bands[0],
  });
  assert.equal(parsed.isEffective, false);
  assert.equal(parsed.policyVersion, 0);
  assert.equal(parsed.employeeBand, null);
  assert.equal(parsed.band, null, 'unknown profile bands cannot inherit a known cap band');
  assert.equal(parsed.policy.status, 'Draft');
});

test('an active policy signal remains true and malformed policy data still fails closed', () => {
  assert.equal(effectiveTravelPolicyResult.parse({
    policy: { ...draftPolicy, status: 'Active', effectiveFrom: '2026-11-01' },
    isEffective: true,
    policyVersion: 1,
    employeeBand: 'staff',
    band: draftPolicy.bands[0],
  }).isEffective, true);
  const mismatchedBand = effectiveTravelPolicyResult.parse({
    policy: { ...draftPolicy, status: 'Active', effectiveFrom: '2026-11-01' },
    isEffective: true,
    policyVersion: 1,
    employeeBand: 'manager',
    band: draftPolicy.bands[0],
  });
  assert.equal(mismatchedBand.employeeBand, 'manager');
  assert.equal(mismatchedBand.band, null, 'a band from another role is not accepted for cap calculation');
  assert.throws(() => effectiveTravelPolicyResult.parse({
    policy: draftPolicy,
    isEffective: 'true',
    policyVersion: 0,
    employeeBand: null,
    band: null,
  }));
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateTravelEstimate, travelDateValidationMessage } = require('../src/lib/expense-validation.ts');

test('travel expense dates are required and parsed as valid calendar dates', () => {
  assert.equal(travelDateValidationMessage('', '2026-11-21'), 'Choose a travel start date.');
  assert.equal(travelDateValidationMessage('2026-11-20', ''), 'Choose a travel end date.');
  assert.equal(travelDateValidationMessage('20/11/2026', '2026-11-21'), 'Choose a valid travel start date.');
  assert.equal(travelDateValidationMessage('2026-02-29', '2026-03-01'), 'Choose a valid travel start date.');
});

test('travel expense end date cannot precede its start date', () => {
  assert.equal(
    travelDateValidationMessage('2026-11-21', '2026-11-20'),
    'Travel end date must be on or after the start date.',
  );
  assert.equal(travelDateValidationMessage('2026-11-20', '2026-11-20'), null);
  assert.equal(travelDateValidationMessage('2026-11-20', '2026-11-21'), null);
});

test('active travel estimate applies band, location-tier, daily and advance ceilings', () => {
  const base = {
    band: { id: 'staff', hotelMetro: 4000, hotelOther: 2500, mealsPerDay: 800, localPerDay: 600 },
    cityTier: 'metro', advancePercent: 80, amount: 8000,
    transportEstimate: 5000, hotelRate: 3000, hotelNights: 1,
    mealRate: 500, mealDays: 2, localRate: 300, localDays: 2, tripDays: 2,
  };
  assert.deepEqual(evaluateTravelEstimate(base), {
    estimate: 9600, advanceCap: 7680, overHotelCap: false, overMealCap: false,
    overLocalCap: false, overAdvanceCap: true, requiresException: true,
  });
  assert.equal(evaluateTravelEstimate({ ...base, amount: 7000 })?.requiresException, false);
  assert.equal(evaluateTravelEstimate({ ...base, hotelRate: 4500 })?.overHotelCap, true);
  assert.equal(evaluateTravelEstimate({ ...base, mealRate: 900 })?.overMealCap, true);
  assert.equal(evaluateTravelEstimate({ ...base, localDays: 3 }), null,
    'per diem days cannot exceed the trip duration');
});

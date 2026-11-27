import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEstimate, rentalCosts, validateTripInputs, serializeParticipants, RENTALS } from './estimate.mjs';

const dates = [{ base: 11000 }, { base: 16300 }];
const lift = [4100, 5400];
const person = (train, board = 'basic', wear = 'basic') => ({ train, ...rentalCosts(board, wear) });

test('the original all-Tokyo estimates and each payment destination match exactly', () => {
  const results = calculateEstimate(dates, lift, Array.from({ length: 5 }, () => person(13600)), 0);
  assert.deepEqual(results.map(quote => quote.total), [[157500, 164000], [184000, 190500]]);
  assert.deepEqual(results[0].tour, [89500, 96000]);
  assert.deepEqual(results[0].individuals[0], [31500, 32800]);
});

test('mixed stations, rental options, dinner and early arrival reconcile for both endpoints', () => {
  const people = [person(13600, 'upgrade', 'none'), person(11860, 'none', 'upgrade'),
    person(13180), person(11860, 'none', 'none'), person(13600)];
  const results = calculateEstimate(dates, lift, people, 1500);
  assert.deepEqual(results[0].tour, [81100, 87600]);
  assert.equal(results[0].train, 64100);
  assert.equal(results[0].rental, 9000);
  assert.equal(results[0].facility, 7500);
  assert.deepEqual(results.map(quote => quote.total), [[161700, 168200], [188200, 194700]]);
  for (const quote of results) {
    for (const endpoint of [0, 1]) {
      assert.equal(quote.total[endpoint], quote.tour[endpoint] + quote.rental + quote.facility + quote.train);
      assert.equal(quote.total[endpoint], quote.individuals.reduce((sum, total) => sum + total[endpoint], 0));
    }
  }
});

test('changing the normal rental rate does not change its payee', () => {
  const rates = { ...RENTALS, board: { ...RENTALS.board, basic: { ...RENTALS.board.basic, daily: 900 } } };
  assert.deepEqual(rentalCosts('basic', 'upgrade', rates), {
    board: 1800, wear: 4000, byPayee: { tour: 1800, rental: 4000 }
  });
});

test('an incomplete rail fare leaves group totals unresolved without hiding known amounts', () => {
  const [quote] = calculateEstimate(dates, lift, [person(null), person(13600)], 0);
  assert.equal(quote.total, null);
  assert.equal(quote.train, null);
  assert.deepEqual(quote.tour, [35800, 38400]);
  assert.deepEqual(quote.individuals, [null, [31500, 32800]]);
});

const legacyPeople = Array.from({ length: 5 }, (_, index) => ({
  name: 'テスト' + index, station: index === 0 ? 'ueno' : 'tokyo', board: '2500', wear: '0'
}));
const { name: unused, ...sampleFields } = legacyPeople[0];
const legacyObject = Object.fromEntries(legacyPeople.map(({ name, ...fields }) => [name, fields]));
const base = { fares: { tokyo: '6800', omiya: '5930', ueno: '6590' }, early: true };
const legacy = [
  { ...base, version: 1, dinner: 2, participants: legacyObject },
  { ...base, version: 2, dinner: 'shabu-shabu', participants: legacyObject },
  { ...base, version: 3, dinner: 'shabu-shabu', participants: legacyPeople }
];
const expected = { ...base, version: 4, dinner: 'shabu-shabu',
  participants: legacyPeople.map(person => ({ ...person, board: 'upgrade', wear: 'none' })) };

for (const fixture of legacy) {
  test('JSON v' + fixture.version + ' preserves settings and estimate when migrated', () => {
    assert.deepEqual(validateTripInputs(fixture), expected);
    assert.deepEqual(validateTripInputs(expected), expected);
    const migrated = validateTripInputs(fixture);
    const people = migrated.participants.map(participant =>
      person(Number(migrated.fares[participant.station]) * 2, participant.board, participant.wear));
    assert.deepEqual(calculateEstimate(dates, lift, people, 1500).map(quote => quote.total),
      [[175580, 182080], [202080, 208580]]);
  });
}

test('malformed files, invalid fares, and unsupported options fail validation', () => {
  for (const data of [null, { ...expected, version: 99 }, { ...expected, early: 'true' },
    { ...expected, fares: { ...base.fares, ueno: '0x20' } },
    { ...expected, participants: expected.participants.slice(0, 4) },
    { ...expected, participants: [{ ...expected.participants[0], board: '__proto__' }, ...expected.participants.slice(1)] },
    { ...legacy[2], participants: [{ ...sampleFields, name: 'テスト0', wear: 'upgrade' }, ...legacyPeople.slice(1)] }
  ]) assert.throws(() => validateTripInputs(data), /形式/);
});

test('serialized names are opt-in and do not alter the input', () => {
  assert.ok(serializeParticipants(expected.participants).every(person => person.name === ''));
  assert.deepEqual(serializeParticipants(expected.participants, true), expected.participants);
  assert.equal(expected.participants[0].name, 'テスト0');
});


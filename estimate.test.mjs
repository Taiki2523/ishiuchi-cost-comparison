import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTrip, januaryQuote, januaryDeparture, rentalCosts, validateTripInputs, serializeParticipants, RENTALS } from './estimate.mjs';

const dates = [{ base: 11000 }, { base: 16300 }];
const lift = [4100, 5400];
const plan = { dates: dates.map(date => ({ ...date, lift, liftPayee: 'tour' })) };
const person = (train, board = 'basic', wear = 'basic') => ({ train, ...rentalCosts(board, wear) });

test('the original all-Tokyo estimates and each payment destination match exactly', () => {
  const results = calculateTrip(plan, Array.from({ length: 5 }, () => person(13600)), 0);
  assert.deepEqual(results.map(quote => quote.total), [[157500, 164000], [184000, 190500]]);
  assert.deepEqual(results[0].tour, [89500, 96000]);
  assert.deepEqual(results[0].individuals[0], [31500, 32800]);
});

test('mixed stations, rental options, dinner and early arrival reconcile for both endpoints', () => {
  const people = [person(13600, 'upgrade', 'none'), person(11860, 'none', 'upgrade'),
    person(13180), person(11860, 'none', 'none'), person(13600)];
  const results = calculateTrip(plan, people, 1500);
  assert.deepEqual(results[0].tour, [81100, 87600]);
  assert.equal(results[0].train, 64100);
  assert.deepEqual(results[0].rental, [9000, 9000]);
  assert.deepEqual(results[0].facility, [7500, 7500]);
  assert.deepEqual(results.map(quote => quote.total), [[161700, 168200], [188200, 194700]]);
  for (const quote of results) {
    for (const endpoint of [0, 1]) {
      assert.equal(quote.total[endpoint], quote.tour[endpoint] + quote.rental[endpoint] + quote.facility[endpoint] + quote.train);
      assert.equal(quote.total[endpoint], quote.individuals.reduce((sum, total) => sum + total[endpoint], 0));
    }
  }
});

test('changing the normal rental rate does not change its payee', () => {
  const rates = { ...RENTALS, board: { ...RENTALS.board, basic: { ...RENTALS.board.basic, daily: 900 } } };
  assert.deepEqual(rentalCosts('basic', 'upgrade', rates), {
    board: 1800, wear: 4000, byPayee: { tour: 1800, rental: 4000, facility: 0 }
  });
});

test('an incomplete rail fare leaves group totals unresolved without hiding known amounts', () => {
  const [quote] = calculateTrip(plan, [person(null), person(13600)], 0);
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
const expected = { ...base, version: 6, departureDay: 5, basePrice: 11000, dinner: 'shabu-shabu',
  participants: legacyPeople.map(person => ({ ...person, board: 'upgrade', wear: 'none' })) };

for (const fixture of legacy) {
  test('JSON v' + fixture.version + ' preserves settings and estimate when migrated', () => {
    assert.deepEqual(validateTripInputs(fixture), expected);
    assert.deepEqual(validateTripInputs(expected), expected);
    const migrated = validateTripInputs(fixture);
    const people = migrated.participants.map(participant =>
      person(Number(migrated.fares[participant.station]) * 2, participant.board, participant.wear));
    assert.deepEqual(calculateTrip(plan, people, 1500).map(quote => quote.total),
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

test('a second resort can sell lift tickets separately and charge for one rental day onsite', () => {
  const day = { base: 9000, lift: [3000, 4200], liftPayee: 'facility' };
  const rates = { ...RENTALS, board: { ...RENTALS.board, basic: { daily: 1500, payee: 'facility' } } };
  const guest = { train: 10000, ...rentalCosts('basic', 'none', rates, 1) };
  const later = { base: 12000, lift: [3500, 3500], liftPayee: 'facility' };
  const quotes = calculateTrip({ dates: [day, later] }, [guest, guest], 0);
  assert.deepEqual(quotes.map(quote => quote.tour), [[18000, 18000], [24000, 24000]]);
  assert.deepEqual(quotes.map(quote => quote.facility), [[9000, 11400], [10000, 10000]]);
  assert.deepEqual(quotes.map(quote => quote.total), [[47000, 49400], [54000, 54000]]);
  assert.deepEqual(quotes[0].individuals, [[23500, 24700], [23500, 24700]]);
});

test('January selection changes one estimate and round-trips the selected base price', () => {
  const people = Array.from({ length: 5 }, () => person(13600));
  const quote = rate => calculateTrip({ dates: [januaryQuote(rate)] }, people, 0)[0];
  assert.deepEqual(quote(11000).tour, [98500, 98500]);
  assert.deepEqual(quote(11000).total, [166500, 166500]);
  assert.deepEqual(quote(19200).total, [207500, 207500]);
  assert.deepEqual(quote(19200).individuals[0], [41500, 41500]);
  assert.equal(validateTripInputs({ ...expected, version: 5, basePrice: 19200 }).basePrice, 19200);
  assert.equal(validateTripInputs({ ...expected, version: 4 }).basePrice, 11000);
  assert.throws(() => validateTripInputs({ ...expected, version: 5, basePrice: 9999 }), /掲載料金/);
});

test('departure day resolves its published price and survives JSON restoration', () => {
  assert.equal(januaryDeparture(16).base, 16300);
  assert.equal(januaryDeparture(31).base, 13100);
  assert.throws(() => januaryDeparture(30), /出発日/);
  assert.throws(() => januaryDeparture('16'), /出発日/);
  const saved = validateTripInputs({ ...expected, departureDay: 22 });
  assert.equal(saved.departureDay, 22);
  assert.equal(saved.basePrice, 11000);
  assert.equal(validateTripInputs({ ...expected, version: 5, basePrice: 16300 }).departureDay, 1);
  assert.throws(() => validateTripInputs({ ...expected, departureDay: 30 }), /出発日/);
});


import { ISHIUCHI_2027 } from './trip-config.mjs';

export const RENTALS = ISHIUCHI_2027.rentals;
const LEGACY_RENTALS = {
  board: { '0': 'none', '700': 'basic', '2500': 'upgrade' },
  wear: { '0': 'none', '700': 'basic', '2000': 'upgrade' }
};
export const STATIONS = ['tokyo', 'omiya', 'ueno'];
export const DINNERS = ['standard', 'sukiyaki', 'shabu-shabu'];
export const PARTICIPANT_COUNT = 5;

export function rentalCosts(boardId, wearId, rates = RENTALS, days = ISHIUCHI_2027.rentalDays) {
  const board = rates.board[boardId];
  const wear = rates.wear[wearId];
  const byPayee = { tour: 0, rental: 0, facility: 0 };
  for (const item of [board, wear]) byPayee[item.payee] += item.daily * days;
  return { board: board.daily * days, wear: wear.daily * days, byPayee };
}

export function calculateTrip(plan, participants, onsite) {
  const count = participants.length;
  const sum = getAmount => participants.reduce((total, person) => total + getAmount(person), 0);
  const train = participants.every(person => person.train !== null) ? sum(person => person.train) : null;
  const rentals = {
    tour: sum(person => person.byPayee.tour),
    rental: sum(person => person.byPayee.rental),
    facility: sum(person => person.byPayee.facility)
  };

  return plan.dates.map(({ base, lift, liftPayee, insurance = 0 }) => {
    const payment = {
      tour: lift.map(extra => (base + insurance) * count + rentals.tour + (liftPayee === 'tour' ? extra * count : 0)),
      rental: lift.map(extra => rentals.rental + (liftPayee === 'rental' ? extra * count : 0)),
      facility: lift.map(extra => onsite * count + rentals.facility + (liftPayee === 'facility' ? extra * count : 0))
    };
    return {
      ...payment, train,
      total: train === null ? null : lift.map((_, index) =>
        payment.tour[index] + payment.rental[index] + payment.facility[index] + train),
      individuals: participants.map(person => person.train === null ? null :
        lift.map(extra => base + insurance + extra + person.train + person.board + person.wear + onsite))
    };
  });
}

export function januaryQuote(base) {
  const price = ISHIUCHI_2027.januaryRates.find(rate => rate.base === base);
  if (!price) throw new Error('掲載料金を選択してください。');
  return { ...price, insurance: ISHIUCHI_2027.insurance, lift: ISHIUCHI_2027.lift, liftPayee: ISHIUCHI_2027.liftPayee };
}

export function januaryDeparture(day) {
  const rate = ISHIUCHI_2027.januaryRates.find(entry => entry.days.includes(day));
  if (!rate) throw new Error('掲載料金がある出発日を選択してください。');
  return { ...januaryQuote(rate.base), day };
}

export function validateTripInputs(data) {
  const invalid = () => { throw new Error('入力データの形式が一致しません。'); };
  if (!data || ![1, 2, 3, 4, 5, 6].includes(data.version) || typeof data.early !== 'boolean') invalid();
  const validFare = value => typeof value === 'string' &&
    (value === '' || (/^[0-9]+$/.test(value) && Number(value) >= 1 && Number(value) <= 999999));
  if (!STATIONS.every(id => validFare(data.fares?.[id]))) invalid();
  const dinner = data.version === 1 && Number.isInteger(data.dinner) ? DINNERS[data.dinner] : data.dinner;
  if (!DINNERS.includes(dinner) || (data.version === 1 && !Number.isInteger(data.dinner))) invalid();

  const source = data.participants;
  const legacyObject = data.version <= 2;
  if (legacyObject ? !source || typeof source !== 'object' || Array.isArray(source) : !Array.isArray(source)) invalid();
  const entries = legacyObject ? Object.entries(source).map(([name, fields]) => ({ ...fields, name })) : source;
  if (entries.length !== PARTICIPANT_COUNT) invalid();
  const participants = entries.map(person => {
    if (typeof person?.name !== 'string' || person.name.length > 40 || /[\r\n]/.test(person.name) ||
        !['', ...STATIONS].includes(person.station)) invalid();
    const board = data.version < 4 && typeof person.board === 'string' ? LEGACY_RENTALS.board[person.board] : person.board;
    const wear = data.version < 4 && typeof person.wear === 'string' ? LEGACY_RENTALS.wear[person.wear] : person.wear;
    if (typeof board !== 'string' || typeof wear !== 'string' ||
        !Object.hasOwn(RENTALS.board, board) || !Object.hasOwn(RENTALS.wear, wear) ||
        (data.version < 4 && (!Object.hasOwn(LEGACY_RENTALS.board, person.board) ||
          !Object.hasOwn(LEGACY_RENTALS.wear, person.wear)))) invalid();
    return { name: person.name, station: person.station, board, wear };
  });
  const quote = data.version === 6
    ? januaryDeparture(data.departureDay)
    : januaryDeparture(januaryQuote(data.version === 5
      ? data.basePrice : ISHIUCHI_2027.januaryRates[0].base).days[0]);
  return { version: 6, departureDay: quote.day, basePrice: quote.base,
    fares: data.fares, dinner, early: data.early, participants };
}

export function serializeParticipants(participants, includeNames = false) {
  return participants.map(({ name, station, board, wear }) => ({ name: includeNames ? name : '', station, board, wear }));
}


export const RENTAL_DAYS = 2;
export const RENTALS = {
  board: { none: { daily: 0, payee: 'tour' }, basic: { daily: 700, payee: 'tour' }, upgrade: { daily: 2500, payee: 'rental' } },
  wear: { none: { daily: 0, payee: 'tour' }, basic: { daily: 700, payee: 'tour' }, upgrade: { daily: 2000, payee: 'rental' } }
};
const LEGACY_RENTALS = {
  board: { '0': 'none', '700': 'basic', '2500': 'upgrade' },
  wear: { '0': 'none', '700': 'basic', '2000': 'upgrade' }
};
export const STATIONS = ['tokyo', 'omiya', 'ueno'];
export const DINNERS = ['standard', 'sukiyaki', 'shabu-shabu'];
export const PARTICIPANT_COUNT = 5;

export function rentalCosts(boardId, wearId, rates = RENTALS) {
  const board = rates.board[boardId];
  const wear = rates.wear[wearId];
  const byPayee = { tour: 0, rental: 0 };
  for (const item of [board, wear]) byPayee[item.payee] += item.daily * RENTAL_DAYS;
  return { board: board.daily * RENTAL_DAYS, wear: wear.daily * RENTAL_DAYS, byPayee };
}

export function calculateEstimate(dates, lift, participants, onsite) {
  const count = participants.length;
  const sum = getAmount => participants.reduce((total, person) => total + getAmount(person), 0);
  const train = participants.every(person => person.train !== null) ? sum(person => person.train) : null;
  const rental = sum(person => person.byPayee.rental);
  const tourRentals = sum(person => person.byPayee.tour);
  return dates.map(({ base }) => {
    const tour = lift.map(extra => (base + extra) * count + tourRentals);
    const facility = onsite * count;
    return {
      tour, rental, facility, train,
      total: train === null ? null : tour.map(amount => amount + rental + facility + train),
      individuals: participants.map(person => person.train === null ? null :
        lift.map(extra => base + extra + person.train + person.board + person.wear + onsite))
    };
  });
}

export function validateTripInputs(data) {
  const invalid = () => { throw new Error('入力データの形式が一致しません。'); };
  if (!data || ![1, 2, 3, 4].includes(data.version) || typeof data.early !== 'boolean') invalid();
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
  return { version: 4, fares: data.fares, dinner, early: data.early, participants };
}

export function serializeParticipants(participants, includeNames = false) {
  return participants.map(({ name, station, board, wear }) => ({ name: includeNames ? name : '', station, board, wear }));
}


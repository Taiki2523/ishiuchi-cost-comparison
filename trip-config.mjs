export const ISHIUCHI_2027 = {
  id: 'ishiuchi-2027-01',
  title: '石打丸山 SNOW TRIP',
  shareTitle: '石打丸山 SNOW TRIP｜2027年1月の見積もり',
  // Travel Inn, 5名以上室数おまかせ. Snapshot checked on 2026-11-28.
  januaryRates: [
    { base: 11000, days: [5, 6, 7, 8, 12, 13, 14, 15, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29] },
    { base: 11900, days: [4] },
    { base: 12300, days: [11, 17, 24] },
    { base: 13100, days: [31] },
    { base: 14400, days: [3] },
    { base: 16300, days: [1, 2, 16, 23] },
    { base: 18200, days: [10] },
    { base: 19200, days: [9] }
  ],
  lift: [4100, 5400],
  liftPayee: 'tour',
  rentalDays: 2,
  rentals: {
    board: { none: { daily: 0, payee: 'tour' }, basic: { daily: 700, payee: 'tour' }, upgrade: { daily: 2500, payee: 'rental' } },
    wear: { none: { daily: 0, payee: 'tour' }, basic: { daily: 700, payee: 'tour' }, upgrade: { daily: 2000, payee: 'rental' } }
  }
};

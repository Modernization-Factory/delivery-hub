// Shared fixtures for the pure-logic tests. Dates are chosen so the arithmetic is
// checkable by hand: Jul 2026 starts on a Wednesday, 2026-07-04/05 are the first weekend.
export const WEEKEND = [0, 6]; // Sun, Sat
export const HOLIDAYS = new Set(["2026-07-17"]); // a Friday, so it removes exactly one working day
export const NO_HOLIDAYS = new Set();
export const LEAVE_TYPES = [
  { name: "Vacation", value: 1 },
  { name: "Sick", value: 1 },
  { name: "Unpaid", value: 1 },
  { name: "Half Day", value: 0.5 },
  { name: "Comp-Off", value: 1 },
];
export const PERF_CFG = { weights: [20, 20, 15, 20, 15, 10], green: 4, amber: 3, partnerOnly: false };

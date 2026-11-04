import test from "node:test";
import assert from "node:assert/strict";
import { sumAll, sumMonths, workingDaysByMonth } from "../src/lib/workdays.js";
import { HOLIDAYS, LEAVE_TYPES, NO_HOLIDAYS, WEEKEND } from "./fixtures.js";

// Jul 2026 starts on a Wednesday: 23 working days, 22 with the 2026-07-17 Friday holiday.
const E = (o) => ({ id: "e", name: "Asha", role: "Developer", company: "WeKan", start: null, term: null, ...o });
const run = (employees, leaves = [], comps = [], holidays = NO_HOLIDAYS, filter) =>
  workingDaysByMonth(employees, leaves, comps, 2026, LEAVE_TYPES, WEEKEND, holidays, filter);

test("base is the month's working days for someone employed all year", () => {
  const rep = run([E({})]);
  assert.equal(rep.rows.length, 1);
  assert.equal(rep.rows[0].byMonth[7].base, 23);
  assert.equal(rep.rows[0].byMonth[7].leave, 0);
  assert.equal(rep.rows[0].byMonth[7].net, 23);
  assert.equal(rep.rows[0].base, 261); // 261 working days in 2026
});

test("configured holidays reduce the base", () => {
  const rep = run([E({})], [], [], HOLIDAYS);
  assert.equal(rep.rows[0].byMonth[7].base, 22);
});

test("the base is clipped to the employment window", () => {
  const join = run([E({ start: "2026-07-20" })]); // Mon 20 → Fri 31 = 2 working weeks
  assert.equal(join.rows[0].byMonth[7].base, 10);
  assert.equal(join.rows[0].byMonth[6].base, 0); // before joining

  const left = run([E({ term: "2026-07-15" })]); // 1-3, 6-10, 13-15
  assert.equal(left.rows[0].byMonth[7].base, 11);
  assert.equal(left.rows[0].byMonth[8].base, 0);

  const noOverlap = run([E({ start: "2025-01-01", term: "2025-06-30" })]);
  assert.deepEqual(noOverlap.rows, []); // never employed in 2026 → dropped
});

test("leave is counted per month, so a leave spanning a month end lands in both", () => {
  const leaves = [{ id: "l1", name: "Asha", start: "2026-06-29", end: "2026-07-03", type: "Vacation" }];
  const rep = run([E({})], leaves);
  assert.equal(rep.rows[0].byMonth[6].leave, 2); // Mon 29, Tue 30
  assert.equal(rep.rows[0].byMonth[7].leave, 3); // Wed 1 – Fri 3
  assert.equal(rep.rows[0].byMonth[7].net, 20);
  assert.equal(rep.rows[0].leave, 5);
});

test("a half day counts 0.5 and comp-off taken counts as leave", () => {
  const leaves = [
    { id: "l1", name: "Asha", start: "2026-07-20", end: "2026-07-20", type: "Half Day" },
    { id: "l2", name: "Asha", start: "2026-07-21", end: "2026-07-22", type: "Comp-Off" },
  ];
  const rep = run([E({})], leaves);
  assert.equal(rep.rows[0].byMonth[7].leave, 2.5);
  assert.equal(rep.rows[0].byMonth[7].net, 20.5);
});

test("comp-off earned in a month adds to the net", () => {
  const comps = [
    { id: "c1", name: "Asha", date: "2026-07-18", days: 1, reason: "release" }, // a Saturday
    { id: "c2", name: "Asha", date: "2026-08-01", days: 2, reason: "migration" },
  ];
  const leaves = [{ id: "l1", name: "Asha", start: "2026-07-20", end: "2026-07-22", type: "Vacation" }];
  const rep = run([E({})], leaves, comps);
  assert.equal(rep.rows[0].byMonth[7].comp, 1);
  assert.equal(rep.rows[0].byMonth[7].net, 23 - 3 + 1); // 21
  assert.equal(rep.rows[0].byMonth[8].comp, 2);
  assert.equal(rep.rows[0].comp, 3);
});

test("comp-off outside the year is ignored", () => {
  const rep = run([E({})], [], [{ id: "c1", name: "Asha", date: "2025-12-27", days: 1, reason: "old" }]);
  assert.equal(rep.rows[0].comp, 0);
});

test("the filter predicate narrows the roster", () => {
  const people = [E({}), E({ id: "e2", name: "Ravi", role: "Lead Developer", company: "Ciklum" })];
  const rep = run(people, [], [], NO_HOLIDAYS, (e) => e.company === "Ciklum");
  assert.deepEqual(rep.rows.map((r) => r.name), ["Ravi"]);
});

test("totals add up across people and sumMonths narrows to one month", () => {
  const people = [E({}), E({ id: "e2", name: "Ravi" })];
  const leaves = [{ id: "l1", name: "Ravi", start: "2026-07-20", end: "2026-07-24", type: "Vacation" }];
  const rep = run(people, leaves);
  assert.equal(rep.totals.people, 2);
  assert.equal(rep.totals.byMonth[7].base, 46);
  assert.equal(rep.totals.byMonth[7].leave, 5);
  assert.equal(rep.totals.byMonth[7].net, 41);
  assert.equal(sumMonths(rep.rows[0], [7], "net"), 23);
  assert.equal(sumMonths(rep.rows[0], [6, 7], "net"), 22 + 23); // Jun 22 + Jul 23 working days
  assert.equal(sumAll(rep.rows, [7], "leave"), 5);
  assert.equal(sumAll(rep.rows, [7, 8], "base"), 46 + 42); // 21 + 21 working days in Aug 2026
});

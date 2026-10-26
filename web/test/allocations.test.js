import test from "node:test";
import assert from "node:assert/strict";
import { aOverlaps, assignmentDaysInMonth, activeAssignmentsOn, computeBurn, crossProjectConcurrent, currentStream, effortSplitInMonth, streamsInMonth } from "../src/lib/allocations.js";
import { NO_HOLIDAYS, WEEKEND } from "./fixtures.js";

const A = (o) => ({ id: "a", name: "Asha", projectId: "p1", stream: "Bugs", from: "2026-07-01", to: null, ...o });

test("aOverlaps blocks double-booking inside one project only", () => {
  const existing = [A({ id: "a1", from: "2026-07-01", to: "2026-07-31" })];
  assert.equal(aOverlaps(existing, A({ id: "a2", from: "2026-07-15", to: null }), null).length, 1);
  assert.equal(aOverlaps(existing, A({ id: "a2", projectId: "p2", from: "2026-07-15" }), null).length, 0);
  assert.equal(aOverlaps(existing, A({ id: "a1", from: "2026-07-15" }), "a1").length, 0); // editing itself
});

test("crossProjectConcurrent surfaces the allowed cross-project splits", () => {
  const existing = [A({ id: "a1", projectId: "p2", from: "2026-07-01", to: "2026-07-31" })];
  assert.equal(crossProjectConcurrent(existing, A({ from: "2026-07-15" }), null).length, 1);
  assert.equal(crossProjectConcurrent(existing, A({ from: "2026-08-01" }), null).length, 0);
});

test("open-ended assignments (to = null) stay active forever", () => {
  const as = [A({ id: "a1", to: null })];
  assert.equal(activeAssignmentsOn(as, "Asha", "2030-01-01").length, 1);
  assert.equal(activeAssignmentsOn(as, "Asha", "2026-06-30").length, 0);
});

test("effortSplitInMonth shares each working day evenly across concurrent projects", () => {
  const solo = effortSplitInMonth([A({ id: "a1" })], 2026, 7, WEEKEND, NO_HOLIDAYS);
  assert.equal(solo.a1, 23); // 23 working days in Jul 2026
  const split = effortSplitInMonth([A({ id: "a1" }), A({ id: "a2", projectId: "p2" })], 2026, 7, WEEKEND, NO_HOLIDAYS);
  assert.equal(split.a1, 11.5);
  assert.equal(split.a2, 11.5);
});

test("effortSplitInMonth only counts days the assignment actually covers", () => {
  const out = effortSplitInMonth([A({ id: "a1", from: "2026-07-20", to: "2026-07-24" })], 2026, 7, WEEKEND, NO_HOLIDAYS);
  assert.equal(out.a1, 5);
});

test("assignmentDaysInMonth clips the assignment to the month", () => {
  assert.equal(assignmentDaysInMonth(A({ from: "2026-06-15", to: "2026-07-03" }), 2026, 7, WEEKEND, NO_HOLIDAYS), 3);
  assert.equal(assignmentDaysInMonth(A({ from: "2026-08-01", to: null }), 2026, 7, WEEKEND, NO_HOLIDAYS), 0);
  assert.equal(assignmentDaysInMonth(A({ from: "2026-07-01", to: null }), 2026, 7, WEEKEND, NO_HOLIDAYS), 23);
});

test("streamsInMonth and currentStream read the assignment timeline", () => {
  const as = [
    A({ id: "a1", stream: "Bugs", from: "2026-07-01", to: "2026-07-15" }),
    A({ id: "a2", stream: "PM", from: "2026-07-16", to: null }),
  ];
  assert.deepEqual(streamsInMonth(as, "Asha", 2026, 7), ["Bugs", "PM"]);
  assert.deepEqual(streamsInMonth(as, "Asha", 2026, 6), []);
  assert.equal(currentStream(as, "Asha", "2026-07-10"), "Bugs");
  assert.equal(currentStream(as, "Asha", "2026-08-10"), "PM");
  assert.equal(currentStream(as, "Ravi", "2026-07-10"), null);
});

test("computeBurn aggregates weighted effort per project, phase and stream", () => {
  const employees = [{ name: "Asha", start: "2026-01-01", term: null }];
  const empByName = { Asha: employees[0] };
  const assignments = [
    A({ id: "a1", projectId: "p1", phase: "R1", stream: "Bugs", from: "2026-07-01", to: "2026-07-31" }),
    A({ id: "a2", projectId: "p2", phase: "R2", stream: "PM", from: "2026-07-01", to: "2026-07-31" }),
  ];
  const b = computeBurn(assignments, employees, empByName, 2026, WEEKEND, NO_HOLIDAYS);
  const july = b.rows.find((r) => r.m === 7);
  assert.equal(july.wdim, 23);
  assert.equal(july.effort, 23); // one person can never burn more than one FTE
  assert.equal(july.fte, 1);
  assert.equal(july.unalloc, 0);
  assert.equal(b.agg.p1.total, 11.5);
  assert.equal(b.agg.p1.byPhase.R1, 11.5);
  assert.equal(b.agg.p2.byStream.PM, 11.5);
  assert.deepEqual([...b.agg.p1.people], ["Asha"]);
  assert.equal(b.perProj.p1.monthly[7].R1, 11.5);
});

test("computeBurn clips assignments to the employee's start/termination dates", () => {
  const employees = [{ name: "Asha", start: "2026-07-16", term: null }];
  const b = computeBurn([A({ id: "a1", from: "2026-07-01", to: "2026-07-31" })], employees, { Asha: employees[0] }, 2026, WEEKEND, NO_HOLIDAYS);
  assert.equal(b.rows.find((r) => r.m === 7).effort, 12); // 16-31 Jul
  const left = [{ name: "Asha", start: "2026-01-01", term: "2026-06-30" }];
  const b2 = computeBurn([A({ id: "a1", from: "2026-07-01", to: "2026-07-31" })], left, { Asha: left[0] }, 2026, WEEKEND, NO_HOLIDAYS);
  assert.equal(b2.rows.find((r) => r.m === 7).effort, 0);
});

test("computeBurn counts active-but-unassigned people", () => {
  const employees = [{ name: "Asha", start: "2026-01-01", term: null }, { name: "Ravi", start: "2026-01-01", term: null }];
  const empByName = Object.fromEntries(employees.map((e) => [e.name, e]));
  const b = computeBurn([A({ id: "a1", from: "2026-07-01", to: "2026-07-31" })], employees, empByName, 2026, WEEKEND, NO_HOLIDAYS);
  const july = b.rows.find((r) => r.m === 7);
  assert.equal(july.active, 2);
  assert.equal(july.unalloc, 1);
});

test("computeBurn leaves employees marked inactive out of the headcount", () => {
  const employees = [{ name: "Asha", start: "2026-01-01", term: null }, { name: "Ravi", start: "2026-01-01", term: null, inactive: true }];
  const empByName = Object.fromEntries(employees.map((e) => [e.name, e]));
  const b = computeBurn([A({ id: "a1", from: "2026-07-01", to: "2026-07-31" })], employees, empByName, 2026, WEEKEND, NO_HOLIDAYS);
  const july = b.rows.find((r) => r.m === 7);
  assert.equal(july.active, 1);
  assert.equal(july.unalloc, 0);
});

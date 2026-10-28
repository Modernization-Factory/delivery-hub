import test from "node:test";
import assert from "node:assert/strict";
import { balancesFor, compOffDateValid, findOverlaps, isActiveDuring, isDuplicate, leaveByProjectRole, leaveByMonth, leaveDays, leaveDaysInRange, monthsBetween, onLeaveOn } from "../src/lib/leave.js";
import { HOLIDAYS, LEAVE_TYPES, NO_HOLIDAYS, WEEKEND } from "./fixtures.js";

test("leaveDays counts working days and applies the type's day value", () => {
  assert.equal(leaveDays("2026-07-20", "2026-07-24", "Vacation", LEAVE_TYPES, WEEKEND, NO_HOLIDAYS), 5);
  assert.equal(leaveDays("2026-07-20", "2026-07-20", "Half Day", LEAVE_TYPES, WEEKEND, NO_HOLIDAYS), 0.5);
  assert.equal(leaveDays("2026-07-13", "2026-07-17", "Vacation", LEAVE_TYPES, WEEKEND, HOLIDAYS), 4);
  assert.equal(leaveDays("2026-07-18", "2026-07-19", "Vacation", LEAVE_TYPES, WEEKEND, NO_HOLIDAYS), 0);
});

test("leaveDays falls back to a full day for an unknown type", () => {
  assert.equal(leaveDays("2026-07-20", "2026-07-20", "Sabbatical", LEAVE_TYPES, WEEKEND, NO_HOLIDAYS), 1);
});

test("isDuplicate matches on person + exact window + type", () => {
  const ls = [{ id: "l1", name: "Asha", start: "2026-07-20", end: "2026-07-22", type: "Vacation" }];
  assert.equal(isDuplicate(ls, { name: "Asha", start: "2026-07-20", end: "2026-07-22", type: "Vacation" }), true);
  assert.equal(isDuplicate(ls, { name: "Asha", start: "2026-07-20", end: "2026-07-22", type: "Sick" }), false);
  assert.equal(isDuplicate(ls, { name: "Ravi", start: "2026-07-20", end: "2026-07-22", type: "Vacation" }), false);
});

test("findOverlaps catches touching ranges and ignores the row being edited", () => {
  const ls = [{ id: "l1", name: "Asha", start: "2026-07-20", end: "2026-07-22", type: "Vacation" }];
  assert.equal(findOverlaps(ls, { name: "Asha", start: "2026-07-22", end: "2026-07-24" }).length, 1); // shared boundary
  assert.equal(findOverlaps(ls, { name: "Asha", start: "2026-07-23", end: "2026-07-24" }).length, 0);
  assert.equal(findOverlaps(ls, { name: "Asha", start: "2026-07-20", end: "2026-07-22" }, "l1").length, 0);
});

test("comp-off can only be earned on a non-working day", () => {
  assert.equal(compOffDateValid("2026-07-16", WEEKEND, HOLIDAYS), false); // ordinary Thursday
  assert.equal(compOffDateValid("2026-07-18", WEEKEND, HOLIDAYS), true); // Saturday
  assert.equal(compOffDateValid("2026-07-17", WEEKEND, HOLIDAYS), true); // holiday
});

test("balancesFor totals by type and nets comp-off earned against used", () => {
  const leaves = [
    { id: "l1", name: "Asha", start: "2026-07-20", end: "2026-07-21", type: "Vacation" },
    { id: "l2", name: "Asha", start: "2026-07-22", end: "2026-07-22", type: "Comp-Off" },
    { id: "l3", name: "Ravi", start: "2026-07-20", end: "2026-07-24", type: "Vacation" },
  ];
  const comps = [{ name: "Asha", date: "2026-07-18", days: 2, reason: "release" }];
  const b = balancesFor("Asha", leaves, comps, LEAVE_TYPES, WEEKEND, NO_HOLIDAYS);
  assert.equal(b.byType.Vacation, 2);
  assert.equal(b.byType.Sick, 0);
  assert.equal(b.compOffEarned, 2);
  assert.equal(b.compOffUsed, 1);
  assert.equal(b.compOffBalance, 1);
});

test("isActiveDuring respects joiners and leavers at the boundary", () => {
  assert.equal(isActiveDuring({ start: "2026-01-01", term: "2026-07-16" }, "2026-07-16", "2026-07-16"), true);
  assert.equal(isActiveDuring({ start: "2026-01-01", term: "2026-06-30" }, "2026-07-16", "2026-07-16"), false);
  assert.equal(isActiveDuring({ start: "2026-08-01", term: null }, "2026-07-01", "2026-07-31"), false);
  assert.equal(isActiveDuring({}, "2026-07-01", "2026-07-31"), true); // no dates = always active
});

test("leaveDaysInRange clips a leave to the reporting window", () => {
  const l = { start: "2026-06-29", end: "2026-07-03", type: "Vacation" };
  assert.equal(leaveDaysInRange(l, "2026-07-01", "2026-07-31", LEAVE_TYPES, WEEKEND, NO_HOLIDAYS), 3);
  assert.equal(leaveDaysInRange(l, "2026-08-01", "2026-08-31", LEAVE_TYPES, WEEKEND, NO_HOLIDAYS), 0);
});

test("onLeaveOn returns everyone whose leave spans the date", () => {
  const ls = [
    { name: "Asha", start: "2026-07-20", end: "2026-07-22" },
    { name: "Ravi", start: "2026-07-23", end: "2026-07-24" },
  ];
  assert.deepEqual(onLeaveOn("2026-07-22", ls).map((l) => l.name), ["Asha"]);
  assert.deepEqual(onLeaveOn("2026-07-25", ls), []);
});

test("leaveByProjectRole splits a person's leave evenly across concurrent projects", () => {
  const leaves = [{ name: "Asha", start: "2026-07-20", end: "2026-07-21", type: "Vacation" }];
  const empByName = { Asha: { name: "Asha", role: "Lead Developer" } };
  const assignments = [
    { name: "Asha", projectId: "p1", from: "2026-07-01", to: null },
    { name: "Asha", projectId: "p2", from: "2026-07-01", to: null },
  ];
  const r = leaveByProjectRole(leaves, empByName, assignments, "2026-07-01", "2026-07-31", LEAVE_TYPES, WEEKEND, NO_HOLIDAYS);
  assert.equal(r.totals.LD, 2);
  assert.equal(r.byProject.p1.LD, 1);
  assert.equal(r.byProject.p2.total, 1);
  assert.equal(r.unassigned.total, 0);
});

test("leaveByProjectRole parks leave of unassigned people in `unassigned`", () => {
  const leaves = [{ name: "Ravi", start: "2026-07-20", end: "2026-07-20", type: "Vacation" }];
  const r = leaveByProjectRole(leaves, {}, [], "2026-07-01", "2026-07-31", LEAVE_TYPES, WEEKEND, NO_HOLIDAYS);
  assert.equal(r.unassigned.Dev, 1); // unknown employee defaults to Developer
  assert.deepEqual(r.byProject, {});
});

test("monthsBetween lists every month inclusive, across a year end", () => {
  assert.deepEqual(monthsBetween("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(monthsBetween("2026-05", "2026-05"), ["2026-05"]);
});

test("leaveByMonth splits a leave across months and groups by any key", () => {
  const empByName = { Asha: { name: "Asha", role: "Developer", company: "WeKan" }, Ravi: { name: "Ravi", role: "Lead Developer", company: "MDB" } };
  const leaves = [
    { name: "Asha", start: "2026-07-30", end: "2026-08-04", type: "Vacation" }, // Thu-Fri Jul + Mon-Tue Aug
    { name: "Ravi", start: "2026-08-10", end: "2026-08-10", type: "Sick" },
    { name: "Ravi", start: "2026-09-01", end: "2026-09-01", type: "Vacation" }, // outside the months asked for
  ];
  const rep = leaveByMonth(leaves, empByName, ["2026-07", "2026-08"], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, (l, e) => e.role + " · " + e.company);
  const asha = rep.rows.find((r) => r.key === "Developer · WeKan");
  assert.deepEqual(asha.byMonth, { "2026-07": 2, "2026-08": 2 });
  assert.equal(asha.total, 4);
  assert.equal(rep.rows.find((r) => r.key === "Lead Developer · MDB").byType.Sick, 1);
  assert.equal(rep.totals.total, 5);
  assert.equal(rep.totals.people.size, 2);
  const onlySick = leaveByMonth(leaves, empByName, ["2026-08"], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, (l) => l.name, (l) => l.type === "Sick");
  assert.deepEqual(onlySick.rows.map((r) => r.key), ["Ravi"]);
});

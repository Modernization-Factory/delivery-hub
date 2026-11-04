import test from "node:test";
import assert from "node:assert/strict";
import { pageSlice } from "../src/lib/paging.js";
import { planCalc, planMonths } from "../src/lib/plans.js";
import { appRoleOf } from "../src/lib/roles.js";
import { canDo, defaultPerms, mergePerms, appRoleForEmp, canDeletePastLeave, canSeeWorkingDays, ROLES } from "../src/lib/permissions.js";
import { perfResourceTrend, perfScorecard, perfVendorTrend, ragOf, starsOf, weightedScore } from "../src/lib/performance.js";
import { PERF_CFG } from "./fixtures.js";

test("pageSlice clamps the page and reports a 1-based range", () => {
  const rows = Array.from({ length: 23 }, (_, i) => i);
  const p1 = pageSlice(rows, 1, 10);
  assert.deepEqual([p1.cur, p1.pages, p1.from, p1.to, p1.total], [1, 3, 1, 10, 23]);
  const p3 = pageSlice(rows, 3, 10);
  assert.deepEqual([p3.slice.length, p3.from, p3.to], [3, 21, 23]);
  assert.equal(pageSlice(rows, 99, 10).cur, 3); // past the end
  assert.equal(pageSlice(rows, -1, 10).cur, 1); // before the start
});

test("pageSlice survives empty input and a zero page size", () => {
  const e = pageSlice([], 1, 10);
  assert.deepEqual([e.slice, e.pages, e.from, e.to, e.total], [[], 1, 0, 0, 0]);
  assert.equal(pageSlice([1, 2, 3], 1, 0).pages, 3); // size floored at 1
});

test("planMonths walks month windows across a year boundary", () => {
  assert.deepEqual(planMonths("2026-11", 4), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(planMonths("2026-07", 0), []);
});

test("planCalc multiplies resources by the month multiplier and totals variance", () => {
  const plan = { monthsCount: 2, mult: 20, multOverrides: { 0: 15 }, rows: [{ id: "r1", res: [1, 2], est: 50 }, { id: "r2", res: ["", 1], est: "" }] };
  const c = planCalc(plan);
  assert.equal(c.rows[0].effort, 55); // 1x15 + 2x20
  assert.equal(c.rows[0].variance, 5);
  assert.equal(c.rows[1].effort, 20);
  assert.equal(c.rows[1].est, null);
  assert.equal(c.rows[1].variance, null); // no estimate = no variance
  assert.deepEqual(c.totalRes, [1, 3]);
  assert.deepEqual(c.projEffort, [15, 60]);
  assert.equal(c.grandRes, 4);
  assert.equal(c.grandEffort, 75);
  assert.equal(c.grandEst, 50);
});

test("appRoleOf maps the master role list onto app roles", () => {
  assert.equal(appRoleOf("Project Manager"), "Project Manager");
  assert.equal(appRoleOf("Lead Developer"), "Lead");
  assert.equal(appRoleOf("Senior Developer"), "Developer");
});

test("default permissions follow the documented role matrix", () => {
  const perms = defaultPerms();
  assert.equal(canDo(perms, "Developer", "leave.own"), true);
  assert.equal(canDo(perms, "Developer", "leave.forAnyone"), false);
  assert.equal(canDo(perms, "Lead", "alloc.edit"), true);
  assert.equal(canDo(perms, "Project Manager", "projects.manage"), true);
  assert.equal(canDo(perms, "Viewer", "ph.weekly"), false);
  assert.equal(canDo(perms, "Viewer", "ph.view"), true);
});

test("Admin keeps every capability and unknown capabilities are denied", () => {
  const perms = defaultPerms();
  assert.equal(canDo(perms, "Admin", "anything.at.all"), true);
  assert.equal(canDo(perms, "Lead", "no.such.cap"), false);
  assert.ok(ROLES.includes("Admin"));
});

test("mergePerms keeps stored overrides but backfills new capabilities", () => {
  const stored = { "leave.own": { Developer: false } }; // stored perms are keyed by app role
  const merged = mergePerms(stored);
  assert.equal(canDo(merged, "Developer", "leave.own"), false); // override respected
  assert.equal(canDo(merged, "Lead", "leave.own"), true); // untouched roles keep the default
  assert.equal(canDo(merged, "Developer", "timecard.editAll"), false);
  assert.equal(canDo(merged, "Lead", "timecard.editAll"), true); // default for a cap the store never saw
});

test("the working-days report is a PM / Admin tool — no other role sees it", () => {
  assert.equal(canSeeWorkingDays("Project Manager"), true);
  assert.equal(canSeeWorkingDays("Admin"), true);
  for (const role of ["Lead", "Developer", "Senior Developer", "Viewer"]) assert.equal(canSeeWorkingDays(role), false, role);
});

test("appRoleForEmp derives the app role from the employee master", () => {
  assert.equal(appRoleForEmp({ role: "Project Manager" }), "Project Manager");
  assert.equal(appRoleForEmp({ role: "Developer" }), "Developer");
  assert.equal(appRoleForEmp({ role: "Senior Developer" }), "Senior Developer");
  assert.equal(appRoleForEmp({ role: "Senior Developer", streamLead: true }), "Lead");
});

test("Senior Developer defaults to the Developer column and inherits stored Developer overrides", () => {
  const perms = defaultPerms();
  assert.equal(canDo(perms, "Senior Developer", "leave.own"), true);
  assert.equal(canDo(perms, "Senior Developer", "timecard.insights"), false);
  const merged = mergePerms({ "alloc.view": { Developer: true }, "leave.own": { Developer: true, "Senior Developer": false } });
  assert.equal(canDo(merged, "Senior Developer", "alloc.view"), true);
  assert.equal(canDo(merged, "Senior Developer", "leave.own"), false); // its own saved value wins
  assert.ok(ROLES.includes("Senior Developer"));
});

test("weightedScore needs all six metrics and honours the weights", () => {
  assert.equal(weightedScore([5, 5, 5, 5, 5, 5], PERF_CFG.weights), 5);
  assert.equal(weightedScore([4, 4, 4, 4, 4, 4], PERF_CFG.weights), 4);
  assert.equal(weightedScore([5, 5, 5, 5, 5, null], PERF_CFG.weights), null);
  assert.equal(weightedScore([5, 5, 5], PERF_CFG.weights), null);
});

test("starsOf rounds to the nearest half star and ragOf bands the score", () => {
  assert.equal(starsOf(4.3), 4.5);
  assert.equal(starsOf(4.1), 4);
  assert.equal(starsOf(null), null);
  assert.equal(ragOf(4.2, PERF_CFG), "Green");
  assert.equal(ragOf(3.2, PERF_CFG), "Amber");
  assert.equal(ragOf(2.2, PERF_CFG), "Red");
  assert.equal(ragOf(null, PERF_CFG), null);
});

const employees = [
  { name: "Asha", company: "WeKan", start: "2026-01-01", term: null },
  { name: "Ravi", company: "Ciklum", start: "2026-01-01", term: null },
  { name: "Mia", company: "MongoDB", start: "2026-01-01", term: null },
];
const scores = [
  { name: "Asha", week: "2026-07-11", m: [5, 5, 5, 5, 5, 5] },
  { name: "Ravi", week: "2026-07-11", m: [3, 3, 3, 3, 3, 3] },
  { name: "Asha", week: "2026-07-18", m: [4, 4, 4, 4, 4, 4] },
];

test("perfScorecard scores the active pool and rolls up per vendor", () => {
  const { rows, vendors } = perfScorecard(employees, scores, "2026-07-11", PERF_CFG);
  assert.deepEqual(rows.map((r) => r.name), ["Asha", "Mia", "Ravi"]); // alphabetical
  assert.equal(rows.find((r) => r.name === "Asha").rag, "Green");
  assert.equal(rows.find((r) => r.name === "Mia").score, null); // unscored
  assert.equal(vendors.WeKan.avg, 5);
  assert.equal(vendors.MongoDB.scored, 0);
  assert.equal(vendors.MongoDB.avg, null);
  assert.equal(vendors.Ciklum.Amber, 1);
});

test("perfScorecard can be limited to partner companies", () => {
  const { rows } = perfScorecard(employees, scores, "2026-07-11", { ...PERF_CFG, partnerOnly: true });
  assert.deepEqual(rows.map((r) => r.name), ["Asha", "Ravi"]); // MongoDB dropped
});

test("perfVendorTrend averages each vendor per week, leaving gaps null", () => {
  const t = perfVendorTrend(employees, scores, PERF_CFG);
  assert.deepEqual(t.weeks, ["2026-07-11", "2026-07-18"]);
  assert.deepEqual(t.vendors.WeKan, [5, 4]);
  assert.deepEqual(t.vendors.Ciklum, [3, null]);
});

test("perfResourceTrend returns one person's history in week order", () => {
  const t = perfResourceTrend(scores, "Asha", PERF_CFG);
  assert.deepEqual(t.map((x) => x.week), ["2026-07-11", "2026-07-18"]);
  assert.deepEqual(t.map((x) => x.score), [5, 4]);
  assert.equal(t[1].stars, 4);
  assert.deepEqual(perfResourceTrend(scores, "Nobody", PERF_CFG), []);
});

test("only PM and Admin can delete leave whose start date has passed", () => {
  assert.equal(canDeletePastLeave("Project Manager"), true);
  assert.equal(canDeletePastLeave("Admin"), true);
  ["Lead", "Senior Developer", "Developer", "Viewer"].forEach((r) => assert.equal(canDeletePastLeave(r), false));
});

test("timecard.flag defaults to Lead and PM, not Developer, Senior Developer or Viewer", () => {
  const perms = defaultPerms();
  assert.equal(canDo(perms, "Lead", "timecard.flag"), true);
  assert.equal(canDo(perms, "Project Manager", "timecard.flag"), true);
  ["Developer", "Senior Developer", "Viewer"].forEach((r) => assert.equal(canDo(perms, r, "timecard.flag"), false));
  assert.equal(canDo(mergePerms({}), "Lead", "timecard.flag"), true); // backfilled onto stored permission docs
});

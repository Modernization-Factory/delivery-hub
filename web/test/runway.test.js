import test from "node:test";
import assert from "node:assert/strict";
import { computeRunway, consumedByProjectRole, runwaySummary } from "../src/lib/runway.js";
import { runwayRoleOf, RUNWAY_ROLES } from "../src/lib/roles.js";
import { LEAVE_TYPES, NO_HOLIDAYS, WEEKEND } from "./fixtures.js";

const TODAY = "2026-07-16"; // Thursday; weekAnchor = 2026-07-11
const dev = { name: "Asha", role: "Developer", start: "2026-01-01", term: null };
const lead = { name: "Ravi", role: "Lead Developer", start: "2026-01-01", term: null };

test("runwayRoleOf maps master roles onto the four runway buckets", () => {
  assert.equal(runwayRoleOf("Project Manager"), "PM");
  assert.equal(runwayRoleOf("Lead Developer"), "LD");
  assert.equal(runwayRoleOf("Senior Developer"), "SD");
  assert.equal(runwayRoleOf("Developer"), "Dev");
  assert.deepEqual(RUNWAY_ROLES, ["PM", "LD", "SD", "Dev"]);
});

test("consumedByProjectRole burns 8h per working day, split across concurrent projects", () => {
  const as = [{ id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: null }];
  const solo = consumedByProjectRole(as, { Asha: dev }, "2026-07-13", "2026-07-17", WEEKEND, NO_HOLIDAYS);
  assert.equal(solo.p1.Dev, 40); // 5 working days x 8h

  const both = consumedByProjectRole(
    [...as, { id: "a2", name: "Asha", projectId: "p2", from: "2026-07-01", to: null }],
    { Asha: dev }, "2026-07-13", "2026-07-17", WEEKEND, NO_HOLIDAYS);
  assert.equal(both.p1.Dev, 20);
  assert.equal(both.p2.Dev, 20);
});

test("consumedByProjectRole ignores days outside employment and empty windows", () => {
  const as = [{ id: "a1", name: "Asha", projectId: "p1", from: "2026-01-01", to: null }];
  const gone = { Asha: { ...dev, term: "2026-07-10" } };
  assert.deepEqual(consumedByProjectRole(as, gone, "2026-07-13", "2026-07-17", WEEKEND, NO_HOLIDAYS), {});
  assert.deepEqual(consumedByProjectRole(as, { Asha: dev }, "2026-07-20", "2026-07-17", WEEKEND, NO_HOLIDAYS), {});
});

test("computeRunway needs funding before it reports anything", () => {
  assert.equal(computeRunway({ id: "p1" }, {}, [], [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, TODAY), null);
  assert.equal(computeRunway({ id: "p1", funding: { hours: { Dev: 100 } } }, {}, [], [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, TODAY), null);
});

test("computeRunway derives remaining hours, weeks and the last working date", () => {
  const project = { id: "p1", funding: { start: "2026-07-13", hours: { PM: 0, LD: 0, SD: 0, Dev: 200 }, overrides: {} } };
  const assignments = [{ id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: null, weeklyHours: 40 }];
  const rw = computeRunway(project, { Asha: dev }, assignments, [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, TODAY);
  const row = rw.rows.find((r) => r.role === "Dev");
  assert.equal(row.headcount, 1);
  assert.equal(row.weeklyBurn, 40);
  assert.equal(row.consumed, 32); // Mon-Thu inclusive of today
  assert.equal(row.remaining, 168);
  assert.equal(row.weeks, 4.2);
  assert.equal(row.days, 21);
  assert.equal(row.rag, "Green"); // >= 4 weeks
  assert.equal(row.last, "2026-08-10"); // 21 working days after the 11 Jul anchor
  assert.equal(rw.end, "2026-08-10");
  assert.equal(rw.totalRemaining, 168);
  assert.equal(rw.anchor, "2026-07-11");
});

test("computeRunway honours a manual remaining override and halves burn when split", () => {
  const project = { id: "p1", funding: { start: "2026-07-13", hours: { Dev: 200 }, overrides: { Dev: 40 } } };
  const assignments = [
    { id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: null, weeklyHours: 40 },
    { id: "a2", name: "Asha", projectId: "p2", from: "2026-07-01", to: null, weeklyHours: 40 },
  ];
  const row = computeRunway(project, { Asha: dev }, assignments, [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, TODAY).rows.find((r) => r.role === "Dev");
  assert.equal(row.override, 40);
  assert.equal(row.remaining, 40);
  assert.equal(row.weeklyBurn, 20); // shared with p2
  assert.equal(row.weeks, 2);
  assert.equal(row.rag, "Amber");
});

test("computeRunway pushes the last date out by approved leave inside the window", () => {
  const project = { id: "p1", funding: { start: "2026-07-13", hours: { Dev: 200 }, overrides: {} } };
  const assignments = [{ id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: null, weeklyHours: 40 }];
  const leaves = [{ name: "Asha", start: "2026-07-20", end: "2026-07-22", type: "Vacation" }];
  const row = computeRunway(project, { Asha: dev }, assignments, leaves, LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, TODAY).rows.find((r) => r.role === "Dev");
  assert.equal(row.leaveAdj, 3);
  assert.equal(row.last, "2026-08-13"); // 3 working days later than the leave-free case
});

test("computeRunway leaves unstaffed roles null rather than zero", () => {
  const project = { id: "p1", funding: { start: "2026-07-13", hours: { Dev: 200, PM: 100 }, overrides: {} } };
  const assignments = [{ id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: null, weeklyHours: 40 }];
  const pm = computeRunway(project, { Asha: dev }, assignments, [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, TODAY).rows.find((r) => r.role === "PM");
  assert.equal(pm.headcount, 0);
  assert.equal(pm.weeks, null);
  assert.equal(pm.rag, null);
  assert.equal(pm.last, null);
});

test("runwaySummary picks the role that exhausts first as the binding constraint", () => {
  const rw = {
    end: "2026-08-01",
    totalRemaining: 300,
    rows: [
      { role: "PM", total: 100, override: null, headcount: 1, weeks: 6, rag: "Green" },
      { role: "LD", total: 0, override: null, headcount: 0, weeks: null, rag: null },
      { role: "Dev", total: 200, override: null, headcount: 2, weeks: 1.5, rag: "Red" },
    ],
  };
  const s = runwaySummary(rw);
  assert.equal(s.tightest.role, "Dev");
  assert.equal(s.minWeeks, 1.5);
  assert.equal(s.rag, "Red"); // worst staffed role wins
  assert.equal(s.staffedRoles, 2);
  assert.equal(s.end, "2026-08-01");
});

test("runwaySummary handles no funding and no staffed roles", () => {
  assert.equal(runwaySummary(null), null);
  const s = runwaySummary({ end: null, totalRemaining: 0, rows: [{ role: "Dev", total: 0, override: null, headcount: 0, weeks: null, rag: null }] });
  assert.equal(s.tightest, null);
  assert.equal(s.rag, null);
  assert.equal(s.minWeeks, null);
});

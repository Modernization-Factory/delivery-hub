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

test("computeRunway projects day by day from today and finds the last working date", () => {
  const project = { id: "p1", funding: { start: "2026-07-13", hours: { PM: 0, LD: 0, SD: 0, Dev: 200 }, overrides: {} } };
  const assignments = [{ id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: null, weeklyHours: 40 }];
  const rw = computeRunway(project, { Asha: dev }, assignments, [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, TODAY);
  const row = rw.rows.find((r) => r.role === "Dev");
  assert.equal(rw.from, TODAY); // default projection date is today
  assert.equal(row.headcount, 1);
  assert.equal(row.weeklyBurn, 40);
  assert.equal(row.consumed, 24); // Mon-Wed: up to the day before the projection date
  assert.equal(row.remaining, 176);
  assert.equal(row.days, 22); // 176 h / 8 h, counting today
  assert.equal(row.weeks, 4.4);
  assert.equal(row.rag, "Green");
  assert.equal(row.last, "2026-08-14");
  assert.equal(rw.end, "2026-08-14");
  assert.equal(rw.totalRemaining, 176);
});

test("computeRunway can project from another date", () => {
  const project = { id: "p1", funding: { start: "2026-07-13", hours: { Dev: 200 }, overrides: { Dev: 40 }, overridesAsOf: "2026-07-20" } };
  const assignments = [{ id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: null, weeklyHours: 40 }];
  const rw = computeRunway(project, { Asha: dev }, assignments, [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, TODAY, "2026-07-20");
  assert.equal(rw.from, "2026-07-20");
  assert.equal(rw.rows.find((r) => r.role === "Dev").last, "2026-07-24"); // 40 h = Mon-Fri of that week
});

test("computeRunway honours a manual remaining override and halves burn when split", () => {
  const project = { id: "p1", funding: { start: "2026-07-13", hours: { Dev: 200 }, overrides: { Dev: 40 }, overridesAsOf: TODAY } };
  const assignments = [
    { id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: null, weeklyHours: 40 },
    { id: "a2", name: "Asha", projectId: "p2", from: "2026-07-01", to: null, weeklyHours: 40 },
  ];
  const row = computeRunway(project, { Asha: dev }, assignments, [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, TODAY).rows.find((r) => r.role === "Dev");
  assert.equal(row.override, 40);
  assert.equal(row.remaining, 40);
  assert.equal(row.weeklyBurn, 20); // shared with p2
  assert.equal(row.days, 10); // 4 h a day here
  assert.equal(row.weeks, 2);
  assert.equal(row.rag, "Amber");
});

test("a person's leave delays the date by the hours they lose, not by team-days", () => {
  const project = { id: "p1", funding: { start: "2026-07-20", hours: { Dev: 160 }, overrides: {} } };
  const assignments = [
    { id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: null, weeklyHours: 40 },
    { id: "a2", name: "Ravi", projectId: "p1", from: "2026-07-01", to: null, weeklyHours: 40 },
  ];
  const ppl = { Asha: dev, Ravi: { ...dev, name: "Ravi" } };
  const base = computeRunway(project, ppl, assignments, [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, "2026-07-20").rows.find((r) => r.role === "Dev");
  assert.equal(base.last, "2026-07-31"); // 160 h at 16 h a day = 10 working days
  const leaves = [{ name: "Asha", start: "2026-07-20", end: "2026-07-21", type: "Vacation" }];
  const row = computeRunway(project, ppl, assignments, leaves, LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, "2026-07-20").rows.find((r) => r.role === "Dev");
  assert.equal(row.leaveHours, 16); // Asha's 2 days
  assert.equal(row.last, "2026-08-03"); // one extra team day, not two
  const half = computeRunway(project, ppl, assignments, [{ name: "Asha", start: "2026-07-20", end: "2026-07-23", type: "Half Day" }], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, "2026-07-20").rows.find((r) => r.role === "Dev");
  assert.equal(half.leaveHours, 16); // half of four days
});

test("holidays burn nothing and push the date out", () => {
  const project = { id: "p1", funding: { start: "2026-07-20", hours: { Dev: 40 }, overrides: {} } };
  const assignments = [{ id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: null, weeklyHours: 40 }];
  const row = computeRunway(project, { Asha: dev }, assignments, [], LEAVE_TYPES, WEEKEND, new Set(["2026-07-22"]), "2026-07-20").rows.find((r) => r.role === "Dev");
  assert.equal(row.holidays, 1);
  assert.equal(row.last, "2026-07-27"); // Wed is a holiday: Mon, Tue, Thu, Fri, next Mon
});

test("when assignments end before the hours are used, the team is assumed to carry on and the date is flagged", () => {
  const project = { id: "p1", funding: { start: "2026-07-20", hours: { Dev: 100 }, overrides: {} } };
  const assignments = [{ id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: "2026-07-24", weeklyHours: 40 }];
  const row = computeRunway(project, { Asha: dev }, assignments, [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, "2026-07-20").rows.find((r) => r.role === "Dev");
  assert.equal(row.beyondAssignments, true);
  assert.equal(row.assignmentsEnd, "2026-07-24");
  assert.equal(row.leftAtAssignmentsEnd, 60); // 100 - 5 days x 8 h
  assert.equal(row.last, "2026-08-05"); // 60 h more runs out during the 8th working day after Fri 24 Jul -> Wed 5 Aug
  assert.equal(row.days, 13);
  const inside = computeRunway({ ...project, funding: { ...project.funding, hours: { Dev: 24 } } }, { Asha: dev }, assignments, [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, "2026-07-20").rows.find((r) => r.role === "Dev");
  assert.equal(inside.beyondAssignments, false); // runs out on Wed 22 Jul, inside the assignment
  assert.equal(inside.assignmentsEnd, null);
});

test("consumed hours skip each person's leave days", () => {
  const as = [{ id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: null }];
  const c = consumedByProjectRole(as, { Asha: dev }, "2026-07-13", "2026-07-17", WEEKEND, NO_HOLIDAYS, [{ name: "Asha", start: "2026-07-14", end: "2026-07-14", type: "Vacation" }], LEAVE_TYPES);
  assert.equal(c.p1.Dev, 32); // 4 working days, Tuesday on leave
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

test("computeRunway drops employees marked inactive from the forward headcount", () => {
  const project = { id: "p1", funding: { start: "2026-07-13", hours: { PM: 0, LD: 0, SD: 0, Dev: 200 }, overrides: {} } };
  const assignments = [{ id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: null, weeklyHours: 40 }];
  const rw = computeRunway(project, { Asha: { ...dev, inactive: true } }, assignments, [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, TODAY);
  assert.equal(rw.rows.find((r) => r.role === "Dev").headcount, 0);
});

test("an override is a balance as of its date: viewing later deducts what was burnt, so the date doesn't drift", () => {
  const project = { id: "p1", funding: { start: "2026-07-01", hours: { Dev: 999 }, overrides: { Dev: 80 }, overridesAsOf: "2026-07-20" } };
  const assignments = [{ id: "a1", name: "Asha", projectId: "p1", from: "2026-07-01", to: null, weeklyHours: 40 }];
  const at = (from) => computeRunway(project, { Asha: dev }, assignments, [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, from, from).rows.find((r) => r.role === "Dev");
  assert.equal(at("2026-07-20").remaining, 80);
  assert.equal(at("2026-07-20").last, "2026-07-31"); // 10 working days
  assert.equal(at("2026-07-23").remaining, 56); // Mon-Wed burnt since the as-of date
  assert.equal(at("2026-07-23").last, "2026-07-31"); // same date seen three days later
  const legacy = { ...project, funding: { ...project.funding, overridesAsOf: undefined, start: "2026-07-20" } };
  assert.equal(computeRunway(legacy, { Asha: dev }, assignments, [], LEAVE_TYPES, WEEKEND, NO_HOLIDAYS, "2026-07-23", "2026-07-23").rows.find((r) => r.role === "Dev").remaining, 56); // no as-of: funding start
});

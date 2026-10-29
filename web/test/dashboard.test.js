import test from "node:test";
import assert from "node:assert/strict";
import { dataGaps, leavesBetween, myTimecardTrail, projectsOf, teamOf, timecardLaggards } from "../src/lib/dashboard.js";

const A = (name, projectId, from, to = null) => ({ id: name + projectId, name, projectId, from, to });
const assignments = [A("Me", "p1", "2026-01-01"), A("Ann", "p1", "2026-01-01"), A("Bob", "p2", "2026-01-01"), A("Cat", "p1", "2026-01-01", "2026-03-01"), A("Dan", "p3", "2026-01-01")];

test("teamOf is everyone on my projects today, plus projects I PM, excluding me and ended assignments", () => {
  assert.deepEqual([...teamOf(assignments, [], "Me", "2026-10-29")].sort(), ["Ann"]);
  assert.deepEqual([...teamOf(assignments, [{ id: "p3", pm: "Me" }], "Me", "2026-10-29")].sort(), ["Ann", "Dan"]);
  assert.deepEqual(projectsOf(assignments, "Me", "2026-10-29"), ["p1"]);
});

test("leavesBetween keeps overlapping leaves for the given names, soonest first", () => {
  const leaves = [
    { name: "Ann", start: "2026-11-03", end: "2026-11-04" },
    { name: "Bob", start: "2026-10-30", end: "2026-10-30" },
    { name: "Ann", start: "2026-10-28", end: "2026-10-30" },
    { name: "Ann", start: "2026-12-01", end: "2026-12-01" },
  ];
  const got = leavesBetween(leaves, "2026-10-29", "2026-11-11", new Set(["Ann"]));
  assert.deepEqual(got.map((l) => l.start), ["2026-10-28", "2026-11-03"]);
});

test("timecardLaggards lists problem statuses and skips untracked JIRA", () => {
  const rows = [
    { id: "a", name: "Ann", weeks: [["Proactive", "Not Updated"]] },
    { id: "b", name: "Bob", weeks: [["Proactive", "Chased"]] }, // JIRA untracked that week
    { id: "c", name: "Cat", weeks: [["Proactive", "Proactive"]] },
  ];
  const got = timecardLaggards(rows, 0, { b: [false] });
  assert.deepEqual(got, [{ name: "Ann", bad: [["JIRA", "Not Updated"]] }]);
});

test("myTimecardTrail returns the last n weeks and a proactive % excluding N/A", () => {
  const row = { weeks: [["Chased", "Chased"], ["Proactive", "N/A"], ["Proactive", "Chased"]] };
  const t = myTimecardTrail(row, ["w1", "w2", "w3"], 2, null);
  assert.deepEqual(t.trail.map((x) => x.week), ["w2", "w3"]);
  assert.equal(t.pct, 67); // 2 proactive of 3 filled (N/A excluded)
  assert.equal(myTimecardTrail(null, [], 8), null);
});

test("dataGaps counts only active employees and open projects", () => {
  const g = dataGaps(
    [{ email: "", role: "Developer" }, { email: "a@x", role: "" }, { email: "", role: "", inactive: true }],
    [{ pm: null, start: "2026-01-01", end: "2026-12-31" }, { pm: "X" }, { pm: null, closedAt: "2026-06-01" }],
  );
  assert.deepEqual(g, { noEmail: 1, noRole: 1, noPm: 1, noDates: 1 });
});

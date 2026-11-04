import test from "node:test";
import assert from "node:assert/strict";
import { canBeTeamManager, isTeamManager, managerOptions, managersAbove, reporteesOf, reportingChain, reportingError } from "../src/lib/reporting.js";

// A small org:   Asha (mgr) ─┬─ Ravi (mgr) ─── Neha
//                            └─ Kiran
//                Mia (PM)     Old (mgr, inactive) ─── Sam
const E = (id, o = {}) => ({ id, name: id, role: "Developer", isAdmin: false, inactive: false, teamManager: false, managerId: null, ...o });
const org = () => [
  E("Asha", { role: "Lead Developer", teamManager: true }),
  E("Ravi", { teamManager: true, managerId: "Asha" }),
  E("Neha", { managerId: "Ravi" }),
  E("Kiran", { managerId: "Asha" }),
  E("Mia", { role: "Project Manager" }),
  E("Old", { teamManager: true, inactive: true }),
  E("Sam", { managerId: "Old" }),
  E("Vic", { role: "Developer", viewer: true }),
];
const ids = (s) => [...s].sort();

test("PMs and Admins can't be team managers; everyone else can, Viewers included", () => {
  assert.equal(canBeTeamManager(E("x")), true);
  assert.equal(canBeTeamManager(E("x", { role: "Senior Developer" })), true);
  assert.equal(canBeTeamManager(E("x", { role: "Lead Developer" })), true);
  assert.equal(canBeTeamManager(E("x", { viewer: true })), true);
  assert.equal(canBeTeamManager(E("x", { role: "Project Manager" })), false);
  assert.equal(canBeTeamManager(E("x", { isAdmin: true })), false);
  // a stale flag on someone who has since become a PM or Admin doesn't count
  assert.equal(isTeamManager(E("x", { teamManager: true, role: "Project Manager" })), false);
  assert.equal(isTeamManager(E("x", { teamManager: true, isAdmin: true })), false);
});

test("reportingChain is the whole chain below, not just direct reportees", () => {
  assert.deepEqual(ids(reportingChain(org(), "Asha")), ["Kiran", "Neha", "Ravi"]);
  assert.deepEqual(ids(reportingChain(org(), "Ravi")), ["Neha"]);
  assert.deepEqual(ids(reportingChain(org(), "Neha")), []);
  assert.deepEqual(reporteesOf(org(), "Asha").map((e) => e.id).sort(), ["Kiran", "Ravi"]);
});

test("managersAbove lists the managers nearest first", () => {
  assert.deepEqual(managersAbove(org(), "Neha"), ["Ravi", "Asha"]);
  assert.deepEqual(managersAbove(org(), "Kiran"), ["Asha"]);
  assert.deepEqual(managersAbove(org(), "Asha"), []);
});

test("a loop already in stored data doesn't hang either walk", () => {
  const loop = [E("A", { teamManager: true, managerId: "B" }), E("B", { teamManager: true, managerId: "A" })];
  assert.deepEqual(ids(reportingChain(loop, "A")), ["B"]);
  assert.deepEqual(managersAbove(loop, "A"), ["B"]);
  const self = [E("A", { teamManager: true, managerId: "A" })];
  assert.deepEqual(ids(reportingChain(self, "A")), []);
  assert.deepEqual(managersAbove(self, "A"), []);
});

test("managerOptions: active flagged managers only, never yourself or anyone below you", () => {
  assert.deepEqual(managerOptions(org(), E("New")).map((e) => e.id), ["Asha", "Ravi"]); // Old is inactive; Mia isn't flagged
  assert.deepEqual(managerOptions(org(), org()[0]).map((e) => e.id), []); // Asha: Ravi is below her
  assert.deepEqual(managerOptions(org(), org()[1]).map((e) => e.id), ["Asha"]); // Ravi: not himself
});

test("reportingError allows ordinary changes", () => {
  const es = org();
  assert.equal(reportingError(es, { ...es[3], managerId: "Ravi" }), null); // Kiran moves under Ravi
  assert.equal(reportingError(es, { ...es[2], managerId: null }), null); // Neha has no manager
  assert.equal(reportingError(es, { ...es[7], teamManager: true }), null); // a Viewer can be flagged
  assert.equal(reportingError(es, { ...E("New"), id: null, managerId: "Asha" }), null); // new employee
  assert.equal(reportingError(es, { ...es[6], name: "Sam renamed" }), null); // keeping an inactive manager is allowed
});

test("reportingError blocks every rule break with a reason", () => {
  const es = org();
  const err = (x) => (reportingError(es, x) || {}).error;
  assert.equal(err({ ...es[4], teamManager: true }), "team_manager_ineligible"); // a PM
  assert.equal(err({ ...es[3], teamManager: true, isAdmin: true }), "team_manager_ineligible"); // an Admin
  assert.equal(err({ ...es[0], role: "Project Manager" }), "team_manager_ineligible"); // flagged person promoted to PM
  assert.equal(err({ ...es[1], teamManager: false }), "has_reportees"); // Ravi still has Neha
  assert.match(reportingError(es, { ...es[1], teamManager: false }).detail, /Neha still reports to Ravi/);
  assert.equal(err({ ...es[2], managerId: "Neha" }), "self_manager");
  assert.equal(err({ ...es[2], managerId: "Ghost" }), "manager_not_found");
  assert.equal(err({ ...es[2], managerId: "Kiran" }), "manager_not_flagged");
  assert.equal(err({ ...es[2], managerId: "Mia" }), "manager_not_flagged"); // a PM can't be reported to
  assert.equal(err({ ...es[2], managerId: "Old" }), "manager_inactive"); // can't newly pick an inactive manager
  assert.equal(err({ ...es[0], managerId: "Ravi" }), "reporting_loop"); // Asha under her own reportee
  assert.equal(err({ ...es[1], managerId: "Ravi" }), "self_manager");
});

// The API keeps its own copy of these rules (api/src/rules.js). Run both on the same cases so
// the server can never accept a reporting change the app refuses, or the other way round.
test("the API's copy of the reporting rules gives the same answers", async () => {
  const { createRequire } = await import("node:module");
  const R = createRequire(import.meta.url)("../../api/src/rules.js");
  const es = org();
  const cases = [
    { ...es[3], managerId: "Ravi" }, { ...es[4], teamManager: true }, { ...es[1], teamManager: false },
    { ...es[2], managerId: "Neha" }, { ...es[2], managerId: "Ghost" }, { ...es[2], managerId: "Kiran" },
    { ...es[2], managerId: "Old" }, { ...es[0], managerId: "Ravi" }, { ...es[7], teamManager: true },
    { ...E("New"), id: null, managerId: "Asha" }, { ...es[5], teamManager: false },
  ];
  for (const c of cases) assert.deepEqual(R.reportingError(es, c), reportingError(es, c), JSON.stringify(c));
  for (const e of es) {
    assert.deepEqual(ids(R.reportingChain(es, e.id)), ids(reportingChain(es, e.id)), e.id);
    assert.deepEqual(R.managersAbove(es, e.id), managersAbove(es, e.id), e.id);
    assert.equal(R.isTeamManager(e), isTeamManager(e), e.id);
  }
});

test("unflagging is blocked only while someone still reports to them", () => {
  const es = org();
  // an inactive manager still holds their reportees until they're reassigned
  assert.deepEqual(reportingError(es, { ...es[5], teamManager: false }), { error: "has_reportees", detail: "Sam still reports to Old — assign them another manager first." });
  const lone = [E("Solo", { teamManager: true })];
  assert.equal(reportingError(lone, { ...lone[0], teamManager: false }), null);
});

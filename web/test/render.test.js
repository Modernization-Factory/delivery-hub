// Smoke-renders every screen. The views are JSX, so they are bundled with the
// esbuild that ships inside vite (no new dependency) and then rendered to a
// string — which catches missing imports and bad references that a bundle-only
// build cannot see.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundle = path.join(root, "node_modules/.cache/render-harness.mjs");

execFileSync(path.join(root, "node_modules/.bin/esbuild"), [
  path.join(root, "test/render-harness.jsx"),
  "--bundle", "--format=esm", "--platform=node", "--jsx=automatic",
  "--outfile=" + bundle,
  "--external:react", "--external:react-dom", "--external:xlsx", "--external:lucide-react",
], { stdio: "pipe" });

const harness = await import(bundle);

for (const name of Object.keys(harness.SCREENS)) {
  test(name + " renders without throwing", () => {
    const html = harness.renderScreen(name);
    assert.ok(html.length > 200, name + " rendered suspiciously little markup");
  });
}

// The Working Days tab nets leave and comp-off across the whole team, so it is a PM / Admin
// tool: the button must not exist for anyone else, not merely be disabled.
test("the Working Days tab is offered to PM / Admin only", () => {
  assert.ok(harness.renderScreen("AllocationsView").includes("Working Days"), "a PM should see the tab");
  assert.ok(!harness.renderScreen("AllocationsViewAsLead").includes("Working Days"), "a Lead should not see the tab");
  assert.ok(!harness.renderScreen("AllocationsViewAsViewer").includes("Working Days"), "a Viewer should not see the tab");
});

test("the Working Days by-type split lists a leave type that isn't in settings", () => {
  const html = harness.renderScreen("AllocationsWorkingDaysOffList");
  assert.ok(html.includes("Tentative"), "the off-list type should get its own chip");
  assert.ok(html.includes("not in settings"), "and be labelled as off-list");
});

// Developers log their own comp-off; they must never see another person's entry or the
// controls for managing everyone's (company filter, name search, employee picker).
test("a Developer / Senior Developer comp-off page shows only their own entries", () => {
  for (const screen of ["CompOffLogDeveloper", "CompOffLogSeniorDev"]) {
    const html = harness.renderScreen(screen);
    assert.ok(html.includes("My Comp-Off"), screen + ": own-only heading");
    assert.ok(html.includes("release"), screen + ": their own entry is listed");
    assert.ok(!html.includes("ravi-weekend") && !html.includes("Ravi"), screen + ": someone else's entry leaked");
    assert.ok(!html.includes("All companies") && !html.includes("Search name"), screen + ": ledger filters shown");
    assert.ok(!html.includes(">Employee<"), screen + ": employee picker / column shown");
  }
  const pm = harness.renderScreen("CompOffLog");
  assert.ok(pm.includes("Comp-off ledger") && pm.includes("All companies") && pm.includes(">Employee<"), "a PM keeps the full ledger");
});

test("Employees shows reporting lines, team managers and reportees of an inactive manager", () => {
  // server rendering puts <!-- --> between adjacent text pieces; drop them to match on the visible text
  const html = harness.renderScreen("EmployeesWithReporting").replace(/<!-- -->/g, "");
  assert.ok(html.includes("Reports to"), "Reports to column");
  assert.ok(html.includes("Team Manager · 1"), "Ravi flagged with one reportee");
  assert.ok(html.includes("manager inactive"), "Mia's manager is inactive");
  assert.ok(html.includes("1 active person reports to an inactive manager — Mia (Old Hand)"), "reassignment warning");
});

// A team manager sees only their chain, so whole-team numbers and whole-team actions go.
test("a flagged team manager doesn't get project burn or whole-team timecard actions", () => {
  assert.ok(harness.renderScreen("AllocationsView").includes("Projected Burn"), "an unflagged PM keeps Projected Burn");
  const alloc = harness.renderScreen("AllocationsViewAsTeamManager");
  assert.ok(!alloc.includes("Projected Burn"), "Projected Burn hidden");
  assert.ok(alloc.includes("Roster"), "Plan / Roster stay");
  const tm = harness.renderScreen("TimecardGridAsTeamManager");
  assert.ok(!tm.includes("Import weekly file") && !tm.includes("Add week"), "a flagged Lead has no import / add week");
});

// Only PMs and Admins change timecards — a Lead sees the grid but can't import, add a week or edit.
test("timecard import / add week / editing are PM and Admin only", () => {
  const pm = harness.renderScreen("TimecardGridAsPM");
  assert.ok(pm.includes("Import weekly file") && pm.includes("Add week"), "a PM imports and adds weeks");
  // the status cells are the only selects styled "cursor-pointer appearance-none"
  assert.ok(pm.includes("cursor-pointer appearance-none"), "a PM gets editable status cells");
  const lead = harness.renderScreen("TimecardGridAsLead");
  assert.ok(lead.includes("Timecard") && !lead.includes("Import weekly file") && !lead.includes("Add week"), "a Lead sees the grid but can't import or add a week");
  assert.ok(!lead.includes("cursor-pointer appearance-none"), "a Lead gets no editable status cells");
});

test("the permission matrix shows the Team Manager column", () => {
  const html = harness.renderScreen("AdminPanel").replace(/<!-- -->/g, "");
  assert.ok(html.includes(">Team Manager<"), "Team Manager column header");
});

// Approval: the queue shows only for someone who may decide the entry (a manager above the
// person, or an Admin) — never for the person themselves, and not for an unflagged PM.
test("comp-off approvals appear for the manager above and for Admin only", () => {
  const txt = (n) => harness.renderScreen(n).replace(/<!-- -->/g, "");
  const mgr = txt("CompOffApprovalsManager");
  assert.ok(mgr.includes("Waiting for your approval — 1 entry") && mgr.includes("Approve") && mgr.includes("weekend-fix"), "Ravi sees Asha's entry");
  assert.ok(txt("CompOffApprovalsAdmin").includes("Waiting for your approval"), "an Admin approves anyone");
  assert.ok(!txt("CompOffApprovalsPM").includes("Waiting for your approval"), "an unflagged PM doesn't approve");
  const own = txt("CompOffOwnPending");
  assert.ok(!own.includes("Waiting for your approval"), "nobody approves their own");
  assert.ok(own.includes("Waiting for approval") && own.includes(">Pending<"), "the Developer sees their entry as pending");
  assert.ok(own.includes("waits for approval by Ravi (or a manager above them, or an Admin)"), "and who will approve it");
  assert.ok(!txt("CompOffOwnPendingAsManager").includes("Waiting for your approval"), "a manager can't approve their own entry");
});

test("the comp-off summary gives each resource earned / pending / used / balance", () => {
  const html = harness.renderScreen("CompOffSummaryView").replace(/<!-- -->/g, "");
  assert.ok(html.includes("Comp-off by resource") && html.includes("Pending approval"), "summary renders");
  assert.ok(html.includes(">Asha<") && html.includes(">Ravi<"), "one row per resource");
  assert.ok(html.includes("1 entry"), "pending entry count");
});

test("the external links card says the links are for Admins only", () => {
  const html = harness.renderScreen("AdminPanel").replace(/<!-- -->/g, "");
  assert.ok(html.includes("in Admins' sidebar only") || html.includes("in Admins&#x27; sidebar only"), "Admin-only wording");
  assert.ok(!html.includes("everyone's sidebar") && !html.includes("everyone&#x27;s sidebar"), "old wording gone");
});

test("the harness covers every screen module in src/views", async () => {
  const fs = await import("node:fs");
  const views = fs.readdirSync(path.join(root, "src/views")).filter((f) => f.endsWith(".jsx"));
  assert.equal(views.length, 19);
  assert.ok(Object.keys(harness.SCREENS).length >= views.length);
});

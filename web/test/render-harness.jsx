// Bundled by render.test.js: renders every screen with a realistic ctx so a
// missing import or a bad reference inside a view fails loudly, not in the browser.
import { renderToString } from "react-dom/server";
import { defaultPerms, canDo, effectiveCan } from "../src/lib/permissions.js";
import { AdminPanel } from "../src/views/Admin.jsx";
import { AllLeaveRecords } from "../src/views/AllLeaveRecords.jsx";
import { AllocationsView, WorkingDaysReport } from "../src/views/Allocations.jsx";
import { ComingSoon } from "../src/views/ComingSoon.jsx";
import { CompOffLog, CompOffSummary } from "../src/views/CompOffLog.jsx";
import { Dashboard } from "../src/views/Dashboard.jsx";
import { EmployeesView } from "../src/views/Employees.jsx";
import { LeaveMonthly, LeaveReports } from "../src/views/LeaveReports.jsx";
import { FlaggedResources } from "../src/ui/FlaggedResources.jsx";
import { LoginLive } from "../src/views/Login.jsx";
import { MyLeave } from "../src/views/MyLeave.jsx";
import { PerformanceView } from "../src/views/Performance.jsx";
import { ProgramHealthView, ProjectHealthDetail } from "../src/views/ProgramHealth.jsx";
import { ProjectsView } from "../src/views/Projects.jsx";
import { RunwayView } from "../src/views/Runway.jsx";
import { SettingsView } from "../src/views/Settings.jsx";
import { TeamCalendar } from "../src/views/TeamCalendar.jsx";
import { TeamPlansView } from "../src/views/TeamPlans.jsx";
import { TimecardGrid } from "../src/views/TimecardGrid.jsx";
import { TimecardInsights } from "../src/views/TimecardInsights.jsx";

const TODAY = "2026-07-16";
const employees = [
  { id: "e0", name: "Asha", role: "Developer", company: "WeKan", start: "2026-01-01", term: null },
  { id: "e1", name: "Ravi", role: "Lead Developer", company: "Ciklum", start: "2026-01-01", term: null },
  { id: "e2", name: "Mia", role: "Project Manager", company: "MongoDB", start: "2026-01-01", term: null },
];
const projects = [
  { id: "p0", name: "OPUSM", phases: ["R1", "R2"], streams: ["Bugs", "PM"], trackJira: true, description: "core", linkLabel: "SOW", linkUrl: "https://example.com",
    start: "2026-01-01", end: "2026-12-31", targetMargin: 35, currentMargin: 30, pm: "Mia", currentPhase: "R1", totalStories: 100, doneStories: 40, keyUpdate: "on track",
    funding: { start: "2026-07-01", hours: { PM: 100, LD: 200, SD: 0, Dev: 400 }, overrides: { PM: null, LD: null, SD: null, Dev: null } } },
  { id: "p1", name: "Bendigo", phases: [], streams: [], trackJira: false, start: "2026-02-01", end: "2026-06-30", pm: null, funding: null },
];
const noop = () => {};
const ctx = {
  user: { name: "Mia", role: "Project Manager", email: "mia@example.com" },
  employees, empByName: Object.fromEntries(employees.map((e) => [e.name, e])),
  leaves: [{ id: "l0", name: "Asha", start: "2026-07-20", end: "2026-07-22", type: "Vacation" }],
  comps: [{ id: "c0", name: "Asha", date: "2026-07-18", days: 1, reason: "release" }],
  tcRows: [{ id: "e0", name: "Asha", release: "R1", remarks: "", weeks: [["Proactive", "Chased"], ["Proactive", "Proactive"]], notes: { 0: { comment: "chased for JIRA", by: "Mia", at: "2026-07-11" } } }],
  tcWeeks: ["2026-07-11", "2026-07-18"],
  leaveTypes: [{ name: "Vacation", value: 1 }, { name: "Sick", value: 1 }, { name: "Unpaid", value: 1 }, { name: "Half Day", value: 0.5 }, { name: "Comp-Off", value: 1 }],
  weekendDays: [0, 6], holidays: ["2026-07-17"], holidaySet: new Set(["2026-07-17"]),
  assignments: [
    { id: "a0", name: "Asha", projectId: "p0", phase: "R1", stream: "Bugs", from: "2026-01-01", to: null, weeklyHours: 40 },
    { id: "a1", name: "Ravi", projectId: "p0", phase: "R2", stream: "PM", from: "2026-01-01", to: "2026-09-30", weeklyHours: 48 },
  ],
  projects, jiraFlags: { e0: [true, true] },
  scores: [{ id: "s0", name: "Asha", week: "2026-07-11", m: [4, 4, 4, 4, 4, 4] }],
  perfCfg: { weights: [20, 20, 15, 20, 15, 10], green: 4, amber: 3, partnerOnly: false },
  perms: defaultPerms(), can: (cap) => canDo(defaultPerms(), "Project Manager", cap),
  extLinks: [{ id: "x0", label: "Wiki", url: "https://example.com", note: "" }],
  plans: [{ id: "pl0", name: "R2 plan", projectId: "p0", phase: "R2", startYm: "2026-07", monthsCount: 3, mult: 20, multOverrides: {}, status: "Active",
    rows: [{ id: "r0", stream: "Bugs", task: "triage", res: [1, 1, 1], est: 50 }] }],
  empFields: [{ id: "f0", label: "Location", type: "text" }],
  raid: [{ id: "r0", projectId: "p0", type: "Risk", desc: "vendor delay", impact: "H", probability: "M", owner: "Mia", targetDate: "2026-07-01", status: "Open", link: "", comments: "" }],
  milestones: [{ id: "m0", projectId: "p0", name: "UAT", phase: "R1", planned: "2026-07-01", actual: "", status: "In Progress", rag: "Amber", comments: "" }],
  weeklyHealth: [{ id: "w0", projectId: "p0", week: "2026-07-11", hoursPlanned: 100, hoursBurnt: 120, scopeChanges: true, rag: "Amber", oneLiner: "scope grew" }],
  pipeline: [{ id: "pp0", company: "Acme", stage: "POC", potentialStart: "Q4", potentialResources: 3, commentary: "", nextAction: "call" }],
  todayISO: TODAY, canManage: true, canConfigure: true, isDev: false, isAdmin: true,
  nextId: (p) => p + "-new", setNav: noop, uploadTimecardFile: noop,
};
ctx.allEmployees = [...ctx.employees, { id: "e9", name: "Old Hand", role: "Developer", company: "MDB", start: "2025-01-01", term: null, inactive: true }];
for (const k of ["setTcWeeks", "setAssignments", "setProjects", "setScores", "setPerfCfg", "setPerms", "setExtLinks", "setPlans", "setEmpFields", "setRaid", "setMilestones", "setWeeklyHealth", "setPipeline", "setLeaves", "setComps", "setTcRows", "setTcFlag", "setEmployees", "setLeaveTypes", "setWeekendDays", "setHolidays"]) ctx[k] = noop;

// the drill-down behind a Program Health tile, rendered straight from a derived row
const healthEntries = ctx.weeklyHealth;
const healthRow = {
  p: projects[0], entries: healthEntries, el: 0.54, sv: { completion: 0.4, variance: -0.14 }, bv: 0.2,
  lw: healthEntries[0], hr: 1, ms: ctx.milestones, nextMs: ctx.milestones[0], overdue: 1,
  st: { status: "Amber", derived: "Red", reasons: ["burn 20% over plan"], fromPM: true },
};

// the same fixtures seen through another role's permissions
const asRole = (name, role) => ({ ...ctx, user: { name, role, email: name.toLowerCase() + "@example.com" }, can: (cap) => canDo(defaultPerms(), role, cap) });
// an org where Ravi (e1, flagged) manages Asha (e0); `id` is the signed-in person
const pendingAsha = { id: "c7", name: "Asha", date: "2026-07-11", days: 1, reason: "weekend-fix", status: "pending", createdBy: "Asha" };
const withOrg = (c, id, comps) => {
  const es = [{ ...employees[0], managerId: "e1" }, { ...employees[1], teamManager: true }, employees[2]];
  return { ...c, user: { ...c.user, id }, employees: es, allEmployees: es, empByName: Object.fromEntries(es.map((e) => [e.name, e])), comps };
};
// a flagged team manager: their role plus the Team Manager column, project screens off
const asManager = (name, role) => ({ ...ctx, user: { name, role, email: name.toLowerCase() + "@example.com", teamManager: true }, can: (cap) => effectiveCan(defaultPerms(), role, true, cap) });
ctx.assignments = ctx.assignments || [];
export const SCREENS = {
  Dashboard: () => Dashboard(ctx),
  MyLeave: () => MyLeave(ctx),
  TeamCalendar: () => TeamCalendar(ctx),
  AllLeaveRecords: () => AllLeaveRecords(ctx),
  LeaveReports: () => LeaveReports(ctx),
  DashboardDeveloper: () => Dashboard(asRole("Asha", "Developer")),
  DashboardLead: () => Dashboard(asRole("Ravi", "Lead")),
  DashboardAdmin: () => Dashboard(asRole("Dushyant", "Admin")),
  ProjectsWithClosed: () => ProjectsView({ ...ctx, allProjects: [...ctx.projects, { ...ctx.projects[1], id: "p9", name: "Old Job", closedAt: "2026-06-30", closedBy: "Mia", closureNote: "delivered" }] }),
  LeaveTrend: () => LeaveMonthly({ ...ctx, mode: "trend" }),
  LeaveByResource: () => LeaveMonthly({ ...ctx, mode: "resource" }),
  FlaggedResources: () => FlaggedResources({ ...ctx, onEdit: noop }),
  CompOffLog: () => CompOffLog(ctx),
  // a Developer's own-only view, fed a list that (wrongly) also holds someone else's entry
  CompOffLogDeveloper: () => CompOffLog({ ...asRole("Asha", "Developer"), comps: [...ctx.comps, { id: "c1", name: "Ravi", date: "2026-07-11", days: 1, reason: "ravi-weekend" }] }),
  // approvals: Ravi (flagged Lead) manages Asha, who self-logged a weekend that's waiting
  CompOffApprovalsManager: () => CompOffLog(withOrg(asManager("Ravi", "Lead"), "e1", [pendingAsha])),
  CompOffApprovalsAdmin: () => CompOffLog(withOrg(asRole("Dushyant", "Admin"), "e9", [pendingAsha])),
  CompOffApprovalsPM: () => CompOffLog(withOrg(asRole("Mia", "Project Manager"), "e2", [pendingAsha])),
  CompOffOwnPending: () => CompOffLog(withOrg(asRole("Asha", "Developer"), "e0", [pendingAsha])),
  CompOffOwnPendingAsManager: () => CompOffLog(withOrg(asManager("Ravi", "Lead"), "e1", [{ ...pendingAsha, id: "c8", name: "Ravi" }])),
  CompOffSummaryView: () => CompOffSummary({ ...ctx, team: "All", q: "", coOf: () => "WeKan", comps: [...ctx.comps, pendingAsha, { id: "c9", name: "Ravi", date: "2026-07-04", days: 0.5, reason: "", status: "approved" }] }),
  CompOffLogSeniorDev: () => CompOffLog({ ...asRole("Asha", "Senior Developer"), comps: [...ctx.comps, { id: "c1", name: "Ravi", date: "2026-07-11", days: 1, reason: "ravi-weekend" }] }),
  TimecardGrid: () => TimecardGrid(ctx),
  TimecardInsights: () => TimecardInsights(ctx),
  AllocationsView: () => AllocationsView(ctx),
  AllocationsViewAsLead: () => AllocationsView(asRole("Ravi", "Lead")),
  AllocationsViewAsViewer: () => AllocationsView(asRole("Vic", "Viewer")),
  AllocationsViewAsTeamManager: () => AllocationsView(asManager("Ravi", "Lead")),
  TimecardGridAsLead: () => TimecardGrid(asRole("Ravi", "Lead")),
  TimecardGridAsTeamManager: () => TimecardGrid(asManager("Ravi", "Lead")),
  DashboardTeamManager: () => Dashboard(asManager("Asha", "Developer")),
  AllocationsWorkingDays: () => WorkingDaysReport(ctx),
  // an imported leave whose type is no longer in settings must still show in the by-type split
  AllocationsWorkingDaysOffList: () => WorkingDaysReport({ ...ctx, leaves: [...ctx.leaves, { id: "l9", name: "Ravi", start: "2026-07-21", end: "2026-07-21", type: "Tentative" }] }),
  ProgramHealthView: () => ProgramHealthView(ctx),
  TeamPlansView: () => TeamPlansView(ctx),
  PerformanceView: () => PerformanceView(ctx),
  RunwayView: () => RunwayView(ctx),
  ProjectsView: () => ProjectsView(ctx),
  EmployeesView: () => EmployeesView(ctx),
  // Ravi manages Asha; Old Hand (inactive) still has Mia reporting to him
  EmployeesWithReporting: () => EmployeesView({ ...ctx, allEmployees: [
    { ...employees[0], managerId: "e1" }, { ...employees[1], teamManager: true }, { ...employees[2], managerId: "e9" },
    { id: "e9", name: "Old Hand", role: "Developer", company: "MDB", start: "2025-01-01", term: null, inactive: true, teamManager: true },
  ] }),
  SettingsView: () => SettingsView(ctx),
  AdminPanel: () => AdminPanel(ctx),
  ComingSoon: () => ComingSoon({ id: "reports", role: "Project Manager" }),
  LoginLive: () => LoginLive({ onEnter: noop }),
  ProjectHealthDetail: () => ProjectHealthDetail({ row: healthRow, onBack: noop, marginsVisible: true, todayISO: TODAY, raid: ctx.raid, canRegister: true, canTarget: true, onSave: noop }),
};
export function renderScreen(name) {
  const Comp = SCREENS[name];
  return renderToString(<Comp />);
}

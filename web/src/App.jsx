import { useState, useMemo, useEffect } from "react";
import { api, setIdentity, getIdentity } from "./api";
import { LayoutDashboard, Plane, CalendarDays, ListChecks, BarChart3, Clock, Table, TrendingUp, GitBranch, FolderKanban, Gauge, Hourglass, Users, Settings as SettingsIcon, Shield, Lock, ExternalLink, ClipboardList, Activity } from "lucide-react";
import { STREAMS, activeAssignmentsOn } from "./lib/allocations.js";
import { MODULES_V2, SEED } from "./lib/constants.js";
import { toISO } from "./lib/dates.js";
import { canDo, defaultPerms, mergePerms } from "./lib/permissions.js";
import { Notice } from "./ui/atoms.jsx";
import { BRAND_CSS, BRAND_FONT, Leaf } from "./ui/brand.jsx";
import { AdminPanel } from "./views/Admin.jsx";
import { AllLeaveRecords } from "./views/AllLeaveRecords.jsx";
import { AllocationsView } from "./views/Allocations.jsx";
import { ComingSoon } from "./views/ComingSoon.jsx";
import { CompOffLog } from "./views/CompOffLog.jsx";
import { Dashboard } from "./views/Dashboard.jsx";
import { EmployeesView } from "./views/Employees.jsx";
import { LeaveReports } from "./views/LeaveReports.jsx";
import { LoginLive } from "./views/Login.jsx";
import { MyLeave } from "./views/MyLeave.jsx";
import { PerformanceView } from "./views/Performance.jsx";
import { ProgramHealthView } from "./views/ProgramHealth.jsx";
import { ProjectsView } from "./views/Projects.jsx";
import { RunwayView } from "./views/Runway.jsx";
import { SettingsView } from "./views/Settings.jsx";
import { TeamCalendar } from "./views/TeamCalendar.jsx";
import { TeamPlansView } from "./views/TeamPlans.jsx";
import { TimecardGrid } from "./views/TimecardGrid.jsx";
import { TimecardInsights } from "./views/TimecardInsights.jsx";

// ============================================================
// ROOT APP
// ============================================================
export default function App() {
  // ---- normalize seed into stateful stores ----
  const [employees, setEmployees0] = useState(() =>
    SEED.E.map(([name, role, company, start, term], i) => ({ id: "e" + i, name, role, company, start, term }))
  );
  const [leaves, setLeaves0] = useState(() =>
    SEED.L.map(([name, start, end, type], i) => ({ id: "l" + i, name, start, end, type }))
  );
  const [comps, setComps0] = useState(() =>
    SEED.C.map(([name, date, days, reason], i) => ({ id: "c" + i, name, date, days, reason }))
  );
  const [tcRows, setTcRows0] = useState(() =>
    SEED.T.map(([name, release, remarks, weeks], i) => ({ id: "t" + i, name, release, remarks, weeks: weeks.map((w) => [...w]) }))
  );
  const [leaveTypes, setLeaveTypes0] = useState([
    { name: "Vacation", value: 1 },
    { name: "Sick", value: 1 },
    { name: "Unpaid", value: 1 },
    { name: "Half Day", value: 0.5 },
    { name: "Comp-Off", value: 1 },
  ]);
  const [weekendDays, setWeekendDays0] = useState([0, 6]); // Sun, Sat
  const [holidays, setHolidays0] = useState(SEED.H);
  const [tcWeeks, setTcWeeks0] = useState(SEED.W);
  const [projects, setProjects0] = useState([{ id: "p0", name: "OPUSM", phases: ["R1", "R2"], trackJira: true, streams: [...new Set([...STREAMS, "PM", "Refactoring"])], description: "", linkLabel: "", linkUrl: "" }]);
  const [assignments, setAssignments0] = useState(() => {
    const relOf = Object.fromEntries(SEED.E.map((e) => [e[0], e[5] || null]));
    return (SEED.A || []).map(([name, stream, from, to], i) => ({ id: "a" + i, name, projectId: "p0", phase: relOf[name] || null, stream, from, to: to || null }));
  });
  const holidaySet = useMemo(() => new Set(holidays), [holidays]);

  // ======================= LIVE SYNC LAYER =======================
  const [booted, setBooted] = useState(false);
  const [syncErr, setSyncErr] = useState(null);
  const [srvMaps, setSrvMaps] = useState({ empIdByName: {}, tcDocIds: {} });
  const fire = (p) => p.catch((e) => setSyncErr(e.message || String(e)));
  const dstr = (x) => (x ? String(x).slice(0, 10) : null);

  async function loadLeaves(empNameById) {
    const ls = await api("/leaves").catch((e) => (e.status === 403 ? api("/leaves?mine=1") : Promise.reject(e)));
    setLeaves0(ls.map((l) => ({ id: String(l.id), name: empNameById[String(l.employeeId)], start: dstr(l.start), end: dstr(l.end), type: l.type })).filter((l) => l.name));
  }
  async function loadComps(empNameById) {
    const cs = await api("/compoffs").catch((e) => (e.status === 403 ? api("/compoffs?mine=1") : Promise.reject(e)));
    setComps0(cs.map((c) => ({ id: String(c._id), name: empNameById[String(c.employeeId)], date: dstr(c.dateWorked), days: c.days, reason: c.reason || "" })).filter((c) => c.name));
  }
  async function loadTimecards(empNameById) {
    const docs = await api("/timecards").catch((e) => (e.status === 403 ? api("/timecards?mine=1") : Promise.reject(e)));
    const weeks = [...new Set(docs.map((d) => dstr(d.week)))].sort();
    const wIdx = Object.fromEntries(weeks.map((w, i) => [w, i]));
    const rowsByEmp = {};
    const docIds = {};
    docs.forEach((d) => {
      const eid2 = String(d.employeeId);
      const name = empNameById[eid2];
      if (!name) return;
      const r = (rowsByEmp[eid2] = rowsByEmp[eid2] || { id: eid2, name, release: d.release || "", remarks: d.remarks || "", weeks: weeks.map(() => ["", ""]), notes: {} });
      if (d.release) r.release = d.release;
      if (d.remarks) r.remarks = d.remarks;
      r.weeks[wIdx[dstr(d.week)]] = [d.sf || "", d.jira || ""];
      if (d.flag) r.notes[wIdx[dstr(d.week)]] = { comment: d.flag.comment || "", by: d.flag.by || "", at: dstr(d.flag.at) };
      (docIds[eid2] = docIds[eid2] || {})[dstr(d.week)] = String(d._id);
    });
    setTcWeeks0(weeks);
    setTcRows0(Object.values(rowsByEmp).sort((a, b) => a.name.localeCompare(b.name)));
    setSrvMaps((m) => ({ ...m, tcDocIds: docIds }));
  }
  async function loadProjects() {
    const ps = await api("/projects");
    setProjects0(ps.map((p) => ({ id: String(p._id), name: p.name, phases: p.phases || [], streams: p.streams || [], description: p.description || "", linkLabel: p.linkLabel || "", linkUrl: p.linkUrl || "", start: dstr(p.start), end: dstr(p.end), targetMargin: p.targetMargin ?? null, pm: p.pm || null, currentPhase: p.currentPhase || null, totalStories: p.totalStories ?? null, doneStories: p.doneStories ?? null, currentMargin: p.currentMargin ?? null, keyUpdate: p.keyUpdate || "", trackJira: p.trackJira !== false, funding: p.funding || null, closedAt: dstr(p.closedAt), closedBy: p.closedBy || "", closureNote: p.closureNote || "" })));
  }
  async function loadAssignments(empNameById) {
    const as2 = await api("/assignments").catch((e) => (e.status === 403 ? api("/assignments?mine=1") : Promise.reject(e)));
    setAssignments0(as2.map((a) => ({ id: String(a._id), name: empNameById[String(a.employeeId)], projectId: String(a.projectId), phase: a.phase || null, stream: a.stream || null, from: dstr(a.from), to: dstr(a.to), weeklyHours: a.weeklyHours || 40 })).filter((a) => a.name));
  }
  async function loadScores(empNameById) {
    const ss = await api("/scores");
    setScores0(ss.map((s) => ({ id: String(s._id), name: empNameById[String(s.employeeId)], week: dstr(s.week), m: s.m })).filter((s) => s.name));
  }
  async function loadRaid() {
    const xs = await api("/raid").catch(() => []);
    setRaid0(xs.map((x) => ({ id: String(x.id), projectId: String(x.projectId), type: x.type, desc: x.desc, impact: x.impact, probability: x.probability, owner: x.owner || "", targetDate: dstr(x.targetDate) || "", status: x.status, link: x.link || "", comments: x.comments || "", createdBy: x.createdBy, createdAt: dstr(x.createdAt), updatedAt: dstr(x.updatedAt) })));
  }
  async function loadMilestones() {
    const xs = await api("/milestones").catch(() => []);
    setMilestones0(xs.map((x) => ({ id: String(x.id), projectId: String(x.projectId), name: x.name, phase: x.phase || "", planned: dstr(x.planned) || "", actual: dstr(x.actual) || "", status: x.status, rag: x.rag, comments: x.comments || "", createdBy: x.createdBy, createdAt: dstr(x.createdAt), updatedAt: dstr(x.updatedAt) })));
  }
  async function loadWeeklyHealth() {
    const xs = await api("/weeklyhealth").catch(() => []);
    setWeeklyHealth0(xs.map((x) => ({ id: String(x.id), projectId: String(x.projectId), week: dstr(x.week), hoursPlanned: x.hoursPlanned, hoursBurnt: x.hoursBurnt, scopeChanges: !!x.scopeChanges, rag: x.rag, oneLiner: x.oneLiner || "", createdBy: x.createdBy, updatedAt: dstr(x.updatedAt) })));
  }
  async function loadPipeline() {
    const xs = await api("/pipeline").catch(() => []);
    setPipeline0(xs.map((x) => ({ id: String(x.id), company: x.company, stage: x.stage, potentialStart: x.potentialStart || "", potentialResources: x.potentialResources ?? null, commentary: x.commentary || "", nextAction: x.nextAction || "" })));
  }
  async function loadPlans() {
    const ps = await api("/plans").catch(() => []);
    setPlans0(ps.map((p) => ({ id: String(p.id), name: p.name, projectId: String(p.projectId), phase: p.phase || null, startYm: p.startYm, monthsCount: p.monthsCount, mult: p.mult, multOverrides: p.multOverrides || {}, rows: p.rows || [], archived: !!p.archived, createdBy: p.createdBy, createdAt: dstr(p.createdAt), updatedAt: dstr(p.updatedAt) })));
  }
  async function loadSettings() {
    const s = await api("/settings");
    if (s.leaveTypes) setLeaveTypes0(s.leaveTypes);
    if (s.weekendDays) setWeekendDays0(s.weekendDays);
    if (s.holidays) setHolidays0(s.holidays.map(dstr).sort());
    if (s.performance) setPerfCfg0({ weights: s.performance.weights, green: s.performance.green, amber: s.performance.amber, partnerOnly: !!s.performance.partnerOnly });
    if (s.extLinks) setExtLinks0(s.extLinks.map((l, i) => ({ id: l.id || "x" + i, label: l.label, url: l.url, description: l.description || "" })));
    if (s.empFields) setEmpFields0(s.empFields);
  }
  async function loadAll(role) {
    const es = await api("/employees").catch(() => null);
    let empNameById = {};
    if (es) {
      setEmployees0(es.map((e) => ({ id: String(e.id), name: e.name, email: e.email || "", role: e.role, company: e.company, start: e.start, term: e.term, streamLead: !!e.streamLead, viewer: !!e.viewer, isAdmin: !!e.isAdmin, inactive: !!e.inactive, custom: e.custom || {} })));
      empNameById = Object.fromEntries(es.map((e) => [String(e.id), e.name]));
      setSrvMaps((m) => ({ ...m, empIdByName: Object.fromEntries(es.map((e) => [e.name, String(e.id)])) }));
    }
    await loadSettings();
    await Promise.all([
      loadLeaves(empNameById).catch(() => {}),
      loadComps(empNameById).catch(() => {}),
      loadTimecards(empNameById).catch(() => {}),
      loadProjects().catch(() => {}),
      loadAssignments(empNameById).catch(() => {}),
      loadScores(empNameById).catch(() => {}),
      loadPlans().catch(() => {}),
      loadRaid().catch(() => {}),
      loadMilestones().catch(() => {}),
      loadWeeklyHealth().catch(() => {}),
      loadPipeline().catch(() => {}),
    ]);
    if (role === "Admin") {
      const p = await api("/admin/permissions").catch(() => null);
      if (p && p.perms) setPerms0(mergePerms(p.perms));
    }
    setBooted(true);
  }
  const empNameByIdNow = () => Object.fromEntries(Object.entries(srvMaps.empIdByName).map(([n, i]) => [i, n]));

  function diffSync(prev, next, ops) {
    const pById = Object.fromEntries(prev.map((x) => [x.id, x]));
    const nById = Object.fromEntries(next.map((x) => [x.id, x]));
    next.filter((x) => !pById[x.id]).forEach((x) => ops.create && ops.create(x));
    prev.filter((x) => !nById[x.id]).forEach((x) => ops.remove && ops.remove(x));
    if (ops.update) next.filter((x) => pById[x.id] && JSON.stringify(pById[x.id]) !== JSON.stringify(x)).forEach((x) => ops.update(x, pById[x.id]));
  }
  const eid = (name) => srvMaps.empIdByName[name];

  const setLeaves = (next) => {
    const prev = leaves; setLeaves0(next);
    diffSync(prev, next, {
      create: (l) => fire(api("/leaves", { method: "POST", body: { employeeId: eid(l.name), start: l.start, end: l.end, type: l.type, force: true } }).then(() => loadLeaves(empNameByIdNow()))),
      remove: (l) => fire(api("/leaves/" + l.id, { method: "DELETE" })),
    });
  };
  const setComps = (next) => {
    const prev = comps; setComps0(next);
    diffSync(prev, next, {
      create: (c) => fire(api("/compoffs", { method: "POST", body: { employeeId: eid(c.name), dateWorked: c.date, days: c.days, reason: c.reason } }).then(() => loadComps(empNameByIdNow()))),
      remove: (c) => fire(api("/compoffs/" + c.id, { method: "DELETE" })),
    });
  };
  const setEmployees = (next0) => {
    // pickers pass the active-only list — never let that drop inactive employees from state
    const next = [...next0, ...employees.filter((e) => e.inactive && !next0.some((x) => x.id === e.id))];
    const prev = employees; setEmployees0(next);
    diffSync(prev, next, {
      create: (e) => fire(api("/employees", { method: "POST", body: { name: e.name, email: e.email || null, role: e.role, company: e.company, start: e.start, term: e.term, streamLead: !!e.streamLead, viewer: !!e.viewer, inactive: !!e.inactive, custom: e.custom || {} } }).then(() => loadAll(user ? user.role : null))),
      update: (e) => fire(api("/employees/" + e.id, { method: "PUT", body: { name: e.name, email: e.email || null, role: e.role, company: e.company, start: e.start, term: e.term, streamLead: !!e.streamLead, viewer: !!e.viewer, inactive: !!e.inactive, custom: e.custom || {} } })),
    });
  };
  // Admin grants go through their own endpoint (not PUT /employees), so update local state directly.
  async function setEmployeeAdmin(id, isAdmin) {
    await api("/admin/employees/" + id + "/admin", { method: "PUT", body: { isAdmin } });
    setEmployees0((es) => es.map((e) => (e.id === id ? { ...e, isAdmin } : e)));
  }
  // close / reopen go through their own endpoint (they also end open assignments), then reload
  async function setProjectClosed(id, close) {
    const r = await api("/projects/" + id + "/close", { method: "PUT", body: close ? { on: close.on, note: close.note } : { reopen: true } });
    await Promise.all([loadProjects(), loadAssignments(empNameByIdNow())]);
    return r;
  }
  const setProjects = (next0) => {
    // most views get open projects only — never let a save drop closed ones from state
    const next = [...next0, ...projects.filter((p) => p.closedAt && !next0.some((x) => x.id === p.id))];
    const prev = projects; setProjects0(next);
    diffSync(prev, next, {
      create: (p) => fire(api("/projects", { method: "POST", body: { name: p.name, phases: p.phases, streams: p.streams || [], description: p.description || "", linkLabel: p.linkLabel || "", linkUrl: p.linkUrl || "", start: p.start || null, end: p.end || null, targetMargin: p.targetMargin ?? null, pm: p.pm || null, currentPhase: p.currentPhase || null, trackJira: p.trackJira !== false } }).then(loadProjects)),
      remove: (p) => fire(api("/projects/" + p.id, { method: "DELETE" })),
      update: (p, was) => {
        const body = {};
        const catChange = p.name !== was.name || JSON.stringify(p.phases) !== JSON.stringify(was.phases) || p.trackJira !== was.trackJira ||
          JSON.stringify(p.streams) !== JSON.stringify(was.streams) || p.description !== was.description || p.linkLabel !== was.linkLabel || p.linkUrl !== was.linkUrl || p.start !== was.start || p.end !== was.end || p.targetMargin !== was.targetMargin || p.pm !== was.pm || p.currentPhase !== was.currentPhase;
        if (catChange) Object.assign(body, { name: p.name, phases: p.phases, streams: p.streams || [], description: p.description || "", linkLabel: p.linkLabel || "", linkUrl: p.linkUrl || "", start: p.start || null, end: p.end || null, targetMargin: p.targetMargin ?? null, pm: p.pm || null, currentPhase: p.currentPhase || null, trackJira: p.trackJira !== false });
        if (JSON.stringify(p.funding) !== JSON.stringify(was.funding)) body.funding = p.funding;
        if (p.totalStories !== was.totalStories || p.doneStories !== was.doneStories || p.currentMargin !== was.currentMargin || p.keyUpdate !== was.keyUpdate) Object.assign(body, { totalStories: p.totalStories, doneStories: p.doneStories, currentMargin: p.currentMargin, keyUpdate: p.keyUpdate });
        if (Object.keys(body).length) fire(api("/projects/" + p.id, { method: "PUT", body }));
      },
    });
  };
  const setAssignments = (next) => {
    const prev = assignments; setAssignments0(next);
    diffSync(prev, next, {
      create: (a) => fire(api("/assignments", { method: "POST", body: { employeeId: eid(a.name), projectId: a.projectId, phase: a.phase, stream: a.stream, from: a.from, to: a.to, weeklyHours: a.weeklyHours || 40 } }).then(() => loadAssignments(empNameByIdNow()))),
      remove: (a) => fire(api("/assignments/" + a.id, { method: "DELETE" })),
      update: (a, was) => { if (a.to !== was.to) fire(api("/assignments/" + a.id + "/end", { method: "PATCH", body: { to: a.to } })); },
    });
  };
  const setScores = (next) => {
    const prev = scores; setScores0(next);
    diffSync(prev, next, {
      create: (s) => fire(api("/scores", { method: "PUT", body: { employeeId: eid(s.name), week: s.week, m: s.m } })),
      update: (s) => fire(api("/scores", { method: "PUT", body: { employeeId: eid(s.name), week: s.week, m: s.m } })),
    });
  };
  const setWeeklyHealth = (next) => {
    const prev = weeklyHealth; setWeeklyHealth0(next);
    diffSync(prev, next, {
      create: (w) => fire(api("/weeklyhealth", { method: "POST", body: { projectId: w.projectId, week: w.week, hoursPlanned: w.hoursPlanned, hoursBurnt: w.hoursBurnt, scopeChanges: w.scopeChanges, rag: w.rag, oneLiner: w.oneLiner } }).then(loadWeeklyHealth)),
      remove: (w) => fire(api("/weeklyhealth/" + w.id, { method: "DELETE" })),
      update: (w) => fire(api("/weeklyhealth/" + w.id, { method: "PUT", body: { week: w.week, hoursPlanned: w.hoursPlanned, hoursBurnt: w.hoursBurnt, scopeChanges: w.scopeChanges, rag: w.rag, oneLiner: w.oneLiner } })),
    });
  };
  const setPipeline = (next) => {
    const prev = pipeline; setPipeline0(next);
    diffSync(prev, next, {
      create: (x) => fire(api("/pipeline", { method: "POST", body: { company: x.company, stage: x.stage, potentialStart: x.potentialStart, potentialResources: x.potentialResources, commentary: x.commentary, nextAction: x.nextAction } }).then(loadPipeline)),
      remove: (x) => fire(api("/pipeline/" + x.id, { method: "DELETE" })),
      update: (x) => fire(api("/pipeline/" + x.id, { method: "PUT", body: { company: x.company, stage: x.stage, potentialStart: x.potentialStart, potentialResources: x.potentialResources, commentary: x.commentary, nextAction: x.nextAction } })),
    });
  };
  const setRaid = (next) => {
    const prev = raid; setRaid0(next);
    diffSync(prev, next, {
      create: (x) => fire(api("/raid", { method: "POST", body: { projectId: x.projectId, type: x.type, desc: x.desc, impact: x.impact, probability: x.probability, owner: x.owner, targetDate: x.targetDate || null, status: x.status, link: x.link, comments: x.comments } }).then(loadRaid)),
      remove: (x) => fire(api("/raid/" + x.id, { method: "DELETE" })),
      update: (x) => fire(api("/raid/" + x.id, { method: "PUT", body: { type: x.type, desc: x.desc, impact: x.impact, probability: x.probability, owner: x.owner, targetDate: x.targetDate || null, status: x.status, link: x.link, comments: x.comments } })),
    });
  };
  const setMilestones = (next) => {
    const prev = milestones; setMilestones0(next);
    diffSync(prev, next, {
      create: (x) => fire(api("/milestones", { method: "POST", body: { projectId: x.projectId, name: x.name, phase: x.phase, planned: x.planned || null, actual: x.actual || null, status: x.status, rag: x.rag, comments: x.comments } }).then(loadMilestones)),
      remove: (x) => fire(api("/milestones/" + x.id, { method: "DELETE" })),
      update: (x) => fire(api("/milestones/" + x.id, { method: "PUT", body: { name: x.name, phase: x.phase, planned: x.planned || null, actual: x.actual || null, status: x.status, rag: x.rag, comments: x.comments } })),
    });
  };
  const setPlans = (next) => {
    const prev = plans; setPlans0(next);
    diffSync(prev, next, {
      create: (p) => fire(api("/plans", { method: "POST", body: { name: p.name, projectId: p.projectId, phase: p.phase, startYm: p.startYm, monthsCount: p.monthsCount, mult: p.mult, multOverrides: p.multOverrides, rows: p.rows } }).then(loadPlans)),
      remove: (p) => fire(api("/plans/" + p.id, { method: "DELETE" })),
      update: (p) => fire(api("/plans/" + p.id, { method: "PUT", body: { name: p.name, phase: p.phase, startYm: p.startYm, monthsCount: p.monthsCount, mult: p.mult, multOverrides: p.multOverrides, rows: p.rows, archived: p.archived } })),
    });
  };
  const setTcRows = (next0) => {
    // views only see active rows — keep the hidden inactive rows in state
    const next = [...next0, ...tcRows.filter((r) => inactiveNames.has(r.name) && !next0.some((x) => x.id === r.id))];
    const prev = tcRows; setTcRows0(next);
    const pById = Object.fromEntries(prev.map((r) => [r.id, r]));
    next.forEach((r) => {
      const was = pById[r.id];
      if (!was) return;
      r.weeks.forEach((w, i) => {
        const old = was.weeks[i] || ["", ""];
        if (w[0] !== old[0] || w[1] !== old[1]) {
          const docId = srvMaps.tcDocIds[r.id] && srvMaps.tcDocIds[r.id][tcWeeks[i]];
          if (docId) fire(api("/timecards/" + docId, { method: "PUT", body: { sf: w[0] || null, jira: w[1] || null } }));
        }
      });
    });
  };
  const setTcWeeks = (next) => {
    const prev = tcWeeks; setTcWeeks0(next);
    if (next.length === prev.length + 1) {
      fire(api("/timecards/weeks", { method: "POST" }).then(() => loadTimecards(empNameByIdNow())));
    }
  };
  const pushSettings = (lt, wd, hd) =>
    fire(api("/settings", { method: "PUT", body: { leaveTypes: lt, weekendDays: wd, holidays: hd } }));
  const setLeaveTypes = (next) => { setLeaveTypes0(next); pushSettings(next, weekendDays, holidays); };
  const setWeekendDays = (next) => { setWeekendDays0(next); pushSettings(leaveTypes, next, holidays); };
  const setHolidays = (next) => { setHolidays0(next); pushSettings(leaveTypes, weekendDays, next); };
  const setExtLinks = (next) => { setExtLinks0(next); fire(api("/settings", { method: "PUT", body: { extLinks: next } })); };
  const setEmpFields = (next) => { setEmpFields0(next); fire(api("/settings", { method: "PUT", body: { empFields: next } })); };
  const setPerfCfg = (next) => { setPerfCfg0(next); fire(api("/perf/config", { method: "PUT", body: next })); };
  const setPerms = (next) => { setPerms0(next); fire(api("/admin/permissions", { method: "PUT", body: { perms: next } })); };
  // flag / unflag one person-week as an outlier, with an optional comment
  async function setTcFlag(rowId, weekIdx, flag) {
    const docId = srvMaps.tcDocIds[rowId] && srvMaps.tcDocIds[rowId][tcWeeks[weekIdx]];
    if (!docId) throw new Error("That week has no timecard record for this person yet.");
    await api("/timecards/" + docId + "/flag", { method: "PUT", body: { flagged: !!flag, comment: flag ? flag.comment : "" } });
    setTcRows0((rows) => rows.map((r) => {
      if (r.id !== rowId) return r;
      const notes = { ...(r.notes || {}) };
      if (flag) notes[weekIdx] = { comment: flag.comment, by: user.name, at: todayISO };
      else delete notes[weekIdx];
      return { ...r, notes };
    }));
  }
  async function uploadTimecardFile(file) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await api("/timecards/import", { method: "POST", formData: fd });
    await loadTimecards(empNameByIdNow());
    if (r.unknownNames && r.unknownNames.length) await loadAll(user ? user.role : null);
    return r;
  }
  // ===================== END LIVE SYNC LAYER =====================

  const [user, setUser] = useState(null); // {role, name}
  const NAV_DEEPLINK = ["dash", "myleave", "calendar", "allrecords", "compoff", "reports", "timecard", "tcsummary", "alloc", "projects", "plans", "programhealth", "perf", "runway", "employees", "settings", "admin"];
  const [nav, setNav] = useState(() => {
    const h = typeof window !== "undefined" && window.location.hash ? window.location.hash.slice(1) : "";
    return NAV_DEEPLINK.includes(h) ? h : "dash";
  });
  // mirror the current page into the URL hash so a browser refresh stays on it
  useEffect(() => {
    if (NAV_DEEPLINK.includes(nav) && window.location.hash.slice(1) !== nav) window.history.replaceState(null, "", "#" + nav);
  }, [nav]); // eslint-disable-line react-hooks/exhaustive-deps
  const [idc, setIdc] = useState(1000);
  const nextId = (p) => { setIdc(idc + 1); return p + (idc + 1); };

  const empByName = useMemo(() => Object.fromEntries(employees.map((e) => [e.name, e])), [employees]);
  // employees marked inactive in the master drop out of every picker, roster and grid; their history stays in reports
  const activeEmployees = useMemo(() => employees.filter((e) => !e.inactive), [employees]);
  const inactiveNames = useMemo(() => new Set(employees.filter((e) => e.inactive).map((e) => e.name)), [employees]);
  // closed projects drop out of pickers, Program Health, runway and burn; the Projects page and history keep them
  const openProjects = useMemo(() => projects.filter((p) => !p.closedAt), [projects]);
  const activeTcRows = useMemo(() => tcRows.filter((r) => !inactiveNames.has(r.name)), [tcRows, inactiveNames]);
  // per timecard row, per week: does JIRA count toward the score? (driven by the project's trackJira setting)
  const jiraFlags = useMemo(() => {
    const projById = Object.fromEntries(projects.map((p) => [p.id, p]));
    const out = {};
    tcRows.forEach((r) => {
      out[r.id] = tcWeeks.map((w) => {
        const acts = activeAssignmentsOn(assignments, r.name, w);
        if (!acts.length) return true; // unassigned: default to tracking both
        return acts.some((a) => { const p = projById[a.projectId]; return !p || p.trackJira !== false; });
      });
    });
    return out;
  }, [tcRows, tcWeeks, assignments, projects]);
  const [scores, setScores0] = useState(() => (SEED.P || []).map(([name, week, m], i) => ({ id: "s" + i, name, week, m: [...m] })));
  const [perfCfg, setPerfCfg0] = useState({ weights: [25, 20, 10, 25, 10, 10], green: 3.5, amber: 2.5, partnerOnly: true });
  const [perms, setPerms0] = useState(defaultPerms);
  const [extLinks, setExtLinks0] = useState([]); // admin-managed external app links shown in the sidebar
  const [plans, setPlans0] = useState([]); // team plans: project+phase month-window resource planning
  const [empFields, setEmpFields0] = useState([]); // admin-defined custom fields on the employee master: [{id, label}]
  const [raid, setRaid0] = useState([]); // per-project RAID log entries
  const [milestones, setMilestones0] = useState([]); // per-project milestones
  const [weeklyHealth, setWeeklyHealth0] = useState([]); // program health: weekly hours planned/burnt + RAG per project
  const [pipeline, setPipeline0] = useState([]); // program health: pre-project opportunities
  const todayISO = toISO(new Date());

  // On refresh, restore the session from the saved identity instead of showing the login screen.
  const [restoring, setRestoring] = useState(() => !!getIdentity());
  useEffect(() => {
    if (!restoring) return;
    api("/me")
      .then((me) => {
        // A saved address that isn't the authenticated (Okta) identity goes back to login.
        if (me.email && me.email !== getIdentity()) throw new Error("identity_mismatch");
        setUser({ role: me.role, name: me.employee.name }); loadAll(me.role);
      })
      .catch(() => setIdentity(null))
      .finally(() => setRestoring(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (restoring) return null;
  if (!user) {
    return (
      <LoginLive
        onEnter={async (email) => {
          setIdentity(email);
          let me;
          try { me = await api("/me"); } catch (e) { setIdentity(null); throw e; }
          // On Kanopy the ingress decides who the caller is and the typed address is
          // ignored, so refuse to continue when the two disagree.
          if (me.email && me.email !== email) {
            setIdentity(null);
            const e = new Error("You're signed in through Okta as " + me.email + ". Enter your own email address to continue.");
            e.status = 403;
            throw e;
          }
          setUser({ role: me.role, name: me.employee.name });
          setNav("dash");
          loadAll(me.role);
        }}
      />
    );
  }
  if (!booted) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ fontFamily: BRAND_FONT, backgroundColor: "#F9FBFA" }}>
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: "#001E2B" }}><Leaf size={28} /></div>
          <div className="text-sm text-slate-500">Loading DeliveryHub from the API…</div>
        </div>
      </div>
    );
  }


  const can = (cap) => canDo(perms, user.role, cap);
  // roles that can't see the whole timecard grid get their own row only ("My Timecard")
  const isDev = !can("timecard.editAll") && !can("timecard.insights") && !can("timecard.flag");
  const isLead = user.role === "Lead";
  const isPM = user.role === "Project Manager";
  const isAdmin = user.role === "Admin";
  const canManage = isLead || isPM || isAdmin; // comp-off, timecard edit, insights
  const canConfigure = isPM || isAdmin; // settings, employee master

  const NAV_ITEMS = [
    { id: "dash", label: "Dashboard", section: "Overview", icon: LayoutDashboard, show: true },
    { id: "myleave", label: "My Leave", section: "Leave", icon: Plane, show: true },
    { id: "calendar", label: "Team Calendar", section: "Leave", icon: CalendarDays, show: true },
    { id: "allrecords", label: "Leave Records", section: "Leave", icon: ListChecks, show: can("leave.records") },
    { id: "reports", label: "Leave Reports", section: "Leave", icon: BarChart3, show: can("leave.reports") },
    { id: "compoff", label: "Comp-Off Log", section: "Leave", icon: Clock, show: can("leave.compoff") },
    { id: "timecard", label: isDev ? "My Timecard" : "Timecard Grid", section: "Delivery", icon: Table, show: true },
    { id: "tcsummary", label: "Timecard Insights", section: "Delivery", icon: TrendingUp, show: can("timecard.insights") },
    { id: "alloc", label: "Allocations", section: "Delivery", icon: GitBranch, show: can("alloc.view") },
    { id: "projects", label: "Projects", section: "Delivery", icon: FolderKanban, show: can("projects.view") },
    { id: "plans", label: "Team Plans", section: "Delivery", icon: ClipboardList, show: can("plans.view") },
    { id: "programhealth", label: "Program Health", section: "Delivery", icon: Activity, show: can("ph.view") },
    { id: "perf", label: "Performance", section: "Delivery", icon: Gauge, show: can("perf.view") },
    { id: "runway", label: "Remaining Runway", section: "Delivery", icon: Hourglass, show: can("runway.view") },
    { id: "employees", label: "Employees", section: "Organisation", icon: Users, show: can("employees.view") },
    { id: "settings", label: "Leave Settings", section: "Organisation", icon: SettingsIcon, show: can("settings.edit") },
    { id: "admin", label: "Administration", section: "Organisation", icon: Shield, show: isAdmin },
  ];

  const ctx = {
    user, employees: activeEmployees, allEmployees: employees, empByName, leaves, comps, tcRows: activeTcRows, tcWeeks, leaveTypes, weekendDays, holidays, holidaySet,
    setTcWeeks, assignments, setAssignments, projects: openProjects, allProjects: projects, setProjects, setProjectClosed, jiraFlags,
    scores, setScores, perfCfg, setPerfCfg, can, perms, setPerms, extLinks, setExtLinks, plans, setPlans, empFields, setEmpFields, raid, setRaid, milestones, setMilestones, weeklyHealth, setWeeklyHealth, pipeline, setPipeline, uploadTimecardFile, setTcFlag,
    todayISO, canManage, canConfigure, isDev, isAdmin,
    setLeaves, setComps, setTcRows, setEmployees, setLeaveTypes, setWeekendDays, setHolidays, nextId, setNav, setEmployeeAdmin,
  };

  return (
    <div className="min-h-screen text-slate-800" style={{ fontFamily: BRAND_FONT, backgroundColor: "#F9FBFA" }}>
      <style>{BRAND_CSS}</style>
      {/* top bar */}
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1720px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#001E2B" }}><Leaf size={22} /></div>
            <div>
              <div className="text-sm font-semibold leading-tight text-slate-900" style={{ fontFamily: BRAND_FONT }}>DeliveryHub</div>
              <div className="text-xs leading-tight text-slate-500">AMP · APAC — UNIFIED TRACKER CONSOLE</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 sm:flex">
              <span className={"h-2 w-2 rounded-full " + (isAdmin ? "bg-purple-500" : isPM ? "mdb-dot-spring" : isLead ? "bg-sky-500" : user.role === "Viewer" ? "bg-teal-400" : "bg-slate-400")} />
              <span className="text-xs font-medium text-slate-700">{user.name}</span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">{user.role}</span>
            </div>
          </div>
        </div>
      </header>

      {syncErr && (
        <div className="mx-auto max-w-[1720px] px-4 pt-3">
          <Notice tone="error">Sync issue: {syncErr} — your last change may not be saved. <button className="ml-2 underline" onClick={() => { setSyncErr(null); loadAll(user.role); }}>Reload from server</button></Notice>
        </div>
      )}
      <div className="mx-auto flex max-w-[1720px] gap-6 px-4 py-6">
        {/* sidebar */}
        <aside className="w-56 shrink-0 no-print lg:sticky lg:top-[76px] lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            {["Overview", "Leave", "Delivery", "Organisation"].map((sec) => {
              const items = NAV_ITEMS.filter((n) => n.show && n.section === sec);
              if (!items.length) return null;
              return (
                <div key={sec} className="mb-2">
                  <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{sec}</div>
                  {items.map((n) => {
                    const Icon = n.icon;
                    return (
                      <button key={n.id} onClick={() => setNav(n.id)}
                        className={"flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition " +
                          (nav === n.id ? "mdb-nav-active" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
                        {Icon && <Icon size={16} className={nav === n.id ? "" : "text-slate-400"} />}
                        {n.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {extLinks.length > 0 && (
              <div className="border-t border-slate-100 pt-2">
                <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Links</div>
                {extLinks.map((l) => (
                  <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" title={l.description || l.url}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                    <ExternalLink size={15} className="text-slate-400" />{l.label}
                  </a>
                ))}
              </div>
            )}
            {MODULES_V2.some((m) => m.roles.includes(user.role)) && (
              <div className="border-t border-slate-100 pt-2">
                <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Coming next</div>
                {MODULES_V2.map((m) => {
                  const visible = m.roles.includes(user.role);
                  if (!visible) return null;
                  return (
                    <button key={m.id} onClick={() => setNav("v2:" + m.id)}
                      className={"flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition " + (nav === "v2:" + m.id ? "bg-slate-50 text-slate-700" : "text-slate-400 hover:bg-slate-50")}>
                      <Lock size={14} />{m.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* main */}
        <main className="min-w-0 flex-1">
          {nav === "dash" && <Dashboard {...ctx} />}
          {nav === "myleave" && <MyLeave {...ctx} />}
          {nav === "calendar" && <TeamCalendar {...ctx} />}
          {nav === "allrecords" && can("leave.records") && <AllLeaveRecords {...ctx} />}
          {nav === "reports" && can("leave.reports") && <LeaveReports {...ctx} />}
          {nav === "compoff" && can("leave.compoff") && <CompOffLog {...ctx} />}
          {nav === "timecard" && <TimecardGrid {...ctx} />}
          {nav === "tcsummary" && can("timecard.insights") && <TimecardInsights {...ctx} />}
          {nav === "alloc" && can("alloc.view") && <AllocationsView {...ctx} />}
          {nav === "projects" && can("projects.view") && <ProjectsView {...ctx} />}
          {nav === "plans" && can("plans.view") && <TeamPlansView {...ctx} />}
          {nav === "programhealth" && can("ph.view") && <ProgramHealthView {...ctx} />}
          {nav === "perf" && can("perf.view") && <PerformanceView {...ctx} />}
          {nav === "runway" && can("runway.view") && <RunwayView {...ctx} />}
          {nav === "employees" && can("employees.view") && <EmployeesView {...ctx} />}
          {nav === "settings" && can("settings.edit") && <SettingsView {...ctx} />}
          {nav === "admin" && isAdmin && <AdminPanel {...ctx} />}
          {nav.startsWith("v2:") && <ComingSoon id={nav.slice(3)} role={user.role} />}
        </main>
      </div>
    </div>
  );
}

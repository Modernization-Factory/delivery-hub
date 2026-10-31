/**
 * DeliveryHub business rules — ported from the tested prototype.
 * Pure functions only. Dates are "YYYY-MM-DD" strings.
 */
const TC_STATUSES = ["Proactive", "Chased", "Beyond Monday", "N/A", "Not Updated", "Partial Updated"];
function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function fmt(s) {
  if (!s) return "—";
  const d = parseISO(s);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(s) {
  const d = parseISO(s);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function isWeekend(d, weekendDays) {
  return weekendDays.includes(d.getDay());
}
function isWorkingDay(d, weekendDays, holidaySet) {
  return !isWeekend(d, weekendDays) && !holidaySet.has(toISO(d));
}
// counts working days in [start, end] and multiplies by the leave type's day value
function leaveDays(startISO, endISO, typeName, leaveTypes, weekendDays, holidaySet) {
  const value = (leaveTypes.find((t) => t.name === typeName) || { value: 1 }).value;
  let d = parseISO(startISO);
  const end = parseISO(endISO);
  let n = 0;
  while (d <= end) {
    if (isWorkingDay(d, weekendDays, holidaySet)) n++;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return n * value;
}
function isDuplicate(leaves, entry) {
  return leaves.some(
    (l) => l.name === entry.name && l.start === entry.start && l.end === entry.end && l.type === entry.type
  );
}
function findOverlaps(leaves, entry, ignoreId) {
  return leaves.filter(
    (l) =>
      l.id !== ignoreId &&
      l.name === entry.name &&
      l.start <= entry.end &&
      entry.start <= l.end
  );
}
function compOffDateValid(dateISO, weekendDays, holidaySet) {
  const d = parseISO(dateISO);
  return isWeekend(d, weekendDays) || holidaySet.has(dateISO);
}
// Timecard weeks are dated by their Sunday and cover the Monday-Friday that FOLLOWS it
// (a column dated Sun 25 Oct is the week of Mon 26 - Fri 30 Oct). Returns those working
// days (weekends and holidays dropped).
function tcWeekDays(weekISO, weekendDays, holidaySet) {
  const d = parseISO(weekISO);
  const out = [];
  for (let k = 1; k <= 7; k++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
    if (isWorkingDay(x, weekendDays, holidaySet)) out.push(toISO(x));
  }
  return out;
}
// Is this person away the whole working week? Every working day must be covered by a
// full-day leave (a 0.5-day type like Half Day doesn't make a day absent). A week with
// no working days (all holidays) is not "on leave".
function onLeaveWholeWeek(name, weekISO, leaves, leaveTypes, weekendDays, holidaySet) {
  const days = tcWeekDays(weekISO, weekendDays, holidaySet);
  if (!days.length) return false;
  const full = (l) => l.name === name && (leaveTypes.find((t) => t.name === l.type) || { value: 1 }).value >= 1;
  const mine = leaves.filter(full);
  return days.every((dd) => mine.some((l) => l.start <= dd && dd <= l.end));
}
// the leave type that spends comp-off balance: marked in settings, so it survives a rename
function compOffTypeName(leaveTypes) {
  const t = leaveTypes.find((x) => x.compOff) || leaveTypes.find((x) => x.name === "Comp-Off");
  return t ? t.name : "Comp-Off";
}
function balancesFor(name, leaves, comps, leaveTypes, weekendDays, holidaySet) {
  const byType = {};
  leaveTypes.forEach((t) => (byType[t.name] = 0));
  leaves
    .filter((l) => l.name === name)
    .forEach((l) => {
      const d = leaveDays(l.start, l.end, l.type, leaveTypes, weekendDays, holidaySet);
      byType[l.type] = (byType[l.type] || 0) + d;
    });
  const earned = comps.filter((c) => c.name === name).reduce((s, c) => s + Number(c.days), 0);
  const used = byType[compOffTypeName(leaveTypes)] || 0;
  return { byType, compOffEarned: earned, compOffUsed: used, compOffBalance: earned - used };
}
// employee active during [rangeStart, rangeEnd]? (start before range ends, end date not before range starts)
function isActiveDuring(e, rangeStart, rangeEnd) {
  return (!e.start || e.start <= rangeEnd) && (!e.term || e.term >= rangeStart);
}
// working days of a leave that fall inside [rangeStart, rangeEnd] (for month-clipped reports)
function leaveDaysInRange(l, rangeStart, rangeEnd, leaveTypes, weekendDays, holidaySet) {
  const s = l.start > rangeStart ? l.start : rangeStart;
  const e = l.end < rangeEnd ? l.end : rangeEnd;
  if (s > e) return 0;
  return leaveDays(s, e, l.type, leaveTypes, weekendDays, holidaySet);
}
function onLeaveOn(dateISO, leaves) {
  return leaves.filter((l) => l.start <= dateISO && dateISO <= l.end);
}
// timecard stats for one row: weeks = [[sf,jira],...]
function tcStats(weeks) {
  const s = { Proactive: 0, Chased: 0, "Beyond Monday": 0, "Not Updated": 0, "Partial Updated": 0, "N/A": 0, blank: 0, filled: 0 };
  weeks.forEach(([sf, jira]) =>
    [sf, jira].forEach((v) => {
      if (!v) s.blank++;
      else {
        s[v] = (s[v] || 0) + 1;
        if (v !== "N/A") s.filled++;
      }
    })
  );
  s.pct = s.filled ? Math.round((s.Proactive / s.filled) * 100) : null;
  return s;
}
function weekCompliance(rows, weekIdx) {
  let pro = 0, filled = 0;
  rows.forEach((r) =>
    r.weeks[weekIdx].forEach((v) => {
      if (v && v !== "N/A") {
        filled++;
        if (v === "Proactive") pro++;
      }
    })
  );
  return filled ? Math.round((pro / filled) * 100) : null;
}
// name spelling variants seen across the source trackers -> canonical master names
const NAME_ALIASES = {
  "Devashish Saksena": "Devashish Sakesna",
  "Amit Jain": "Amit Jain(L)",
  "Aniket Sambhaji Patil": "Aniket Sambhaji",
  "Chaitanya Kuthiyala": "Chaitanya Kuthiala",
  "Christopher Niklowoski*": "Christopher Niklowoski",
  "Gaurav Chittineni": "Chittineni Gaurav",
  "Lazar Dukic*": "Lazar Dukic",
};
// Excel cell (Date | serial number | string) -> "YYYY-MM-DD" | null
function excelToISO(v) {
  if (v === null || v === undefined || v === "") return null;
  let ms;
  if (v instanceof Date) ms = v.getTime();
  else if (typeof v === "number") ms = Math.round((v - 25569) * 86400000);
  else {
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const t = Date.parse(s);
    if (isNaN(t)) return null;
    ms = t;
  }
  const d = new Date(ms + 12 * 3600 * 1000); // noon shift tolerates timezone skew either way
  const p = (n) => String(n).padStart(2, "0");
  return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
}
// Parses the Timecard-Proactiveness sheet as array-of-arrays (header row 1: week dates
// from col F, merged over SF+JIRA pairs; row 2: SF/JIRA labels; data from row 3).
function parseTimecardGrid(grid) {
  const header = grid[0] || [];
  const weeks = [];
  for (let c = 5; c < header.length; c += 2) {
    const iso = excelToISO(header[c]);
    if (!iso) break;
    weeks.push({ col: c, iso });
  }
  const canon = {};
  TC_STATUSES.forEach((s) => (canon[s.toLowerCase()] = s));
  let unknownStatuses = 0;
  let duplicates = 0;
  const seen = new Set();
  const rows = [];
  for (let r = 2; r < grid.length; r++) {
    const raw = grid[r] || [];
    if (raw[0] === null || raw[0] === undefined || String(raw[0]).trim() === "") continue;
    const name0 = String(raw[0]).trim();
    const name = NAME_ALIASES[name0] || name0;
    if (seen.has(name)) { duplicates++; continue; }
    seen.add(name);
    const norm = (v) => {
      if (v === null || v === undefined) return "";
      const t = String(v).trim();
      if (!t) return "";
      const c2 = canon[t.toLowerCase()];
      if (c2 === undefined) { unknownStatuses++; return ""; }
      return c2;
    };
    rows.push({
      name,
      company: raw[1] ? String(raw[1]).trim() : "",
      release: raw[2] ? String(raw[2]).trim() : "",
      role: raw[3] ? String(raw[3]).trim() : "",
      remarks: raw[4] ? String(raw[4]).trim() : "",
      weeks: weeks.map((w) => [norm(raw[w.col]), norm(raw[w.col + 1])]),
    });
  }
  return { weeks: weeks.map((w) => w.iso), rows, unknownStatuses, duplicates };
}

// ---- Allocations: streams + date-range assignment logic ----
const STREAMS = ["Batches","Bugs","Code Optimisations","Code Quality","Database Maintainence","Database Objects","Leads","Miscellaneous Activities","New Integrations","PM","Post Production Support","Refactoring","Retrofitting","RIAM"];
const OPEN_END = "9999-12-31"; // null `to` = ongoing
// overlap is blocked only WITHIN the same project; cross-project concurrency is allowed (FTE splits evenly)
function aOverlaps(assignments, entry, ignoreId) {
  const eEnd = entry.to || OPEN_END;
  return assignments.filter((a) => a.id !== ignoreId && a.name === entry.name && a.projectId === entry.projectId && a.from <= eEnd && entry.from <= (a.to || OPEN_END));
}
function crossProjectConcurrent(assignments, entry, ignoreId) {
  const eEnd = entry.to || OPEN_END;
  return assignments.filter((a) => a.id !== ignoreId && a.name === entry.name && a.projectId !== entry.projectId && a.from <= eEnd && entry.from <= (a.to || OPEN_END));
}
function activeAssignmentsOn(assignments, name, iso) {
  return assignments.filter((a) => a.name === name && a.from <= iso && iso <= (a.to || OPEN_END));
}
// Day-weighted effort: for each working day in the month, a person's concurrent
// assignments share the day evenly (1/n each). Returns { assignmentId: weightedDays }.
function effortSplitInMonth(personAssignments, y, m, weekendDays, holidaySet) {
  const [ms, me] = monthRange(y, m);
  const out = {};
  let d = parseISO(ms);
  const end = parseISO(me);
  while (d <= end) {
    if (isWorkingDay(d, weekendDays, holidaySet)) {
      const iso = toISO(d);
      const act = personAssignments.filter((a) => a.from <= iso && iso <= (a.to || OPEN_END));
      if (act.length) {
        const w = 1 / act.length;
        act.forEach((a) => { out[a.id] = (out[a.id] || 0) + w; });
      }
    }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return out;
}
function workingDaysBetween(startISO, endISO, weekendDays, holidaySet) {
  let d = parseISO(startISO);
  const end = parseISO(endISO);
  let n = 0;
  while (d <= end) {
    if (isWorkingDay(d, weekendDays, holidaySet)) n++;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return n;
}
function monthRange(y, m) { // m: 1-12
  const p = (n) => String(n).padStart(2, "0");
  const last = new Date(y, m, 0).getDate();
  return [y + "-" + p(m) + "-01", y + "-" + p(m) + "-" + p(last)];
}
// working days an assignment contributes inside a given month
function assignmentDaysInMonth(a, y, m, weekendDays, holidaySet) {
  const [ms, me] = monthRange(y, m);
  const s = a.from > ms ? a.from : ms;
  const e = (a.to || OPEN_END) < me ? a.to : me;
  if (s > e) return 0;
  return workingDaysBetween(s, e, weekendDays, holidaySet);
}
function streamsInMonth(assignments, name, y, m) {
  const [ms, me] = monthRange(y, m);
  return assignments
    .filter((a) => a.name === name && a.from <= me && ms <= (a.to || OPEN_END))
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((a) => a.stream);
}
function currentStream(assignments, name, iso) {
  const a = assignments.find((x) => x.name === name && x.from <= iso && iso <= (x.to || OPEN_END));
  return a ? a.stream : null;
}

// timecard stats where JIRA counts only when the week's flag is true (project-level setting)
function tcStatsFlex(weeks, jiraFlags) {
  const s = { Proactive: 0, Chased: 0, "Beyond Monday": 0, "Not Updated": 0, "Partial Updated": 0, "N/A": 0, blank: 0, filled: 0 };
  weeks.forEach(([sf, jira], i) => {
    const cells = jiraFlags && jiraFlags[i] === false ? [sf] : [sf, jira];
    cells.forEach((v) => {
      if (!v) s.blank++;
      else {
        s[v] = (s[v] || 0) + 1;
        if (v !== "N/A") s.filled++;
      }
    });
  });
  s.pct = s.filled ? Math.round((s.Proactive / s.filled) * 100) : null;
  return s;
}
function weekComplianceFlex(rows, weekIdx, flagsById) {
  let pro = 0, filled = 0;
  rows.forEach((r) => {
    const flags = flagsById && flagsById[r.id];
    const [sf, jira] = r.weeks[weekIdx] || ["", ""];
    const cells = flags && flags[weekIdx] === false ? [sf] : [sf, jira];
    cells.forEach((v) => {
      if (v && v !== "N/A") {
        filled++;
        if (v === "Proactive") pro++;
      }
    });
  });
  return filled ? Math.round((pro / filled) * 100) : null;
}
// timecard proactiveness % -> suggested performance metric (1-5)
function tcSuggested(pct) {
  if (pct === null || pct === undefined) return null;
  return pct >= 90 ? 5 : pct >= 75 ? 4 : pct >= 60 ? 3 : pct >= 40 ? 2 : 1;
}
// ---- Performance scoring math (weights in %, must total 100) ----
const METRICS = ["Delivery", "Quality", "Communication", "Tech Skill", "Timecard", "Collaboration"];
function weightedScore(m, weights) {
  if (!m || m.length !== 6 || m.some((x) => x === null || x === undefined || x === "")) return null;
  const t = weights.reduce((s, w) => s + Number(w), 0) || 100;
  return m.reduce((s, x, i) => s + Number(x) * Number(weights[i]), 0) / t;
}
function starsOf(score) {
  return score === null ? null : Math.round(score * 2) / 2;
}
function ragOf(score, cfg) {
  return score === null ? null : score >= cfg.green ? "Green" : score >= cfg.amber ? "Amber" : "Red";
}
// leave whose start date has passed is locked — only PM / Admin may delete it
function canDeletePastLeave(role) {
  return role === "Project Manager" || role === "Admin";
}
// effective app role: Lead Developer OR designated Stream Lead -> Lead
function appRoleForEmp(e) {
  if (e.viewer) return "Viewer"; // read-only persona, regardless of PS role
  if (e.role === "Project Manager") return "Project Manager";
  if (e.role === "Lead Developer" || e.streamLead) return "Lead";
  if (e.role === "Senior Developer") return "Senior Developer";
  return "Developer";
}

// ---- Permission registry: module-level groups, capability-level entries, role defaults ----
// (D = Developer, S = Senior Developer, L = Lead incl. Stream Leads, P = Project Manager; Admin always has everything;
// S falls back to D when omitted)
const PERM_GROUPS = [
  { module: "Leave", caps: [
    ["leave.own", "Submit own leave · delete own entries", { D: 1, L: 1, P: 1, V: 0 }],
    ["leave.records", "View all leave records", { D: 0, L: 1, P: 1, V: 1 }],
    ["leave.forAnyone", "File / delete leave for anyone", { D: 0, L: 1, P: 1, V: 0 }],
    ["leave.compoff", "Log & manage comp-off earned", { D: 0, L: 1, P: 1, V: 0 }],
    ["leave.reports", "Leave reports (role / company / project totals)", { D: 0, L: 1, P: 1, V: 1 }],
    ["settings.edit", "Leave settings (types · weekends · holidays)", { D: 0, L: 0, P: 1, V: 0 }],
  ]},
  { module: "Timecard", caps: [
    ["timecard.editAll", "Edit full grid · import weekly file · add weeks", { D: 0, L: 1, P: 1, V: 0 }],
    ["timecard.insights", "Timecard insights & compliance", { D: 0, L: 1, P: 1, V: 1 }],
    ["timecard.flag", "Flag outlier weeks & comment on them", { D: 0, L: 1, P: 1, V: 0 }],
  ]},
  { module: "Allocations & Projects", caps: [
    ["alloc.view", "View allocations (plan · roster · burn)", { D: 0, L: 1, P: 1, V: 1 }],
    ["alloc.edit", "Create / end / delete assignments", { D: 0, L: 1, P: 1, V: 0 }],
    ["projects.view", "View project master", { D: 0, L: 1, P: 1, V: 1 }],
    ["projects.manage", "Manage projects (names · phases · streams · JIRA setting)", { D: 0, L: 0, P: 1, V: 0 }],
    ["projects.raid", "Manage RAID log & milestones on projects", { D: 0, L: 1, P: 1, V: 0 }],
  ]},
  { module: "Team Plans", caps: [
    ["plans.view", "View team plans & manage grid", { D: 0, L: 1, P: 1, V: 1 }],
    ["plans.manage", "Create / update / archive / delete team plans", { D: 0, L: 1, P: 1, V: 0 }],
  ]},
  { module: "Program Health", caps: [
    ["ph.view", "View program health (portfolio · weekly · pipeline)", { D: 0, L: 1, P: 1, V: 1 }],
    ["ph.register", "Edit PM-maintained project fields (stories · current margin · key update)", { D: 0, L: 0, P: 1, V: 0 }],
    ["ph.weekly", "Submit & edit weekly health entries", { D: 0, L: 0, P: 1, V: 0 }],
    ["ph.pipeline", "Manage the pipeline board", { D: 0, L: 0, P: 1, V: 0 }],
  ]},
  { module: "Performance", caps: [
    ["perf.view", "View performance · watchlist", { D: 0, L: 1, P: 1, V: 1 }],
    ["perf.score", "Enter & edit weekly scores", { D: 0, L: 1, P: 1, V: 0 }],
    ["perf.reports", "Performance reports & exports (Excel · PDF)", { D: 0, L: 1, P: 1, V: 1 }],
    ["perf.config", "Scoring configuration (weights · RAG · scope)", { D: 0, L: 0, P: 0, V: 0 }],
  ]},
  { module: "Runway", caps: [
    ["runway.view", "View remaining runway (weeks · days · last date)", { D: 0, L: 1, P: 1, V: 1 }],
    ["runway.funding", "Manage funding hours & remaining overrides", { D: 0, L: 0, P: 1, V: 0 }],
  ]},
  { module: "People", caps: [
    ["employees.view", "View employee master", { D: 0, L: 1, P: 1, V: 1 }],
    ["employees.edit", "Edit employee master · Stream Leads · Viewers", { D: 0, L: 0, P: 1, V: 0 }],
  ]},
];
function defaultPerms() {
  const o = {};
  PERM_GROUPS.forEach((g) => g.caps.forEach(([id, _l, d]) => { o[id] = { Developer: !!d.D, "Senior Developer": !!(d.S ?? d.D), Lead: !!d.L, "Project Manager": !!d.P, Viewer: !!d.V }; }));
  return o;
}
// stored permission docs from before a capability/role existed lack keys — merge defaults under them
function mergePerms(stored) {
  const base = defaultPerms();
  const out = {};
  Object.keys(base).forEach((cap) => {
    const s = (stored || {})[cap] || {};
    // Senior Developer split out of Developer later — until saved, it mirrors the stored Developer setting
    const sd = "Senior Developer" in s ? {} : "Developer" in s ? { "Senior Developer": s.Developer } : {};
    out[cap] = { ...base[cap], ...s, ...sd };
  });
  return out;
}
function canDo(perms, role, cap) {
  if (role === "Admin") return true;
  const p = perms[cap];
  return p ? !!p[role] : false;
}
// ---- Performance report builders (pure, testable) ----
const PARTNER_COS = ["WeKan", "Ciklum", "Globant"];
function perfScorecard(employees, scores, week, cfg) {
  const pool = employees
    .filter((e) => isActiveDuring(e, week, week) && (cfg.partnerOnly ? PARTNER_COS.includes(e.company) : true))
    .sort((a, b) => a.name.localeCompare(b.name));
  const rows = pool.map((e) => {
    const s = scores.find((x) => x.name === e.name && x.week === week);
    const sc = s ? weightedScore(s.m, cfg.weights) : null;
    return { name: e.name, vendor: e.company, m: s ? s.m : [null, null, null, null, null, null], score: sc, stars: starsOf(sc), rag: ragOf(sc, cfg) };
  });
  const vendors = {};
  rows.forEach((r) => {
    const v = (vendors[r.vendor] = vendors[r.vendor] || { total: 0, scored: 0, sum: 0, Green: 0, Amber: 0, Red: 0 });
    v.total++;
    if (r.score !== null) { v.scored++; v.sum += r.score; v[r.rag]++; }
  });
  Object.values(vendors).forEach((v) => { v.avg = v.scored ? v.sum / v.scored : null; });
  return { rows, vendors };
}
function perfVendorTrend(employees, scores, cfg) {
  const weeks = [...new Set(scores.map((s) => s.week))].sort();
  const coOf = Object.fromEntries(employees.map((e) => [e.name, e.company]));
  const grid = {}; // vendor -> { week -> {sum, n} }
  scores.forEach((s) => {
    const sc = weightedScore(s.m, cfg.weights);
    if (sc === null) return;
    const v = coOf[s.name] || "?";
    if (cfg.partnerOnly && !PARTNER_COS.includes(v)) return;
    const g = (grid[v] = grid[v] || {});
    const c = (g[s.week] = g[s.week] || { sum: 0, n: 0 });
    c.sum += sc; c.n++;
  });
  return { weeks, vendors: Object.fromEntries(Object.entries(grid).map(([v, g]) => [v, weeks.map((w) => (g[w] ? g[w].sum / g[w].n : null))])) };
}
function perfResourceTrend(scores, name, cfg) {
  return scores
    .filter((s) => s.name === name)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((s) => ({ week: s.week, m: s.m, score: weightedScore(s.m, cfg.weights) }))
    .map((x) => ({ ...x, stars: starsOf(x.score), rag: ragOf(x.score, cfg) }));
}


// ---- Remaining Runway engine ----
// Runway per role = remaining billable hours / weekly team burn, projected onto
// the calendar from the week anchor, extended by REAL approved leave (fixing the
// source sheet's broken WORKDAY usage where leave forecasts never took effect).
const RUNWAY_ROLES = ["PM", "LD", "SD", "Dev"];
function runwayRoleOf(psRole) {
  return psRole === "Project Manager" ? "PM" : psRole === "Lead Developer" ? "LD" : psRole === "Senior Developer" ? "SD" : "Dev";
}
function weekAnchor(todayISO) {
  // Excel: TODAY() - WEEKDAY(TODAY()) -> the most recent Saturday
  const d = parseISO(todayISO);
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay() - 1));
}
function addWorkingDays(startISO, n, weekendDays, holidaySet) {
  // Excel WORKDAY semantics: fraction truncated, start day not counted
  let remaining = Math.floor(n);
  const d = parseISO(startISO);
  let iso = startISO;
  let guard = 0;
  while (remaining > 0 && guard < 3000) {
    d.setDate(d.getDate() + 1);
    iso = toISO(d);
    guard++;
    if (isWorkingDay(d, weekendDays, holidaySet)) remaining--;
  }
  return iso;
}
// hours one person's assignment burns on a working day: 8 h x (weeklyHours / 40), split evenly
// across the projects they're on that day, minus the share of the day they're on leave
// (full-day types remove it all, Half Day removes half). Returns { burn, lost }.
function dayHours(a, iso, assignments, leaves, leaveTypes) {
  const conc = assignments.filter((x) => x.name === a.name && x.from <= iso && iso <= (x.to || OPEN_END)).length || 1;
  const full = (8 * ((Number(a.weeklyHours) || 40) / 40)) / conc;
  const value = (type) => { const t = (leaveTypes || []).find((x) => x.name === type); return t ? Number(t.value) : 1; };
  const off = Math.min(1, (leaves || []).filter((l) => l.name === a.name && l.start <= iso && iso <= l.end).reduce((t, l) => t + value(l.type), 0));
  return { burn: full * (1 - off), lost: full * off };
}

// consumed hours per project and role between two dates: each working day every assigned,
// employed person burns their hours (see dayHours) — days on leave don't burn.
// { projectId: { role: hours } }
function consumedByProjectRole(assignments, empByName, fromISO, toISO2, weekendDays, holidaySet, leaves = [], leaveTypes = []) {
  const out = {};
  if (!fromISO || fromISO > toISO2) return out;
  const d = parseISO(fromISO);
  let iso = fromISO;
  while (iso <= toISO2) {
    if (isWorkingDay(d, weekendDays, holidaySet)) {
      for (const a of assignments) {
        if (!(a.from <= iso && iso <= (a.to || OPEN_END))) continue;
        const emp = empByName[a.name];
        if (emp && !isActiveDuring(emp, iso, iso)) continue;
        const role = runwayRoleOf(emp ? emp.role : "Developer");
        const P = (out[a.projectId] = out[a.projectId] || {});
        P[role] = (P[role] || 0) + dayHours(a, iso, assignments, leaves, leaveTypes).burn;
      }
    }
    d.setDate(d.getDate() + 1);
    iso = toISO(d);
  }
  return out;
}

const MAX_DAYS = 1100; // projections stop ~3 years out

// Remaining runway per role, simulated day by day from `fromISO` (default today, inclusive):
// each working day the role's assigned people burn their hours; weekends, holidays and each
// person's leave burn nothing. The last date is the day remaining hours run out. If the role's
// assignments end first, the people assigned on that final day are assumed to carry on and the
// date is flagged `beyondAssignments` (with `assignmentsEnd` and `leftAtAssignmentsEnd`).
// Consumed hours count from the funding start up to the day before `fromISO`.
function computeRunway(project, empByName, assignments, leaves, leaveTypes, weekendDays, holidaySet, todayISO, fromISO) {
  const f = project.funding;
  if (!f || !f.start) return null;
  const from = fromISO || todayISO;
  const dayBefore = (() => { const d = parseISO(from); d.setDate(d.getDate() - 1); return toISO(d); })();
  const consumed = (consumedByProjectRole(assignments, empByName, f.start, dayBefore, weekendDays, holidaySet, leaves, leaveTypes)[project.id]) || {};
  const live = (a) => { const e = empByName[a.name]; return e && !e.inactive; };
  const onProject = assignments.filter((a) => a.projectId === project.id && live(a));
  const rows = RUNWAY_ROLES.map((role) => {
    const mine = onProject.filter((a) => runwayRoleOf(empByName[a.name].role) === role);
    const today = mine.filter((a) => a.from <= from && from <= (a.to || OPEN_END) && isActiveDuring(empByName[a.name], from, from));
    const headcount = new Set(today.map((a) => a.name)).size;
    // nominal weekly capacity as of the projection date (no leave or holidays)
    const weeklyBurn = today.reduce((s, a) => {
      const conc = assignments.filter((x) => x.name === a.name && x.from <= from && from <= (x.to || OPEN_END)).length || 1;
      return s + (Number(a.weeklyHours) || 40) / conc;
    }, 0);
    const total = Number((f.hours || {})[role]) || 0;
    const cons = Math.round((consumed[role] || 0) * 10) / 10;
    const rawOvr = f.overrides ? f.overrides[role] : null;
    const override = rawOvr === null || rawOvr === undefined || rawOvr === "" ? null : Number(rawOvr);
    // an override is the balance on its "as of" date (saved with it; older data: the funding
    // start); hours burnt between then and the projection date come off it, so the dates stay
    // put from one day to the next instead of drifting with today's date
    const overrideAsOf = f.overridesAsOf || f.start;
    const sinceOverride = override !== null && from > overrideAsOf
      ? ((consumedByProjectRole(assignments, empByName, overrideAsOf, dayBefore, weekendDays, holidaySet, leaves, leaveTypes)[project.id] || {})[role] || 0) : 0;
    const remaining = override !== null ? Math.max(0, override - sinceOverride) : Math.max(0, total - cons);
    // simulate forward over the role's real assignments
    const run = (list, all) => {
      const lastEnd = list.reduce((m, a) => ((a.to || OPEN_END) > m ? a.to || OPEN_END : m), "");
      let left = remaining, last = null, days = 0, leaveHours = 0, holidays = 0, coveredUntil = null;
      const d = parseISO(from);
      let iso = from;
      for (let k = 0; left > 0 && list.length && iso <= lastEnd && k < MAX_DAYS; k++) {
        if (holidaySet.has(iso) && !weekendDays.includes(d.getDay())) holidays++;
        else if (isWorkingDay(d, weekendDays, holidaySet)) {
          let burnt = 0, any = false;
          for (const a of list) {
            if (!(a.from <= iso && iso <= (a.to || OPEN_END)) || !isActiveDuring(empByName[a.name], iso, iso)) continue;
            any = true;
            const h = dayHours(a, iso, all, leaves, leaveTypes);
            burnt += h.burn; leaveHours += h.lost;
          }
          if (any) {
            days++; coveredUntil = iso; left -= burnt;
            if (left <= 0) { last = iso; break; }
          }
        }
        d.setDate(d.getDate() + 1);
        iso = toISO(d);
      }
      return { left, last, days, leaveHours, holidays, coveredUntil };
    };
    let sim = run(mine, assignments);
    // Hours outlast the assignments: assume the people assigned on the final day carry on
    // (same hours, same split, their leave and holidays still applied) until the hours run out.
    // The date is still reported, flagged as falling after the assignments end.
    let assignmentsEnd = null, leftAtAssignmentsEnd = 0;
    if (!sim.last && remaining > 0 && sim.coveredUntil) {
      const endDay = sim.coveredUntil;
      const carry = new Set(mine.filter((a) => a.from <= endDay && endDay <= (a.to || OPEN_END)).map((a) => a.id));
      const extend = (a) => (carry.has(a.id) ? { ...a, to: null } : a);
      assignmentsEnd = endDay;
      leftAtAssignmentsEnd = Math.max(0, Math.round(sim.left));
      sim = run(mine.map(extend), assignments.map(extend));
    }
    const { last, days, leaveHours, holidays } = sim;
    // weeks of runway = working days until the hours run out / 5
    const weeks = !remaining ? 0 : !last ? null : days / 5;
    const rag = weeks === null ? null : weeks >= 4 ? "Green" : weeks >= 2 ? "Amber" : "Red";
    return { role, headcount, weeklyBurn, total, consumed: cons, remaining, override, overrideAsOf: override !== null ? overrideAsOf : null, weeks, days, last, leaveHours: Math.round(leaveHours * 10) / 10, holidays, beyondAssignments: !!(last && assignmentsEnd), assignmentsEnd: last ? assignmentsEnd : null, leftAtAssignmentsEnd, rag };
  });
  const withData = rows.filter((r) => r.last);
  const end = withData.length ? withData.reduce((m, r) => (r.last < m ? r.last : m), withData[0].last) : null;
  return { from, rows, end, totalRemaining: rows.reduce((s, r) => s + r.remaining, 0) };
}

// leave days in a window, attributed to projects (split evenly across a person's
// concurrent projects) and broken down by role — powers the Project × Role leave report
function leaveByProjectRole(leaves, empByName, assignments, fromISO, toISO2, leaveTypes, weekendDays, holidaySet) {
  const mk = () => ({ PM: 0, LD: 0, SD: 0, Dev: 0, total: 0 });
  const byProject = {};
  const unassigned = mk();
  const totals = mk();
  leaves.forEach((l) => {
    const days = leaveDaysInRange(l, fromISO, toISO2, leaveTypes, weekendDays, holidaySet);
    if (!days) return;
    const emp = empByName[l.name];
    const role = runwayRoleOf(emp ? emp.role : "Developer");
    totals[role] += days;
    totals.total += days;
    const pids = [...new Set(assignments.filter((a) => a.name === l.name && a.from <= toISO2 && fromISO <= (a.to || OPEN_END)).map((a) => a.projectId))];
    if (!pids.length) {
      unassigned[role] += days;
      unassigned.total += days;
      return;
    }
    const share = days / pids.length;
    pids.forEach((pid) => {
      const P = (byProject[pid] = byProject[pid] || mk());
      P[role] += share;
      P.total += share;
    });
  });
  return { byProject, unassigned, totals };
}

// ---- Program Health derivations (store raw facts; compute here) ----
function phElapsedPct(start, end, todayISO2) {
  if (!start || !end || end <= start) return null;
  return Math.round(((parseISO(todayISO2) - parseISO(start)) / (parseISO(end) - parseISO(start))) * 100) / 100;
}
function phEffortVar(planned, burnt) {
  const p = Number(planned) || 0;
  if (!p) return null;
  return Math.round(((Number(burnt) || 0) / p - 1) * 1000) / 1000;
}
function phBurnVsPlan(entries) {
  const P = entries.reduce((s, e) => s + (Number(e.hoursPlanned) || 0), 0);
  const B = entries.reduce((s, e) => s + (Number(e.hoursBurnt) || 0), 0);
  return P ? Math.round((B / P - 1) * 1000) / 1000 : null;
}
function phScheduleVar(totalStories, doneStories, elapsedPct) {
  const t = Number(totalStories) || 0;
  if (!t || elapsedPct === null) return { completion: t ? 0 : null, variance: null };
  const completion = Math.round(((Number(doneStories) || 0) / t) * 100) / 100;
  return { completion, variance: Math.round((completion - elapsedPct) * 100) / 100 };
}
function phHighRisks(raid, projectId) {
  return raid.filter((x) => x.projectId === projectId && x.status !== "Closed" && x.impact === "H").length;
}
const PH_STAGES = ["Exploratory", "POC", "Proposal", "MFW", "SOW Signed", "Closed"];

// slice rows for pagination — pure and testable
function pageSlice(rows, page, size) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, size)));
  const cur = Math.min(Math.max(1, page), pages);
  const from = (cur - 1) * size;
  return { slice: rows.slice(from, from + size), cur, pages, total, from: total ? from + 1 : 0, to: Math.min(from + size, total) };
}

// ---- Team Plan engine ----
// A plan targets project+phase over a month window. Rows = stream/label + task +
// #resources per month. Projected effort = resources × per-month multiplier
// (default 20 working days; overridable per month — the source sheet used ×15 for a
// partial July). Estimated effort is user-supplied per row; variance = projected − estimated.
function planMonths(startYm, count) {
  const [y, m] = startYm.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 + i, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  });
}
function planCalc(plan) {
  const count = Number(plan.monthsCount) || 0;
  const ovr = plan.multOverrides || {};
  const multFor = (i) => (ovr[i] === null || ovr[i] === undefined || ovr[i] === "" ? (Number(plan.mult) || 20) : Number(ovr[i]));
  const rows = (plan.rows || []).map((r) => {
    const res = Array.from({ length: count }, (_, i) => Number(r.res[i]) || 0);
    const effort = res.reduce((s, x, i) => s + x * multFor(i), 0);
    const resTotal = res.reduce((s, x) => s + x, 0);
    const est = r.est === null || r.est === undefined || r.est === "" ? null : Number(r.est);
    return { id: r.id, effort, resTotal, est, variance: est === null ? null : Math.round((effort - est) * 10) / 10 };
  });
  const totalRes = Array.from({ length: count }, (_, i) => (plan.rows || []).reduce((s, r) => s + (Number(r.res[i]) || 0), 0));
  const projEffort = totalRes.map((x, i) => x * multFor(i));
  return {
    rows, totalRes, projEffort, multFor,
    grandRes: totalRes.reduce((s, x) => s + x, 0),
    grandEffort: projEffort.reduce((s, x) => s + x, 0),
    grandEst: rows.reduce((s, r) => s + (r.est || 0), 0),
  };
}

// map master roles -> app roles
function appRoleOf(masterRole) {
  if (masterRole === "Project Manager") return "Project Manager";
  if (masterRole === "Lead Developer") return "Lead";
  return "Developer";
}
function computeBurn(assignments, employees, empByName, year, weekendDays, holidaySet) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const byPerson = {};
    assignments.forEach((a) => {
      const emp = empByName[a.name];
      const clipped = {
        ...a,
        from: emp && emp.start && emp.start > a.from ? emp.start : a.from,
        to: emp && emp.term && (!a.to || emp.term < a.to) ? emp.term : a.to,
      };
      if (clipped.to && clipped.to < clipped.from) return;
      (byPerson[a.name] = byPerson[a.name] || []).push(clipped);
    });
    const rows = [];
    const agg = {}; // projectId -> { total, byPhase, byStream, people:Set }  (Projects tab)
    const perProj = {}; // projectId -> { phases:Set, monthly: {m: {phase: days}} }  (Burn tab)
    months.forEach((m) => {
      const [ms, me] = monthRange(year, m);
      const wdim = workingDaysBetween(ms, me, weekendDays, holidaySet);
      const byProj = {};
      let effort = 0;
      Object.values(byPerson).forEach((pas) => {
        const split = effortSplitInMonth(pas, year, m, weekendDays, holidaySet);
        pas.forEach((a) => {
          const d = split[a.id] || 0;
          if (!d) return;
          effort += d;
          byProj[a.projectId] = (byProj[a.projectId] || 0) + d;
          const g = (agg[a.projectId] = agg[a.projectId] || { total: 0, byPhase: {}, byStream: {}, people: new Set() });
          g.total += d;
          const ph = a.phase || "—";
          g.byPhase[ph] = (g.byPhase[ph] || 0) + d;
          const sKey = a.stream || "—";
          g.byStream[sKey] = (g.byStream[sKey] || 0) + d;
          g.people.add(a.name);
          const P = (perProj[a.projectId] = perProj[a.projectId] || { phases: new Set(), monthly: {} });
          P.phases.add(ph);
          (P.monthly[m] = P.monthly[m] || {})[ph] = (P.monthly[m][ph] || 0) + d;
        });
      });
      const active = employees.filter((e) => !e.inactive && isActiveDuring(e, ms, me));
      const unalloc = active.filter((e) => !assignments.some((a) => a.name === e.name && a.from <= me && ms <= (a.to || OPEN_END))).length;
      rows.push({ m, wdim, effort, byProj, fte: wdim ? effort / wdim : 0, active: active.length, unalloc });
    });
    return { rows, agg, perProj };
}
module.exports = {
  TC_STATUSES, METRICS, STREAMS, NAME_ALIASES, PERM_GROUPS, PARTNER_COS, OPEN_END, RUNWAY_ROLES,
  parseISO, toISO, isWeekend, isWorkingDay, workingDaysBetween, monthRange,
  leaveDays, leaveDaysInRange, isDuplicate, findOverlaps, compOffDateValid, balancesFor, onLeaveOn,
  isActiveDuring, appRoleOf, appRoleForEmp, compOffTypeName, tcWeekDays, onLeaveWholeWeek, canDeletePastLeave,
  tcStats, tcStatsFlex, weekCompliance, weekComplianceFlex, tcSuggested,
  excelToISO, parseTimecardGrid,
  aOverlaps, crossProjectConcurrent, activeAssignmentsOn, effortSplitInMonth, assignmentDaysInMonth, streamsInMonth, currentStream,
  computeBurn,
  weightedScore, starsOf, ragOf, perfScorecard, perfVendorTrend, perfResourceTrend,
  defaultPerms, canDo, mergePerms,
  runwayRoleOf, weekAnchor, addWorkingDays, consumedByProjectRole, computeRunway,
  leaveByProjectRole, planCalc, planMonths, pageSlice,
  phElapsedPct, phEffortVar, phBurnVsPlan, phScheduleVar, phHighRisks, PH_STAGES,
};

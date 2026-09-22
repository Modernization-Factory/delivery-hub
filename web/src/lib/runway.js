import { OPEN_END } from "./constants.js";
import { addWorkingDays, isWorkingDay, parseISO, toISO, weekAnchor } from "./dates.js";
import { isActiveDuring, leaveDaysInRange } from "./leave.js";
import { RUNWAY_ROLES, runwayRoleOf } from "./roles.js";

// consumed = 8h per working day per person, day-weighted across concurrent
// assignments, clipped to employment windows: { projectId: { role: hours } }
export function consumedByProjectRole(assignments, empByName, fromISO, toISO2, weekendDays, holidaySet) {
  const out = {};
  if (!fromISO || fromISO > toISO2) return out;
  const byPerson = {};
  assignments.forEach((a) => { (byPerson[a.name] = byPerson[a.name] || []).push(a); });
  const d = parseISO(fromISO);
  let iso = fromISO;
  while (iso <= toISO2) {
    if (isWorkingDay(d, weekendDays, holidaySet)) {
      for (const name in byPerson) {
        const emp = empByName[name];
        if (emp && !isActiveDuring(emp, iso, iso)) continue;
        const acts = byPerson[name].filter((a) => a.from <= iso && iso <= (a.to || OPEN_END));
        if (!acts.length) continue;
        const share = 8 / acts.length;
        const role = runwayRoleOf(emp ? emp.role : "Developer");
        acts.forEach((a) => {
          const P = (out[a.projectId] = out[a.projectId] || {});
          P[role] = (P[role] || 0) + share;
        });
      }
    }
    d.setDate(d.getDate() + 1);
    iso = toISO(d);
  }
  return out;
}

export function computeRunway(project, empByName, assignments, leaves, leaveTypes, weekendDays, holidaySet, todayISO) {
  const f = project.funding;
  if (!f || !f.start) return null;
  const anchor = weekAnchor(todayISO);
  const consumed = (consumedByProjectRole(assignments, empByName, f.start, todayISO, weekendDays, holidaySet)[project.id]) || {};
  const active = assignments.filter((a) => a.projectId === project.id && a.from <= todayISO && todayISO <= (a.to || OPEN_END));
  const rows = RUNWAY_ROLES.map((role) => {
    const people = active.filter((a) => {
      const e = empByName[a.name];
      return e && isActiveDuring(e, todayISO, todayISO) && runwayRoleOf(e.role) === role;
    });
    const headcount = people.length;
    // forward burn must respect concurrent-project splits, exactly like consumption does:
    // a person active on N projects today contributes weeklyHours / N to each
    const weeklyBurn = people.reduce((s, a) => {
      const conc = assignments.filter((x) => x.name === a.name && x.from <= todayISO && todayISO <= (x.to || OPEN_END)).length || 1;
      return s + (Number(a.weeklyHours) || 40) / conc;
    }, 0);
    const total = Number((f.hours || {})[role]) || 0;
    const cons = Math.round((consumed[role] || 0) * 10) / 10;
    const rawOvr = f.overrides ? f.overrides[role] : null;
    const override = rawOvr === null || rawOvr === undefined || rawOvr === "" ? null : Number(rawOvr);
    const remaining = override !== null ? override : Math.max(0, total - cons);
    const weeks = weeklyBurn > 0 ? remaining / weeklyBurn : null;
    const days = weeks === null ? null : weeks * 5;
    let last = days === null ? null : addWorkingDays(anchor, days, weekendDays, holidaySet);
    let leaveAdj = 0;
    if (last && headcount) {
      const names = new Set(people.map((p) => p.name));
      const teamLeaves = leaves.filter((l) => names.has(l.name));
      for (let pass = 0; pass < 2; pass++) {
        const inWindow = teamLeaves.reduce((s, l) => s + leaveDaysInRange(l, anchor, last, leaveTypes, weekendDays, holidaySet), 0);
        const extra = Math.floor(inWindow) - Math.floor(leaveAdj);
        if (extra <= 0) { leaveAdj = inWindow; break; }
        last = addWorkingDays(last, extra, weekendDays, holidaySet);
        leaveAdj = inWindow;
      }
    }
    const rag = weeks === null ? null : weeks >= 4 ? "Green" : weeks >= 2 ? "Amber" : "Red";
    return { role, headcount, weeklyBurn, total, consumed: cons, remaining, override, weeks, days, last, leaveAdj, rag };
  });
  const withData = rows.filter((r) => r.last);
  const end = withData.length ? withData.reduce((m, r) => (r.last < m ? r.last : m), withData[0].last) : null;
  return { anchor, rows, end, totalRemaining: rows.reduce((s, r) => s + r.remaining, 0) };
}

// ============================================================
// REMAINING RUNWAY (Lead view · PM/Admin manage funding)
// ============================================================
// Portfolio-level roll-up of one project's runway: the binding constraint is the
// role that runs out first, so that role drives the project RAG and the end date.
export function runwaySummary(rw) {
  if (!rw) return null;
  const live = rw.rows.filter((r) => r.weeks !== null && (r.total || r.override !== null || r.headcount));
  const tightest = live.length ? live.reduce((m, r) => (r.weeks < m.weeks ? r : m), live[0]) : null;
  const order = { Red: 0, Amber: 1, Green: 2 };
  const rag = live.length ? live.map((r) => r.rag).sort((a, b) => order[a] - order[b])[0] : null;
  return { tightest, rag, minWeeks: tightest ? tightest.weeks : null, end: rw.end, totalRemaining: rw.totalRemaining, staffedRoles: live.length };
}

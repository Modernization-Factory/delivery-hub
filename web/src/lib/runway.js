import { OPEN_END } from "./constants.js";
import { isWorkingDay, parseISO, toISO } from "./dates.js";
import { isActiveDuring } from "./leave.js";
import { RUNWAY_ROLES, runwayRoleOf } from "./roles.js";

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
export function consumedByProjectRole(assignments, empByName, fromISO, toISO2, weekendDays, holidaySet, leaves = [], leaveTypes = []) {
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
export function computeRunway(project, empByName, assignments, leaves, leaveTypes, weekendDays, holidaySet, todayISO, fromISO) {
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

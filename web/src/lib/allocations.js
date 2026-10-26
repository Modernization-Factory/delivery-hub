import { OPEN_END } from "./constants.js";
import { isWorkingDay, monthRange, parseISO, toISO, workingDaysBetween } from "./dates.js";
import { isActiveDuring } from "./leave.js";

// ---- Allocations: streams + date-range assignment logic ----
export const STREAMS = ["Batches","Bugs","Code Optimisations","Code Quality","Database Maintainence","Database Objects","Leads","Miscellaneous Activities","New Integrations","PM","Post Production Support","Refactoring","Retrofitting","RIAM"];

// overlap is blocked only WITHIN the same project; cross-project concurrency is allowed (FTE splits evenly)
export function aOverlaps(assignments, entry, ignoreId) {
  const eEnd = entry.to || OPEN_END;
  return assignments.filter((a) => a.id !== ignoreId && a.name === entry.name && a.projectId === entry.projectId && a.from <= eEnd && entry.from <= (a.to || OPEN_END));
}

export function crossProjectConcurrent(assignments, entry, ignoreId) {
  const eEnd = entry.to || OPEN_END;
  return assignments.filter((a) => a.id !== ignoreId && a.name === entry.name && a.projectId !== entry.projectId && a.from <= eEnd && entry.from <= (a.to || OPEN_END));
}

export function activeAssignmentsOn(assignments, name, iso) {
  return assignments.filter((a) => a.name === name && a.from <= iso && iso <= (a.to || OPEN_END));
}

// Day-weighted effort: for each working day in the month, a person's concurrent
// assignments share the day evenly (1/n each). Returns { assignmentId: weightedDays }.
export function effortSplitInMonth(personAssignments, y, m, weekendDays, holidaySet) {
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

// working days an assignment contributes inside a given month
export function assignmentDaysInMonth(a, y, m, weekendDays, holidaySet) {
  const [ms, me] = monthRange(y, m);
  const s = a.from > ms ? a.from : ms;
  const e = (a.to || OPEN_END) < me ? a.to : me;
  if (s > e) return 0;
  return workingDaysBetween(s, e, weekendDays, holidaySet);
}

export function streamsInMonth(assignments, name, y, m) {
  const [ms, me] = monthRange(y, m);
  return assignments
    .filter((a) => a.name === name && a.from <= me && ms <= (a.to || OPEN_END))
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((a) => a.stream);
}

export function currentStream(assignments, name, iso) {
  const a = assignments.find((x) => x.name === name && x.from <= iso && iso <= (x.to || OPEN_END));
  return a ? a.stream : null;
}

// weighted burn engine shared by the Allocations and Projects views
export function computeBurn(assignments, employees, empByName, year, weekendDays, holidaySet) {
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

export const STREAM_COLORS = {
  Batches: "bg-sky-100 text-sky-800", Bugs: "bg-red-100 text-red-800",
  "Code Optimisations": "bg-amber-100 text-amber-800", "Code Quality": "bg-lime-100 text-lime-800",
  "Database Maintainence": "bg-teal-100 text-teal-800", "Database Objects": "bg-cyan-100 text-cyan-800",
  Leads: "bg-indigo-100 text-indigo-800", "Miscellaneous Activities": "bg-slate-200 text-slate-700",
  "New Integrations": "bg-fuchsia-100 text-fuchsia-800", PM: "bg-purple-100 text-purple-800",
  "Post Production Support": "bg-orange-100 text-orange-800", Refactoring: "bg-emerald-100 text-emerald-800",
  Retrofitting: "bg-rose-100 text-rose-800", RIAM: "bg-violet-100 text-violet-800",
};

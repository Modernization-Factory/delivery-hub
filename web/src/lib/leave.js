import { OPEN_END } from "./constants.js";
import { isWeekend, isWorkingDay, parseISO } from "./dates.js";
import { runwayRoleOf } from "./roles.js";

// counts working days in [start, end] and multiplies by the leave type's day value
export function leaveDays(startISO, endISO, typeName, leaveTypes, weekendDays, holidaySet) {
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

export function isDuplicate(leaves, entry) {
  return leaves.some(
    (l) => l.name === entry.name && l.start === entry.start && l.end === entry.end && l.type === entry.type
  );
}

export function findOverlaps(leaves, entry, ignoreId) {
  return leaves.filter(
    (l) =>
      l.id !== ignoreId &&
      l.name === entry.name &&
      l.start <= entry.end &&
      entry.start <= l.end
  );
}

export function compOffDateValid(dateISO, weekendDays, holidaySet) {
  const d = parseISO(dateISO);
  return isWeekend(d, weekendDays) || holidaySet.has(dateISO);
}

export function balancesFor(name, leaves, comps, leaveTypes, weekendDays, holidaySet) {
  const byType = {};
  leaveTypes.forEach((t) => (byType[t.name] = 0));
  leaves
    .filter((l) => l.name === name)
    .forEach((l) => {
      const d = leaveDays(l.start, l.end, l.type, leaveTypes, weekendDays, holidaySet);
      byType[l.type] = (byType[l.type] || 0) + d;
    });
  const earned = comps.filter((c) => c.name === name).reduce((s, c) => s + Number(c.days), 0);
  const used = byType["Comp-Off"] || 0;
  return { byType, compOffEarned: earned, compOffUsed: used, compOffBalance: earned - used };
}

// employee active during [rangeStart, rangeEnd]? (start before range ends, end date not before range starts)
export function isActiveDuring(e, rangeStart, rangeEnd) {
  return (!e.start || e.start <= rangeEnd) && (!e.term || e.term >= rangeStart);
}

// working days of a leave that fall inside [rangeStart, rangeEnd] (for month-clipped reports)
export function leaveDaysInRange(l, rangeStart, rangeEnd, leaveTypes, weekendDays, holidaySet) {
  const s = l.start > rangeStart ? l.start : rangeStart;
  const e = l.end < rangeEnd ? l.end : rangeEnd;
  if (s > e) return 0;
  return leaveDays(s, e, l.type, leaveTypes, weekendDays, holidaySet);
}

export function onLeaveOn(dateISO, leaves) {
  return leaves.filter((l) => l.start <= dateISO && dateISO <= l.end);
}

// leave days in a window, attributed to projects (split evenly across a person's
// concurrent projects) and broken down by role — powers the Project × Role leave report
export function leaveByProjectRole(leaves, empByName, assignments, fromISO, toISO2, leaveTypes, weekendDays, holidaySet) {
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

export const LEAVE_COLORS = {
  Vacation: "bg-sky-100 text-sky-800",
  Sick: "bg-rose-100 text-rose-800",
  Unpaid: "bg-slate-200 text-slate-700",
  "Half Day": "bg-violet-100 text-violet-800",
  "Comp-Off": "bg-teal-100 text-teal-800",
};

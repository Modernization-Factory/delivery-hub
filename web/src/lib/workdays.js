// ============================================================
// WORKING DAYS — per resource, per month, net of leave and comp-off
// ============================================================
import { monthRange, workingDaysBetween } from "./dates.js";
import { leaveDaysInRange } from "./leave.js";

// Total working days for each resource, month by month, net of leave and comp-off:
//
//   base   working days in the month inside the person's employment window
//          (weekends and the configured holidays are already excluded)
//   leave  their leave landing in the month, each day weighted by the leave type's
//          value — a Half Day counts 0.5, and comp-off *taken* is one of the types
//   comp   comp-off *earned* in the month (a weekend or holiday actually worked)
//   net    base − leave + comp — the days the person can really be planned for
//
// `filter(emp)` narrows the roster (role / company / project / name). A person with no
// working days, leave or comp-off anywhere in the year is dropped from the report.
export function workingDaysByMonth(employees, leaves, comps, year, leaveTypes, weekendDays, holidaySet, filter = () => true) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const yearStart = year + "-01-01";
  const yearEnd = year + "-12-31";
  const byName = (list) => {
    const o = {};
    list.forEach((x) => { (o[x.name] = o[x.name] || []).push(x); });
    return o;
  };
  const leaveOf = byName(leaves);
  const compOf = byName(comps);
  const totals = { byMonth: {}, base: 0, leave: 0, comp: 0, net: 0, people: 0 };
  months.forEach((m) => (totals.byMonth[m] = { base: 0, leave: 0, comp: 0, net: 0 }));
  const rows = [];
  employees.filter(filter).forEach((emp) => {
    const mine = (leaveOf[emp.name] || []).filter((l) => l.end >= yearStart && l.start <= yearEnd);
    const myComps = (compOf[emp.name] || []).filter((c) => c.date >= yearStart && c.date <= yearEnd);
    const byMonth = {};
    let tBase = 0, tLeave = 0, tComp = 0;
    months.forEach((m) => {
      const [ms, me] = monthRange(year, m);
      // clip the month to the employment window — a mid-month joiner isn't credited the whole month
      const s = emp.start && emp.start > ms ? emp.start : ms;
      const e = emp.term && emp.term < me ? emp.term : me;
      const base = s <= e ? workingDaysBetween(s, e, weekendDays, holidaySet) : 0;
      let leave = 0;
      mine.forEach((l) => {
        if (l.end >= ms && l.start <= me) leave += leaveDaysInRange(l, ms, me, leaveTypes, weekendDays, holidaySet);
      });
      const ym = ms.slice(0, 7);
      const comp = myComps.filter((c) => c.date.slice(0, 7) === ym).reduce((sum, c) => sum + Number(c.days || 0), 0);
      byMonth[m] = { base, leave, comp, net: base - leave + comp };
      tBase += base; tLeave += leave; tComp += comp;
      totals.byMonth[m].base += base;
      totals.byMonth[m].leave += leave;
      totals.byMonth[m].comp += comp;
      totals.byMonth[m].net += base - leave + comp;
    });
    if (!tBase && !tLeave && !tComp) return; // not employed and not away in this year
    rows.push({ name: emp.name, emp, byMonth, base: tBase, leave: tLeave, comp: tComp, net: tBase - tLeave + tComp, leaveRecords: mine, compRecords: myComps });
    totals.base += tBase; totals.leave += tLeave; totals.comp += tComp; totals.net += tBase - tLeave + tComp; totals.people++;
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { months, rows, totals };
}

// Sum one metric across a subset of months — lets the view show a single month (or a range)
// without recomputing the whole year.
export function sumMonths(row, months, metric) {
  return months.reduce((s, m) => s + (row.byMonth[m] ? row.byMonth[m][metric] : 0), 0);
}

export function sumAll(rows, months, metric) {
  return rows.reduce((s, r) => s + sumMonths(r, months, metric), 0);
}

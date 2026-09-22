import { useState, useMemo } from "react";
import { parseISO, toISO } from "../lib/dates.js";
import { isActiveDuring, leaveByProjectRole, leaveDaysInRange } from "../lib/leave.js";
import { downloadXlsx } from "../lib/xlsx.js";
import { Btn, Card, Stat, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";

// ============================================================
// LEAVE REPORTS (Lead / PM / Admin) — totals by role / company
// ============================================================
export function LeaveReports(ctx) {
  const { leaves, employees, empByName, leaveTypes, weekendDays, holidaySet, todayISO, assignments, projects } = ctx;
  const [period, setPeriod] = useState("all");
  const [groupBy, setGroupBy] = useState("role");
  const r1 = (x) => Math.round(x * 10) / 10;

  const months = useMemo(() => {
    const set = new Set();
    leaves.forEach((l) => { set.add(l.start.slice(0, 7)); set.add(l.end.slice(0, 7)); });
    return [...set].sort();
  }, [leaves]);

  let rangeStart = "0000-01-01", rangeEnd = "9999-12-31";
  if (period !== "all") {
    rangeStart = period + "-01";
    const [y, m] = period.split("-").map(Number);
    rangeEnd = toISO(new Date(y, m, 0)); // last day of month
  }
  const monthLabel = (ym) => parseISO(ym + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const keyOf = (name) => {
    const e = empByName[name];
    if (!e) return "Unknown";
    return groupBy === "role" ? e.role : e.company;
  };
  const groups = {};
  leaves.forEach((l) => {
    const d = leaveDaysInRange(l, rangeStart, rangeEnd, leaveTypes, weekendDays, holidaySet);
    if (d === 0) return;
    const k = keyOf(l.name);
    if (!groups[k]) groups[k] = { total: 0, byType: {}, people: new Set() };
    groups[k].total += d;
    groups[k].byType[l.type] = (groups[k].byType[l.type] || 0) + d;
    groups[k].people.add(l.name);
  });
  // headcount respects end dates: active in the selected month, or active today for "All months"
  const activeStart = period === "all" ? todayISO : rangeStart;
  const activeEnd = period === "all" ? todayISO : rangeEnd;
  const activeEmployees = employees.filter((e) => isActiveDuring(e, activeStart, activeEnd));
  const headcount = {};
  activeEmployees.forEach((e) => {
    const k = groupBy === "role" ? e.role : e.company;
    headcount[k] = (headcount[k] || 0) + 1;
  });
  const rows = Object.entries(groups)
    .map(([k, g]) => ({ key: k, total: g.total, byType: g.byType, onLeave: g.people.size, hc: headcount[k] || 0 }))
    .sort((a, b) => b.total - a.total);
  const grand = rows.reduce((s, r) => s + r.total, 0);
  const peopleOnLeave = new Set();
  leaves.forEach((l) => { if (leaveDaysInRange(l, rangeStart, rangeEnd, leaveTypes, weekendDays, holidaySet) > 0) peopleOnLeave.add(l.name); });
  const maxTotal = rows.length ? rows[0].total : 1;
  const periodText = period === "all" ? "all recorded months" : monthLabel(period);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Leave Reports</h2>
        <div className="flex flex-wrap gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {[["role", "By role"], ["company", "By company"]].map(([v, lab]) => (
              <button key={v} onClick={() => setGroupBy(v)}
                className={"px-4 py-2 text-sm font-medium transition " + (groupBy === v ? "mdb-btn-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
                {lab}
              </button>
            ))}
          </div>
          <select className={inputCls + " w-48"} value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">All months</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <Btn kind="ghost" small onClick={() => {
            const pr = leaveByProjectRole(leaves, empByName, assignments, rangeStart, rangeEnd, leaveTypes, weekendDays, holidaySet);
            const pName2 = (pid) => { const p = projects.find((x) => x.id === pid); return p ? p.name : pid; };
            downloadXlsx("leave-report-" + (period === "all" ? "all" : period) + ".xlsx", [
              [(groupBy === "role" ? "By role" : "By company"), [[groupBy === "role" ? "Role" : "Company", "Active headcount", "On leave", ...leaveTypes.map((t) => t.name), "Total days", "Avg per person"], ...rows.map((r) => [r.key, r.hc, r.onLeave, ...leaveTypes.map((t) => r1(r.byType[t.name] || 0)), r1(r.total), r1(r.total / r.onLeave)])]],
              ["Project x Role", [["Project", "PM", "LD", "SD", "Dev", "Total"], ...Object.entries(pr.byProject).map(([pid, v]) => [pName2(pid), r1(v.PM), r1(v.LD), r1(v.SD), r1(v.Dev), r1(v.total)]), ["Unassigned", r1(pr.unassigned.PM), r1(pr.unassigned.LD), r1(pr.unassigned.SD), r1(pr.unassigned.Dev), r1(pr.unassigned.total)], ["All", r1(pr.totals.PM), r1(pr.totals.LD), r1(pr.totals.SD), r1(pr.totals.Dev), r1(pr.totals.total)]]],
            ]);
          }}>⬇ Excel</Btn>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total leave days" value={r1(grand)} sub={periodText} />
        <Stat label="People on leave" value={peopleOnLeave.size} sub={"of " + activeEmployees.length + (period === "all" ? " active today" : " active in " + monthLabel(period))} />
        <Stat label="Avg per person on leave" value={peopleOnLeave.size ? r1(grand / peopleOnLeave.size) : 0} sub="working days" />
        <Stat label={"Highest " + (groupBy === "role" ? "role" : "company")} value={rows.length ? rows[0].key : "—"} sub={rows.length ? r1(rows[0].total) + " days" : "no leave in this period"} />
      </div>
      <Card title={"Leave days " + (groupBy === "role" ? "by role" : "by company") + " — " + periodText}>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No leave recorded in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">{groupBy === "role" ? "Role" : "Company"}</th>
                  <th className="py-2 pr-4 text-right">Active headcount</th>
                  <th className="py-2 pr-4 text-right">On leave</th>
                  {leaveTypes.map((t) => <th key={t.name} className="py-2 pr-4 text-right">{t.name}</th>)}
                  <th className="py-2 pr-4 text-right">Total days</th>
                  <th className="py-2 pr-4 text-right">Avg / person on leave</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{r.key}</td>
                    <td className="py-2 pr-4 text-right text-slate-500">{r.hc}</td>
                    <td className="py-2 pr-4 text-right">{r.onLeave}</td>
                    {leaveTypes.map((t) => (
                      <td key={t.name} className="py-2 pr-4 text-right">{r.byType[t.name] ? r1(r.byType[t.name]) : <span className="text-slate-300">—</span>}</td>
                    ))}
                    <td className="py-2 pr-4 text-right font-semibold text-slate-900">{r1(r.total)}</td>
                    <td className="py-2 pr-4 text-right text-slate-600">{r1(r.total / r.onLeave)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200">
                  <td className="py-2 pr-4 font-semibold text-slate-900">All</td>
                  <td className="py-2 pr-4 text-right text-slate-500">{activeEmployees.length}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{peopleOnLeave.size}</td>
                  {leaveTypes.map((t) => (
                    <td key={t.name} className="py-2 pr-4 text-right font-semibold">{r1(rows.reduce((s, r) => s + (r.byType[t.name] || 0), 0)) || <span className="font-normal text-slate-300">—</span>}</td>
                  ))}
                  <td className="py-2 pr-4 text-right font-semibold text-slate-900">{r1(grand)}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{peopleOnLeave.size ? r1(grand / peopleOnLeave.size) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {(() => {
        const pr = leaveByProjectRole(leaves, empByName, assignments, rangeStart, rangeEnd, leaveTypes, weekendDays, holidaySet);
        const pName2 = (pid) => { const p = projects.find((x) => x.id === pid); return p ? p.name : pid; };
        const prRows = Object.entries(pr.byProject).map(([pid, v]) => ({ label: pName2(pid), ...v }));
        if (pr.unassigned.total) prRows.push({ label: "Unassigned", ...pr.unassigned });
        return (
          <Card title={"Leave days by project × role — " + periodText}>
            {prRows.length === 0 ? <p className="text-sm text-slate-500">No leave attributable in this period.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4">Project</th>
                      {["PM", "LD", "SD", "Dev"].map((r) => <th key={r} className="py-2 pr-4 text-right">{r}</th>)}
                      <th className="py-2 pr-4 text-right">Total days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prRows.sort((a, b) => b.total - a.total).map((r) => (
                      <tr key={r.label} className={r.label === "Unassigned" ? "text-slate-500" : ""}>
                        <td className="py-2 pr-4 font-medium">{r.label}</td>
                        {["PM", "LD", "SD", "Dev"].map((k) => <td key={k} className="py-2 pr-4 text-right">{r[k] ? r1(r[k]) : <span className="text-slate-300">—</span>}</td>)}
                        <td className="py-2 pr-4 text-right font-semibold">{r1(r.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200 font-semibold">
                      <td className="py-2 pr-4">All</td>
                      {["PM", "LD", "SD", "Dev"].map((k) => <td key={k} className="py-2 pr-4 text-right">{r1(pr.totals[k])}</td>)}
                      <td className="py-2 pr-4 text-right">{r1(pr.totals.total)}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate-400">A person's leave is attributed to the project(s) they're assigned to during the period — split evenly when on multiple projects concurrently. Roles: PM / Lead Developer / Senior Developer / Developer.</p>
              </div>
            )}
          </Card>
        );
      })()}
      {rows.length > 0 && (
        <Card title={"Share of leave " + (groupBy === "role" ? "by role" : "by company")}>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center gap-3 text-sm">
                <div className="w-36 shrink-0 truncate font-medium text-slate-700">{r.key}</div>
                <div className="h-5 flex-1 rounded bg-slate-100">
                  <div className="mdb-bar flex h-5 items-center rounded px-2 text-xs font-medium text-white" style={{ width: Math.max(6, Math.round((r.total / maxTotal) * 100)) + "%" }}>
                    {r1(r.total)}
                  </div>
                </div>
                <div className="w-14 shrink-0 text-right text-xs text-slate-500">{grand ? Math.round((r.total / grand) * 100) : 0}%</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

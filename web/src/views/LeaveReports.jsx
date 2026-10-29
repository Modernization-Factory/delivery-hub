import { useState, useMemo } from "react";
import { parseISO, toISO } from "../lib/dates.js";
import { fmtShort } from "../lib/dates.js";
import { LEAVE_COLORS, isActiveDuring, leaveByMonth, leaveByProjectRole, leaveDaysInRange, monthsBetween } from "../lib/leave.js";
import { downloadXlsx } from "../lib/xlsx.js";
import { Btn, Card, Field, Pill, Stat, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";

// ============================================================
// LEAVE REPORTS (Lead / PM / Admin) — Summary · Monthly trend · By resource
// ============================================================
export function LeaveReports(ctx) {
  const [tab, setTab] = useState("summary");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Leave Reports</h2>
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {[["summary", "Summary"], ["trend", "Monthly trend"], ["resource", "By resource"]].map(([v, lab]) => (
            <button key={v} onClick={() => setTab(v)}
              className={"px-4 py-2 text-sm font-medium transition " + (tab === v ? "mdb-btn-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
              {lab}
            </button>
          ))}
        </div>
      </div>
      {tab === "summary" ? <LeaveSummary {...ctx} /> : <LeaveMonthly {...ctx} mode={tab} />}
    </div>
  );
}

// Summary — one month (or all months) by role or by company, plus project × role
function LeaveSummary(ctx) {
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
      <div className="flex flex-wrap items-center justify-end gap-3">
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
            const pName2 = (pid) => { const p = (ctx.allProjects || projects).find((x) => x.id === pid); return p ? p.name : pid; };
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
        const pName2 = (pid) => { const p = (ctx.allProjects || projects).find((x) => x.id === pid); return p ? p.name : pid; };
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

// Monthly trend (rows = role / company / role × company) and By resource (rows = people, each
// expandable to their individual leaves). Both share the same filters and export to Excel.
export function LeaveMonthly(ctx) {
  const { mode, leaves, empByName, leaveTypes, weekendDays, holidaySet, todayISO } = ctx;
  const all = ctx.allEmployees || ctx.employees; // reports cover history, so people since marked inactive still count
  const r1 = (x) => Math.round(x * 10) / 10;
  const thisYm = todayISO.slice(0, 7);
  const firstYm = leaves.reduce((m, l) => (l.start.slice(0, 7) < m ? l.start.slice(0, 7) : m), thisYm);
  const lastYm = leaves.reduce((m, l) => (l.end.slice(0, 7) > m ? l.end.slice(0, 7) : m), thisYm);
  const sixBack = monthsBetween(firstYm, thisYm).slice(-6)[0];
  const [from, setFrom] = useState(sixBack);
  const [to, setTo] = useState(thisYm);
  const [role, setRole] = useState("All");
  const [company, setCompany] = useState("All");
  const [type, setType] = useState("All");
  const [groupBy, setGroupBy] = useState("role");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null); // resource row expanded to its leaves

  const allMonths = monthsBetween(firstYm < sixBack ? firstYm : sixBack, lastYm > thisYm ? lastYm : thisYm);
  const months = from <= to ? monthsBetween(from, to) : [];
  const roles = [...new Set(all.map((e) => e.role || "No role set"))].sort();
  const companies = [...new Set(all.map((e) => e.company || "No company set"))].sort();
  const monthLabel = (ym) => parseISO(ym + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  // employees whose master record has no role / company still count — under a visible label
  const roleOf = (e) => (e && e.role) || "No role set";
  const coOf = (e) => (e && e.company) || "No company set";
  const groupOf = mode === "resource" ? (l) => l.name
    : groupBy === "role" ? (l, e) => roleOf(e)
    : groupBy === "company" ? (l, e) => coOf(e)
    : (l, e) => roleOf(e) + " · " + coOf(e);
  const filter = (l, e) => (type === "All" || l.type === type)
    && (role === "All" || roleOf(e) === role)
    && (company === "All" || coOf(e) === company)
    && (mode !== "resource" || !q || l.name.toLowerCase().includes(q.toLowerCase()));
  const rep = useMemo(() => leaveByMonth(leaves, empByName, months, leaveTypes, weekendDays, holidaySet, groupOf, filter),
    [leaves, empByName, from, to, role, company, type, groupBy, q, mode, leaveTypes, weekendDays, holidaySet]); // eslint-disable-line react-hooks/exhaustive-deps
  const peak = Math.max(1, ...months.map((m) => rep.totals.byMonth[m]));
  const { rows: pageRows, pager } = usePaged(rep.rows, 25); // a person per row runs to 100+ rows
  const rowLabel = mode === "resource" ? "Resource" : groupBy === "role" ? "Role" : groupBy === "company" ? "Company" : "Role · Company";
  const fromS = months.length ? months[0] + "-01" : "";
  const toS = months.length ? (() => { const [y, m] = months[months.length - 1].split("-").map(Number); return toISO(new Date(y, m, 0)); })() : "";
  const leavesOf = (name) => leaves
    .filter((l) => l.name === name && filter(l, empByName[name]) && l.end >= fromS && l.start <= toS)
    .sort((a, b) => a.start.localeCompare(b.start));
  const filterText = [role !== "All" && role, company !== "All" && company, type !== "All" && type].filter(Boolean).join(" · ") || "all roles, companies and types";

  function exportExcel() {
    const head = [rowLabel, ...(mode === "resource" ? ["Role", "Company"] : ["People"]), ...months.map(monthLabel), "Total"];
    const body = rep.rows.map((r) => {
      const e = empByName[r.key];
      return [r.key, ...(mode === "resource" ? [roleOf(e), coOf(e)] : [r.people.size]), ...months.map((m) => r1(r.byMonth[m])), r1(r.total)];
    });
    const totalRow = ["All", ...(mode === "resource" ? ["", ""] : [rep.totals.people.size]), ...months.map((m) => r1(rep.totals.byMonth[m])), r1(rep.totals.total)];
    const filters = [["Filters"], ["Months", monthLabel(from) + " – " + monthLabel(to)], ["Role", role], ["Company", company], ["Leave type", type], ...(mode === "resource" && q ? [["Name contains", q]] : [])];
    const sheets = [
      [mode === "resource" ? "By resource" : "Monthly trend", [head, ...body, totalRow]],
      ["By leave type", [["Leave type", "Days"], ...leaveTypes.map((t) => [t.name, r1(rep.totals.byType[t.name] || 0)])]],
    ];
    if (mode === "resource") {
      sheets.push(["Leave records", [["Resource", "Role", "Company", "Start", "End", "Type", "Working days in range"],
        ...rep.rows.flatMap((r) => leavesOf(r.key).map((l) => {
          const e = empByName[l.name];
          return [l.name, e ? e.role : "", e ? e.company : "", l.start, l.end, l.type, r1(leaveDaysInRange(l, fromS, toS, leaveTypes, weekendDays, holidaySet))];
        }))]]);
    }
    sheets.push(["Filters", filters]);
    downloadXlsx("leave-" + (mode === "resource" ? "by-resource" : "trend-by-" + groupBy) + "-" + from + "-to-" + to + ".xlsx", sheets);
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From">
            <select className={inputCls + " w-32"} value={from} onChange={(e) => setFrom(e.target.value)}>
              {allMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </Field>
          <Field label="To">
            <select className={inputCls + " w-32"} value={to} onChange={(e) => setTo(e.target.value)}>
              {allMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </Field>
          <Field label="Role">
            <select className={inputCls + " w-44"} value={role} onChange={(e) => setRole(e.target.value)}>
              <option>All</option>{roles.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Company">
            <select className={inputCls + " w-32"} value={company} onChange={(e) => setCompany(e.target.value)}>
              <option>All</option>{companies.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Leave type">
            <select className={inputCls + " w-32"} value={type} onChange={(e) => setType(e.target.value)}>
              <option>All</option>{leaveTypes.map((t) => <option key={t.name}>{t.name}</option>)}
            </select>
          </Field>
          {mode === "trend" ? (
            <Field label="Rows">
              <select className={inputCls + " w-40"} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                <option value="role">By role</option>
                <option value="company">By company</option>
                <option value="both">Role × company</option>
              </select>
            </Field>
          ) : (
            <Field label="Name">
              <input className={inputCls + " w-44"} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            </Field>
          )}
          <div className="ml-auto self-end"><Btn kind="ghost" small onClick={exportExcel} disabled={!months.length}>⬇ Excel</Btn></div>
        </div>
        {from > to && <p className="mt-2 text-sm text-red-600">"From" must be on or before "To".</p>}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Leave days" value={r1(rep.totals.total)} sub={months.length + " month" + (months.length === 1 ? "" : "s") + " · " + filterText} />
        <Stat label="People with leave" value={rep.totals.people.size} />
        <Stat label="Avg per month" value={months.length ? r1(rep.totals.total / months.length) : 0} sub="working days" />
        <Stat label="Busiest month" value={rep.totals.total ? monthLabel(months.reduce((a, b) => (rep.totals.byMonth[b] > rep.totals.byMonth[a] ? b : a))) : "—"}
          sub={rep.totals.total ? r1(Math.max(...months.map((m) => rep.totals.byMonth[m]))) + " days" : "no leave in range"} />
      </div>

      {mode === "trend" && months.length > 0 && (
        <Card title={"Leave days per month — " + filterText}>
          <div className="flex items-end gap-2">
            {months.map((m) => (
              <div key={m} className="flex-1 text-center">
                <div className="mx-auto flex h-32 w-full items-end rounded bg-slate-100" style={{ maxWidth: 56 }}>
                  <div className="mdb-bar w-full rounded" style={{ height: Math.round((rep.totals.byMonth[m] / peak) * 100) + "%" }} title={r1(rep.totals.byMonth[m]) + " days"} />
                </div>
                <div className="mt-1 text-xs font-medium text-slate-600">{r1(rep.totals.byMonth[m])}</div>
                <div className="text-xs text-slate-400">{monthLabel(m)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title={(mode === "resource" ? "Leave by resource" : "Leave by " + rowLabel.toLowerCase()) + " — working days per month"}>
        {rep.rows.length === 0 ? <p className="text-sm text-slate-500">No leave matches these filters.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">{rowLabel}</th>
                  {mode === "resource" ? <th className="py-2 pr-4">Role · Company</th> : <th className="py-2 pr-4 text-right">People</th>}
                  {months.map((m) => <th key={m} className="py-2 pr-3 text-right">{monthLabel(m)}</th>)}
                  <th className="py-2 pr-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((r) => {
                  const e = empByName[r.key];
                  const isOpen = mode === "resource" && open === r.key;
                  return [
                    <tr key={r.key} className={mode === "resource" ? "cursor-pointer hover:bg-slate-50" : ""} onClick={() => mode === "resource" && setOpen(isOpen ? null : r.key)}>
                      <td className="py-2 pr-4 font-medium text-slate-800">{mode === "resource" && <span className="mr-1 text-slate-400">{isOpen ? "▾" : "▸"}</span>}{r.key}</td>
                      {mode === "resource"
                        ? <td className="py-2 pr-4 text-xs text-slate-500">{e ? roleOf(e) + " · " + coOf(e) : "—"}{e && e.inactive ? " · inactive" : ""}</td>
                        : <td className="py-2 pr-4 text-right text-slate-500">{r.people.size}</td>}
                      {months.map((m) => <td key={m} className="py-2 pr-3 text-right">{r.byMonth[m] ? r1(r.byMonth[m]) : <span className="text-slate-300">—</span>}</td>)}
                      <td className="py-2 pr-4 text-right font-semibold text-slate-900">{r1(r.total)}</td>
                    </tr>,
                    isOpen && (
                      <tr key={r.key + "_leaves"}>
                        <td colSpan={months.length + 3} className="bg-slate-50 px-4 py-2">
                          <ul className="space-y-1">
                            {leavesOf(r.key).map((l) => (
                              <li key={l.id} className="flex items-center gap-2 text-xs text-slate-700">
                                <Pill tone={LEAVE_COLORS[l.type] || "bg-slate-100 text-slate-600"}>{l.type}</Pill>
                                <span>{fmtShort(l.start)}{l.start !== l.end ? " – " + fmtShort(l.end) : ""}</span>
                                <span className="text-slate-400">{r1(leaveDaysInRange(l, fromS, toS, leaveTypes, weekendDays, holidaySet))} working day(s) in range</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ),
                  ];
                })}
                <tr className="border-t border-slate-200 font-semibold">
                  <td className="py-2 pr-4">All</td>
                  {mode === "resource" ? <td /> : <td className="py-2 pr-4 text-right">{rep.totals.people.size}</td>}
                  {months.map((m) => <td key={m} className="py-2 pr-3 text-right">{r1(rep.totals.byMonth[m])}</td>)}
                  <td className="py-2 pr-4 text-right">{r1(rep.totals.total)}</td>
                </tr>
              </tbody>
            </table>
            {pager}
            <p className="mt-2 text-xs text-slate-400">Working days (weekends and holidays excluded, half days count 0.5). A leave spanning a month end counts in both months. People since marked inactive are included — this is history.{mode === "resource" ? " Click a person to see their individual leaves." : ""}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

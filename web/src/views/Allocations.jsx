import { useState, useMemo } from "react";
import { STREAM_COLORS, aOverlaps, activeAssignmentsOn, computeBurn, crossProjectConcurrent } from "../lib/allocations.js";
import { OPEN_END } from "../lib/constants.js";
import { fmt, fmtShort, monthRange, parseISO } from "../lib/dates.js";
import { isActiveDuring, leaveColor, leaveDaysInRange } from "../lib/leave.js";
import { canSeeWorkingDays } from "../lib/permissions.js";
import { sumAll, sumMonths, workingDaysByMonth } from "../lib/workdays.js";
import { downloadXlsx } from "../lib/xlsx.js";
import { Btn, Card, Field, Notice, Pill, Stat, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";

// ============================================================
// ALLOCATIONS (Lead/PM/Admin assign · PM/Admin manage projects)
// ============================================================
export function AllocationsView(ctx) {
  const { assignments, setAssignments, projects, employees, empByName, weekendDays, holidaySet, nextId, todayISO } = ctx;
  const canEdit = ctx.can("alloc.edit");
  // the working-days report is a PM / Admin planning tool, and it reads everyone's comp-off,
  // so it needs the full comp-off log too — Leads, Developers and Viewers never see it
  const canWorkingDays = canSeeWorkingDays(ctx.user.role) && ctx.can("leave.compoff");
  const [tab, setTab] = useState("plan"); // plan | roster | burn | wd
  const [year, setYear] = useState(2026);
  const [q, setQ] = useState("");
  const [fproj, setFproj] = useState("All");
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ projectId: "", phase: "", stream: "", from: todayISO, to: "", ongoing: true, weeklyHours: 40 });
  const [asOf, setAsOf] = useState(todayISO);
  const [gby, setGby] = useState("project"); // project | phase | stream | flat
  const [msg, setMsg] = useState(null);
  const r1 = (x) => Math.round(x * 10) / 10;
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const mLabel = (m) => parseISO(year + "-" + String(m).padStart(2, "0") + "-01").toLocaleDateString("en-IN", { month: "short" });
  const projById = Object.fromEntries((ctx.allProjects || projects).map((p) => [p.id, p])); // closed ones still name past assignments
  const pName = (a) => (projById[a.projectId] ? projById[a.projectId].name : "?");
  const label = (a) => pName(a) + (a.phase ? " · " + a.phase : "") + " · " + a.stream;

  const roster = employees
    .filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  // assignments in a month for one person (optionally filtered by project)
  function inMonth(name, m) {
    const [ms, me] = monthRange(year, m);
    return assignments.filter((a) => a.name === name && (fproj === "All" || a.projectId === fproj) && a.from <= me && ms <= (a.to || OPEN_END));
  }

  function addAssignment() {
    setMsg(null);
    if (!sel) return;
    const proj = projById[form.projectId];
    if (!proj) return setMsg({ tone: "error", text: "Pick a project." });
    if (!selProj) return setMsg({ tone: "error", text: "Create a project first — assignments need one." });
    const pstreams = selProj.streams || [];
    if (form.stream && !pstreams.includes(form.stream)) return setMsg({ tone: "error", text: "Stream " + form.stream + " isn't defined on this project — manage streams in the Projects menu." });
    const entry = { name: sel, projectId: effPid, phase: form.phase || null, stream: form.stream || null, from: form.from, to: form.ongoing ? null : form.to || null, weeklyHours: Number(form.weeklyHours) || 40 };
    if (!entry.from) return setMsg({ tone: "error", text: "Start date is required." });
    if (!form.ongoing && (!form.to || form.to < form.from)) return setMsg({ tone: "error", text: "End date must be on or after the start date (or mark it ongoing)." });
    const emp = empByName[sel];
    if (emp && emp.term && entry.from > emp.term) return setMsg({ tone: "error", text: sel + "'s end date is " + fmt(emp.term) + " — can't start an assignment after it." });
    const clash = aOverlaps(assignments, entry);
    if (clash.length) return setMsg({ tone: "error", text: "Overlaps on " + proj.name + ": " + clash.map((c) => c.stream + " (" + fmtShort(c.from) + " – " + (c.to ? fmtShort(c.to) : "ongoing") + ")").join(", ") + ". One assignment per project at a time — end that one first." });
    const cross = crossProjectConcurrent(assignments, entry);
    setAssignments([...assignments, { id: nextId("a"), ...entry }]);
    setMsg({ tone: "ok", text: "Assigned " + sel + " to " + proj.name + (entry.phase ? " · " + entry.phase : "") + " · " + entry.stream + " from " + fmt(entry.from) + (entry.to ? " to " + fmt(entry.to) : " (ongoing)") + "." + (cross.length ? " Runs alongside " + cross.map(pName).join(", ") + " — FTE splits evenly across concurrent projects." : "") });
  }
  function endToday(a) {
    setAssignments(assignments.map((x) => (x.id === a.id ? { ...x, to: todayISO } : x)));
    setMsg({ tone: "ok", text: a.name + "'s " + label(a) + " assignment ended today." });
  }

  const burn = useMemo(() => computeBurn(assignments, ctx.allEmployees, empByName, year, weekendDays, holidaySet),
    [assignments, ctx.allEmployees, empByName, year, weekendDays, holidaySet]);

  const selAssignments = sel ? assignments.filter((a) => a.name === sel).sort((a, b) => a.from.localeCompare(b.from)) : [];
  // self-healing project id: live databases use ObjectIds, so never trust a stale/hardcoded value
  const effPid = projects.some((p) => p.id === form.projectId) ? form.projectId : (projects[0] ? projects[0].id : "");
  const selProj = projById[effPid];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Allocations</h2>
        <div className="flex flex-wrap gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {[["plan", "Plan"], ["roster", "Roster"], ["burn", "Projected Burn"], ...(canWorkingDays ? [["wd", "Working Days"]] : [])].map(([v, lab]) => (
              <button key={v} onClick={() => setTab(v)}
                className={"px-4 py-2 text-sm font-medium transition " + (tab === v ? "mdb-btn-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
                {lab}
              </button>
            ))}
          </div>
          <select className={inputCls + " w-28"} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {tab === "plan" && (
            <>
              <input className={inputCls + " w-40"} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className={inputCls + " w-36"} value={fproj} onChange={(e) => setFproj(e.target.value)}>
                <option value="All">All projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}

      {tab === "plan" && sel && (
        <Card title={"Assignments — " + sel} right={<Btn kind="ghost" small onClick={() => { setSel(null); setMsg(null); }}>Close</Btn>}>
          {selAssignments.length === 0 ? (
            <p className="mb-3 text-sm text-slate-500">No assignments yet — {sel.split(" ")[0]} is unallocated.</p>
          ) : (
            <ul className="mb-3 divide-y divide-slate-100">
              {selAssignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="font-medium text-slate-700">{pName(a)}</span>
                    {a.phase && <span className="ml-1 text-slate-500">· {a.phase}</span>}
                    <Pill tone={"ml-2 " + (STREAM_COLORS[a.stream] || "bg-slate-100 text-slate-600")}>{a.stream || "—"}</Pill>
                    {a.weeklyHours && Number(a.weeklyHours) !== 40 ? <Pill tone="ml-1 bg-orange-100 text-orange-800">{a.weeklyHours} h/wk</Pill> : null}
                    <span className="ml-2 text-slate-600">{fmt(a.from)} → {a.to ? fmt(a.to) : "ongoing"}</span>
                  </span>
                  <span className="flex gap-2">
                    {canEdit && (!a.to || a.to > todayISO) && <Btn small kind="ghost" onClick={() => endToday(a)}>End today</Btn>}
                    {canEdit && <Btn small kind="danger" onClick={() => setAssignments(assignments.filter((x) => x.id !== a.id))}>Delete</Btn>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-5">
            <Field label="Project">
              <select className={inputCls} value={effPid} onChange={(e) => setForm({ ...form, projectId: e.target.value, phase: "", stream: "" })}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Phase">
              <select className={inputCls} value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
                <option value="">—</option>
                {(selProj ? selProj.phases : []).map((ph) => <option key={ph}>{ph}</option>)}
              </select>
            </Field>
            <Field label="Stream">
              <select className={inputCls} value={form.stream} onChange={(e) => setForm({ ...form, stream: e.target.value })}>
                <option value="">— no stream —</option>
                {((selProj || {}).streams || []).map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="From"><input type="date" className={inputCls} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></Field>
            <Field label="Hours/week (runway)"><input type="number" min="1" max="80" className={inputCls} value={form.weeklyHours} onChange={(e) => setForm({ ...form, weeklyHours: e.target.value })} /></Field>
            <div>
              <Field label="To (blank = ongoing)"><input type="date" className={inputCls} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value, ongoing: !e.target.value })} /></Field>
              <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" className="h-3 w-3 accent-emerald-700" checked={form.ongoing} onChange={(e) => setForm({ ...form, ongoing: e.target.checked, to: e.target.checked ? "" : form.to })} />
                Ongoing (no end date)
              </label>
            </div>
          </div>
          {canEdit ? <div className="mt-3"><Btn onClick={addAssignment}>Add assignment</Btn></div> : <Notice tone="warn">View only — your role can't edit assignments.</Notice>}
        </Card>
      )}

      {tab === "plan" && (
        <Card>
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full border-separate text-xs" style={{ borderSpacing: 0 }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="sticky left-0 z-20 border-b border-slate-200 bg-white px-2 py-2 text-left font-semibold text-slate-600">Resource</th>
                  {months.map((m) => <th key={m} className="border-b border-l border-slate-200 bg-white px-1 py-2 text-center font-semibold text-slate-600" style={{ minWidth: 92 }}>{mLabel(m)} {String(year).slice(2)}</th>)}
                </tr>
              </thead>
              <tbody>
                {roster.map((e) => (
                  <tr key={e.id} className="group cursor-pointer" onClick={() => { setSel(e.name); setMsg(null); }}>
                    <td className={"sticky left-0 z-10 whitespace-nowrap border-b border-slate-100 px-2 py-1 font-medium group-hover:bg-slate-50 " + (sel === e.name ? "bg-emerald-50 text-emerald-900" : "bg-white text-slate-800")}>
                      {e.name}
                    </td>
                    {months.map((m) => {
                      const as2 = inMonth(e.name, m);
                      return (
                        <td key={m} className="border-b border-l border-slate-100 p-0.5 text-center">
                          {as2.length === 0 ? <span className="text-slate-200">·</span> : (
                            <span className="inline-flex flex-wrap justify-center gap-0.5">
                              {as2.slice(0, 2).map((a) => (
                                <span key={a.id} title={label(a) + " · " + fmt(a.from) + " → " + (a.to ? fmt(a.to) : "ongoing")}
                                  className={"rounded px-1 py-0.5 text-xs font-medium " + (STREAM_COLORS[a.stream] || "bg-slate-100 text-slate-600")}>
                                  {a.stream ? (a.stream.length > 12 ? a.stream.slice(0, 11) + "…" : a.stream) : "—"}
                                </span>
                              ))}
                              {as2.length > 2 && <span className="text-xs text-slate-400">+{as2.length - 2}</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">Click a resource to manage assignments. Hover a chip for project · phase · dates. Concurrent projects split FTE evenly.</p>
        </Card>
      )}

      {tab === "roster" && (() => {
        const active = employees.filter((e) => isActiveDuring(e, asOf, asOf)).sort((a, b) => a.name.localeCompare(b.name));
        const rows = []; // one row per (person, assignment) active on asOf
        const unalloc = [];
        active.forEach((e) => {
          const acts = activeAssignmentsOn(assignments, e.name, asOf);
          if (acts.length === 0) unalloc.push(e);
          else acts.forEach((a) => rows.push({ e, a }));
        });
        const allocated = active.length - unalloc.length;
        const multi = active.filter((e) => activeAssignmentsOn(assignments, e.name, asOf).length > 1).length;
        const keyOf = (r) => gby === "project" ? pName(r.a) : gby === "phase" ? (r.a.phase || "No phase") : (r.a.stream || "No stream");
        const groups = {};
        if (gby !== "flat") rows.forEach((r) => { (groups[keyOf(r)] = groups[keyOf(r)] || []).push(r); });
        const fteOf = (r) => 1 / activeAssignmentsOn(assignments, r.e.name, asOf).length;
        const rowCells = (r) => (
          <tr key={r.e.id + r.a.id}>
            <td className="py-1.5 pr-4 font-medium text-slate-800">{r.e.name}</td>
            <td className="py-1.5 pr-4 text-slate-500">{r.e.company}</td>
            <td className="py-1.5 pr-4">{pName(r.a)}</td>
            <td className="py-1.5 pr-4 text-slate-600">{r.a.phase || "—"}</td>
            <td className="py-1.5 pr-4"><Pill tone={STREAM_COLORS[r.a.stream] || "bg-slate-100 text-slate-600"}>{r.a.stream || "—"}</Pill></td>
            <td className="py-1.5 pr-4 text-slate-500">{fmtShort(r.a.from)} → {r.a.to ? fmtShort(r.a.to) : "ongoing"}</td>
            <td className="py-1.5 pr-4 text-right">{Math.round(fteOf(r) * 100) / 100}</td>
          </tr>
        );
        const header = (
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4">Resource</th><th className="py-2 pr-4">Company</th><th className="py-2 pr-4">Project</th>
            <th className="py-2 pr-4">Phase</th><th className="py-2 pr-4">Stream</th><th className="py-2 pr-4">Dates</th><th className="py-2 pr-4 text-right">FTE</th>
          </tr>
        );
        return (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-slate-300">
                {[["project", "By project"], ["phase", "By phase"], ["stream", "By stream"], ["flat", "Flat list"]].map(([v, lab]) => (
                  <button key={v} onClick={() => setGby(v)}
                    className={"px-3 py-2 text-sm font-medium transition " + (gby === v ? "mdb-btn-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
                    {lab}
                  </button>
                ))}
              </div>
              <input type="date" className={inputCls + " w-40"} value={asOf} onChange={(e) => setAsOf(e.target.value || todayISO)} />
              <span className="text-xs text-slate-500">snapshot as of {fmt(asOf)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Active people" value={active.length} sub={"as of " + fmtShort(asOf)} />
              <Stat label="Allocated" value={allocated} sub={active.length ? Math.round((allocated / active.length) * 100) + "% of active" : ""} />
              <Stat label="Unallocated" value={unalloc.length} sub={unalloc.length ? "need a plan" : "fully planned"} />
              <Stat label="On multiple projects" value={multi} sub="FTE split evenly" />
            </div>
            {gby === "flat" ? (
              <Card title={"All allocations — " + rows.length + " assignment(s) active"}>
                {rows.length === 0 ? <p className="text-sm text-slate-500">Nobody is allocated on this date.</p> : (
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">{header}</thead>
                      <tbody className="divide-y divide-slate-100">{rows.map(rowCells)}</tbody>
                    </table>
                  </div>
                )}
              </Card>
            ) : (
              Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([k, list]) => (
                <Card key={k} title={k + " — " + list.length + " assignment(s), " + new Set(list.map((r) => r.e.name)).size + " people, " + Math.round(list.reduce((s, r) => s + fteOf(r), 0) * 10) / 10 + " FTE"}>
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">{header}</thead>
                      <tbody className="divide-y divide-slate-100">{list.sort((a, b) => a.e.name.localeCompare(b.e.name)).map(rowCells)}</tbody>
                    </table>
                  </div>
                </Card>
              ))
            )}
            {gby !== "flat" && Object.keys(groups).length === 0 && (
              <Card><p className="text-sm text-slate-500">Nobody is allocated on this date — everyone appears below.</p></Card>
            )}
            {unalloc.length > 0 && (
              <Card title={"Unallocated — " + unalloc.length + " active people with no assignment on " + fmtShort(asOf)}>
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {unalloc.map((e) => (
                    <button key={e.id} onClick={() => { setTab("plan"); setSel(e.name); setMsg(null); }}
                      className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-1.5 text-left text-xs transition hover:bg-amber-100">
                      <span className="truncate font-medium text-slate-700">{e.name}</span>
                      <span className="ml-2 shrink-0 text-slate-500">{e.company} · assign →</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </>
        );
      })()}

      {tab === "burn" && (
        <>
          <Notice tone="ok">Capacity is in person-months, working-day exact — weekends and the {holidaySet.size} configured holidays are excluded automatically. Example: an allocation 16 Jul → 16 Aug 2026 contributes 12/23 of July + 10/20 of August ≈ 1.0 capacity.</Notice>
          <Card title={"Overall burn " + year + " — day-weighted across concurrent projects, clipped to employment windows"}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Month</th><th className="py-2 pr-4 text-right">Working days</th>
                    <th className="py-2 pr-4 text-right">Effort (days)</th><th className="py-2 pr-4 text-right">Capacity (FTE)</th>
                    <th className="py-2 pr-4 text-right">Active</th><th className="py-2 pr-4 text-right">Unallocated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {burn.rows.map((r) => (
                    <tr key={r.m} className={r.effort ? "" : "text-slate-400"}>
                      <td className="py-1.5 pr-4 font-medium">{mLabel(r.m)}</td>
                      <td className="py-1.5 pr-4 text-right">{r.wdim}</td>
                      <td className="py-1.5 pr-4 text-right font-semibold">{r1(r.effort)}</td>
                      <td className="py-1.5 pr-4 text-right">{Math.round(r.fte * 100) / 100}</td>
                      <td className="py-1.5 pr-4 text-right text-slate-500">{r.active}</td>
                      <td className="py-1.5 pr-4 text-right">{r.unalloc ? <Pill tone="bg-amber-100 text-amber-800">{r.unalloc}</Pill> : <span className="text-slate-300">0</span>}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 font-semibold">
                    <td className="py-2 pr-4">Total {year}</td>
                    <td className="py-2 pr-4 text-right text-slate-500">{burn.rows.reduce((s, r) => s + r.wdim, 0)}</td>
                    <td className="py-2 pr-4 text-right">{r1(burn.rows.reduce((s, r) => s + r.effort, 0))}</td>
                    <td className="py-2 pr-4 text-right">{Math.round(burn.rows.reduce((s, r) => s + r.fte, 0) * 100) / 100} p-m</td>
                    <td /><td />
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
          {(ctx.allProjects || projects).filter((p) => burn.perProj[p.id]).map((p) => (
            <ProjectBurnCard key={p.id} project={p} perProj={burn.perProj[p.id]} rows={burn.rows} mLabel={mLabel} />
          ))}
          {Object.keys(burn.perProj).length === 0 && (
            <Card><p className="text-sm text-slate-500">No effort lands in {year} yet — add assignments on the Plan tab.</p></Card>
          )}
        </>
      )}

      {tab === "wd" && <WorkingDaysReport {...ctx} year={year} />}
    </div>
  );
}

// per-project burn table: months × phases, each phase showing Capacity (person-months) + Days
export function ProjectBurnCard({ project, perProj, rows, mLabel }) {
  const r1 = (x) => Math.round(x * 10) / 10;
  const r2 = (x) => Math.round(x * 100) / 100;
  const phases = [...perProj.phases].sort((a, b) => (a === "—" ? 1 : b === "—" ? -1 : a.localeCompare(b)));
  const activeMonths = rows.filter((r) => perProj.monthly[r.m]);
  const phTotals = {};
  phases.forEach((ph) => (phTotals[ph] = { d: 0, c: 0 }));
  let projDays = 0, projCap = 0;
  const body = activeMonths.map((r) => {
    const mm = perProj.monthly[r.m];
    let mDays = 0;
    const cells = [];
    phases.forEach((ph) => {
      const d = mm[ph] || 0;
      mDays += d;
      const cap = r.wdim ? d / r.wdim : 0;
      phTotals[ph].d += d;
      phTotals[ph].c += cap;
      cells.push(
        <td key={ph + "c"} className="border-l border-slate-100 py-1.5 pl-3 pr-2 text-right">{d ? r2(cap) : <span className="text-slate-300">—</span>}</td>,
        <td key={ph + "d"} className="py-1.5 pr-4 text-right text-slate-600">{d ? r1(d) : <span className="text-slate-300">—</span>}</td>
      );
    });
    const mCap = r.wdim ? mDays / r.wdim : 0;
    projDays += mDays;
    projCap += mCap;
    return (
      <tr key={r.m}>
        <td className="py-1.5 pr-4 font-medium">{mLabel(r.m)} <span className="text-xs text-slate-400">({r.wdim} wd)</span></td>
        {cells}
        <td className="border-l border-slate-200 py-1.5 pl-3 pr-2 text-right font-semibold">{r2(mCap)}</td>
        <td className="py-1.5 pr-4 text-right font-semibold">{r1(mDays)}</td>
      </tr>
    );
  });
  return (
    <Card title={"Burn by phase — " + project.name}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Month</th>
              {phases.map((ph) => <th key={ph} colSpan={2} className="border-l border-slate-100 py-2 pl-3 pr-4 text-right">{ph === "—" ? "No phase" : ph}</th>)}
              <th colSpan={2} className="border-l border-slate-200 py-2 pl-3 pr-4 text-right">Project total</th>
            </tr>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
              <th className="py-1 pr-4 font-normal">working-day exact</th>
              {phases.map((ph) => [
                <th key={ph + "c"} className="border-l border-slate-100 py-1 pl-3 pr-2 text-right font-normal">Capacity</th>,
                <th key={ph + "d"} className="py-1 pr-4 text-right font-normal">Days</th>,
              ])}
              <th className="border-l border-slate-200 py-1 pl-3 pr-2 text-right font-normal">Capacity</th>
              <th className="py-1 pr-4 text-right font-normal">Days</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {body}
            <tr className="border-t border-slate-200 font-semibold">
              <td className="py-2 pr-4">Total</td>
              {phases.map((ph) => [
                <td key={ph + "c"} className="border-l border-slate-100 py-2 pl-3 pr-2 text-right">{r2(phTotals[ph].c)} p-m</td>,
                <td key={ph + "d"} className="py-2 pr-4 text-right">{r1(phTotals[ph].d)}</td>,
              ])}
              <td className="border-l border-slate-200 py-2 pl-3 pr-2 text-right">{r2(projCap)} p-m</td>
              <td className="py-2 pr-4 text-right">{r1(projDays)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">Capacity = effort days ÷ working days in the month (person-months, "p-m"). A full-month allocation = 1.00; partial months show as fractions.</p>
    </Card>
  );
}

// ============================================================
// WORKING DAYS REPORT — per resource, month by month, net of leave and comp-off.
// The capacity side of the allocation plan: what each person can actually be
// planned for once leave and comp-off are taken out.
// ============================================================
export function WorkingDaysReport(ctx) {
  const { allEmployees, leaves, comps, leaveTypes, weekendDays, holidaySet, assignments, allProjects, todayISO } = ctx;
  const year = ctx.year || Number(String(todayISO || "").slice(0, 4)) || new Date().getFullYear();
  const all = allEmployees || ctx.employees || [];
  const [month, setMonth] = useState("all");
  const [role, setRole] = useState("All");
  const [company, setCompany] = useState("All");
  const [proj, setProj] = useState("All");
  const [metric, setMetric] = useState("net");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const r1 = (x) => Math.round(x * 10) / 10;
  const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const METRICS = [["net", "Net working days"], ["base", "Calendar working days"], ["leave", "Leave days"], ["comp", "Comp-off earned"]];
  const visMonths = month === "all" ? MONTHS : [Number(month)];
  const [periodStart, periodEnd] = month === "all" ? [year + "-01-01", year + "-12-31"] : monthRange(year, Number(month));
  const mLabel = (m) => parseISO(year + "-" + String(m).padStart(2, "0") + "-01").toLocaleDateString("en-IN", { month: "short" });
  const roles = [...new Set(all.map((e) => e.role || "No role set"))].sort();
  const companies = [...new Set(all.map((e) => e.company || "No company set"))].sort();
  const projList = (allProjects || ctx.projects || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const projName = (pid) => { const p = projList.find((x) => x.id === pid); return p ? p.name : pid; };
  // a person matches the project filter when any of their assignments overlaps the period
  const projNames = useMemo(() => {
    if (proj === "All") return null;
    return new Set(assignments.filter((a) => a.projectId === proj && a.from <= periodEnd && periodStart <= (a.to || OPEN_END)).map((a) => a.name));
  }, [proj, assignments, periodStart, periodEnd]);
  const filter = (e) => (role === "All" || (e.role || "No role set") === role)
    && (company === "All" || (e.company || "No company set") === company)
    && (!q || e.name.toLowerCase().includes(q.toLowerCase()))
    && (!projNames || projNames.has(e.name));
  const rep = useMemo(() => workingDaysByMonth(all, leaves, comps, year, leaveTypes, weekendDays, holidaySet, filter),
    [all, leaves, comps, year, leaveTypes, weekendDays, holidaySet, role, company, q, projNames]); // eslint-disable-line react-hooks/exhaustive-deps
  const { rows: pageRows, pager } = usePaged(rep.rows, 25);
  const metricLabel = (METRICS.find((m) => m[0] === metric) || ["", "Net working days"])[1];
  const totalOf = (r) => sumMonths(r, visMonths, metric);
  const grand = (k) => sumAll(rep.rows, visMonths, k);
  const periodText = month === "all" ? String(year) : mLabel(Number(month)) + " " + year;
  const filterText = [role !== "All" && role, company !== "All" && company, proj !== "All" && projName(proj), q && "“" + q + "”"].filter(Boolean).join(" · ") || "all resources";
  const recordsIn = (name) => leaves
    .filter((l) => l.name === name && l.end >= periodStart && l.start <= periodEnd)
    .map((l) => ({ l, days: leaveDaysInRange(l, periodStart, periodEnd, leaveTypes, weekendDays, holidaySet) }))
    .filter((x) => x.days > 0)
    .sort((a, b) => a.l.start.localeCompare(b.l.start));
  const compsIn = (name) => comps.filter((c) => c.name === name && c.date >= periodStart && c.date <= periodEnd).sort((a, b) => a.date.localeCompare(b.date));
  const typeOf = (name) => {
    const o = {};
    recordsIn(name).forEach((x) => { o[x.l.type] = (o[x.l.type] || 0) + x.days; });
    return o;
  };
  // every configured leave type feeds the net — surface the split so nothing looks left out
  const leaveByType = useMemo(() => {
    const out = {};
    rep.rows.forEach((r) => leaves.forEach((l) => {
      if (l.name !== r.name || l.end < periodStart || l.start > periodEnd) return;
      const d = leaveDaysInRange(l, periodStart, periodEnd, leaveTypes, weekendDays, holidaySet);
      if (d) out[l.type] = (out[l.type] || 0) + d;
    }));
    return out;
  }, [rep, leaves, periodStart, periodEnd, leaveTypes, weekendDays, holidaySet]);

  function exportExcel() {
    const head = ["Resource", "Role", "Company", ...visMonths.map((m) => mLabel(m) + " " + year), metricLabel];
    const body = rep.rows.map((r) => [r.name, r.emp.role || "", r.emp.company || "", ...visMonths.map((m) => r1(r.byMonth[m][metric])), r1(totalOf(r))]);
    const totalRow = ["All", "", "", ...visMonths.map((m) => r1(rep.totals.byMonth[m][metric])), r1(grand(metric))];
    const detail = [["Resource", "Month", "Calendar working days", "Leave days", "Comp-off earned", "Net working days"]];
    rep.rows.forEach((r) => visMonths.forEach((m) => {
      const c = r.byMonth[m];
      detail.push([r.name, mLabel(m) + " " + year, r1(c.base), r1(c.leave), r1(c.comp), r1(c.net)]);
    }));
    const leaveSheet = [["Resource", "Role", "Company", "Start", "End", "Type", "Days in period", "Comment"]];
    rep.rows.forEach((r) => recordsIn(r.name).forEach((x) => leaveSheet.push([r.name, r.emp.role || "", r.emp.company || "", x.l.start, x.l.end, x.l.type, r1(x.days), x.l.comment || ""])));
    const compSheet = [["Resource", "Role", "Company", "Date worked", "Days", "Reason"]];
    rep.rows.forEach((r) => compsIn(r.name).forEach((c) => compSheet.push([r.name, r.emp.role || "", r.emp.company || "", c.date, r1(Number(c.days)), c.reason || ""])));
    const typeSheet = [["Leave type", "Day value", "Days"]];
    leaveTypes.forEach((t) => typeSheet.push([t.name, t.value, r1(leaveByType[t.name] || 0)]));
    typeSheet.push(["All types", "", r1(grand("leave"))]);
    const filters = [["Filters"], ["Period", periodText], ["Role", role], ["Company", company], ["Project", proj === "All" ? "All projects" : projName(proj)], ["Metric", metricLabel], ["Name contains", q || "—"]];
    downloadXlsx("working-days-" + (month === "all" ? String(year) : year + "-" + String(month).padStart(2, "0")) + ".xlsx", [
      ["Working days", [head, ...body, totalRow]],
      ["By month", detail],
      ["Leave by type", typeSheet],
      ["Leave records", leaveSheet],
      ["Comp-off earned", compSheet],
      ["Filters", filters],
    ]);
  }

  return (
    <div className="space-y-5">
      <Notice tone="ok">
        Working days are counted inside each person's employment window only — weekends and the {holidaySet.size} configured holidays are excluded.
        <b> Net</b> = calendar working days − leave + comp-off earned. Every leave type counts — {leaveTypes.map((t) => t.name + (t.value === 1 ? "" : " (" + t.value + " day)")).join(", ")} — so comp-off taken is subtracted like any other leave, and comp-off earned (a weekend or holiday worked) is added back.
      </Notice>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Month">
            <select className={inputCls + " w-36"} value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="all">All of {year}</option>
              {MONTHS.map((m) => <option key={m} value={m}>{mLabel(m)} {year}</option>)}
            </select>
          </Field>
          <Field label="Role">
            <select className={inputCls + " w-44"} value={role} onChange={(e) => setRole(e.target.value)}>
              <option>All</option>{roles.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Company">
            <select className={inputCls + " w-36"} value={company} onChange={(e) => setCompany(e.target.value)}>
              <option>All</option>{companies.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Project">
            <select className={inputCls + " w-44"} value={proj} onChange={(e) => setProj(e.target.value)}>
              <option value="All">All projects</option>
              {projList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Show">
            <select className={inputCls + " w-44"} value={metric} onChange={(e) => setMetric(e.target.value)}>
              {METRICS.map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}
            </select>
          </Field>
          <Field label="Name">
            <input className={inputCls + " w-40"} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <div className="ml-auto self-end"><Btn kind="ghost" small onClick={exportExcel} disabled={!rep.rows.length}>⬇ Excel</Btn></div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Net working days" value={r1(grand("net"))} sub={periodText + " · " + filterText} />
        <Stat label="Calendar working days" value={r1(grand("base"))} sub="before leave and comp-off" />
        <Stat label="Leave days" value={r1(grand("leave"))} sub={"across " + rep.totals.people + " resource(s)"} />
        <Stat label="Comp-off earned" value={r1(grand("comp"))} sub="weekend / holiday days worked" />
      </div>

      <Card title={"Leave days by type — " + periodText + " (every type counts toward the net)"}>
        <div className="flex flex-wrap gap-2">
          {leaveTypes.map((t) => (
            <span key={t.name} className={"inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium " + leaveColor(t.name, leaveTypes)}>
              {t.name}<span className="text-sm font-semibold">{r1(leaveByType[t.name] || 0)}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
            All leave<span className="text-sm font-semibold">{r1(grand("leave"))}</span>
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-400">Each leave day is weighted by its type's value — a Half Day counts 0.5. Comp-off taken is the comp-off type above; comp-off earned is added separately.</p>
      </Card>

      <Card title={metricLabel + " — " + periodText}>
        {rep.rows.length === 0 ? <p className="text-sm text-slate-500">No resources match these filters.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Resource</th>
                  <th className="py-2 pr-4">Role · Company</th>
                  {visMonths.map((m) => <th key={m} className="py-2 pr-3 text-right">{mLabel(m)}</th>)}
                  <th className="py-2 pr-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((r) => {
                  const isOpen = open === r.name;
                  const bt = isOpen ? typeOf(r.name) : {};
                  return [
                    <tr key={r.name} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(isOpen ? null : r.name)}>
                      <td className="py-2 pr-4 font-medium text-slate-800"><span className="mr-1 text-slate-400">{isOpen ? "▾" : "▸"}</span>{r.name}</td>
                      <td className="py-2 pr-4 text-xs text-slate-500">{(r.emp.role || "—") + " · " + (r.emp.company || "—")}{r.emp.inactive ? " · inactive" : ""}</td>
                      {visMonths.map((m) => (
                        <td key={m} className="py-2 pr-3 text-right">{r.byMonth[m][metric] ? r1(r.byMonth[m][metric]) : <span className="text-slate-300">—</span>}</td>
                      ))}
                      <td className="py-2 pr-4 text-right font-semibold text-slate-900">{r1(totalOf(r))}</td>
                    </tr>,
                    isOpen && (
                      <tr key={r.name + "_detail"}>
                        <td colSpan={visMonths.length + 3} className="bg-slate-50 px-4 py-3">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Leave — {r1(sumMonths(r, visMonths, "leave"))} day(s)</div>
                              <div className="mb-2 flex flex-wrap gap-1">
                                {leaveTypes.map((t) => (
                                  <span key={t.name} className={"rounded px-1.5 py-0.5 text-xs " + (bt[t.name] ? leaveColor(t.name, leaveTypes) : "bg-slate-100 text-slate-400")}>
                                    {t.name} {r1(bt[t.name] || 0)}
                                  </span>
                                ))}
                              </div>
                              {recordsIn(r.name).length === 0 ? <p className="text-xs text-slate-400">No leave in this period.</p> : (
                                <ul className="space-y-1">
                                  {recordsIn(r.name).map((x) => (
                                    <li key={x.l.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                                      <Pill tone={leaveColor(x.l.type, leaveTypes)}>{x.l.type}</Pill>
                                      <span>{fmtShort(x.l.start)}{x.l.start !== x.l.end ? " – " + fmtShort(x.l.end) : ""}</span>
                                      <span className="text-slate-400">{r1(x.days)} day(s)</span>
                                      {x.l.comment && <span className="italic text-slate-600">“{x.l.comment}”</span>}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Comp-off earned — {r1(sumMonths(r, visMonths, "comp"))} day(s)</div>
                              {compsIn(r.name).length === 0 ? <p className="text-xs text-slate-400">No comp-off earned in this period.</p> : (
                                <ul className="space-y-1">
                                  {compsIn(r.name).map((c) => (
                                    <li key={c.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                                      <span>{fmtShort(c.date)}</span>
                                      <Pill tone="bg-teal-100 text-teal-800">{r1(Number(c.days))} day(s)</Pill>
                                      {c.reason && <span className="text-slate-500">{c.reason}</span>}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })}
                <tr className="border-t border-slate-200 font-semibold">
                  <td className="py-2 pr-4">All</td>
                  <td className="py-2 pr-4 text-xs font-normal text-slate-500">{rep.totals.people} resource(s)</td>
                  {visMonths.map((m) => <td key={m} className="py-2 pr-3 text-right">{r1(rep.totals.byMonth[m][metric])}</td>)}
                  <td className="py-2 pr-4 text-right">{r1(grand(metric))}</td>
                </tr>
              </tbody>
            </table>
            {pager}
            <p className="mt-2 text-xs text-slate-400">
              Net = calendar working days − leave + comp-off earned. Working days are clipped to each person's employment window (start → end date), and a leave spanning a month end counts in both months. Click a resource for their leave and comp-off detail.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

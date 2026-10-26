import { useState, useMemo } from "react";
import { STREAM_COLORS, computeBurn } from "../lib/allocations.js";
import { OPEN_END } from "../lib/constants.js";
import { fmt, fmtShort, parseISO } from "../lib/dates.js";
import { isActiveDuring } from "../lib/leave.js";
import { HML, MS_STATUSES, RAG_OPTS, RAID_STATUSES, RAID_TYPES, hmlPill, ragPill } from "../lib/raid.js";
import { downloadXlsx } from "../lib/xlsx.js";
import { Btn, Card, Field, Notice, Pill, Stat, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";

export function ProjectsView(ctx) {
  const { projects, setProjects, assignments, employees, empByName, weekendDays, holidaySet, nextId, todayISO, raid, milestones } = ctx;
  const canConfigure = ctx.can("projects.manage");
  const [year, setYear] = useState(2026);
  const [pform, setPform] = useState({ name: "", phases: "", streams: "", description: "", linkLabel: "", linkUrl: "", start: "", end: "", targetMargin: "", pm: "", currentPhase: "" });
  const canRaid = ctx.can("projects.raid");
  const [panel, setPanel] = useState(null); // { id: projectId, tab: "raid" | "ms" }
  const [pedit, setPedit] = useState(null); // { id, phases, streams, description, linkLabel, linkUrl }
  const [msg, setMsg] = useState(null);
  const [selId, setSelId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const r1 = (x) => Math.round(x * 10) / 10;
  const marginsVisible = ctx.user.role === "Project Manager" || ctx.user.role === "Admin";
  const burn = useMemo(() => computeBurn(assignments, ctx.allEmployees, empByName, year, weekendDays, holidaySet),
    [assignments, ctx.allEmployees, empByName, year, weekendDays, holidaySet]);

  // one derivation per project, shared by the list and the detail view
  const rows = projects.map((p) => {
    const g = burn.agg[p.id] || { total: 0, byPhase: {}, byStream: {}, people: new Set() };
    const todayActive = new Set(assignments.filter((a) => a.projectId === p.id && a.from <= todayISO && todayISO <= (a.to || OPEN_END)).map((a) => a.name));
    const raidOpen = raid.filter((x) => x.projectId === p.id && x.status !== "Closed").length;
    const msAll = milestones.filter((x) => x.projectId === p.id);
    const msPending = msAll.filter((x) => x.status !== "Complete");
    const msOverdue = msPending.filter((m) => m.planned && m.planned < todayISO).length;
    return { p, g, todayActive, raidOpen, raidAll: raid.filter((x) => x.projectId === p.id).length, msAll: msAll.length, msPending: msPending.length, msOverdue, pastDue: !!(p.end && p.end < todayISO) };
  });
  const needle = q.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (needle && !(r.p.name.toLowerCase().includes(needle) || (r.p.pm || "").toLowerCase().includes(needle) || (r.p.streams || []).some((s) => s.toLowerCase().includes(needle)))) return false;
    if (flt === "pastdue") return r.pastDue;
    if (flt === "nopm") return !r.p.pm;
    if (flt === "attention") return r.pastDue || r.raidOpen > 0 || r.msOverdue > 0;
    if (flt === "active") return r.todayActive.size > 0;
    if (flt === "idle") return r.todayActive.size === 0;
    return true;
  });
  const sorted = filtered.slice().sort((a, b) => {
    if (sortBy === "effort") return b.g.total - a.g.total;
    if (sortBy === "people") return b.todayActive.size - a.todayActive.size;
    if (sortBy === "end") return ((a.p.end || "9999") < (b.p.end || "9999") ? -1 : 1);
    if (sortBy === "risk") return (b.raidOpen + b.msOverdue) - (a.raidOpen + a.msOverdue);
    return a.p.name.localeCompare(b.p.name);
  });
  const { rows: pageRows, pager } = usePaged(sorted, 25);
  const sel = rows.find((r) => r.p.id === selId) || null;

  const peopleToday = new Set();
  rows.forEach((r) => r.todayActive.forEach((n) => peopleToday.add(n)));
  const totalEffort = rows.reduce((s, r) => s + r.g.total, 0);
  const needsAttention = rows.filter((r) => r.pastDue || r.msOverdue > 0).length;

  function addProject() {
    setMsg(null);
    const name = pform.name.trim();
    if (!name) return setMsg({ tone: "error", text: "Project name is required." });
    if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) return setMsg({ tone: "error", text: "A project named " + name + " already exists." });
    const phases = pform.phases.split(",").map((s) => s.trim()).filter(Boolean);
    const streams = pform.streams.split(",").map((s) => s.trim()).filter(Boolean);
    if (pform.linkUrl && !/^https?:\/\//.test(pform.linkUrl.trim())) return setMsg({ tone: "error", text: "External link must start with http:// or https://" });
    if (pform.start && pform.end && pform.end < pform.start) return setMsg({ tone: "error", text: "Target end date can't be before the start date." });
    const tm = pform.targetMargin === "" ? null : Number(pform.targetMargin);
    if (tm !== null && (isNaN(tm) || tm < 0 || tm > 100)) return setMsg({ tone: "error", text: "Target margin must be a percentage between 0 and 100." });
    setProjects([...projects, { id: nextId("p"), name, phases, streams, trackJira: true, description: pform.description.trim(), linkLabel: pform.linkLabel.trim(), linkUrl: pform.linkUrl.trim(), start: pform.start || null, end: pform.end || null, targetMargin: tm, pm: pform.pm || null, currentPhase: pform.currentPhase || null }]);
    setPform({ name: "", phases: "", streams: "", description: "", linkLabel: "", linkUrl: "", start: "", end: "", targetMargin: "", pm: "", currentPhase: "" });
    setShowNew(false);
    setMsg({ tone: "ok", text: "Project " + name + " created" + (phases.length ? " with phases " + phases.join(", ") : "") + "." });
  }
  function deleteProject(p) {
    if (assignments.some((a) => a.projectId === p.id)) return setMsg({ tone: "error", text: p.name + " has assignments — reassign or delete those first." });
    setProjects(projects.filter((x) => x.id !== p.id));
    setSelId(null);
  }
  function toggleJira(p) {
    setProjects(projects.map((x) => (x.id === p.id ? { ...x, trackJira: x.trackJira === false } : x)));
  }
  function saveEdit(p) {
    if (pedit.linkUrl && !/^https?:\/\//.test(pedit.linkUrl.trim())) return setMsg({ tone: "error", text: "External link must start with http:// or https://" });
    if (pedit.start && pedit.end && pedit.end < pedit.start) return setMsg({ tone: "error", text: "Target end date can't be before the start date." });
    const tm2 = pedit.targetMargin === "" || pedit.targetMargin === null ? null : Number(pedit.targetMargin);
    if (tm2 !== null && (isNaN(tm2) || tm2 < 0 || tm2 > 100)) return setMsg({ tone: "error", text: "Target margin must be a percentage between 0 and 100." });
    setProjects(projects.map((x) => x.id === p.id ? { ...x,
      phases: pedit.phases.split(",").map((s) => s.trim()).filter(Boolean),
      streams: pedit.streams.split(",").map((s) => s.trim()).filter(Boolean),
      description: pedit.description.trim(), linkLabel: pedit.linkLabel.trim(), linkUrl: pedit.linkUrl.trim(),
      start: pedit.start || null, end: pedit.end || null, targetMargin: tm2, pm: pedit.pm || null, currentPhase: pedit.currentPhase || null } : x));
    setPedit(null);
    setMsg({ tone: "ok", text: p.name + " updated." });
  }
  const pmOptions = employees.filter((e) => e.role === "Project Manager" && isActiveDuring(e, todayISO, todayISO));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Projects ({projects.length})</h2>
        <div className="flex items-center gap-2">
          <select className={inputCls + " w-28"} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {canConfigure && !sel && <Btn small kind={showNew ? "ghost" : "primary"} onClick={() => setShowNew(!showNew)}>{showNew ? "Cancel" : "+ New project"}</Btn>}
        </div>
      </div>
      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}
      {!canConfigure && <Notice tone="warn">View only — the project master is maintained by the Project Manager. Leads assign people to these projects from Allocations.</Notice>}

      {canConfigure && showNew && !sel && (
        <Card title="Create project">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Project name"><input className={inputCls} value={pform.name} onChange={(e) => setPform({ ...pform, name: e.target.value })} placeholder="e.g. Bendigo AppDev" /></Field>
            <Field label="Phases (comma-separated, optional)"><input className={inputCls} value={pform.phases} onChange={(e) => setPform({ ...pform, phases: e.target.value })} placeholder="R1, R2" /></Field>
            <Field label="Streams (comma-separated, optional)"><input className={inputCls} value={pform.streams} onChange={(e) => setPform({ ...pform, streams: e.target.value })} placeholder="Bugs, Batches, PM" /></Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Description (optional)"><input className={inputCls} value={pform.description} onChange={(e) => setPform({ ...pform, description: e.target.value })} placeholder="What this engagement covers" /></Field>
            <Field label="External link label (optional)"><input className={inputCls} value={pform.linkLabel} onChange={(e) => setPform({ ...pform, linkLabel: e.target.value })} placeholder="SOW folder / JIRA board" /></Field>
            <Field label="External link URL"><input className={inputCls} value={pform.linkUrl} onChange={(e) => setPform({ ...pform, linkUrl: e.target.value })} placeholder="https://…" /></Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Start date (optional)"><input type="date" className={inputCls} value={pform.start} onChange={(e) => setPform({ ...pform, start: e.target.value })} /></Field>
            <Field label="Target end date (optional)"><input type="date" className={inputCls} value={pform.end} onChange={(e) => setPform({ ...pform, end: e.target.value })} /></Field>
            <Field label="Target margin % (optional · PM/Admin only)"><input type="number" min="0" max="100" step="0.1" className={inputCls} value={pform.targetMargin} onChange={(e) => setPform({ ...pform, targetMargin: e.target.value })} placeholder="e.g. 35" /></Field>
            <Field label="Project manager (owner)">
              <select className={inputCls} value={pform.pm} onChange={(e) => setPform({ ...pform, pm: e.target.value })}>
                <option value="">—</option>
                {pmOptions.map((e) => <option key={e.id}>{e.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-3"><Btn onClick={addProject}>Create project</Btn></div>
        </Card>
      )}

      {!sel && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Projects" value={rows.length} sub={rows.filter((r) => r.todayActive.size > 0).length + " staffed today"} />
            <Stat label="People on projects today" value={peopleToday.size} sub="distinct, across the portfolio" />
            <Stat label={"Effort " + year} value={r1(totalEffort)} sub="person-days allocated" />
            <Stat label="Needs attention" value={needsAttention} sub="past target end or milestone overdue" />
          </div>

          <Card title={"Project register (" + sorted.length + (sorted.length !== rows.length ? " of " + rows.length : "") + ")"}
            right={
              <div className="flex flex-wrap items-center gap-2">
                <input className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm" placeholder="Search name, PM or stream" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={flt} onChange={(e) => setFlt(e.target.value)}>
                  <option value="all">All projects</option><option value="attention">Needs attention</option><option value="active">Staffed today</option><option value="idle">Nobody today</option><option value="pastdue">Past target end</option><option value="nopm">No PM</option>
                </select>
                <select className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="name">Sort: name</option><option value="effort">Sort: most effort</option><option value="people">Sort: most people today</option><option value="end">Sort: earliest end</option><option value="risk">Sort: most open risks</option>
                </select>
                <Btn kind="ghost" small onClick={() => {
                  downloadXlsx("projects.xlsx", [["Projects", [
                    ["Project", "PM", "Current phase", "Start", "Target end", "People today", "People " + year, "Effort " + year + " (days)", "Open RAID", "Pending milestones", "Overdue milestones", "Streams"].concat(marginsVisible ? ["Target margin %"] : []),
                    ...sorted.map((r) => {
                      const base = [r.p.name, r.p.pm || "", r.p.currentPhase || "", r.p.start || "", r.p.end || "", r.todayActive.size, r.g.people.size, r1(r.g.total), r.raidOpen, r.msPending, r.msOverdue, (r.p.streams || []).join(", ")];
                      return marginsVisible ? base.concat([r.p.targetMargin ?? ""]) : base;
                    }),
                  ]]]);
                }}>⬇ Excel</Btn>
              </div>
            }>
            {sorted.length === 0 ? <p className="text-sm text-slate-500">No projects match this filter.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Project</th><th className="py-2 pr-3">PM</th><th className="py-2 pr-3">Phase</th><th className="py-2 pr-3">Window</th>
                      <th className="py-2 pr-3 text-right">Today</th><th className="py-2 pr-3 text-right">People {year}</th><th className="py-2 pr-3 text-right">Effort {year}</th>
                      <th className="py-2 pr-3 text-center">RAID</th><th className="py-2 pr-3 text-center">Milestones</th><th className="py-2 pr-3">Streams</th><th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageRows.map((r) => (
                      <tr key={r.p.id} className="cursor-pointer align-top hover:bg-slate-50" onClick={() => { setSelId(r.p.id); setPanel(null); setPedit(null); }}>
                        <td className="py-2 pr-3 font-medium text-slate-800">
                          {r.p.name}
                          {r.p.phases.length > 1 && <span className="ml-1 text-xs text-slate-400">{r.p.phases.length} phases</span>}
                        </td>
                        <td className="py-2 pr-3">{r.p.pm || <span className="text-amber-600">unassigned</span>}</td>
                        <td className="py-2 pr-3">{r.p.currentPhase || <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 pr-3 text-xs">
                          {r.p.start || r.p.end ? (
                            <span className={r.pastDue ? "font-medium text-red-600" : "text-slate-600"}>
                              {r.p.start ? fmtShort(r.p.start) : "—"} → {r.p.end ? fmtShort(r.p.end) : "—"}{r.pastDue ? " · past due" : ""}
                            </span>
                          ) : <span className="text-slate-300">not set</span>}
                        </td>
                        <td className={"py-2 pr-3 text-right font-semibold " + (r.todayActive.size ? "text-slate-800" : "text-slate-300")}>{r.todayActive.size}</td>
                        <td className="py-2 pr-3 text-right text-slate-600">{r.g.people.size}</td>
                        <td className="py-2 pr-3 text-right text-slate-600">{r1(r.g.total)}</td>
                        <td className="py-2 pr-3 text-center">{r.raidOpen ? <Pill tone="bg-amber-100 text-amber-800">{r.raidOpen}</Pill> : <span className="text-slate-300">0</span>}</td>
                        <td className="py-2 pr-3 text-center">
                          {r.msAll === 0 ? <span className="text-slate-300">—</span> : <Pill tone={r.msOverdue ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}>{r.msAll - r.msPending}/{r.msAll}{r.msOverdue ? " · " + r.msOverdue + " late" : ""}</Pill>}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="flex flex-wrap gap-1">
                            {(r.p.streams || []).slice(0, 3).map((s) => <Pill key={s} tone={STREAM_COLORS[s] || "bg-slate-100 text-slate-600"}>{s}</Pill>)}
                            {(r.p.streams || []).length > 3 && <span className="text-xs text-slate-400">+{(r.p.streams || []).length - 3}</span>}
                            {(r.p.streams || []).length === 0 && <span className="text-xs text-slate-300">none</span>}
                          </span>
                        </td>
                        <td className="py-2 text-right text-xs text-slate-400">open ›</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pager}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">Today = people assigned on {fmt(todayISO)}. People / effort for {year} come from allocations (8 h per working day). Open a project for its phase &amp; stream breakdown, RAID log and milestones.</p>
          </Card>
        </>
      )}

      {sel && (() => {
        const { p, g, todayActive, raidOpen, raidAll, msAll, msPending } = sel;
        const maxPh = Math.max(1, ...Object.values(g.byPhase));
        const maxSt = Math.max(1, ...Object.values(g.byStream));
        const idx = sorted.findIndex((x) => x.p.id === p.id);
        const goto = (i) => { setSelId(sorted[i].p.id); setPanel(null); setPedit(null); };
        return (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Btn kind="ghost" small onClick={() => { setSelId(null); setPanel(null); setPedit(null); }}>‹ All projects</Btn>
              <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>{p.name}</h3>
              {p.phases.length > 0 && <span className="text-xs text-slate-500">phases: {p.phases.join(", ")}</span>}
              <span className="ml-auto flex gap-1">
                <Btn small kind="ghost" disabled={idx <= 0} onClick={() => goto(idx - 1)}>‹ Prev</Btn>
                <Btn small kind="ghost" disabled={idx < 0 || idx >= sorted.length - 1} onClick={() => goto(idx + 1)}>Next ›</Btn>
                {canConfigure && (
                  <>
                    <Btn small kind="ghost" onClick={() => setPedit({ id: p.id, phases: p.phases.join(", "), streams: (p.streams || []).join(", "), description: p.description || "", linkLabel: p.linkLabel || "", linkUrl: p.linkUrl || "", start: p.start || "", end: p.end || "", targetMargin: p.targetMargin ?? "", pm: p.pm || "", currentPhase: p.currentPhase || "" })}>Edit</Btn>
                    <Btn small kind="danger" onClick={() => deleteProject(p)}>Delete</Btn>
                  </>
                )}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="On it today" value={todayActive.size} sub={todayActive.size ? [...todayActive].slice(0, 3).join(", ") + (todayActive.size > 3 ? " +" + (todayActive.size - 3) : "") : "nobody assigned today"} />
              <Stat label={"People in " + year} value={g.people.size} sub="distinct assignees" />
              <Stat label={"Effort " + year} value={r1(g.total)} sub="person-days from allocations" />
              <Stat label="Open RAID / milestones" value={raidOpen + " / " + msPending} sub={sel.msOverdue ? sel.msOverdue + " milestone(s) overdue" : "nothing overdue"} />
            </div>

            <Card title="Project master">
              {pedit && pedit.id === p.id ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Phases (comma-separated)"><input className={inputCls} value={pedit.phases} onChange={(e) => setPedit({ ...pedit, phases: e.target.value })} /></Field>
                    <Field label="Streams (comma-separated)"><input className={inputCls} value={pedit.streams} onChange={(e) => setPedit({ ...pedit, streams: e.target.value })} /></Field>
                    <Field label="Description"><input className={inputCls} value={pedit.description} onChange={(e) => setPedit({ ...pedit, description: e.target.value })} /></Field>
                    <Field label="Link label"><input className={inputCls} value={pedit.linkLabel} onChange={(e) => setPedit({ ...pedit, linkLabel: e.target.value })} /></Field>
                    <Field label="Link URL"><input className={inputCls} value={pedit.linkUrl} onChange={(e) => setPedit({ ...pedit, linkUrl: e.target.value })} /></Field>
                    <Field label="Start date"><input type="date" className={inputCls} value={pedit.start} onChange={(e) => setPedit({ ...pedit, start: e.target.value })} /></Field>
                    <Field label="Target end date"><input type="date" className={inputCls} value={pedit.end} onChange={(e) => setPedit({ ...pedit, end: e.target.value })} /></Field>
                    <Field label="Target margin %"><input type="number" min="0" max="100" step="0.1" className={inputCls} value={pedit.targetMargin} onChange={(e) => setPedit({ ...pedit, targetMargin: e.target.value })} /></Field>
                    <Field label="Project manager (owner)">
                      <select className={inputCls} value={pedit.pm} onChange={(e) => setPedit({ ...pedit, pm: e.target.value })}>
                        <option value="">—</option>
                        {pmOptions.map((e) => <option key={e.id}>{e.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Current phase (for reporting)">
                      <select className={inputCls} value={pedit.currentPhase} onChange={(e) => setPedit({ ...pedit, currentPhase: e.target.value })}>
                        <option value="">—</option>
                        {pedit.phases.split(",").map((s) => s.trim()).filter(Boolean).map((ph) => <option key={ph}>{ph}</option>)}
                      </select>
                    </Field>
                    <div className="flex items-end gap-2">
                      <Btn small onClick={() => saveEdit(p)}>Save</Btn>
                      <Btn small kind="ghost" onClick={() => setPedit(null)}>Cancel</Btn>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Removing a stream doesn't touch existing assignments — they keep their recorded stream; new assignments only offer the streams listed here.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {p.pm ? <Pill tone="bg-sky-100 text-sky-800">PM: {p.pm}</Pill> : <Pill tone="bg-amber-100 text-amber-800">No PM assigned</Pill>}
                    {p.currentPhase && <Pill tone="bg-indigo-100 text-indigo-800">Phase: {p.currentPhase}</Pill>}
                    {p.start && <Pill tone="bg-slate-100 text-slate-600">Start {fmt(p.start)}</Pill>}
                    {p.end && <Pill tone={p.end < todayISO ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}>Target end {fmt(p.end)}{p.end < todayISO ? " · past due" : ""}</Pill>}
                    {p.targetMargin !== null && p.targetMargin !== undefined && marginsVisible && <Pill tone="bg-purple-100 text-purple-800">Target margin {p.targetMargin}%</Pill>}
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    {p.description && <p className="text-slate-600">{p.description}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      {p.linkUrl && <a href={p.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-emerald-700 underline decoration-emerald-300 hover:decoration-emerald-700">{p.linkLabel || p.linkUrl} ↗</a>}
                      {(p.streams || []).map((s) => <Pill key={s} tone={STREAM_COLORS[s] || "bg-slate-100 text-slate-600"}>{s}</Pill>)}
                      {(p.streams || []).length === 0 && <span className="text-xs text-slate-400">No streams defined — assignments on this project carry no stream.</span>}
                    </div>
                  </div>
                  <label className={"mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm " + (canConfigure ? "cursor-pointer border-slate-300 text-slate-700 hover:bg-slate-50" : "border-slate-200 text-slate-400")}>
                    <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={p.trackJira !== false} disabled={!canConfigure} onChange={() => toggleJira(p)} />
                    Count JIRA in timecard score
                  </label>
                </>
              )}
            </Card>

            <Card title={"Effort breakdown — " + year}>
              {g.total === 0 ? <p className="text-sm text-slate-500">No effort lands in {year} yet — assign people from Allocations → Plan.</p> : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">By phase</div>
                    {Object.entries(g.byPhase).sort((a, b) => b[1] - a[1]).map(([ph, v]) => (
                      <div key={ph} className="mb-1 flex items-center gap-2 text-xs">
                        <div className="w-16 shrink-0 truncate font-medium text-slate-700">{ph}</div>
                        <div className="h-4 flex-1 rounded bg-slate-100"><div className="mdb-bar h-4 rounded" style={{ width: Math.max(4, Math.round((v / maxPh) * 100)) + "%" }} /></div>
                        <div className="w-12 shrink-0 text-right text-slate-500">{r1(v)}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">By stream</div>
                    {Object.entries(g.byStream).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, v]) => (
                      <div key={s} className="mb-1 flex items-center gap-2 text-xs">
                        <div className="w-32 shrink-0 truncate"><Pill tone={STREAM_COLORS[s] || "bg-slate-100 text-slate-600"}>{s}</Pill></div>
                        <div className="h-4 flex-1 rounded bg-slate-100"><div className="mdb-bar h-4 rounded" style={{ width: Math.max(4, Math.round((v / maxSt) * 100)) + "%" }} /></div>
                        <div className="w-12 shrink-0 text-right text-slate-500">{r1(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <div className="flex flex-wrap gap-2">
              <Btn small kind={panel?.id === p.id && panel.tab === "raid" ? "primary" : "ghost"} onClick={() => setPanel(panel?.id === p.id && panel.tab === "raid" ? null : { id: p.id, tab: "raid" })}>
                RAID log ({raidOpen} open / {raidAll})
              </Btn>
              <Btn small kind={panel?.id === p.id && panel.tab === "ms" ? "primary" : "ghost"} onClick={() => setPanel(panel?.id === p.id && panel.tab === "ms" ? null : { id: p.id, tab: "ms" })}>
                Milestones ({msPending} pending / {msAll})
              </Btn>
            </div>
            {panel?.id === p.id && panel.tab === "raid" && <RaidPanel {...ctx} project={p} canEdit={canRaid} />}
            {panel?.id === p.id && panel.tab === "ms" && <MilestonePanel {...ctx} project={p} canEdit={canRaid} />}
          </>
        );
      })()}
    </div>
  );
}

export function RaidPanel(ctx) {
  const { raid, setRaid, project, canEdit, nextId, todayISO, user } = ctx;
  const empty = { type: "Risk", desc: "", impact: "M", probability: "M", owner: "", targetDate: "", status: "Open", link: "", comments: "" };
  const [f, setF] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [m, setM] = useState(null);
  const rows = raid.filter((x) => x.projectId === project.id).sort((a, b) => (a.status === "Closed") - (b.status === "Closed") || (a.targetDate || "9999") < (b.targetDate || "9999") ? -1 : 1);
  const { rows: pageRows, pager } = usePaged(rows, 10);
  function save() {
    setM(null);
    if (!f.desc.trim()) return setM("A description is required.");
    if (editId) {
      setRaid(raid.map((x) => (x.id === editId ? { ...x, ...f, desc: f.desc.trim(), updatedAt: todayISO } : x)));
      setEditId(null);
    } else {
      setRaid([...raid, { ...f, id: nextId("rd"), projectId: project.id, desc: f.desc.trim(), createdBy: user.name, createdAt: todayISO, updatedAt: todayISO }]);
    }
    setF(empty);
  }
  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 text-sm font-semibold text-slate-700">RAID log — {project.name}</div>
      {canEdit && (
        <div className="mb-3 rounded-lg bg-white p-3 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-6">
            <Field label="Type"><select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{RAID_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Impact (H/M/L)"><select className={inputCls} value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })}>{HML.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Probability (H/M/L)"><select className={inputCls} value={f.probability} onChange={(e) => setF({ ...f, probability: e.target.value })}>{HML.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Owner"><input className={inputCls} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} placeholder="MDB / customer / name" /></Field>
            <Field label="Target date"><input type="date" className={inputCls} value={f.targetDate} onChange={(e) => setF({ ...f, targetDate: e.target.value })} /></Field>
            <Field label="Status"><select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{RAID_STATUSES.map((t) => <option key={t}>{t}</option>)}</select></Field>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Field label="Description"><input className={inputCls} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="What's the risk / issue / dependency / decision" /></Field>
            <Field label="Linked item (Jira / Smartsheet / etc.)"><input className={inputCls} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="OPUSM-1234 or URL" /></Field>
            <Field label="Comments"><input className={inputCls} value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} /></Field>
          </div>
          {m && <div className="mt-2"><Notice tone="error">{m}</Notice></div>}
          <div className="mt-2 flex gap-2">
            <Btn small onClick={save}>{editId ? "Save changes" : "Add entry"}</Btn>
            {editId && <Btn small kind="ghost" onClick={() => { setEditId(null); setF(empty); }}>Cancel edit</Btn>}
          </div>
        </div>
      )}
      {rows.length === 0 ? <p className="text-sm text-slate-500">No RAID entries{canEdit ? " — add the first above." : "."}</p> : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Type</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-center">Impact</th><th className="px-3 py-2 text-center">Prob.</th>
                <th className="px-3 py-2">Owner</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Linked</th><th className="px-3 py-2">Comments</th>{canEdit && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((x) => (
                <tr key={x.id} className={x.status === "Closed" ? "text-slate-400" : ""}>
                  <td className="px-3 py-1.5"><Pill tone={x.type === "Risk" ? "bg-amber-100 text-amber-800" : x.type === "Issue" ? "bg-red-100 text-red-800" : x.type === "Dependency" ? "bg-sky-100 text-sky-800" : "bg-purple-100 text-purple-800"}>{x.type}</Pill></td>
                  <td className="px-3 py-1.5 text-slate-700">{x.desc}</td>
                  <td className="px-3 py-1.5 text-center"><Pill tone={hmlPill(x.impact)}>{x.impact}</Pill></td>
                  <td className="px-3 py-1.5 text-center"><Pill tone={hmlPill(x.probability)}>{x.probability}</Pill></td>
                  <td className="px-3 py-1.5">{x.owner || "—"}</td>
                  <td className="px-3 py-1.5">
                    {x.targetDate ? (
                      <span className="inline-flex items-center gap-1">
                        {fmt(x.targetDate)}
                        {x.status !== "Closed" && x.targetDate < todayISO && <Pill tone="bg-red-100 text-red-800">overdue</Pill>}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-1.5"><Pill tone={x.status === "Closed" ? "bg-slate-100 text-slate-500" : x.status === "In Progress" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}>{x.status}</Pill></td>
                  <td className="px-3 py-1.5 text-xs">{x.link ? (/^https?:\/\//.test(x.link) ? <a href={x.link} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">{x.link.slice(0, 24)}…</a> : x.link) : "—"}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{x.comments || "—"}</td>
                  {canEdit && <td className="px-2 py-1.5 text-right">
                    <span className="flex justify-end gap-1">
                      <Btn small kind="ghost" onClick={() => { setEditId(x.id); setF({ type: x.type, desc: x.desc, impact: x.impact, probability: x.probability, owner: x.owner || "", targetDate: x.targetDate || "", status: x.status, link: x.link || "", comments: x.comments || "" }); }}>Edit</Btn>
                      <Btn small kind="danger" onClick={() => setRaid(raid.filter((y) => y.id !== x.id))}>✕</Btn>
                    </span>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pager}
    </div>
  );
}

export function MilestonePanel(ctx) {
  const { milestones, setMilestones, project, canEdit, nextId, todayISO, user } = ctx;
  const empty = { name: "", phase: "", planned: "", actual: "", status: "Not Started", rag: "Green", comments: "" };
  const [f, setF] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [m, setM] = useState(null);
  const rows = milestones.filter((x) => x.projectId === project.id).sort((a, b) => ((a.planned || "9999") < (b.planned || "9999") ? -1 : 1));
  const { rows: pageRows, pager } = usePaged(rows, 10);
  function save() {
    setM(null);
    if (!f.name.trim()) return setM("A milestone name is required.");
    if (f.status === "Complete" && !f.actual) return setM("A Complete milestone needs its actual date.");
    if (editId) {
      setMilestones(milestones.map((x) => (x.id === editId ? { ...x, ...f, name: f.name.trim(), updatedAt: todayISO } : x)));
      setEditId(null);
    } else {
      setMilestones([...milestones, { ...f, id: nextId("ms"), projectId: project.id, name: f.name.trim(), createdBy: user.name, createdAt: todayISO, updatedAt: todayISO }]);
    }
    setF(empty);
  }
  const slip = (x) => (x.planned && x.actual ? Math.round((parseISO(x.actual) - parseISO(x.planned)) / 86400000) : null);
  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 text-sm font-semibold text-slate-700">Milestones — {project.name}</div>
      {canEdit && (
        <div className="mb-3 rounded-lg bg-white p-3 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-7">
            <Field label="Milestone name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="UAT start" /></Field>
            <Field label="Phase">
              <select className={inputCls} value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value })}>
                <option value="">—</option>
                {project.phases.map((ph) => <option key={ph}>{ph}</option>)}
              </select>
            </Field>
            <Field label="Planned date"><input type="date" className={inputCls} value={f.planned} onChange={(e) => setF({ ...f, planned: e.target.value })} /></Field>
            <Field label="Actual date"><input type="date" className={inputCls} value={f.actual} onChange={(e) => setF({ ...f, actual: e.target.value })} /></Field>
            <Field label="Status"><select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{MS_STATUSES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="RAG"><select className={inputCls} value={f.rag} onChange={(e) => setF({ ...f, rag: e.target.value })}>{RAG_OPTS.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Comments"><input className={inputCls} value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} /></Field>
          </div>
          {m && <div className="mt-2"><Notice tone="error">{m}</Notice></div>}
          <div className="mt-2 flex gap-2">
            <Btn small onClick={save}>{editId ? "Save changes" : "Add milestone"}</Btn>
            {editId && <Btn small kind="ghost" onClick={() => { setEditId(null); setF(empty); }}>Cancel edit</Btn>}
          </div>
        </div>
      )}
      {rows.length === 0 ? <p className="text-sm text-slate-500">No milestones{canEdit ? " — add the first above." : "."}</p> : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Milestone</th><th className="px-3 py-2">Phase</th><th className="px-3 py-2">Planned</th><th className="px-3 py-2">Actual</th><th className="px-3 py-2 text-right">Slip</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">RAG</th><th className="px-3 py-2">Comments</th>{canEdit && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((x) => {
                const s = slip(x);
                return (
                  <tr key={x.id} className={x.status === "Complete" ? "text-slate-500" : ""}>
                    <td className="px-3 py-1.5 font-medium text-slate-800">{x.name}</td>
                    <td className="px-3 py-1.5">{x.phase || "—"}</td>
                    <td className="px-3 py-1.5">{x.planned ? fmt(x.planned) : "—"}</td>
                    <td className="px-3 py-1.5">
                      {x.actual ? fmt(x.actual) : (x.planned && x.planned < todayISO && x.status !== "Complete" ? <Pill tone="bg-red-100 text-red-800">overdue</Pill> : "—")}
                    </td>
                    <td className="px-3 py-1.5 text-right">{s === null ? <span className="text-slate-300">—</span> : <span className={s > 0 ? "font-medium text-red-600" : s < 0 ? "font-medium text-emerald-700" : "text-slate-400"}>{s > 0 ? "+" + s : s} d</span>}</td>
                    <td className="px-3 py-1.5"><Pill tone={x.status === "Complete" ? "bg-emerald-100 text-emerald-800" : x.status === "In Progress" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"}>{x.status}</Pill></td>
                    <td className="px-3 py-1.5"><Pill tone={ragPill(x.rag)}>{x.rag}</Pill></td>
                    <td className="px-3 py-1.5 text-xs text-slate-500">{x.comments || "—"}</td>
                    {canEdit && <td className="px-2 py-1.5 text-right">
                      <span className="flex justify-end gap-1">
                        <Btn small kind="ghost" onClick={() => { setEditId(x.id); setF({ name: x.name, phase: x.phase || "", planned: x.planned || "", actual: x.actual || "", status: x.status, rag: x.rag, comments: x.comments || "" }); }}>Edit</Btn>
                        <Btn small kind="danger" onClick={() => setMilestones(milestones.filter((y) => y.id !== x.id))}>✕</Btn>
                      </span>
                    </td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pager}
    </div>
  );
}

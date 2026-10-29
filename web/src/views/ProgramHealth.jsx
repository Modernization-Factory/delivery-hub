import { useState } from "react";
import { Table } from "lucide-react";
import { fmt, parseISO, toISO } from "../lib/dates.js";
import { PH_RAG_ACCENT, PH_RAG_TONE, PH_STAGES, phBurnVsPlan, phEffortVar, phElapsedPct, phHighRisks, phOverallStatus, phPct, phRowFor, phScheduleVar } from "../lib/programHealth.js";
import { RAG_OPTS } from "../lib/raid.js";
import { downloadXlsx } from "../lib/xlsx.js";
import { Btn, Card, Field, Notice, Pill, Stat, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";

// ============================================================
// PROGRAM HEALTH (portfolio · weekly health · pipeline)
// Raw facts stored; RAG, elapsed %, variances derived on render.
// ============================================================
export function ProgramHealthView(ctx) {
  const { projects, setProjects, raid, milestones, weeklyHealth, setWeeklyHealth, pipeline, setPipeline, nextId, todayISO, user } = ctx;
  const canRegister = ctx.can("ph.register");
  const canWeekly = ctx.can("ph.weekly");
  const canPipeline = ctx.can("ph.pipeline");
  const marginsVisible = user.role === "Project Manager" || user.role === "Admin";
  const [tab, setTab] = useState("portfolio");
  const [msg, setMsg] = useState(null);
  const pc = (x) => (x === null || x === undefined ? "—" : Math.round(x * 100) + "%");
  const ragTone = PH_RAG_TONE;
  const latestWeekly = (pid) => weeklyHealth.filter((w) => w.projectId === pid).sort((a, b) => b.week.localeCompare(a.week))[0] || null;

  // one derivation per project, shared by the tiles, the table and the detail view
  const phRow = (p) => phRowFor(p, { weeklyHealth, raid, milestones, todayISO });
  const rows = projects.map(phRow);
  const [selId, setSelId] = useState(null);
  const [portView, setPortView] = useState("tiles");
  const sel = rows.find((r) => r.p.id === selId) || null;

  // ---- portfolio register ----
  const [regEdit, setRegEdit] = useState(null); // { id, totalStories, doneStories, currentMargin, keyUpdate }
  function saveRegister(p) {
    const t = regEdit.totalStories === "" ? null : Number(regEdit.totalStories);
    const dn = regEdit.doneStories === "" ? null : Number(regEdit.doneStories);
    const cm = regEdit.currentMargin === "" ? null : Number(regEdit.currentMargin);
    if (t !== null && dn !== null && dn > t) return setMsg({ tone: "error", text: "Completed stories can't exceed total." });
    setProjects(projects.map((x) => (x.id === p.id ? { ...x, totalStories: t, doneStories: dn, currentMargin: cm, keyUpdate: regEdit.keyUpdate.trim() } : x)));
    setRegEdit(null);
    setMsg({ tone: "ok", text: p.name + " register updated." });
  }

  // ---- weekly health ----
  const satOf = (iso) => { const d = parseISO(iso); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7)); return toISO(d); };
  const emptyW = { projectId: "", week: satOf(todayISO), hoursPlanned: "", hoursBurnt: "", scopeChanges: false, rag: "Green", oneLiner: "" };
  const [wf, setWf] = useState(emptyW);
  const [wEditId, setWEditId] = useState(null);
  const effWPid = projects.some((p) => p.id === wf.projectId) ? wf.projectId : (projects[0] ? projects[0].id : "");
  function saveWeekly() {
    setMsg(null);
    if (!effWPid) return setMsg({ tone: "error", text: "Create a project first." });
    if (!wf.week) return setMsg({ tone: "error", text: "Week ending date is required." });
    if (wf.hoursPlanned === "" || Number(wf.hoursPlanned) < 0) return setMsg({ tone: "error", text: "Hours planned is required (0 is allowed)." });
    const dup = weeklyHealth.find((w) => w.projectId === effWPid && w.week === wf.week && w.id !== wEditId);
    if (dup) return setMsg({ tone: "error", text: "An entry for that project and week already exists — edit it instead." });
    const doc = { projectId: effWPid, week: wf.week, hoursPlanned: Number(wf.hoursPlanned) || 0, hoursBurnt: Number(wf.hoursBurnt) || 0, scopeChanges: !!wf.scopeChanges, rag: wf.rag, oneLiner: wf.oneLiner.trim() };
    if (wEditId) {
      setWeeklyHealth(weeklyHealth.map((w) => (w.id === wEditId ? { ...w, ...doc, updatedAt: todayISO } : w)));
      setWEditId(null);
    } else {
      setWeeklyHealth([...weeklyHealth, { ...doc, id: nextId("wh"), createdBy: user.name, createdAt: todayISO, updatedAt: todayISO }]);
    }
    setWf({ ...emptyW, projectId: effWPid });
    setMsg({ tone: "ok", text: "Weekly health saved." });
  }
  const [whProj, setWhProj] = useState("all");
  const whRows = weeklyHealth.filter((w) => projects.some((p) => p.id === w.projectId) && (whProj === "all" || w.projectId === whProj)).sort((a, b) => b.week.localeCompare(a.week));
  const { rows: whPage, pager: whPager } = usePaged(whRows, 10);

  // ---- pipeline ----
  const emptyP = { company: "", stage: PH_STAGES[0], potentialStart: "", potentialResources: "", commentary: "", nextAction: "" };
  const [pf2, setPf2] = useState(emptyP);
  const [pEditId, setPEditId] = useState(null);
  function savePipeline() {
    setMsg(null);
    if (!pf2.company.trim()) return setMsg({ tone: "error", text: "Company / opportunity name is required." });
    const doc = { company: pf2.company.trim(), stage: pf2.stage, potentialStart: pf2.potentialStart.trim(), potentialResources: pf2.potentialResources === "" ? null : Number(pf2.potentialResources), commentary: pf2.commentary.trim(), nextAction: pf2.nextAction.trim() };
    if (pEditId) {
      setPipeline(pipeline.map((x) => (x.id === pEditId ? { ...x, ...doc, updatedAt: todayISO } : x)));
      setPEditId(null);
    } else {
      setPipeline([...pipeline, { ...doc, id: nextId("pl"), createdBy: user.name, createdAt: todayISO, updatedAt: todayISO }]);
    }
    setPf2(emptyP);
  }

  const pName = (pid) => { const p = projects.find((x) => x.id === pid); return p ? p.name : "?"; };
  const openHigh = raid.filter((x) => x.status !== "Closed" && x.impact === "H" && projects.some((p) => p.id === x.projectId)); // open projects only

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Program Health</h2>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {[["portfolio", "Portfolio"], ["weekly", "Weekly health"], ["pipeline", "Pipeline (" + pipeline.length + ")"]].map(([v, lab]) => (
            <button key={v} onClick={() => setTab(v)} className={"rounded-md px-3 py-1 text-sm " + (tab === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>{lab}</button>
          ))}
        </div>
      </div>
      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}

      {tab === "portfolio" && sel && (
        <ProjectHealthDetail row={sel} onBack={() => setSelId(null)} marginsVisible={marginsVisible} todayISO={todayISO} raid={raid} />
      )}

      {tab === "portfolio" && !sel && (
        <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Projects" value={rows.length} sub="in the active register" />
          {["Green", "Amber", "Red"].map((s) => {
            const n = rows.filter((r) => r.st.status === s).length;
            return <Stat key={s} label={s} value={n} sub={s === "Green" ? "on track" : s === "Amber" ? "watch" : "needs intervention"} />;
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">Status uses the latest weekly RAG when a PM has submitted one, otherwise it is derived from burn, schedule, risks and milestones. Click a tile for the project detail.</p>
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {[["tiles", "Tiles"], ["table", "Table"]].map(([v, lab]) => (
              <button key={v} onClick={() => setPortView(v)} className={"rounded-md px-3 py-1 text-sm " + (portView === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>{lab}</button>
            ))}
          </div>
        </div>

        {portView === "tiles" && (
          rows.length === 0 ? <Card><p className="text-sm text-slate-500">No projects in the register yet.</p></Card> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <button key={r.p.id} onClick={() => setSelId(r.p.id)}
                  className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
                  style={{ borderTop: "3px solid " + PH_RAG_ACCENT[r.st.status] }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>{r.p.name}</div>
                      <div className="text-xs text-slate-500">{r.p.pm || "no PM"}{r.p.currentPhase ? " · " + r.p.currentPhase : ""}</div>
                    </div>
                    <Pill tone={ragTone[r.st.status]}>{r.st.status}{r.st.fromPM ? "" : " *"}</Pill>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: Math.min(100, Math.max(0, Math.round((r.sv.completion || 0) * 100))) + "%", background: PH_RAG_ACCENT[r.st.status] }} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[["Elapsed", pc(r.el)], ["Done", pc(r.sv.completion)], ["Burn vs plan", pc(r.bv)]].map(([l, v]) => (
                      <div key={l}>
                        <div className="text-sm font-semibold text-slate-800">{v}</div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">{l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                    {r.hr > 0 && <Pill tone="bg-red-100 text-red-800">{r.hr} high risk{r.hr > 1 ? "s" : ""}</Pill>}
                    {r.overdue > 0 && <Pill tone="bg-orange-100 text-orange-800">{r.overdue} overdue milestone{r.overdue > 1 ? "s" : ""}</Pill>}
                    {r.hr === 0 && r.overdue === 0 && <span className="text-slate-400">no open flags</span>}
                  </div>
                  <div className="mt-2 truncate text-xs text-slate-500">{(r.lw && r.lw.oneLiner) || r.p.keyUpdate || (r.lw ? "" : "no weekly entry yet")}</div>
                </button>
              ))}
            </div>
          )
        )}

        {portView === "table" && (
        <Card title={"Active projects (" + projects.length + ") — derived live from register data, weekly entries, RAID and milestones"}
          right={<Btn kind="ghost" small onClick={() => {
            downloadXlsx("program-health-portfolio.xlsx", [["Portfolio", [
              ["Project", "PM", "Phase", "Start", "Target end", "% time elapsed", "Stories done/total", "Task completion %", "Burn vs plan %", "Schedule variance %", "High risks (open)", "Next milestone", "Latest RAG", "Key update"].concat(marginsVisible ? ["Target margin %", "Current margin %", "Margin variance %"] : []),
              ...projects.map((p) => {
                const el = phElapsedPct(p.start, p.end, todayISO);
                const sv = phScheduleVar(p.totalStories, p.doneStories, el);
                const bv = phBurnVsPlan(weeklyHealth.filter((w) => w.projectId === p.id));
                const lw = latestWeekly(p.id);
                const base = [p.name, p.pm || "", p.currentPhase || "", p.start || "", p.end || "", el === null ? "" : el, (p.doneStories ?? "") + "/" + (p.totalStories ?? ""), sv.completion ?? "", bv ?? "", sv.variance ?? "", phHighRisks(raid, p.id), (() => { const nm = milestones.filter((m) => m.projectId === p.id && m.status !== "Complete").sort((a, b) => ((a.planned || "9999") < (b.planned || "9999") ? -1 : 1))[0]; return nm ? nm.name + (nm.planned ? " " + nm.planned : "") : ""; })(), lw ? lw.rag : "", p.keyUpdate || ""];
                return marginsVisible ? base.concat([p.targetMargin ?? "", p.currentMargin ?? "", p.targetMargin !== null && p.targetMargin !== undefined && p.currentMargin !== null && p.currentMargin !== undefined ? Math.round((p.currentMargin - p.targetMargin) * 10) / 10 : ""]) : base;
              }),
            ]]]);
          }}>⬇ Excel</Btn>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Project</th><th className="py-2 pr-3">PM</th><th className="py-2 pr-3">Phase</th>
                  <th className="py-2 pr-3 text-right">Elapsed</th><th className="py-2 pr-3 text-right">Stories</th><th className="py-2 pr-3 text-right">Done</th>
                  <th className="py-2 pr-3 text-right">Burn vs plan</th><th className="py-2 pr-3 text-right">Sched. var</th>
                  {marginsVisible && <th className="py-2 pr-3 text-right">Margin T/C</th>}
                  <th className="py-2 pr-3 text-center">High risks</th><th className="py-2 pr-3">Next milestone</th><th className="py-2 pr-3">RAG</th><th className="py-2 pr-3">Key update</th>
                  {canRegister && <th />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((p) => {
                  const el = phElapsedPct(p.start, p.end, todayISO);
                  const sv = phScheduleVar(p.totalStories, p.doneStories, el);
                  const bv = phBurnVsPlan(weeklyHealth.filter((w) => w.projectId === p.id));
                  const lw = latestWeekly(p.id);
                  const hr = phHighRisks(raid, p.id);
                  const editing = regEdit && regEdit.id === p.id;
                  return (
                    <tr key={p.id} className="align-top">
                      <td className="py-2 pr-3 font-medium text-slate-800">
                        <button onClick={() => setSelId(p.id)} className="text-left hover:underline">{p.name}</button>
                      </td>
                      <td className="py-2 pr-3">{p.pm || "—"}</td>
                      <td className="py-2 pr-3">{p.currentPhase || "—"}</td>
                      <td className={"py-2 pr-3 text-right " + (el !== null && el > 1 ? "font-semibold text-red-600" : "")}>{pc(el)}</td>
                      <td className="py-2 pr-3 text-right">
                        {editing ? (
                          <span className="inline-flex items-center gap-1">
                            <input type="number" min="0" style={{ width: 58 }} className="rounded border border-slate-200 px-1 py-0.5 text-right" value={regEdit.doneStories} onChange={(e) => setRegEdit({ ...regEdit, doneStories: e.target.value })} />
                            /
                            <input type="number" min="0" style={{ width: 58 }} className="rounded border border-slate-200 px-1 py-0.5 text-right" value={regEdit.totalStories} onChange={(e) => setRegEdit({ ...regEdit, totalStories: e.target.value })} />
                          </span>
                        ) : <span>{p.doneStories ?? "—"} / {p.totalStories ?? "—"}</span>}
                      </td>
                      <td className="py-2 pr-3 text-right">{pc(sv.completion)}</td>
                      <td className={"py-2 pr-3 text-right " + (bv !== null && bv > 0 ? "text-red-600" : "text-slate-600")}>{pc(bv)}</td>
                      <td className={"py-2 pr-3 text-right " + (sv.variance !== null && sv.variance < 0 ? "font-medium text-red-600" : "text-slate-600")}>{pc(sv.variance)}</td>
                      {marginsVisible && (
                        <td className="py-2 pr-3 text-right">
                          {editing ? (
                            <input type="number" min="0" max="100" step="0.1" style={{ width: 64 }} className="rounded border border-slate-200 px-1 py-0.5 text-right" placeholder="current" value={regEdit.currentMargin} onChange={(e) => setRegEdit({ ...regEdit, currentMargin: e.target.value })} />
                          ) : <span>{p.targetMargin ?? "—"} / {p.currentMargin ?? "—"}{p.targetMargin != null && p.currentMargin != null && <span className={"ml-1 text-xs " + (p.currentMargin < p.targetMargin ? "text-red-600" : "text-emerald-700")}>({p.currentMargin >= p.targetMargin ? "+" : ""}{Math.round((p.currentMargin - p.targetMargin) * 10) / 10})</span>}</span>}
                        </td>
                      )}
                      <td className="py-2 pr-3 text-center">{hr ? <Pill tone="bg-red-100 text-red-800">{hr}</Pill> : <span className="text-slate-300">0</span>}</td>
                      <td className="py-2 pr-3 text-xs">
                        {(() => {
                          const nm = milestones.filter((m) => m.projectId === p.id && m.status !== "Complete").sort((a, b) => ((a.planned || "9999") < (b.planned || "9999") ? -1 : 1))[0];
                          if (!nm) return <span className="text-slate-300">—</span>;
                          const late = nm.planned && nm.planned < todayISO;
                          return <span className={late ? "font-medium text-red-600" : "text-slate-600"}>{nm.name}{nm.planned ? " · " + fmt(nm.planned) : ""}{late ? " (overdue)" : ""}</span>;
                        })()}
                      </td>
                      <td className="py-2 pr-3">{lw ? <Pill tone={ragTone[lw.rag]}>{lw.rag}</Pill> : <span className="text-xs text-slate-400">no entry</span>}</td>
                      <td className="py-2 pr-3 text-xs text-slate-600" style={{ maxWidth: 260 }}>
                        {editing ? <input className={inputCls + " py-1"} value={regEdit.keyUpdate} onChange={(e) => setRegEdit({ ...regEdit, keyUpdate: e.target.value })} /> : (p.keyUpdate || <span className="text-slate-300">—</span>)}
                        {lw && lw.oneLiner && !editing && <div className="mt-0.5 text-slate-400">wk: {lw.oneLiner}</div>}
                      </td>
                      {canRegister && (
                        <td className="py-2 text-right">
                          {editing ? (
                            <span className="flex justify-end gap-1"><Btn small onClick={() => saveRegister(p)}>Save</Btn><Btn small kind="ghost" onClick={() => setRegEdit(null)}>✕</Btn></span>
                          ) : <Btn small kind="ghost" onClick={() => setRegEdit({ id: p.id, totalStories: p.totalStories ?? "", doneStories: p.doneStories ?? "", currentMargin: p.currentMargin ?? "", keyUpdate: p.keyUpdate || "" })}>Edit</Btn>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">Derived on render: elapsed = (today − start) ÷ (end − start) · task completion = done ÷ total stories · burn vs plan = Σburnt ÷ Σplanned − 1 · schedule variance = completion − elapsed. Stories, current margin and key update are PM-maintained here; dates, PM and phase come from the project master.{marginsVisible ? "" : " Margin columns are visible to PM and Admin only."}</p>
        </Card>
        )}
        <Card title={"Open risks & issues — High impact across the portfolio (" + openHigh.length + ")"}>
          {openHigh.length === 0 ? <p className="text-sm text-slate-500">Nothing high-impact open. RAID entries are managed on each project (Projects → RAID log).</p> : (
            <ul className="divide-y divide-slate-100">
              {openHigh.sort((a, b) => (a.targetDate || "9999") < (b.targetDate || "9999") ? -1 : 1).map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Pill tone={x.type === "Risk" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>{x.type}</Pill>
                  <span className="font-medium text-slate-700">{pName(x.projectId)}</span>
                  <span className="text-slate-600">{x.desc}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                    {x.owner && <span>{x.owner}</span>}
                    {x.targetDate && <span className={x.targetDate < todayISO ? "font-medium text-red-600" : ""}>{fmt(x.targetDate)}</span>}
                    <Pill tone={x.status === "In Progress" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}>{x.status}</Pill>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        </>
      )}

      {tab === "weekly" && (
        <>
        {canWeekly && (
          <Card title={wEditId ? "Edit weekly health entry" : "Weekly health entry"}>
            <div className="grid gap-3 sm:grid-cols-6">
              <Field label="Project">
                <select className={inputCls} value={effWPid} onChange={(e) => setWf({ ...wf, projectId: e.target.value })}>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Week ending"><input type="date" className={inputCls} value={wf.week} onChange={(e) => setWf({ ...wf, week: e.target.value })} /></Field>
              <Field label="Hours planned"><input type="number" min="0" className={inputCls} value={wf.hoursPlanned} onChange={(e) => setWf({ ...wf, hoursPlanned: e.target.value })} /></Field>
              <Field label="Hours burnt"><input type="number" min="0" className={inputCls} value={wf.hoursBurnt} onChange={(e) => setWf({ ...wf, hoursBurnt: e.target.value })} /></Field>
              <Field label="RAG"><select className={inputCls} value={wf.rag} onChange={(e) => setWf({ ...wf, rag: e.target.value })}>{RAG_OPTS.map((r) => <option key={r}>{r}</option>)}</select></Field>
              <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={wf.scopeChanges} onChange={(e) => setWf({ ...wf, scopeChanges: e.target.checked })} />
                Scope changes this week
              </label>
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-1">
              <Field label="One-liner (leadership summary)"><input className={inputCls} value={wf.oneLiner} onChange={(e) => setWf({ ...wf, oneLiner: e.target.value })} /></Field>
            </div>
            <p className="mt-1 text-xs text-slate-400">Risks and milestones aren't entered here — they live on the project (Projects → RAID log / Milestones) and the portfolio reads them from there.</p>
            <div className="mt-3 flex gap-2">
              <Btn small onClick={saveWeekly}>{wEditId ? "Save changes" : "Add entry"}</Btn>
              {wEditId && <Btn small kind="ghost" onClick={() => { setWEditId(null); setWf({ ...emptyW, projectId: effWPid }); }}>Cancel</Btn>}
            </div>
          </Card>
        )}
        <Card title="Weekly history" right={
          <select className={inputCls + " w-48"} value={whProj} onChange={(e) => setWhProj(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>}>
          {whRows.length === 0 ? <p className="text-sm text-slate-500">No weekly entries yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Week ending</th><th className="py-2 pr-3">Project</th><th className="py-2 pr-3 text-right">Planned</th><th className="py-2 pr-3 text-right">Burnt</th>
                    <th className="py-2 pr-3 text-right">Effort var</th><th className="py-2 pr-3 text-center">Scope Δ</th><th className="py-2 pr-3">RAG</th><th className="py-2 pr-3">One-liner</th>{canWeekly && <th />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {whPage.map((w) => {
                    const ev = phEffortVar(w.hoursPlanned, w.hoursBurnt);
                    return (
                      <tr key={w.id}>
                        <td className="py-1.5 pr-3 font-medium">{fmt(w.week)}</td>
                        <td className="py-1.5 pr-3">{pName(w.projectId)}</td>
                        <td className="py-1.5 pr-3 text-right">{w.hoursPlanned}</td>
                        <td className="py-1.5 pr-3 text-right">{w.hoursBurnt}</td>
                        <td className={"py-1.5 pr-3 text-right " + (ev !== null && ev > 0 ? "text-red-600" : "text-slate-600")}>{ev === null ? "—" : (ev > 0 ? "+" : "") + Math.round(ev * 1000) / 10 + "%"}</td>
                        <td className="py-1.5 pr-3 text-center">{w.scopeChanges ? <Pill tone="bg-amber-100 text-amber-800">Y</Pill> : <span className="text-slate-300">N</span>}</td>
                        <td className="py-1.5 pr-3"><Pill tone={ragTone[w.rag]}>{w.rag}</Pill></td>
                        <td className="py-1.5 pr-3 text-xs text-slate-600">{w.oneLiner || "—"}</td>
                        {canWeekly && (
                          <td className="py-1.5 text-right">
                            <span className="flex justify-end gap-1">
                              <Btn small kind="ghost" onClick={() => { setWEditId(w.id); setWf({ projectId: w.projectId, week: w.week, hoursPlanned: w.hoursPlanned, hoursBurnt: w.hoursBurnt, scopeChanges: w.scopeChanges, rag: w.rag, oneLiner: w.oneLiner }); }}>Edit</Btn>
                              <Btn small kind="danger" onClick={() => setWeeklyHealth(weeklyHealth.filter((x) => x.id !== w.id))}>✕</Btn>
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {whPager}
            </div>
          )}
        </Card>
        </>
      )}

      {tab === "pipeline" && (
        <>
        {canPipeline && (
          <Card title={pEditId ? "Edit opportunity" : "New opportunity"}>
            <div className="grid gap-3 sm:grid-cols-6">
              <Field label="Company / opportunity"><input className={inputCls} value={pf2.company} onChange={(e) => setPf2({ ...pf2, company: e.target.value })} /></Field>
              <Field label="Stage"><select className={inputCls} value={pf2.stage} onChange={(e) => setPf2({ ...pf2, stage: e.target.value })}>{PH_STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Potential start"><input className={inputCls} value={pf2.potentialStart} onChange={(e) => setPf2({ ...pf2, potentialStart: e.target.value })} placeholder="date or ??" /></Field>
              <Field label="Potential resources"><input type="number" min="0" className={inputCls} value={pf2.potentialResources} onChange={(e) => setPf2({ ...pf2, potentialResources: e.target.value })} /></Field>
              <Field label="Next action"><input className={inputCls} value={pf2.nextAction} onChange={(e) => setPf2({ ...pf2, nextAction: e.target.value })} /></Field>
              <Field label="Commentary"><input className={inputCls} value={pf2.commentary} onChange={(e) => setPf2({ ...pf2, commentary: e.target.value })} /></Field>
            </div>
            <div className="mt-3 flex gap-2">
              <Btn small onClick={savePipeline}>{pEditId ? "Save changes" : "Add opportunity"}</Btn>
              {pEditId && <Btn small kind="ghost" onClick={() => { setPEditId(null); setPf2(emptyP); }}>Cancel</Btn>}
            </div>
          </Card>
        )}
        <Card title="Pipeline board">
          {pipeline.length === 0 ? <p className="text-sm text-slate-500">No opportunities yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Company</th><th className="py-2 pr-3">Stage</th><th className="py-2 pr-3">Potential start</th><th className="py-2 pr-3 text-right">Resources</th><th className="py-2 pr-3">Next action</th><th className="py-2 pr-3">Commentary</th>{canPipeline && <th />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...pipeline].sort((a, b) => PH_STAGES.indexOf(b.stage) - PH_STAGES.indexOf(a.stage)).map((x) => (
                    <tr key={x.id}>
                      <td className="py-1.5 pr-3 font-medium text-slate-800">{x.company}</td>
                      <td className="py-1.5 pr-3"><Pill tone={x.stage === "SOW Signed" ? "bg-emerald-100 text-emerald-800" : x.stage === "Closed" ? "bg-slate-200 text-slate-500" : "bg-sky-100 text-sky-800"}>{x.stage}</Pill></td>
                      <td className="py-1.5 pr-3">{x.potentialStart || "—"}</td>
                      <td className="py-1.5 pr-3 text-right">{x.potentialResources ?? "—"}</td>
                      <td className="py-1.5 pr-3 text-xs text-slate-600">{x.nextAction || "—"}</td>
                      <td className="py-1.5 pr-3 text-xs text-slate-500">{x.commentary || "—"}</td>
                      {canPipeline && (
                        <td className="py-1.5 text-right">
                          <span className="flex justify-end gap-1">
                            <Btn small kind="ghost" onClick={() => { setPEditId(x.id); setPf2({ company: x.company, stage: x.stage, potentialStart: x.potentialStart || "", potentialResources: x.potentialResources ?? "", commentary: x.commentary || "", nextAction: x.nextAction || "" }); }}>Edit</Btn>
                            <Btn small kind="danger" onClick={() => setPipeline(pipeline.filter((y) => y.id !== x.id))}>✕</Btn>
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </>
      )}
    </div>
  );
}

// ============================================================
// PROGRAM HEALTH — single project detail (KPIs behind a dashboard tile)
// Read-only: every number is derived from the same facts as the portfolio.
// ============================================================
export function ProjectHealthDetail({ row, onBack, marginsVisible, todayISO, raid }) {
  const { p, entries, el, sv, bv, lw, hr, ms, nextMs, overdue, st } = row;
  const pc = phPct;
  const plannedH = entries.reduce((s, e) => s + (Number(e.hoursPlanned) || 0), 0);
  const burntH = entries.reduce((s, e) => s + (Number(e.hoursBurnt) || 0), 0);
  const recent = entries.slice(-8);
  const maxH = Math.max(1, ...recent.map((e) => Math.max(Number(e.hoursPlanned) || 0, Number(e.hoursBurnt) || 0)));
  const projRaid = raid.filter((x) => x.projectId === p.id && x.status !== "Closed")
    .sort((a, b) => (a.impact === b.impact ? ((a.targetDate || "9999") < (b.targetDate || "9999") ? -1 : 1) : a.impact === "H" ? -1 : 1));
  const marginVar = p.targetMargin != null && p.currentMargin != null ? Math.round((p.currentMargin - p.targetMargin) * 10) / 10 : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Btn kind="ghost" small onClick={onBack}>‹ All projects</Btn>
        <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>{p.name}</h3>
        <Pill tone={PH_RAG_TONE[st.status]}>{st.status}</Pill>
        <span className="text-xs text-slate-500">
          {st.fromPM ? "PM-submitted RAG" + (lw ? " · week ending " + fmt(lw.week) : "") : "derived — no weekly entry submitted"}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <span>PM: <span className="font-medium text-slate-800">{p.pm || "—"}</span></span>
        <span>Phase: <span className="font-medium text-slate-800">{p.currentPhase || "—"}</span></span>
        <span>Window: <span className="font-medium text-slate-800">{p.start ? fmt(p.start) : "—"} → {p.end ? fmt(p.end) : "—"}</span></span>
      </div>

      {st.reasons.length > 0 && (
        <Notice tone={st.derived === "Red" ? "error" : st.derived === "Amber" ? "warn" : "ok"}>
          Signals: {st.reasons.join(" · ")}
          {st.fromPM && st.derived !== st.status ? " — derived status would be " + st.derived + "." : ""}
        </Notice>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Time elapsed" value={pc(el)} sub={el !== null && el > 1 ? "past target end date" : "of the project window"} />
        <Stat label="Task completion" value={pc(sv.completion)} sub={(p.doneStories ?? "—") + " / " + (p.totalStories ?? "—") + " stories"} />
        <Stat label="Schedule variance" value={pc(sv.variance)} sub="completion − elapsed" />
        <Stat label="Burn vs plan" value={pc(bv)} sub={burntH + "h burnt / " + plannedH + "h planned"} />
        <Stat label="High-impact risks" value={hr} sub={projRaid.length + " open RAID entries"} />
        <Stat label="Milestones" value={ms.filter((m) => m.status === "Complete").length + " / " + ms.length} sub={overdue ? overdue + " overdue" : "none overdue"} />
        <Stat label="Next milestone" value={nextMs ? nextMs.name : "—"} sub={nextMs && nextMs.planned ? fmt(nextMs.planned) + (nextMs.planned < todayISO ? " · overdue" : "") : "nothing scheduled"} />
        {marginsVisible && <Stat label="Margin (target / current)" value={(p.targetMargin ?? "—") + " / " + (p.currentMargin ?? "—")} sub={marginVar === null ? "not set" : (marginVar >= 0 ? "+" : "") + marginVar + " pts vs target"} />}
      </div>

      {(p.keyUpdate || (lw && lw.oneLiner)) && (
        <Card title="Latest update">
          {p.keyUpdate && <p className="text-sm text-slate-700">{p.keyUpdate}</p>}
          {lw && lw.oneLiner && <p className="mt-1 text-sm text-slate-500">Week of {fmt(lw.week)}: {lw.oneLiner}</p>}
        </Card>
      )}

      <Card title={"Weekly hours — planned vs burnt (last " + recent.length + " of " + entries.length + " entries)"}>
        {recent.length === 0 ? <p className="text-sm text-slate-500">No weekly health entries for this project yet.</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Week ending</th><th className="py-2 pr-3 text-right">Planned</th><th className="py-2 pr-3 text-right">Burnt</th>
                <th className="py-2 pr-3 text-right">Variance</th><th className="py-2 pr-3" style={{ width: "34%" }}>Burn</th>
                <th className="py-2 pr-3">RAG</th><th className="py-2 pr-3">Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.slice().reverse().map((e) => {
                const v = phEffortVar(e.hoursPlanned, e.hoursBurnt);
                return (
                  <tr key={e.id}>
                    <td className="py-2 pr-3 text-slate-700">{fmt(e.week)}</td>
                    <td className="py-2 pr-3 text-right">{e.hoursPlanned}</td>
                    <td className="py-2 pr-3 text-right">{e.hoursBurnt}</td>
                    <td className={"py-2 pr-3 text-right " + (v !== null && v > 0 ? "text-red-600" : "text-slate-600")}>{pc(v)}</td>
                    <td className="py-2 pr-3">
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: Math.round(((Number(e.hoursBurnt) || 0) / maxH) * 100) + "%", background: v !== null && v > 0.1 ? PH_RAG_ACCENT.Red : PH_RAG_ACCENT.Green }} />
                      </div>
                      <div className="mt-0.5 h-1.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-slate-300" style={{ width: Math.round(((Number(e.hoursPlanned) || 0) / maxH) * 100) + "%" }} />
                      </div>
                    </td>
                    <td className="py-2 pr-3"><Pill tone={PH_RAG_TONE[e.rag]}>{e.rag}</Pill></td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{e.scopeChanges ? "changed" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-slate-400">Top bar = hours burnt, bottom grey bar = hours planned, both scaled to the largest week shown.</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={"Milestones (" + ms.length + ")"}>
          {ms.length === 0 ? <p className="text-sm text-slate-500">No milestones recorded.</p> : (
            <ul className="divide-y divide-slate-100">
              {ms.slice().sort((a, b) => ((a.planned || "9999") < (b.planned || "9999") ? -1 : 1)).map((m) => {
                const slip = m.planned && m.actual ? Math.round((parseISO(m.actual) - parseISO(m.planned)) / 86400000) : null;
                const late = m.status !== "Complete" && m.planned && m.planned < todayISO;
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="font-medium text-slate-700">{m.name}</span>
                    {m.phase && <span className="text-xs text-slate-400">{m.phase}</span>}
                    <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                      {m.planned && <span className={late ? "font-medium text-red-600" : ""}>{fmt(m.planned)}{late ? " · overdue" : ""}</span>}
                      {slip !== null && slip !== 0 && <span className={slip > 0 ? "text-red-600" : "text-emerald-700"}>{slip > 0 ? "+" : ""}{slip}d</span>}
                      <Pill tone={m.status === "Complete" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}>{m.status}</Pill>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title={"Open RAID (" + projRaid.length + ")"}>
          {projRaid.length === 0 ? <p className="text-sm text-slate-500">Nothing open. RAID entries are managed on the project (Projects → RAID log).</p> : (
            <ul className="divide-y divide-slate-100">
              {projRaid.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Pill tone={x.impact === "H" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>{x.type}</Pill>
                  <span className="text-slate-600">{x.desc}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                    {x.owner && <span>{x.owner}</span>}
                    {x.targetDate && <span className={x.targetDate < todayISO ? "font-medium text-red-600" : ""}>{fmt(x.targetDate)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

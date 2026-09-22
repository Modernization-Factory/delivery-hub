import { useState } from "react";
import { STREAM_COLORS } from "../lib/allocations.js";
import { fmt, parseISO } from "../lib/dates.js";
import { planCalc, planMonths } from "../lib/plans.js";
import { downloadXlsx } from "../lib/xlsx.js";
import { Btn, Card, Field, Notice, Pill, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";

// ============================================================
// TEAM PLANS (Lead / PM / Admin manage · Viewer browses)
// ============================================================
export function TeamPlansView(ctx) {
  const { plans, setPlans, projects, nextId, user, todayISO } = ctx;
  const canManage = ctx.can("plans.manage");
  const [openId, setOpenId] = useState(null);
  const [showArch, setShowArch] = useState(false);
  const [nform, setNform] = useState({ name: "", projectId: projects[0] ? projects[0].id : "", phase: "", startYm: todayISO.slice(0, 7), monthsCount: 6, mult: 20 });
  const [msg, setMsg] = useState(null);
  const r1 = (x) => Math.round(x * 10) / 10;
  const projById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const mLab = (ym) => parseISO(ym + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  const open = plans.find((p) => p.id === openId);

  const effNfPid = projById[nform.projectId] ? nform.projectId : (projects[0] ? projects[0].id : "");
  function createPlan() {
    setMsg(null);
    const proj = projById[effNfPid];
    if (!proj) return setMsg({ tone: "error", text: "Pick a project." });
    const count = Math.max(1, Math.min(12, Number(nform.monthsCount) || 6));
    const plan = {
      id: nextId("tp"),
      name: nform.name.trim() || proj.name + (nform.phase ? " " + nform.phase : "") + " — " + mLab(nform.startYm),
      projectId: effNfPid, phase: nform.phase || null,
      startYm: nform.startYm, monthsCount: count,
      mult: Number(nform.mult) || 20, multOverrides: {},
      rows: [], archived: false,
      createdBy: user.name, createdAt: todayISO, updatedAt: todayISO,
    };
    setPlans([...plans, plan]);
    setOpenId(plan.id);
    setMsg({ tone: "ok", text: "Plan \"" + plan.name + "\" created — add stream rows below." });
  }
  const patchPlan = (id, fn) => setPlans(plans.map((p) => (p.id === id ? { ...fn({ ...p }), updatedAt: todayISO } : p)));

  // ---------- editor ----------
  if (open) {
    const proj = projById[open.projectId] || { name: "?", streams: [] };
    const months = planMonths(open.startYm, open.monthsCount);
    const calc = planCalc(open);
    const hasStreams = (proj.streams || []).length > 0;
    const setRow = (rid, fn) => patchPlan(open.id, (p) => ({ ...p, rows: p.rows.map((r) => (r.id === rid ? fn({ ...r }) : r)) }));
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>
            {open.name} <span className="ml-2 text-sm font-normal text-slate-500">{proj.name}{open.phase ? " · " + open.phase : ""} · {mLab(months[0])} – {mLab(months[months.length - 1])}</span>
            {open.archived && <Pill tone="ml-2 bg-slate-200 text-slate-600">Archived</Pill>}
          </h2>
          <div className="flex gap-2">
            <Btn kind="ghost" small onClick={() => {
              downloadXlsx("team-plan-" + open.name.replace(/[^\w]+/g, "_") + ".xlsx", [["Plan", [
                ["Stream / label", "Task", "Expected start", "Expected end", "Estimated effort (d)", ...months.map(mLab), "Total res", "Effort by resources (d)", "Variance (d)"],
                ...open.rows.map((r, ri) => [r.stream || "", r.task || "", r.start || "", r.end || "", calc.rows[ri].est ?? "", ...months.map((_, i) => Number(r.res[i]) || 0), calc.rows[ri].resTotal, calc.rows[ri].effort, calc.rows[ri].variance ?? ""]),
                ["Multiplier (days/month)", "", "", "", "", ...months.map((_, i) => calc.multFor(i)), "", "", ""],
                ["Total Resources / month", "", "", "", calc.grandEst || "", ...calc.totalRes, calc.grandRes, calc.grandEffort, ""],
                ["Total Person Days / month", "", "", "", "", ...calc.projEffort, "", calc.grandEffort, ""],
                ["Total Person Hours / month", "", "", "", "", ...calc.projEffort.map((x) => x * 8), "", calc.grandEffort * 8, ""],
                ["Difference (res vs prev month)", "", "", "", "", ...calc.totalRes.map((x, i) => (i === 0 ? "" : Math.round((x - calc.totalRes[i - 1]) * 100) / 100)), "", "", ""],
              ]]]);
            }}>⬇ Excel</Btn>
            <Btn kind="ghost" small onClick={() => { setOpenId(null); setMsg(null); }}>← All plans</Btn>
          </div>
        </div>
        {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}
        {!canManage && <Notice tone="warn">Read-only — your role can browse this plan but not change it.</Notice>}
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3" style={{ minWidth: 140 }}>{hasStreams ? "Stream" : "Project label"}</th>
                  <th className="py-2 pr-3" style={{ minWidth: 150 }}>Task description</th>
                  <th className="px-2 py-2" style={{ minWidth: 90 }}>Expected start</th>
                  <th className="px-2 py-2" style={{ minWidth: 90 }}>Expected end</th>
                  <th className="px-2 py-2 text-center">Estimated (d)</th>
                  {months.map((ym) => <th key={ym} className="border-l border-slate-100 px-2 py-2 text-center">{mLab(ym)}</th>)}
                  <th className="border-l border-slate-200 px-2 py-2 text-right">Res</th>
                  <th className="px-2 py-2 text-right">Effort by resources (d)</th>
                  <th className="px-2 py-2 text-right">Δ vs est</th>
                  {canManage && <th />}
                </tr>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th colSpan={5} className="py-1 pr-3 font-normal">Multiplier (days/month · blank = {open.mult})</th>
                  {months.map((ym, i) => (
                    <th key={ym} className="border-l border-slate-100 px-1 py-1 text-center font-normal">
                      {canManage ? (
                        <input type="number" min="1" max="31" placeholder={String(open.mult)} style={{ width: 48 }}
                          value={open.multOverrides[i] ?? ""}
                          onChange={(e) => patchPlan(open.id, (p) => ({ ...p, multOverrides: { ...p.multOverrides, [i]: e.target.value === "" ? null : Number(e.target.value) } }))}
                          className="rounded border border-slate-200 px-1 py-0.5 text-center" />
                      ) : <span>{calc.multFor(i)}</span>}
                    </th>
                  ))}
                  <th colSpan={canManage ? 5 : 4} className="px-2 py-1 text-right font-normal">
                    {canManage && <span className="mr-2">default ×
                      <input type="number" min="1" max="31" style={{ width: 48 }} value={open.mult}
                        onChange={(e) => patchPlan(open.id, (p) => ({ ...p, mult: Number(e.target.value) || 20 }))}
                        className="ml-1 rounded border border-slate-200 px-1 py-0.5 text-center" /></span>}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {open.rows.map((r, ri) => (
                  <tr key={r.id}>
                    <td className="py-1 pr-3">
                      {canManage ? (
                        hasStreams ? (
                          <select className={inputCls + " py-1"} value={(proj.streams || []).includes(r.stream) ? r.stream : "__custom"}
                            onChange={(e) => setRow(r.id, (x) => ({ ...x, stream: e.target.value === "__custom" ? (x.stream && !(proj.streams || []).includes(x.stream) ? x.stream : "") : e.target.value }))}>
                            {(proj.streams || []).map((s) => <option key={s} value={s}>{s}</option>)}
                            <option value="__custom">Custom label…</option>
                          </select>
                        ) : (
                          <input className={inputCls + " py-1"} value={r.stream || ""} placeholder="Project label" onChange={(e) => setRow(r.id, (x) => ({ ...x, stream: e.target.value }))} />
                        )
                      ) : <Pill tone={STREAM_COLORS[r.stream] || "bg-slate-100 text-slate-600"}>{r.stream || "—"}</Pill>}
                      {canManage && hasStreams && !(proj.streams || []).includes(r.stream) && (
                        <input className={inputCls + " mt-1 py-1"} value={r.stream || ""} placeholder="Custom label" onChange={(e) => setRow(r.id, (x) => ({ ...x, stream: e.target.value }))} />
                      )}
                    </td>
                    <td className="py-1 pr-3">
                      {canManage ? <input className={inputCls + " py-1"} value={r.task || ""} placeholder="What this covers" onChange={(e) => setRow(r.id, (x) => ({ ...x, task: e.target.value }))} />
                        : <span className="text-slate-600">{r.task || "—"}</span>}
                    </td>
                    <td className="px-1 py-1">
                      {canManage ? <input className={inputCls + " py-1"} style={{ minWidth: 84 }} value={r.start || ""} placeholder="e.g. Aug '26" onChange={(e) => setRow(r.id, (x) => ({ ...x, start: e.target.value }))} />
                        : <span className="text-slate-500">{r.start || "—"}</span>}
                    </td>
                    <td className="px-1 py-1">
                      {canManage ? <input className={inputCls + " py-1"} style={{ minWidth: 84 }} value={r.end || ""} placeholder="e.g. Jan '27" onChange={(e) => setRow(r.id, (x) => ({ ...x, end: e.target.value }))} />
                        : <span className="text-slate-500">{r.end || "—"}</span>}
                    </td>
                    <td className="px-1 py-1 text-center">
                      {canManage ? (
                        <input type="number" min="0" style={{ width: 78 }} value={r.est ?? ""} placeholder="est."
                          onChange={(e) => setRow(r.id, (x) => ({ ...x, est: e.target.value === "" ? null : Number(e.target.value) }))}
                          className="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-center font-medium text-white placeholder:text-slate-500" />
                      ) : <span className="font-medium">{calc.rows[ri].est ?? "—"}</span>}
                    </td>
                    {months.map((ym, i) => (
                      <td key={ym} className="border-l border-slate-100 px-1 py-1 text-center">
                        {canManage ? (
                          <input type="number" min="0" step="0.5" style={{ width: 58 }} value={r.res[i] ?? ""}
                            onChange={(e) => setRow(r.id, (x) => { const res = [...x.res]; res[i] = e.target.value === "" ? "" : Number(e.target.value); return { ...x, res }; })}
                            className="rounded border border-slate-200 px-1 py-1 text-center" />
                        ) : <span>{Number(r.res[i]) || <span className="text-slate-300">·</span>}</span>}
                      </td>
                    ))}
                    <td className="border-l border-slate-200 px-2 py-1 text-right font-medium">{r1(calc.rows[ri].resTotal)}</td>
                    <td className="px-2 py-1 text-right font-semibold">{r1(calc.rows[ri].effort)}<span className="ml-1 font-normal text-slate-400">{calc.rows[ri].effort * 8}h</span></td>
                    <td className="px-2 py-1 text-right">
                      {calc.rows[ri].variance === null ? <span className="text-slate-300">—</span> : (
                        <Pill tone={calc.rows[ri].variance > 0 ? "bg-amber-100 text-amber-800" : calc.rows[ri].variance < 0 ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}>
                          {calc.rows[ri].variance > 0 ? "+" : ""}{r1(calc.rows[ri].variance)}
                        </Pill>
                      )}
                    </td>
                    {canManage && <td className="px-1 py-1 text-right"><Btn small kind="danger" onClick={() => patchPlan(open.id, (p) => ({ ...p, rows: p.rows.filter((x) => x.id !== r.id) }))}>✕</Btn></td>}
                  </tr>
                ))}
                {open.rows.length === 0 && <tr><td colSpan={months.length + 10} className="py-3 text-sm text-slate-500">No rows yet{canManage ? " — add the first stream below." : "."}</td></tr>}
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td colSpan={4} className="py-2 pr-3">Total Resources / month</td>
                  <td className="px-2 py-2 text-center text-slate-600">{calc.grandEst ? r1(calc.grandEst) : "—"}</td>
                  {calc.totalRes.map((x, i) => <td key={i} className="border-l border-slate-100 px-1 py-2 text-center">{x || <span className="font-normal text-slate-300">·</span>}</td>)}
                  <td className="border-l border-slate-200 px-2 py-2 text-right">{r1(calc.grandRes)}</td>
                  <td className="px-2 py-2 text-right">{r1(calc.grandEffort)}</td>
                  <td colSpan={canManage ? 2 : 1} />
                </tr>
                <tr className="font-semibold">
                  <td colSpan={5} className="py-2 pr-3">Projected Effort Spent / month (person-days)</td>
                  {calc.projEffort.map((x, i) => <td key={i} className="border-l border-slate-100 px-1 py-2 text-center">{x ? r1(x) : <span className="font-normal text-slate-300">·</span>}</td>)}
                  <td className="border-l border-slate-200 px-2 py-2 text-right text-slate-400">Σ</td>
                  <td className="px-2 py-2 text-right">{r1(calc.grandEffort)} d</td>
                  <td colSpan={canManage ? 2 : 1} />
                </tr>
                <tr className="text-slate-600">
                  <td colSpan={5} className="py-1.5 pr-3 font-medium">Total Person Hours / month (×8)</td>
                  {calc.projEffort.map((x, i) => <td key={i} className="border-l border-slate-100 px-1 py-1.5 text-center">{x ? r1(x * 8) : <span className="text-slate-300">·</span>}</td>)}
                  <td className="border-l border-slate-200 px-2 py-1.5 text-right text-slate-400">Σ</td>
                  <td className="px-2 py-1.5 text-right font-medium">{r1(calc.grandEffort * 8)} h</td>
                  <td colSpan={canManage ? 2 : 1} />
                </tr>
                <tr className="text-xs text-slate-500">
                  <td colSpan={5} className="py-1.5 pr-3">Δ resources vs previous month (ramp)</td>
                  {calc.totalRes.map((x, i) => {
                    if (i === 0) return <td key={i} className="border-l border-slate-100 px-1 py-1.5 text-center text-slate-300">—</td>;
                    const d = Math.round((x - calc.totalRes[i - 1]) * 100) / 100;
                    return <td key={i} className={"border-l border-slate-100 px-1 py-1.5 text-center font-medium " + (d > 0 ? "text-emerald-700" : d < 0 ? "text-red-600" : "text-slate-400")}>{d > 0 ? "+" + d : d}</td>;
                  })}
                  <td colSpan={canManage ? 4 : 3} />
                </tr>
              </tbody>
            </table>
          </div>
          {canManage && (
            <div className="mt-3">
              <Btn small kind="ghost" onClick={() => patchPlan(open.id, (p) => ({ ...p, rows: [...p.rows, { id: nextId("tr"), stream: hasStreams ? (proj.streams[0] || "") : "", task: "", start: "", end: "", res: Array.from({ length: open.monthsCount }, () => ""), est: null }] }))}>+ Add row</Btn>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-400">Effort by resources = Σ month resources × multiplier (sheet formula SUM(months)×{open.mult}; partial months can use fractional resources like 0.55, or a per-month multiplier override). Person hours at ×8. Estimated effort is your own figure; Δ vs est = computed − estimated. The ramp row mirrors the sheet's "Difference" — month-over-month change in total resources.</p>
        </Card>
      </div>
    );
  }

  // ---------- manage grid ----------
  const visible = plans.filter((p) => showArch || !p.archived);
  const { rows: visPage, pager: planPager } = usePaged(visible, 10);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Team Plans ({plans.length})</h2>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={showArch} onChange={(e) => setShowArch(e.target.checked)} />
          Show archived
        </label>
      </div>
      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}
      {canManage && (
        <Card title="Create team plan">
          <div className="grid gap-3 sm:grid-cols-6">
            <Field label="Project">
              <select className={inputCls} value={effNfPid} onChange={(e) => setNform({ ...nform, projectId: e.target.value, phase: "" })}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Phase">
              <select className={inputCls} value={nform.phase} onChange={(e) => setNform({ ...nform, phase: e.target.value })}>
                <option value="">—</option>
                {(projById[effNfPid] ? projById[effNfPid].phases : []).map((ph) => <option key={ph}>{ph}</option>)}
              </select>
            </Field>
            <Field label="Plan name (optional)"><input className={inputCls} value={nform.name} onChange={(e) => setNform({ ...nform, name: e.target.value })} placeholder="auto from project" /></Field>
            <Field label="Start month"><input type="month" className={inputCls} value={nform.startYm} onChange={(e) => setNform({ ...nform, startYm: e.target.value })} /></Field>
            <Field label="# months (1–12)"><input type="number" min="1" max="12" className={inputCls} value={nform.monthsCount} onChange={(e) => setNform({ ...nform, monthsCount: e.target.value })} /></Field>
            <Field label="Effort multiplier (days/mo)"><input type="number" min="1" max="31" className={inputCls} value={nform.mult} onChange={(e) => setNform({ ...nform, mult: e.target.value })} /></Field>
          </div>
          <div className="mt-3"><Btn onClick={createPlan}>Create plan</Btn></div>
        </Card>
      )}
      <Card title="All plans">
        {visible.length === 0 ? <p className="text-sm text-slate-500">No plans yet{canManage ? " — create the first one above." : "."}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Plan</th><th className="py-2 pr-4">Project · Phase</th><th className="py-2 pr-4">Window</th>
                  <th className="py-2 pr-4 text-right">Rows</th><th className="py-2 pr-4 text-right">Projected (d)</th><th className="py-2 pr-4 text-right">Estimated (d)</th>
                  <th className="py-2 pr-4">Updated</th><th className="py-2 pr-4">Status</th><th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visPage.map((p) => {
                  const c = planCalc(p);
                  const proj = projById[p.projectId];
                  const months = planMonths(p.startYm, p.monthsCount);
                  return (
                    <tr key={p.id} className={p.archived ? "text-slate-400" : ""}>
                      <td className="py-2 pr-4 font-medium">{p.name}</td>
                      <td className="py-2 pr-4">{proj ? proj.name : "?"}{p.phase ? " · " + p.phase : ""}</td>
                      <td className="py-2 pr-4 text-slate-500">{mLab(months[0])} – {mLab(months[months.length - 1])}</td>
                      <td className="py-2 pr-4 text-right">{p.rows.length}</td>
                      <td className="py-2 pr-4 text-right font-semibold">{r1(c.grandEffort)}</td>
                      <td className="py-2 pr-4 text-right">{c.grandEst ? r1(c.grandEst) : "—"}</td>
                      <td className="py-2 pr-4 text-xs text-slate-500">{fmt(p.updatedAt)} · {p.createdBy}</td>
                      <td className="py-2 pr-4">{p.archived ? <Pill tone="bg-slate-200 text-slate-600">Archived</Pill> : <Pill tone="bg-emerald-100 text-emerald-800">Active</Pill>}</td>
                      <td className="py-2 text-right">
                        <span className="flex justify-end gap-2">
                          <Btn small kind="ghost" onClick={() => { setOpenId(p.id); setMsg(null); }}>{canManage && !p.archived ? "Open / edit" : "View"}</Btn>
                          {canManage && <Btn small kind="ghost" onClick={() => {
                            const copy = { ...p, id: nextId("tp"), name: p.name + " (scenario)", archived: false, createdBy: user.name, createdAt: todayISO, updatedAt: todayISO, rows: p.rows.map((r) => ({ ...r, id: nextId("tr"), res: [...r.res] })), multOverrides: { ...p.multOverrides } };
                            setPlans([...plans, copy]);
                            setMsg({ tone: "ok", text: "Duplicated as \"" + copy.name + "\" — the sheet's scenario blocks (e.g. \"Till January — With Onboarding\") live as separate plans here." });
                          }}>Duplicate</Btn>}
                          {canManage && <Btn small kind="ghost" onClick={() => patchPlan(p.id, (x) => ({ ...x, archived: !x.archived }))}>{p.archived ? "Unarchive" : "Archive"}</Btn>}
                          {canManage && <Btn small kind="danger" onClick={() => setPlans(plans.filter((x) => x.id !== p.id))}>Delete</Btn>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {planPager}
      </Card>
    </div>
  );
}

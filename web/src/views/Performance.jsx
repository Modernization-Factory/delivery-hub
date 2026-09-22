import { useState, useMemo } from "react";
import { fmt, fmtShort } from "../lib/dates.js";
import { isActiveDuring } from "../lib/leave.js";
import { METRICS, perfResourceTrend, perfScorecard, perfVendorTrend, ragOf, starsOf, weightedScore } from "../lib/performance.js";
import { tcStatsFlex, tcSuggested } from "../lib/timecard.js";
import { downloadXlsx } from "../lib/xlsx.js";
import { Btn, Card, Field, Notice, Pill, Stat, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT, Leaf } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";

// ============================================================
// PERFORMANCE (Lead / PM / Admin — never visible to Developers)
// ============================================================
export function PerformanceView(ctx) {
  const { scores, setScores, perfCfg, setPerfCfg, employees, tcRows, tcWeeks, jiraFlags, nextId, isAdmin, todayISO } = ctx;
  const PARTNERS = ["WeKan", "Ciklum", "Globant"];
  const pWeeks = useMemo(() => [...new Set([...tcWeeks, ...scores.map((s) => s.week)])].sort(), [tcWeeks, scores]);
  const [week, setWeek] = useState(pWeeks[pWeeks.length - 1] || todayISO);
  const [q, setQ] = useState("");
  const [co, setCo] = useState("All");
  const [draft, setDraft] = useState(null); // admin config draft
  const [msg, setMsg] = useState(null);
  const [ptab, setPtab] = useState("scoring"); // scoring | reports
  const [rpt, setRpt] = useState("scorecard"); // scorecard | vendors | resource
  const [rptName, setRptName] = useState("");
  const r2 = (x) => Math.round(x * 100) / 100;

  const pool = employees
    .filter((e) => isActiveDuring(e, week, week))
    .filter((e) => (perfCfg.partnerOnly ? PARTNERS.includes(e.company) : true))
    .filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) && (co === "All" || e.company === co))
    .sort((a, b) => a.name.localeCompare(b.name));
  const scoreFor = (name) => scores.find((s) => s.name === name && s.week === week);
  function setMetric(name, idx, val) {
    const v = val === "" ? null : Number(val);
    const ex = scoreFor(name);
    if (ex) setScores(scores.map((s) => (s.id === ex.id ? { ...s, m: s.m.map((x, i) => (i === idx ? v : x)) } : s)));
    else {
      const m = [null, null, null, null, null, null];
      m[idx] = v;
      setScores([...scores, { id: nextId("s"), name, week, m }]);
    }
  }
  const canScore = ctx.can("perf.score");
  const tcPctByName = useMemo(() => {
    const out = {};
    tcRows.forEach((r) => { out[r.name] = tcStatsFlex(r.weeks, jiraFlags[r.id]).pct; });
    return out;
  }, [tcRows, jiraFlags]);

  const weekScores = pool.map((e) => {
    const s = scoreFor(e.name);
    const score = s ? weightedScore(s.m, perfCfg.weights) : null;
    return { e, s, score, rag: ragOf(score, perfCfg) };
  });
  const { rows: wsPage, pager: wsPager } = usePaged(weekScores, 25);
  const scored = weekScores.filter((x) => x.score !== null);
  const avg = scored.length ? scored.reduce((a, x) => a + x.score, 0) / scored.length : null;
  const rag = { Green: 0, Amber: 0, Red: 0 };
  scored.forEach((x) => rag[x.rag]++);
  const watch = scored.filter((x) => x.rag !== "Green").sort((a, b) => a.score - b.score);
  const RAG_TONE = { Green: "bg-emerald-100 text-emerald-800", Amber: "bg-amber-100 text-amber-800", Red: "bg-red-100 text-red-800" };
  const starsText = (st) => st === null ? "" : "★".repeat(Math.floor(st)) + (st % 1 ? "½" : "");

  function applyCfg() {
    setMsg(null);
    const w = draft.weights.map(Number);
    const tot = w.reduce((s, x) => s + x, 0);
    if (tot !== 100) return setMsg({ tone: "error", text: "Weights must total exactly 100 — currently " + tot + "." });
    if (Number(draft.green) <= Number(draft.amber)) return setMsg({ tone: "error", text: "Green threshold must be above Amber." });
    setPerfCfg({ weights: w, green: Number(draft.green), amber: Number(draft.amber), partnerOnly: draft.partnerOnly });
    setDraft(null);
    setMsg({ tone: "ok", text: "Scoring configuration updated — all scores recalculated." });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Partner Performance</h2>
        <div className="flex flex-wrap gap-2">
          {ctx.can("perf.reports") && (
            <div className="flex overflow-hidden rounded-lg border border-slate-300">
              {[["scoring", "Scoring"], ["reports", "Reports & Export"]].map(([v, lab]) => (
                <button key={v} onClick={() => setPtab(v)}
                  className={"px-4 py-2 text-sm font-medium transition " + (ptab === v ? "mdb-btn-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
                  {lab}
                </button>
              ))}
            </div>
          )}
          <select className={inputCls + " w-52"} value={week} onChange={(e) => setWeek(e.target.value)}>
            {pWeeks.map((w) => <option key={w} value={w}>week ending {fmtShort(w)}</option>)}
          </select>
          <input className={inputCls + " w-40"} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={inputCls + " w-28"} value={co} onChange={(e) => setCo(e.target.value)}>
            {["All", ...(perfCfg.partnerOnly ? PARTNERS : ["MDB", ...PARTNERS])].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}
      {ptab === "reports" && ctx.can("perf.reports") && (() => {
        const cfg = perfCfg;
        const sc = perfScorecard(employees, scores, week, cfg);
        const vt = perfVendorTrend(employees, scores, cfg);
        const names = [...new Set(scores.map((s) => s.name))].sort();
        const person = names.includes(rptName) ? rptName : names[0] || "";
        const trend = person ? perfResourceTrend(scores, person, cfg) : [];
        const r2b = (x) => (x === null || x === undefined ? "" : Math.round(x * 100) / 100);
        const RAG_TONE = { Green: "bg-emerald-100 text-emerald-800", Amber: "bg-amber-100 text-amber-800", Red: "bg-red-100 text-red-800" };
        function exportExcel() {
          if (rpt === "scorecard") {
            downloadXlsx("performance-scorecard-" + week + ".xlsx", [
              ["Scorecard", [["Resource", "Vendor", ...METRICS, "Weighted", "Stars", "RAG"], ...sc.rows.map((r) => [r.name, r.vendor, ...r.m.map((x) => (x === null ? "" : x)), r2b(r.score), r.stars === null ? "" : r.stars, r.rag || ""])]],
              ["Vendor summary", [["Vendor", "Resources", "Scored", "Avg", "Green", "Amber", "Red"], ...Object.entries(sc.vendors).map(([v, x]) => [v, x.total, x.scored, r2b(x.avg), x.Green, x.Amber, x.Red])]],
            ]);
          } else if (rpt === "vendors") {
            downloadXlsx("vendor-comparison.xlsx", [["Weekly averages", [["Vendor", ...vt.weeks], ...Object.entries(vt.vendors).map(([v, arr]) => [v, ...arr.map(r2b)])]]]);
          } else {
            downloadXlsx("resource-trend-" + person.replace(/\s+/g, "_") + ".xlsx", [[person.slice(0, 31), [["Week", ...METRICS, "Weighted", "Stars", "RAG"], ...trend.map((t) => [t.week, ...t.m.map((x) => (x === null ? "" : x)), r2b(t.score), t.stars === null ? "" : t.stars, t.rag || ""])]]]);
          }
        }
        return (
          <>
            <div className="no-print flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-slate-300">
                {[["scorecard", "Weekly Scorecard"], ["vendors", "Vendor Comparison"], ["resource", "Resource Trend"]].map(([v, lab]) => (
                  <button key={v} onClick={() => setRpt(v)}
                    className={"px-3 py-2 text-sm font-medium transition " + (rpt === v ? "mdb-btn-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
                    {lab}
                  </button>
                ))}
              </div>
              {rpt === "resource" && (
                <select className={inputCls + " w-56"} value={person} onChange={(e) => setRptName(e.target.value)}>
                  {names.map((n) => <option key={n}>{n}</option>)}
                </select>
              )}
              <span className="ml-auto flex gap-2">
                <Btn kind="ghost" small onClick={exportExcel}>⬇ Excel</Btn>
                <Btn small onClick={() => window.print()}>Print / Save as PDF</Btn>
              </span>
            </div>
            <div className="print-area rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-start justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>
                    {rpt === "scorecard" ? "Partner Performance Scorecard — week ending " + fmt(week) : rpt === "vendors" ? "Vendor Performance Comparison" : "Resource Performance Trend — " + person}
                  </div>
                  <div className="text-xs text-slate-500">AMP APAC · generated {fmt(todayISO)} · weights {METRICS.map((mn, i) => mn + " " + perfCfg.weights[i] + "%").join(" · ")} · RAG Green ≥ {perfCfg.green}, Amber ≥ {perfCfg.amber}</div>
                </div>
                <Leaf size={26} />
              </div>
              {rpt === "scorecard" && (
                <>
                  <table className="mb-4 w-full text-xs">
                    <thead><tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-3">Vendor</th><th className="py-1.5 pr-3 text-right">Resources</th><th className="py-1.5 pr-3 text-right">Scored</th><th className="py-1.5 pr-3 text-right">Avg</th><th className="py-1.5 pr-3 text-right">Green</th><th className="py-1.5 pr-3 text-right">Amber</th><th className="py-1.5 pr-3 text-right">Red</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(sc.vendors).map(([v, x]) => (
                        <tr key={v}><td className="py-1 pr-3 font-medium">{v}</td><td className="py-1 pr-3 text-right">{x.total}</td><td className="py-1 pr-3 text-right">{x.scored}</td><td className="py-1 pr-3 text-right font-semibold">{r2b(x.avg) || "—"}</td><td className="py-1 pr-3 text-right text-emerald-700">{x.Green}</td><td className="py-1 pr-3 text-right text-amber-700">{x.Amber}</td><td className="py-1 pr-3 text-right text-red-700">{x.Red}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-3">Resource</th><th className="py-1.5 pr-3">Vendor</th>
                      {METRICS.map((mn) => <th key={mn} className="py-1.5 pr-2 text-center">{mn.slice(0, 5)}</th>)}
                      <th className="py-1.5 pr-3 text-right">Score</th><th className="py-1.5 pr-3">RAG</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {sc.rows.map((r) => (
                        <tr key={r.name}>
                          <td className="py-1 pr-3 font-medium">{r.name}</td><td className="py-1 pr-3 text-slate-500">{r.vendor}</td>
                          {r.m.map((x, i) => <td key={i} className="py-1 pr-2 text-center">{x === null ? "·" : x}</td>)}
                          <td className="py-1 pr-3 text-right font-semibold">{r.score === null ? "—" : r2b(r.score)}</td>
                          <td className="py-1 pr-3">{r.rag ? <Pill tone={RAG_TONE[r.rag]}>{r.rag}</Pill> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {rpt === "vendors" && (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-500">
                    <th className="py-1.5 pr-3">Vendor</th>
                    {vt.weeks.map((w) => <th key={w} className="py-1.5 pr-2 text-center">{fmtShort(w)}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(vt.vendors).map(([v, arr]) => (
                      <tr key={v}>
                        <td className="py-1 pr-3 font-medium">{v}</td>
                        {arr.map((x, i) => (
                          <td key={i} className="py-1 pr-2 text-center">
                            {x === null ? <span className="text-slate-300">·</span> : <span className={x >= perfCfg.green ? "font-semibold text-emerald-700" : x >= perfCfg.amber ? "text-amber-700" : "font-semibold text-red-700"}>{r2b(x)}</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {rpt === "resource" && (
                trend.length === 0 ? <p className="text-sm text-slate-500">No scores recorded for {person} yet.</p> : (
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-3">Week</th>
                      {METRICS.map((mn) => <th key={mn} className="py-1.5 pr-2 text-center">{mn.slice(0, 5)}</th>)}
                      <th className="py-1.5 pr-3 text-right">Score</th><th className="py-1.5 pr-3">Stars</th><th className="py-1.5 pr-3">RAG</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {trend.map((t) => (
                        <tr key={t.week}>
                          <td className="py-1 pr-3 font-medium">{fmtShort(t.week)}</td>
                          {t.m.map((x, i) => <td key={i} className="py-1 pr-2 text-center">{x === null ? "·" : x}</td>)}
                          <td className="py-1 pr-3 text-right font-semibold">{t.score === null ? "—" : r2b(t.score)}</td>
                          <td className="py-1 pr-3 text-amber-500">{t.stars === null ? "" : "★".repeat(Math.floor(t.stars)) + (t.stars % 1 ? "½" : "")}</td>
                          <td className="py-1 pr-3">{t.rag ? <Pill tone={RAG_TONE[t.rag]}>{t.rag}</Pill> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
              <p className="mt-4 border-t border-slate-100 pt-2 text-xs text-slate-400">Confidential — for MongoDB AMP APAC delivery governance. Generated from DeliveryHub.</p>
            </div>
          </>
        );
      })()}
      {ptab === "scoring" && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Scored this week" value={scored.length + " / " + pool.length} sub={perfCfg.partnerOnly ? "partner resources" : "all resources"} />
        <Stat label="Avg weighted score" value={avg === null ? "—" : r2(avg)} sub="out of 5" />
        <Stat label="Green / Amber" value={rag.Green + " / " + rag.Amber} sub={"Green ≥ " + perfCfg.green + " · Amber ≥ " + perfCfg.amber} />
        <Stat label="Red" value={rag.Red} sub={rag.Red ? "needs attention" : "none this week"} />
      </div>
      <Card title={"Weekly scoring — " + fmt(week) + " (1 critical … 5 excellent)"}>
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Resource</th><th className="py-2 pr-3">Vendor</th>
                {METRICS.map((mName, i) => <th key={mName} className="py-2 pr-2 text-center" title={mName === "Timecard" ? "Suggested from timecard proactiveness — click the grey hint to apply" : mName}>{mName}<div className="font-normal normal-case text-slate-400">{perfCfg.weights[i]}%</div></th>)}
                <th className="py-2 pr-3 text-right">Score</th><th className="py-2 pr-3">Stars</th><th className="py-2 pr-3">RAG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wsPage.map(({ e, s, score, rag: rg }) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap py-1 pr-3 font-medium text-slate-800">{e.name}</td>
                  <td className="py-1 pr-3 text-slate-500">{e.company}</td>
                  {METRICS.map((mName, i) => {
                    const v = s && s.m[i] !== null && s.m[i] !== undefined ? s.m[i] : "";
                    const sug = mName === "Timecard" && v === "" ? tcSuggested(tcPctByName[e.name]) : null;
                    return (
                      <td key={mName} className="py-1 pr-2 text-center">
                        <span className="inline-flex items-center gap-1">
                          <select value={v} disabled={!canScore} onChange={(ev) => setMetric(e.name, i, ev.target.value)}
                            className={"w-14 rounded border border-slate-200 px-1 py-1 text-center " + (canScore ? "cursor-pointer " : "cursor-not-allowed opacity-70 ") + (v === "" ? "text-slate-300" : v >= 4 ? "bg-emerald-50 text-emerald-800" : v >= 3 ? "bg-white text-slate-700" : "bg-red-50 text-red-800")}>
                            <option value="">—</option>
                            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                          {sug !== null && canScore && <button onClick={() => setMetric(e.name, i, String(sug))} title={"Apply suggestion from timecard proactiveness (" + (tcPctByName[e.name] ?? "—") + "%)"} className="rounded bg-slate-100 px-1 text-slate-400 hover:bg-slate-200">{sug}</button>}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-1 pr-3 text-right font-semibold">{score === null ? <span className="font-normal text-slate-300">—</span> : r2(score)}</td>
                  <td className="whitespace-nowrap py-1 pr-3 text-amber-500">{starsText(starsOf(score))}</td>
                  <td className="py-1 pr-3">{rg ? <Pill tone={RAG_TONE[rg]}>{rg}</Pill> : <span className="text-slate-300">—</span>}</td>
                </tr>
              ))}
              {pool.length === 0 && <tr><td colSpan={11} className="py-3 text-sm text-slate-500">No resources match — {perfCfg.partnerOnly ? "partner-only scoring is on (WeKan · Ciklum · Globant)" : "adjust filters"}.</td></tr>}
            </tbody>
          </table>
        </div>
        {wsPager}
        <p className="mt-2 text-xs text-slate-400">A score computes once all six metrics are filled. Grey hint next to Timecard applies the suggestion derived from that person's proactiveness %. Developers never see this module.</p>
      </Card>
      {watch.length > 0 && (
        <Card title={"Watchlist — " + fmt(week)}>
          <ul className="divide-y divide-slate-100">
            {watch.map(({ e, score, rag: rg }) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span><span className="font-medium text-slate-800">{e.name}</span><span className="ml-2 text-xs text-slate-400">{e.company}</span></span>
                <span className="flex items-center gap-2"><span className="text-xs text-slate-500">{r2(score)}</span><Pill tone={RAG_TONE[rg]}>{rg}</Pill></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {ctx.can("perf.config") && (
        <Card title="Scoring configuration (Admin)" right={!draft && <Btn small kind="ghost" onClick={() => setDraft({ weights: [...perfCfg.weights], green: perfCfg.green, amber: perfCfg.amber, partnerOnly: perfCfg.partnerOnly })}>Edit</Btn>}>
          {!draft ? (
            <p className="text-sm text-slate-600">Weights: {METRICS.map((mName, i) => mName + " " + perfCfg.weights[i] + "%").join(" · ")}. RAG: Green ≥ {perfCfg.green}, Amber ≥ {perfCfg.amber}, else Red. Scope: {perfCfg.partnerOnly ? "partner resources only (WeKan · Ciklum · Globant)" : "all resources including MDB"}.</p>
          ) : (
            <div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {METRICS.map((mName, i) => (
                  <Field key={mName} label={mName + " %"}>
                    <input type="number" min="0" max="100" className={inputCls} value={draft.weights[i]}
                      onChange={(e) => setDraft({ ...draft, weights: draft.weights.map((w, j) => (j === i ? e.target.value : w)) })} />
                  </Field>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Field label="Green ≥"><input type="number" step="0.1" className={inputCls + " w-24"} value={draft.green} onChange={(e) => setDraft({ ...draft, green: e.target.value })} /></Field>
                <Field label="Amber ≥"><input type="number" step="0.1" className={inputCls + " w-24"} value={draft.amber} onChange={(e) => setDraft({ ...draft, amber: e.target.value })} /></Field>
                <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-700">
                  <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={draft.partnerOnly} onChange={(e) => setDraft({ ...draft, partnerOnly: e.target.checked })} />
                  Partner resources only (untick to extend to MDB)
                </label>
                <span className={"pb-2 text-sm font-medium " + (draft.weights.reduce((s, w) => s + Number(w), 0) === 100 ? "text-emerald-700" : "text-red-600")}>
                  Total: {draft.weights.reduce((s, w) => s + Number(w), 0)}%
                </span>
                <Btn onClick={applyCfg}>Apply</Btn>
                <Btn kind="ghost" onClick={() => setDraft(null)}>Cancel</Btn>
              </div>
            </div>
          )}
        </Card>
      )}
      </>}
    </div>
  );
}

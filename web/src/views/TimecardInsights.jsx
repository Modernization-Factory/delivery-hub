import { fmtShort } from "../lib/dates.js";
import { tcStatsFlex, weekComplianceFlex } from "../lib/timecard.js";
import { downloadXlsx } from "../lib/xlsx.js";
import { Btn, Card, Pill, Stat } from "../ui/atoms.jsx";
import { FlaggedResources, flaggedSheet } from "../ui/FlaggedResources.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";

// ============================================================
// TIMECARD INSIGHTS (Lead / PM / Admin)
// ============================================================
export function TimecardInsights(ctx) {
  const { tcRows, tcWeeks, empByName, jiraFlags } = ctx;
  const scored = tcRows
    .map((r) => ({ ...r, st: tcStatsFlex(r.weeks, jiraFlags[r.id]) }))
    .filter((r) => r.st.pct !== null);
  const worst = [...scored].sort((a, b) => a.st.pct - b.st.pct).slice(0, 10);
  const best = [...scored].sort((a, b) => b.st.pct - a.st.pct).slice(0, 5);
  const weekly = tcWeeks.map((w, i) => ({ w, pct: weekComplianceFlex(tcRows, i, jiraFlags) }));
  const avg = scored.length ? Math.round(scored.reduce((s, r) => s + r.st.pct, 0) / scored.length) : 0;
  const totals = { Proactive: 0, Chased: 0, "Beyond Monday": 0, "Not Updated": 0, "Partial Updated": 0 };
  scored.forEach((r) => Object.keys(totals).forEach((k) => (totals[k] += r.st[k] || 0)));
  function exportExcel() {
    downloadXlsx("timecard-insights.xlsx", [
      ["Per resource", [["Resource", "Company", "Release", "Proactive %", "Proactive", "Chased", "Beyond Monday", "Not Updated", "Partial Updated"], ...scored.map((r) => [r.name, empByName[r.name] ? empByName[r.name].company : "", r.release, r.st.pct, r.st.Proactive, r.st.Chased, r.st["Beyond Monday"], r.st["Not Updated"], r.st["Partial Updated"]])]],
      ["Weekly compliance", [["Week of", "Proactive %"], ...weekly.map((w) => [w.w, w.pct === null ? "" : w.pct])]],
      ["Flagged weeks", flaggedSheet(tcRows, tcWeeks, empByName)],
    ]);
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Timecard Insights</h2>
        <Btn kind="ghost" small onClick={exportExcel}>⬇ Excel</Btn>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Avg proactiveness" value={avg + "%"} sub={scored.length + " tracked resources"} />
        <Stat label="Chased entries" value={totals["Chased"]} sub="times someone had to follow up" />
        <Stat label="Beyond Monday" value={totals["Beyond Monday"]} sub="late past the deadline" />
        <Stat label="Not updated" value={totals["Not Updated"]} sub="missing timecards" />
      </div>
      <Card title="Week-by-week compliance (SF + JIRA, Proactive share)">
        <div className="flex items-end gap-2">
          {weekly.map(({ w, pct }) => (
            <div key={w} className="flex-1 text-center">
              <div className="mx-auto flex h-32 w-full items-end rounded bg-slate-100" style={{ maxWidth: 48 }}>
                <div
                  className={"w-full rounded " + ((pct || 0) >= 80 ? "bg-emerald-500" : (pct || 0) >= 60 ? "bg-amber-400" : "bg-red-400")}
                  style={{ height: (pct || 0) + "%" }}
                  title={pct + "%"}
                />
              </div>
              <div className="mt-1 text-xs font-medium text-slate-600">{pct === null ? "—" : pct + "%"}</div>
              <div className="text-xs text-slate-400">{fmtShort(w)}</div>
            </div>
          ))}
        </div>
      </Card>
      <FlaggedResources {...ctx} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Needs chasing — lowest proactiveness">
          <ul className="divide-y divide-slate-100">
            {worst.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-800">{r.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{empByName[r.name] ? empByName[r.name].company : ""} · {r.release}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{r.st["Not Updated"]} missed · {r.st["Chased"]} chased</span>
                  <Pill tone={r.st.pct >= 60 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>{r.st.pct}%</Pill>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Most reliable — top proactiveness">
          <ul className="divide-y divide-slate-100">
            {best.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-800">{r.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{empByName[r.name] ? empByName[r.name].company : ""} · {r.release}</span>
                </div>
                <Pill tone="bg-emerald-100 text-emerald-800">{r.st.pct}%</Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}


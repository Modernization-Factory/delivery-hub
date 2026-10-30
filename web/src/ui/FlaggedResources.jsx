import { useState } from "react";
import { fmtShort } from "../lib/dates.js";
import { TC_COLORS } from "../lib/timecard.js";
import { downloadXlsx } from "../lib/xlsx.js";
import { Btn, Card, Pill, inputCls } from "./atoms.jsx";
// every flagged person-week as export rows (newest week first)
export function flaggedSheet(rows, weeks, empByName, keep = () => true) {
  const out = [["Resource", "Company", "Role", "Week of", "SF", "JIRA", "Comment", "Flagged by", "Flagged on"]];
  rows.forEach((r) => Object.entries(r.notes || {}).forEach(([wi, n]) => {
    if (!keep(r, Number(wi))) return;
    const e = empByName[r.name];
    const [sf, jira] = r.weeks[wi] || ["", ""];
    out.push([r.name, e ? e.company : "", e ? e.role : "", weeks[wi], sf, jira, n.comment || "", n.by || "", n.at || ""]);
  }));
  return [out[0], ...out.slice(1).sort((a, b) => b[3].localeCompare(a[3]) || a[0].localeCompare(b[0]))];
}

// Flagged resources — everyone with outlier flags, grouped by person, with every comment.
// `asTable` (Timecard Grid's Flagged tab): one row per flagged week with Edit / Delete;
// otherwise grouped by person (Timecard Insights, read-only).
export function FlaggedResources({ tcRows, tcWeeks, empByName, setNav, onEdit, onDelete, asTable }) {
  const [q, setQ] = useState("");
  const [co, setCo] = useState("All");
  const [since, setSince] = useState(0); // 0 = all weeks, else last N weeks
  const minIdx = since ? Math.max(0, tcWeeks.length - since) : 0;
  const keep = (r, wi) => wi >= minIdx && r.name.toLowerCase().includes(q.toLowerCase()) && (co === "All" || (empByName[r.name] && empByName[r.name].company === co));
  const people = tcRows
    .map((r) => ({ r, flags: Object.entries(r.notes || {}).map(([wi, n]) => ({ wi: Number(wi), n })).filter((f) => keep(r, f.wi)).sort((a, b) => b.wi - a.wi) }))
    .filter((p) => p.flags.length)
    .sort((a, b) => b.flags.length - a.flags.length || a.r.name.localeCompare(b.r.name));
  const total = people.reduce((s, p) => s + p.flags.length, 0);
  const flat = people.flatMap(({ r, flags }) => flags.map((f) => ({ r, ...f }))).sort((a, b) => b.wi - a.wi || a.r.name.localeCompare(b.r.name));
  const companies = [...new Set(tcRows.map((r) => (empByName[r.name] ? empByName[r.name].company : "")).filter(Boolean))].sort();
  return (
    <Card title={"Flagged resources (" + people.length + " people · " + total + " flagged weeks)"} right={
      <div className="flex flex-wrap gap-2">
        <input className={inputCls + " w-40"} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls + " w-28"} value={co} onChange={(e) => setCo(e.target.value)}>
          <option>All</option>{companies.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={inputCls + " w-36"} value={since} onChange={(e) => setSince(Number(e.target.value))}>
          <option value={0}>All weeks</option>
          {[4, 8, 12].map((n) => <option key={n} value={n}>Last {n} weeks</option>)}
        </select>
        <Btn kind="ghost" small disabled={!total} onClick={() => downloadXlsx("timecard-flagged-weeks.xlsx", [["Flagged weeks", flaggedSheet(tcRows, tcWeeks, empByName, keep)]])}>⬇ Excel</Btn>
      </div>
    }>
      {people.length === 0 ? (
        <p className="text-sm text-slate-500">No flagged weeks match these filters. Leads and PMs flag outlier weeks from the Timecard Grid (⚑).</p>
      ) : asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Resource</th><th className="py-2 pr-3">Company</th><th className="py-2 pr-3">Week of</th><th className="py-2 pr-3">SF</th><th className="py-2 pr-3">JIRA</th>
                <th className="py-2 pr-3">Comment</th><th className="py-2 pr-3">Flagged by</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flat.map(({ r, wi, n }) => {
                const [sf, jira] = r.weeks[wi] || ["", ""];
                return (
                  <tr key={r.id + "_" + wi} className="align-top">
                    <td className="py-2 pr-3 font-medium text-slate-800"><span className="mr-1 text-amber-600">⚑</span>{r.name}</td>
                    <td className="py-2 pr-3 text-slate-500">{empByName[r.name] ? empByName[r.name].company : "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtShort(tcWeeks[wi])}</td>
                    <td className="py-2 pr-3">{sf ? <Pill tone={TC_COLORS[sf]}>{sf}</Pill> : <span className="text-slate-300">—</span>}</td>
                    <td className="py-2 pr-3">{jira ? <Pill tone={TC_COLORS[jira]}>{jira}</Pill> : <span className="text-slate-300">—</span>}</td>
                    <td className="py-2 pr-3 text-slate-700">{n.comment || <span className="text-slate-400">(no comment)</span>}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-xs text-slate-500">{n.by}{n.at ? " · " + fmtShort(n.at) : ""}</td>
                    <td className="py-2 whitespace-nowrap text-right">
                      {onEdit && <Btn small kind="ghost" onClick={() => onEdit(r, wi)}>Edit</Btn>}
                      {onDelete && <Btn small kind="danger" onClick={() => onDelete(r, wi)}>Delete</Btn>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {people.map(({ r, flags }) => {
            const e = empByName[r.name];
            return (
              <li key={r.id} className="py-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-amber-600">⚑</span>
                  <span className="font-medium text-slate-800">{r.name}</span>
                  <span className="text-xs text-slate-400">{e ? e.role + " · " + e.company : ""}{r.release ? " · " + r.release : ""}</span>
                  <Pill tone="bg-amber-100 text-amber-800">{flags.length} flagged week{flags.length === 1 ? "" : "s"}</Pill>
                </div>
                <ul className="ml-6 space-y-1.5">
                  {flags.map(({ wi, n }) => (
                    <li key={wi} className="text-sm">
                      <span className="font-medium text-slate-600">week of {fmtShort(tcWeeks[wi])}</span>
                      {(r.weeks[wi] || []).map((v, k) => v && <Pill key={k} tone={"ml-1 " + TC_COLORS[v]}>{(k === 0 ? "SF " : "JIRA ") + v}</Pill>)}
                      <span className="ml-2 text-slate-700">{n.comment || <span className="text-slate-400">(no comment)</span>}</span>
                      <span className="ml-2 text-xs text-slate-400">— {n.by}{n.at ? ", " + fmtShort(n.at) : ""}</span>
                      {onEdit && <button type="button" className="ml-2 text-xs text-emerald-700 underline" onClick={() => onEdit(r, wi)}>Edit</button>}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
      {setNav && !onEdit && <p className="mt-2 text-xs text-slate-400">To add, edit or remove a flag, use ⚑ on the <button type="button" className="text-emerald-700 underline" onClick={() => setNav("timecard")}>Timecard Grid</button>.</p>}
    </Card>
  );
}

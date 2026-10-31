import { useState } from "react";
import { fmt, fmtShort } from "../lib/dates.js";
import { RUNWAY_ROLES } from "../lib/roles.js";
import { computeRunway, runwaySummary } from "../lib/runway.js";
import { downloadXlsx } from "../lib/xlsx.js";
import { Btn, Card, Field, Notice, Pill, Stat, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";

export function RunwayView(ctx) {
  const { projects, setProjects, employees, empByName, assignments, leaves, leaveTypes, weekendDays, holidaySet, todayISO } = ctx;
  const canFund = ctx.can("runway.funding");
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [selId, setSelId] = useState(null);
  const [q, setQ] = useState("");
  const [ragFilter, setRagFilter] = useState("all");
  const [sortBy, setSortBy] = useState("weeks");
  const r1 = (x) => Math.round(x * 10) / 10;
  const r2 = (x) => Math.round(x * 100) / 100;
  const RAG_TONE = { Green: "bg-emerald-100 text-emerald-800", Amber: "bg-amber-100 text-amber-800", Red: "bg-red-100 text-red-800" };
  const [from0, setFrom] = useState(""); // projection date; blank = today (so it follows the date day to day)
  const from = from0 || todayISO;

  const all = projects.map((p) => {
    const rw = computeRunway(p, empByName, assignments, leaves, leaveTypes, weekendDays, holidaySet, todayISO, from);
    return { p, rw, sum: runwaySummary(rw) };
  });
  const funded = all.filter((x) => x.rw);
  const counts = { Red: 0, Amber: 0, Green: 0 };
  funded.forEach((x) => { if (x.sum && x.sum.rag) counts[x.sum.rag] += 1; });
  const soonest = funded.filter((x) => x.rw.end).sort((a, b) => (a.rw.end < b.rw.end ? -1 : 1))[0] || null;

  const needle = q.trim().toLowerCase();
  const filtered = all.filter((x) => {
    if (needle && !(x.p.name.toLowerCase().includes(needle) || (x.p.pm || "").toLowerCase().includes(needle))) return false;
    if (ragFilter === "all") return true;
    if (ragFilter === "unfunded") return !x.rw;
    return x.sum && x.sum.rag === ragFilter;
  });
  const big = 1e9;
  const sorted = filtered.slice().sort((a, b) => {
    if (sortBy === "name") return a.p.name.localeCompare(b.p.name);
    if (sortBy === "end") return ((a.rw && a.rw.end) || "9999") < ((b.rw && b.rw.end) || "9999") ? -1 : 1;
    if (sortBy === "remaining") return ((b.sum && b.sum.totalRemaining) || 0) - ((a.sum && a.sum.totalRemaining) || 0);
    return ((a.sum && a.sum.minWeeks !== null ? a.sum.minWeeks : big)) - ((b.sum && b.sum.minWeeks !== null ? b.sum.minWeeks : big));
  });
  const { rows: pageRows, pager } = usePaged(sorted, 25);
  const sel = all.find((x) => x.p.id === selId) || null;

  function startEdit(p) {
    const fd = p.funding || {};
    setEditId(p.id);
    setF({ start: fd.start || todayISO, hours: { ...(fd.hours || {}) }, overrides: { ...(fd.overrides || {}) }, asOf: fd.overridesAsOf || fd.start || todayISO, asOfTouched: false });
  }
  function saveFunding(p) {
    setMsg(null);
    if (!f.start) return setMsg({ tone: "error", text: "Funding start date is required — consumption is counted from it." });
    const hours = {};
    const overrides = {};
    RUNWAY_ROLES.forEach((r) => {
      hours[r] = Number(f.hours[r]) || 0;
      overrides[r] = f.overrides[r] === "" || f.overrides[r] === null || f.overrides[r] === undefined ? null : Number(f.overrides[r]);
    });
    // a changed override is a balance as of today unless the "as of" date was set by hand
    const prev = (p.funding && p.funding.overrides) || {};
    const changed = RUNWAY_ROLES.some((r) => (prev[r] ?? null) !== overrides[r]);
    const overridesAsOf = f.asOfTouched ? f.asOf : changed ? todayISO : (p.funding && p.funding.overridesAsOf) || f.start;
    setProjects(projects.map((x) => (x.id === p.id ? { ...x, funding: { start: f.start, hours, overrides, overridesAsOf } } : x)));
    setEditId(null);
    setMsg({ tone: "ok", text: "Funding saved for " + p.name + " — runway recalculated." });
  }

  const fundingEditor = (p) => (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-3 sm:grid-cols-5">
        <Field label="Funding start (consumption counts from here)"><input type="date" className={inputCls} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        {RUNWAY_ROLES.map((r) => (
          <Field key={r} label={r + " total billable hrs"}>
            <input type="number" min="0" className={inputCls} value={f.hours[r] ?? ""} onChange={(e) => setF({ ...f, hours: { ...f.hours, [r]: e.target.value } })} />
          </Field>
        ))}
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-5">
        <Field label="Overrides are the balance as of">
          <input type="date" className={inputCls} value={f.asOf} onChange={(e) => setF({ ...f, asOf: e.target.value, asOfTouched: true })} />
        </Field>
        {RUNWAY_ROLES.map((r) => (
          <Field key={r} label={r + " remaining override"}>
            <input type="number" min="0" className={inputCls} placeholder="derived" value={f.overrides[r] ?? ""} onChange={(e) => setF({ ...f, overrides: { ...f.overrides, [r]: e.target.value } })} />
          </Field>
        ))}
      </div>
      <div className="mt-3 flex gap-2"><Btn small onClick={() => saveFunding(p)}>Save funding</Btn><Btn small kind="ghost" onClick={() => setEditId(null)}>Cancel</Btn></div>
    </div>
  );

  const lastLabel = (r) => r.last
    ? <span>{fmt(r.last)}{r.beyondAssignments && <span className="ml-1 text-xs font-normal text-amber-700" title={"Assignments end " + fmt(r.assignmentsEnd) + " with " + r.leftAtAssignmentsEnd + " h unused; this date assumes the people assigned then carry on"}>⚠ after assignments end {fmtShort(r.assignmentsEnd)}</span>}</span>
    : r.total && !r.remaining ? <span className="text-red-600">used up</span> : "—";
  const weeksLabel = (w) => (w === null || w === undefined ? "—" : r2(w) + " wk");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Remaining Runway</h2>
        <span className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          Project from
          <input type="date" className={inputCls + " w-40"} value={from} onChange={(e) => setFrom(e.target.value === todayISO ? "" : e.target.value)} />
          {from0 && <Btn small kind="ghost" onClick={() => setFrom("")}>Today</Btn>}
        </span>
      </div>
      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}

      {!sel && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Funded projects" value={funded.length} sub={all.length - funded.length ? all.length - funded.length + " without funding" : "all projects configured"} />
            <Stat label="Under 2 weeks" value={counts.Red} sub="role runs out inside 2 weeks" />
            <Stat label="2–4 weeks" value={counts.Amber} sub="needs an extension conversation" />
            <Stat label="Soonest to end" value={soonest ? fmt(soonest.rw.end) : "—"} sub={soonest ? soonest.p.name : "no funded runway"} />
          </div>

          <Card title={"Projects (" + sorted.length + (sorted.length !== all.length ? " of " + all.length : "") + ") — one row each, tightest role drives the RAG"}
            right={
              <div className="flex flex-wrap items-center gap-2">
                <input className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm" placeholder="Search project or PM" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={ragFilter} onChange={(e) => setRagFilter(e.target.value)}>
                  <option value="all">All statuses</option><option value="Red">Red</option><option value="Amber">Amber</option><option value="Green">Green</option><option value="unfunded">Not funded</option>
                </select>
                <select className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="weeks">Sort: shortest runway</option><option value="end">Sort: earliest end</option><option value="remaining">Sort: most hours left</option><option value="name">Sort: name</option>
                </select>
                <Btn kind="ghost" small onClick={() => {
                  downloadXlsx("remaining-runway.xlsx", [["Runway", [
                    ["Project", "PM", "Status", "Tightest role", "Weeks left", "Total remaining h", "Funded until", "Funding start"],
                    ...sorted.map((x) => [x.p.name, x.p.pm || "", x.sum && x.sum.rag ? x.sum.rag : "not funded", x.sum && x.sum.tightest ? x.sum.tightest.role : "", x.sum && x.sum.minWeeks !== null ? r2(x.sum.minWeeks) : "", x.sum ? r1(x.sum.totalRemaining) : "", x.rw && x.rw.end ? x.rw.end : "", x.p.funding ? x.p.funding.start : ""]),
                  ]]]);
                }}>⬇ Excel</Btn>
              </div>
            }>
            {sorted.length === 0 ? <p className="text-sm text-slate-500">No projects match this filter.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Project</th><th className="py-2 pr-3">PM</th><th className="py-2 pr-3">Tightest role</th>
                      <th className="py-2 pr-3 text-right">Weeks left</th><th className="py-2 pr-3">Runs until</th>
                      <th className="py-2 pr-3 text-right">Remaining h</th><th className="py-2 pr-3">Roles staffed</th><th className="py-2 pr-3">Status</th><th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageRows.map(({ p, rw, sum }) => (
                      <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelId(p.id)}>
                        <td className="py-2 pr-3 font-medium text-slate-800">{p.name}</td>
                        <td className="py-2 pr-3 text-slate-600">{p.pm || "—"}</td>
                        <td className="py-2 pr-3">{sum && sum.tightest ? sum.tightest.role : <span className="text-slate-300">—</span>}</td>
                        <td className={"py-2 pr-3 text-right font-semibold " + (sum && sum.rag === "Red" ? "text-red-600" : "text-slate-800")}>{sum ? weeksLabel(sum.minWeeks) : "—"}</td>
                        <td className="py-2 pr-3">{rw && rw.end ? fmt(rw.end) : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 pr-3 text-right">{sum ? r1(sum.totalRemaining) : "—"}</td>
                        <td className="py-2 pr-3">
                          <span className="flex gap-1">
                            {rw ? RUNWAY_ROLES.map((role) => {
                              const rr = rw.rows.find((z) => z.role === role);
                              const tone = !rr || rr.rag === null ? "bg-slate-100 text-slate-400" : RAG_TONE[rr.rag];
                              return <span key={role} className={"rounded px-1.5 py-0.5 text-[10px] font-medium " + tone} title={rr && rr.weeks !== null ? role + ": " + r2(rr.weeks) + " weeks" : role + ": no burn"}>{role}</span>;
                            }) : <span className="text-slate-300">—</span>}
                          </span>
                        </td>
                        <td className="py-2 pr-3">{sum && sum.rag ? <Pill tone={RAG_TONE[sum.rag]}>{sum.rag}</Pill> : <Pill tone="bg-slate-100 text-slate-500">not funded</Pill>}</td>
                        <td className="py-2 text-right text-xs text-slate-400">open ›</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pager}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">Weeks left = the earliest-exhausting staffed role. The four chips are the per-role RAG (grey = no active burn). Open a project for the full per-role breakdown and funding setup.</p>
          </Card>
        </>
      )}

      {sel && (() => {
        const { p, rw, sum } = sel;
        return (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Btn kind="ghost" small onClick={() => { setSelId(null); setEditId(null); }}>‹ All projects</Btn>
              <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>{p.name}</h3>
              {sum && sum.rag && <Pill tone={RAG_TONE[sum.rag]}>{sum.rag}</Pill>}
              <span className="text-xs text-slate-500">{p.pm ? "PM " + p.pm + " · " : ""}{p.funding ? "funded from " + fmt(p.funding.start) : "no funding configured"}</span>
              <span className="ml-auto flex gap-1">
                {(() => {
                  const idx = sorted.findIndex((x) => x.p.id === p.id);
                  return (
                    <>
                      <Btn small kind="ghost" disabled={idx <= 0} onClick={() => { setEditId(null); setSelId(sorted[idx - 1].p.id); }}>‹ Prev</Btn>
                      <Btn small kind="ghost" disabled={idx < 0 || idx >= sorted.length - 1} onClick={() => { setEditId(null); setSelId(sorted[idx + 1].p.id); }}>Next ›</Btn>
                    </>
                  );
                })()}
              </span>
            </div>

            {rw && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Weeks left" value={sum ? weeksLabel(sum.minWeeks) : "—"} sub={sum && sum.tightest ? "limited by " + sum.tightest.role : "no staffed role"} />
                <Stat label="Funded until" value={rw.end ? fmt(rw.end) : "—"} sub="earliest role exhaustion" />
                <Stat label="Remaining hours" value={r1(rw.totalRemaining)} sub={"of " + RUNWAY_ROLES.reduce((s, r) => s + ((p.funding.hours || {})[r] || 0), 0) + " billable"} />
                <Stat label="Weekly burn" value={r1(rw.rows.reduce((s, r) => s + r.weeklyBurn, 0)) + " h"} sub={rw.rows.reduce((s, r) => s + r.headcount, 0) + " people assigned"} />
              </div>
            )}

            <Card title={"Per-role runway — " + p.name}
              right={canFund && editId !== p.id && <Btn small kind="ghost" onClick={() => startEdit(p)}>{p.funding ? "Edit funding" : "Set up funding"}</Btn>}>
              {editId === p.id && f && fundingEditor(p)}
              {!rw ? (
                <p className="text-sm text-slate-500">No funding configured{canFund ? " — click \"Set up funding\" and enter the SOW billable hours per role." : " — the PM sets SOW billable hours per role here."}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3">Role</th><th className="py-2 pr-3 text-right">Headcount</th><th className="py-2 pr-3 text-right">Burn / wk (h)</th>
                        <th className="py-2 pr-3 text-right">Total billable</th><th className="py-2 pr-3 text-right">Consumed</th><th className="py-2 pr-3 text-right">Remaining</th>
                        <th className="py-2 pr-3 text-right">Weeks</th><th className="py-2 pr-3 text-right">Working days</th><th className="py-2 pr-3">Last date</th>
                        <th className="py-2 pr-3 text-right">Lost to leave</th><th className="py-2 pr-3 text-right">Holidays</th><th className="py-2 pr-3">RAG</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rw.rows.map((r) => (
                        <tr key={r.role} className={r.headcount === 0 && !r.total ? "text-slate-300" : ""}>
                          <td className="py-1.5 pr-3 font-medium">{r.role}</td>
                          <td className="py-1.5 pr-3 text-right">{r.headcount}{r.weeklyBurn && r.headcount && r.weeklyBurn < r.headcount * 40 ? <span className="ml-1 text-xs text-slate-400" title="Some people are split across concurrent projects — burn reflects their share here">({Math.round(r.weeklyBurn / 40 * 100) / 100} FTE)</span> : null}</td>
                          <td className="py-1.5 pr-3 text-right">{r.weeklyBurn ? Math.round(r.weeklyBurn * 10) / 10 : "—"}</td>
                          <td className="py-1.5 pr-3 text-right">{r.total || "—"}</td>
                          <td className="py-1.5 pr-3 text-right text-slate-500">{r.consumed || "—"}</td>
                          <td className="py-1.5 pr-3 text-right font-semibold">{r1(r.remaining)}{r.override !== null && <Pill tone="ml-1 bg-purple-100 text-purple-800" title={r.overrideAsOf ? r.override + " h as of " + fmt(r.overrideAsOf) + "; hours burnt since then are deducted" : ""}>override</Pill>}</td>
                          <td className="py-1.5 pr-3 text-right font-semibold">{r.weeks === null ? "—" : r2(r.weeks)}</td>
                          <td className="py-1.5 pr-3 text-right">{r.days ? r.days : "—"}</td>
                          <td className="py-1.5 pr-3 font-medium">{lastLabel(r)}</td>
                          <td className="py-1.5 pr-3 text-right text-slate-500">{r.leaveHours ? r1(r.leaveHours) + " h" : "—"}</td>
                          <td className="py-1.5 pr-3 text-right text-slate-500">{r.holidays || "—"}</td>
                          <td className="py-1.5 pr-3">{r.rag ? <Pill tone={RAG_TONE[r.rag]}>{r.rag}</Pill> : "—"}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-slate-200 font-semibold">
                        <td className="py-2 pr-3">Project</td><td /><td />
                        <td className="py-2 pr-3 text-right">{RUNWAY_ROLES.reduce((s, r) => s + ((p.funding.hours || {})[r] || 0), 0)}</td>
                        <td />
                        <td className="py-2 pr-3 text-right">{r1(rw.totalRemaining)}</td>
                        <td colSpan={2} />
                        <td className="py-2 pr-3">{rw.end ? "ends " + fmt(rw.end) : "—"}</td>
                        <td colSpan={3} />
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-slate-400">Projected day by day from {fmt(from)}: each working day every assigned person burns 8 h × (weekly hours ÷ 40), split across concurrent projects. Weekends, holidays and each person's own leave burn nothing (Half Day burns half), so leave delays the date by the hours actually lost, not by whole team-days. The last date is when remaining hours run out; if the role's assignments end first, the people assigned on that day are assumed to carry on and the date is marked ⚠. Consumed counts from the funding start to the day before the projection date. A remaining override is the balance on its "as of" date; hours burnt since then are deducted, so dates don't drift day to day. Weeks = working days ÷ 5. RAG: Green ≥ 4 weeks, Amber ≥ 2.</p>
                </div>
              )}
            </Card>
          </>
        );
      })()}
    </div>
  );
}

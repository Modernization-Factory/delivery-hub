import { useState } from "react";
import { fmt } from "../lib/dates.js";
import { balancesFor, compOffDateValid } from "../lib/leave.js";
import { Btn, Card, Field, Notice, Pill, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";

// ============================================================
// COMP-OFF LOG (Lead / PM / Admin)
// ============================================================
export function CompOffLog(ctx) {
  const { comps, setComps, employees, weekendDays, holidaySet, nextId, leaves, leaveTypes, todayISO, empByName } = ctx;
  const [team, setTeam] = useState("All"); // company filter: narrows both the ledger and the employee picker
  const [q, setQ] = useState("");
  const coOf = (name) => (empByName[name] && empByName[name].company) || "—"; // empByName covers inactive people too
  const teams = [...new Set([...employees.map((e) => e.company), ...comps.map((c) => coOf(c.name))].filter(Boolean))].sort();
  const pickable = employees.filter((e) => team === "All" || e.company === team);
  const [who0, setWho] = useState("");
  const who = pickable.some((e) => e.name === who0) ? who0 : (pickable[0] ? pickable[0].name : "");
  const [date, setDate] = useState("");
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState(null);
  function add() {
    setMsg(null);
    if (!who || !date) return setMsg({ tone: "error", text: "Employee and date worked are required." });
    if (!compOffDateValid(date, weekendDays, holidaySet)) {
      return setMsg({ tone: "error", text: fmt(date) + " is a normal working day. Comp-off can only be earned for work on a weekend or a listed holiday (same rule as the old tracker)." });
    }
    if (comps.some((c) => c.name === who && c.date === date)) {
      return setMsg({ tone: "error", text: "A comp-off entry for " + who + " on " + fmt(date) + " already exists." });
    }
    setComps([...comps, { id: nextId("c"), name: who, date, days: Number(days), reason }]);
    setReason("");
    setMsg({ tone: "ok", text: "Comp-off logged: " + who + " earns " + days + " day(s) for " + fmt(date) + "." });
  }
  const shown = comps.filter((c) => (team === "All" || coOf(c.name) === team) && c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const sorted = [...shown].sort((a, b) => b.date.localeCompare(a.date));
  const earnedShown = shown.reduce((t, c) => t + Number(c.days), 0);
  const { rows: coPage, pager: coPager } = usePaged(sorted, 25);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Comp-Off Earned</h2>
        <div className="flex flex-wrap gap-2">
          <select className={inputCls + " w-40"} value={team} onChange={(e) => setTeam(e.target.value)} title="Company">
            <option value="All">All companies</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className={inputCls + " w-48"} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <Card title="Log approved comp-off (weekend / holiday work only)">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Employee">
            <select className={inputCls} value={who} onChange={(e) => setWho(e.target.value)}>
              {pickable.map((e) => <option key={e.id} value={e.name}>{e.name}{e.term && e.term <= todayISO ? " (ended)" : ""}</option>)}
            </select>
          </Field>
          <Field label="Date worked"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Earned days">
            <select className={inputCls} value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="1">1 — full day</option>
              <option value="0.5">0.5 — half day</option>
            </select>
          </Field>
          <Field label="Reason (short)"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Prod cutover support" /></Field>
        </div>
        <div className="mt-3"><Btn onClick={add}>Log comp-off</Btn></div>
        {msg && <div className="mt-3"><Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice></div>}
      </Card>
      <Card title={"Comp-off ledger (" + shown.length + (shown.length !== comps.length ? " of " + comps.length : "") + " entries · " + earnedShown + " days earned" + (team !== "All" ? " · " + team : "") + ")"}>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Company</th><th className="py-2 pr-4">Date worked</th><th className="py-2 pr-4">Earned</th><th className="py-2 pr-4">Balance now</th><th className="py-2 pr-4">Reason</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coPage.map((c) => {
                const b = balancesFor(c.name, leaves, comps, leaveTypes, weekendDays, holidaySet);
                return (
                  <tr key={c.id}>
                    <td className="py-1.5 pr-4 font-medium text-slate-800">{c.name}</td>
                    <td className="py-1.5 pr-4 text-slate-500">{coOf(c.name)}</td>
                    <td className="py-1.5 pr-4">{fmt(c.date)}</td>
                    <td className="py-1.5 pr-4">{c.days}</td>
                    <td className="py-1.5 pr-4"><Pill tone={b.compOffBalance >= 0 ? "bg-teal-100 text-teal-800" : "bg-red-100 text-red-800"}>{b.compOffBalance}</Pill></td>
                    <td className="py-1.5 pr-4 text-slate-500">{c.reason || "—"}</td>
                    <td className="py-1.5 text-right"><Btn small kind="danger" onClick={() => setComps(comps.filter((x) => x.id !== c.id))}>Delete</Btn></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {coPager}
      </Card>
    </div>
  );
}

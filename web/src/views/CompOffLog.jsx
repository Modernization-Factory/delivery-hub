import { useState } from "react";
import { fmt } from "../lib/dates.js";
import { balancesFor, compOffDateValid } from "../lib/leave.js";
import { canLogCompOff } from "../lib/permissions.js";
import { Btn, Card, Field, Notice, Pill, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";

// ============================================================
// COMP-OFF LOG — the full ledger for leave.compoff (Lead / PM / Admin by default);
// with only leave.compoffOwn (Developers) it is "My comp-off": your own entries, nobody else's
// ============================================================
export function CompOffLog(ctx) {
  const { comps: allComps, setComps, employees, weekendDays, holidaySet, nextId, leaves, leaveTypes, todayISO, empByName, user } = ctx;
  const manage = ctx.can("leave.compoff");
  const me = user.name;
  // own-only: never show another person's entry, even if the loaded list happens to hold one
  const comps = manage ? allComps : allComps.filter((c) => c.name === me);
  const [team, setTeam] = useState("All"); // company filter: narrows both the ledger and the employee picker
  const [q, setQ] = useState("");
  const coOf = (name) => (empByName[name] && empByName[name].company) || "—"; // empByName covers inactive people too
  const teams = [...new Set([...employees.map((e) => e.company), ...comps.map((c) => coOf(c.name))].filter(Boolean))].sort();
  const pickable = employees.filter((e) => team === "All" || e.company === team);
  const [who0, setWho] = useState("");
  const who = !manage ? me : pickable.some((e) => e.name === who0) ? who0 : (pickable[0] ? pickable[0].name : "");
  const [date, setDate] = useState("");
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState(null);
  function add() {
    setMsg(null);
    if (!who || !date) return setMsg({ tone: "error", text: manage ? "Employee and date worked are required." : "Date worked is required." });
    if (!manage && date > todayISO) return setMsg({ tone: "error", text: fmt(date) + " hasn't happened yet — log comp-off for a day you've already worked." });
    if (!compOffDateValid(date, weekendDays, holidaySet)) {
      return setMsg({ tone: "error", text: fmt(date) + " is a normal working day. Comp-off can only be earned for work on a weekend or a listed holiday (same rule as the old tracker)." });
    }
    if (comps.some((c) => c.name === who && c.date === date)) {
      return setMsg({ tone: "error", text: "A comp-off entry for " + (manage ? who : "you") + " on " + fmt(date) + " already exists." });
    }
    // always write through the full list — the own-only view is a filtered copy of it
    setComps([...allComps, { id: nextId("c"), name: who, date, days: Number(days), reason }]);
    setReason("");
    setMsg({ tone: "ok", text: "Comp-off logged: " + (manage ? who + " earns " : "you earn ") + days + " day(s) for " + fmt(date) + "." });
  }
  const shown = comps.filter((c) => (team === "All" || coOf(c.name) === team) && c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const sorted = [...shown].sort((a, b) => b.date.localeCompare(a.date));
  const earnedShown = shown.reduce((t, c) => t + Number(c.days), 0);
  const { rows: coPage, pager: coPager } = usePaged(sorted, 25);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>{manage ? "Comp-Off Earned" : "My Comp-Off"}</h2>
        {manage && (
          <div className="flex flex-wrap gap-2">
            <select className={inputCls + " w-40"} value={team} onChange={(e) => setTeam(e.target.value)} title="Company">
              <option value="All">All companies</option>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={inputCls + " w-48"} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
      </div>
      <Card title={manage ? "Log approved comp-off (weekend / holiday work only)" : "Log comp-off you earned (a weekend or holiday you worked)"}>
        <div className={"grid gap-3 " + (manage ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
          {manage && (
            <Field label="Employee">
              <select className={inputCls} value={who} onChange={(e) => setWho(e.target.value)}>
                {pickable.map((e) => <option key={e.id} value={e.name}>{e.name}{e.term && e.term <= todayISO ? " (ended)" : ""}</option>)}
              </select>
            </Field>
          )}
          <Field label="Date worked"><input type="date" className={inputCls} value={date} max={manage ? undefined : todayISO} onChange={(e) => setDate(e.target.value)} /></Field>
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
      <Card title={(manage ? "Comp-off ledger (" : "Your comp-off (") + shown.length + (shown.length !== comps.length ? " of " + comps.length : "") + " entries · " + earnedShown + " days earned" + (team !== "All" ? " · " + team : "") + ")"}>
        {!manage && shown.length === 0 && <p className="mb-2 text-sm text-slate-500">Nothing logged yet. Worked a weekend or a holiday? Log it above and it adds to your comp-off balance.</p>}
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                {manage && <><th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Company</th></>}
                <th className="py-2 pr-4">Date worked</th><th className="py-2 pr-4">Earned</th><th className="py-2 pr-4">Balance now</th><th className="py-2 pr-4">Reason</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coPage.map((c) => {
                const b = balancesFor(c.name, leaves, comps, leaveTypes, weekendDays, holidaySet);
                return (
                  <tr key={c.id}>
                    {manage && <><td className="py-1.5 pr-4 font-medium text-slate-800">{c.name}</td>
                    <td className="py-1.5 pr-4 text-slate-500">{coOf(c.name)}</td></>}
                    <td className="py-1.5 pr-4">{fmt(c.date)}</td>
                    <td className="py-1.5 pr-4">{c.days}</td>
                    <td className="py-1.5 pr-4"><Pill tone={b.compOffBalance >= 0 ? "bg-teal-100 text-teal-800" : "bg-red-100 text-red-800"}>{b.compOffBalance}</Pill></td>
                    <td className="py-1.5 pr-4 text-slate-500">{c.reason || "—"}</td>
                    <td className="py-1.5 text-right">{canLogCompOff(ctx.can, c.name === me) && <Btn small kind="danger" onClick={() => setComps(allComps.filter((x) => x.id !== c.id))}>Delete</Btn>}</td>
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

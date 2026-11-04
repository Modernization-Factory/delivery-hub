import { useState } from "react";
import { fmt, fmtShort } from "../lib/dates.js";
import { balancesFor, compOffDateValid, compOffStatus, compOffTypeName } from "../lib/leave.js";
import { canLogCompOff } from "../lib/permissions.js";
import { canDecideCompOff } from "../lib/reporting.js";
import { downloadXlsx } from "../lib/xlsx.js";
import { Btn, Card, Field, Notice, Pill, Stat, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";

const STATUS_TONE = { pending: "bg-amber-100 text-amber-800", approved: "bg-teal-100 text-teal-800", rejected: "bg-rose-100 text-rose-800" };
const STATUS_LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected" };

// ============================================================
// COMP-OFF LOG — the full ledger for leave.compoff (Lead / PM / Admin by default, team managers
// for their chain); with only leave.compoffOwn (Developers) it is "My comp-off": your own entries.
// Self-logged entries wait for a manager above you (or an Admin) to approve them; only approved
// days count toward the balance. Entries logged for someone else are approved straight away.
// ============================================================
export function CompOffLog(ctx) {
  const { comps: allComps, setComps, decideCompOff, employees, weekendDays, holidaySet, nextId, leaves, leaveTypes, todayISO, empByName, user } = ctx;
  const manage = ctx.can("leave.compoff");
  const me = user.name;
  const r1 = (x) => Math.round(x * 10) / 10;
  // own-only: never show another person's entry, even if the loaded list happens to hold one
  const comps = manage ? allComps : allComps.filter((c) => c.name === me);
  const [tab, setTab] = useState("ledger"); // ledger | summary (ledger viewers only)
  const [team, setTeam] = useState("All"); // company filter: narrows the ledger, summary and employee picker
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
  const isAdmin = user.role === "Admin";
  const coName = compOffTypeName(leaveTypes);

  // ---- approvals: pending entries this user may decide (the API checks the same rule)
  const org = ctx.allEmployees || employees;
  const idOf = (name) => (empByName[name] || {}).id;
  const approver = { id: user.id, role: user.role, teamManager: !!user.teamManager };
  const canDecide = (c) => compOffStatus(c) === "pending" && canDecideCompOff(approver, org, idOf(c.name), ctx.can);
  const toDecide = allComps.filter(canDecide).sort((a, b) => a.date.localeCompare(b.date));
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const [decMsg, setDecMsg] = useState(null);
  async function decide(c, decision) {
    setBusy(c.id);
    setDecMsg(null);
    try {
      await decideCompOff(c.id, decision, notes[c.id] || "");
      setDecMsg({ tone: "ok", text: (decision === "approve" ? "Approved " : "Rejected ") + c.name + "'s " + c.days + " day(s) for " + fmt(c.date) + "." });
    } catch (e) {
      setDecMsg({ tone: "error", text: e.message || "Couldn't save that decision." });
    } finally {
      setBusy(null);
    }
  }

  // who approves my own entries: the nearest manager, otherwise an Admin
  const myMgr = empByName[me] && empByName[me].managerId ? org.find((e) => e.id === empByName[me].managerId) : null;
  const approvedBy = isAdmin ? "" : myMgr ? myMgr.name + " (or a manager above them, or an Admin)" : "an Admin — you have no manager set";

  function add() {
    setMsg(null);
    if (!who || !date) return setMsg({ tone: "error", text: manage ? "Employee and date worked are required." : "Date worked is required." });
    if (!manage && date > todayISO) return setMsg({ tone: "error", text: fmt(date) + " hasn't happened yet — log comp-off for a day you've already worked." });
    if (!compOffDateValid(date, weekendDays, holidaySet)) {
      return setMsg({ tone: "error", text: fmt(date) + " is a normal working day. Comp-off can only be earned for work on a weekend or a listed holiday (same rule as the old tracker)." });
    }
    if (allComps.some((c) => c.name === who && c.date === date)) {
      return setMsg({ tone: "error", text: "A comp-off entry for " + (who === me ? "you" : who) + " on " + fmt(date) + " already exists." });
    }
    const status = who === me && !isAdmin ? "pending" : "approved";
    // always write through the full list — the own-only view is a filtered copy of it
    setComps([...allComps, { id: nextId("c"), name: who, date, days: Number(days), reason, status, createdBy: me }]);
    setReason("");
    setMsg(status === "pending"
      ? { tone: "ok", text: "Logged " + days + " day(s) for " + fmt(date) + " — waiting for approval by " + approvedBy + ". It counts toward your balance once approved." }
      : { tone: "ok", text: "Comp-off logged: " + (who === me ? "you earn " : who + " earns ") + days + " day(s) for " + fmt(date) + "." });
  }

  const shown = comps.filter((c) => (team === "All" || coOf(c.name) === team) && c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const sorted = [...shown].sort((a, b) => b.date.localeCompare(a.date));
  const daysWith = (list, st) => list.filter((c) => compOffStatus(c) === st).reduce((t, c) => t + Number(c.days), 0);
  const { rows: coPage, pager: coPager } = usePaged(sorted, 25);
  const mine = balancesFor(me, leaves, allComps, leaveTypes, weekendDays, holidaySet);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>{manage ? "Comp-Off" : "My Comp-Off"}</h2>
        {manage && (
          <div className="flex flex-wrap gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-300">
              {[["ledger", "Ledger"], ["summary", "Summary"]].map(([v, lab]) => (
                <button key={v} onClick={() => setTab(v)}
                  className={"px-4 py-2 text-sm font-medium transition " + (tab === v ? "mdb-btn-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
                  {lab}
                </button>
              ))}
            </div>
            <select className={inputCls + " w-40"} value={team} onChange={(e) => setTeam(e.target.value)} title="Company">
              <option value="All">All companies</option>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={inputCls + " w-48"} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
      </div>

      {!manage && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={coName + " earned"} value={r1(mine.compOffEarned)} sub="approved" />
          <Stat label="Waiting for approval" value={r1(mine.compOffPending)} sub={mine.compOffPending ? "not usable yet" : "nothing pending"} />
          <Stat label={coName + " used"} value={r1(mine.compOffUsed)} />
          <Stat label={coName + " balance"} value={r1(mine.compOffBalance)} sub={mine.compOffBalance < 0 ? "Negative — review entries" : "available to take"} />
        </div>
      )}

      {toDecide.length > 0 && (
        <Card title={"Waiting for your approval — " + toDecide.length + " entr" + (toDecide.length === 1 ? "y" : "ies") + " · " + r1(daysWith(toDecide, "pending")) + " day(s)"}>
          {decMsg && <div className="mb-3"><Notice tone={decMsg.tone === "error" ? "error" : "ok"}>{decMsg.text}</Notice></div>}
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Date worked</th><th className="py-2 pr-4">Days</th><th className="py-2 pr-4">Reason</th><th className="py-2 pr-4">Note (optional)</th><th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {toDecide.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1.5 pr-4 font-medium text-slate-800">{c.name}</td>
                    <td className="py-1.5 pr-4">{fmt(c.date)}</td>
                    <td className="py-1.5 pr-4">{c.days}</td>
                    <td className="py-1.5 pr-4 text-slate-500">{c.reason || "—"}</td>
                    <td className="py-1.5 pr-4"><input className={inputCls + " py-1"} maxLength={300} value={notes[c.id] || ""} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} placeholder="e.g. confirmed with the client" /></td>
                    <td className="whitespace-nowrap py-1.5 text-right">
                      <span className="inline-flex gap-2">
                        <Btn small disabled={busy === c.id} onClick={() => decide(c, "approve")}>Approve</Btn>
                        <Btn small kind="danger" disabled={busy === c.id} onClick={() => decide(c, "reject")}>Reject</Btn>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {toDecide.length === 0 && decMsg && <Notice tone={decMsg.tone === "error" ? "error" : "ok"}>{decMsg.text}</Notice>}

      {(tab === "ledger" || !manage) && (
        <>
          <Card title={manage ? "Log comp-off (weekend / holiday work only)" : "Log comp-off you earned (a weekend or holiday you worked)"}>
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
            {!isAdmin && <p className="mt-2 text-xs text-slate-400">Comp-off you log for yourself waits for approval by {approvedBy}.{manage ? " Comp-off you log for someone else is approved straight away." : ""}</p>}
            {msg && <div className="mt-3"><Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice></div>}
          </Card>
          <Card title={(manage ? "Comp-off ledger (" : "Your comp-off (") + shown.length + (shown.length !== comps.length ? " of " + comps.length : "") + " entries · " + r1(daysWith(shown, "approved")) + " days approved · " + r1(daysWith(shown, "pending")) + " pending" + (team !== "All" ? " · " + team : "") + ")"}>
            {!manage && shown.length === 0 && <p className="mb-2 text-sm text-slate-500">Nothing logged yet. Worked a weekend or a holiday? Log it above and, once approved, it adds to your comp-off balance.</p>}
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    {manage && <><th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Company</th></>}
                    <th className="py-2 pr-4">Date worked</th><th className="py-2 pr-4">Days</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Balance now</th><th className="py-2 pr-4">Reason</th><th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coPage.map((c) => {
                    const b = balancesFor(c.name, leaves, allComps, leaveTypes, weekendDays, holidaySet);
                    const st = compOffStatus(c);
                    const by = c.decidedBy ? (st === "approved" ? "approved by " : "rejected by ") + c.decidedBy : c.createdBy && c.createdBy !== c.name && st === "approved" ? "logged by " + c.createdBy : "";
                    return (
                      <tr key={c.id}>
                        {manage && <><td className="py-1.5 pr-4 font-medium text-slate-800">{c.name}</td>
                        <td className="py-1.5 pr-4 text-slate-500">{coOf(c.name)}</td></>}
                        <td className="py-1.5 pr-4">{fmt(c.date)}</td>
                        <td className={"py-1.5 pr-4 " + (st === "approved" ? "" : "text-slate-400")}>{c.days}</td>
                        <td className="py-1.5 pr-4">
                          <Pill tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Pill>
                          {by && <span className="ml-1 text-xs text-slate-400">{by}</span>}
                          {c.decisionNote && <div className="text-xs italic text-slate-500">“{c.decisionNote}”</div>}
                        </td>
                        <td className="py-1.5 pr-4"><Pill tone={b.compOffBalance >= 0 ? "bg-teal-100 text-teal-800" : "bg-red-100 text-red-800"}>{r1(b.compOffBalance)}</Pill></td>
                        <td className="py-1.5 pr-4 text-slate-500">{c.reason || "—"}</td>
                        <td className="py-1.5 text-right">{canLogCompOff(ctx.can, c.name === me) && <Btn small kind="danger" onClick={() => setComps(allComps.filter((x) => x.id !== c.id))}>Delete</Btn>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {coPager}
            <p className="mt-2 text-xs text-slate-400">Only approved days count toward a balance. Pending days wait for a manager above the person in their reporting chain, or an Admin.</p>
          </Card>
        </>
      )}

      {manage && tab === "summary" && <CompOffSummary {...ctx} team={team} q={q} coOf={coOf} />}
    </div>
  );
}

// Summary — a quick picture of each resource: approved earned, pending, used, balance.
// Covers everyone with comp-off logged or comp-off leave taken, within the loaded scope
// (a team manager's chain, or the whole team).
export function CompOffSummary(ctx) {
  const { comps, leaves, leaveTypes, weekendDays, holidaySet, team, q, coOf } = ctx;
  const r1 = (x) => Math.round(x * 10) / 10;
  const coName = compOffTypeName(leaveTypes);
  const [sortBy, setSortBy] = useState("balance");
  const names = [...new Set([...comps.map((c) => c.name), ...leaves.filter((l) => l.type === coName).map((l) => l.name)])]
    .filter((n) => (team === "All" || coOf(n) === team) && n.toLowerCase().includes((q || "").trim().toLowerCase()));
  const rows = names.map((name) => {
    const b = balancesFor(name, leaves, comps, leaveTypes, weekendDays, holidaySet);
    const mine = comps.filter((c) => c.name === name);
    const last = mine.filter((c) => compOffStatus(c) === "approved").map((c) => c.date).sort().pop() || null;
    return { name, company: coOf(name), earned: b.compOffEarned, pending: b.compOffPending, used: b.compOffUsed, balance: b.compOffBalance, entries: mine.length, pendingEntries: mine.filter((c) => compOffStatus(c) === "pending").length, last };
  }).sort((a, b) => (sortBy === "name" ? a.name.localeCompare(b.name) : b[sortBy] - a[sortBy] || a.name.localeCompare(b.name)));
  const tot = (k) => rows.reduce((s, r) => s + r[k], 0);
  const negative = rows.filter((r) => r.balance < 0);
  const { rows: pageRows, pager } = usePaged(rows, 25);
  function exportExcel() {
    downloadXlsx("comp-off-summary.xlsx", [
      ["Summary", [["Resource", "Company", "Earned (approved)", "Pending approval", "Used", "Balance", "Entries", "Last earned"],
        ...rows.map((r) => [r.name, r.company, r1(r.earned), r1(r.pending), r1(r.used), r1(r.balance), r.entries, r.last || ""]),
        ["All", "", r1(tot("earned")), r1(tot("pending")), r1(tot("used")), r1(tot("balance")), tot("entries"), ""]]],
      ["Filters", [["Company", team], ["Name contains", q || "—"]]],
    ]);
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Resources" value={rows.length} sub={team !== "All" ? team : "with comp-off activity"} />
        <Stat label="Earned (approved)" value={r1(tot("earned"))} sub="days" />
        <Stat label="Pending approval" value={r1(tot("pending"))} sub={tot("pendingEntries") + " entr" + (tot("pendingEntries") === 1 ? "y" : "ies")} />
        <Stat label={coName + " used"} value={r1(tot("used"))} sub="days taken as leave" />
        <Stat label="Net balance" value={r1(tot("balance"))} sub={negative.length ? negative.length + " resource(s) negative" : "nobody negative"} />
      </div>
      <Card title="Comp-off by resource" right={<div className="flex items-center gap-2">
        <select className={inputCls + " w-40 py-1"} value={sortBy} onChange={(e) => setSortBy(e.target.value)} title="Sort">
          <option value="balance">Sort: balance</option><option value="pending">Sort: pending</option><option value="earned">Sort: earned</option><option value="used">Sort: used</option><option value="name">Sort: name</option>
        </select>
        <Btn kind="ghost" small onClick={exportExcel} disabled={!rows.length}>⬇ Excel</Btn>
      </div>}>
        {rows.length === 0 ? <p className="text-sm text-slate-500">No comp-off logged or taken{team !== "All" || q ? " for these filters" : ""}.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Resource</th><th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4 text-right">Earned</th><th className="py-2 pr-4 text-right">Pending</th><th className="py-2 pr-4 text-right">Used</th>
                  <th className="py-2 pr-4 text-right">Balance</th><th className="py-2 pr-4 text-right">Entries</th><th className="py-2 pr-4">Last earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((r) => (
                  <tr key={r.name}>
                    <td className="py-1.5 pr-4 font-medium text-slate-800">{r.name}</td>
                    <td className="py-1.5 pr-4 text-slate-500">{r.company}</td>
                    <td className="py-1.5 pr-4 text-right">{r1(r.earned)}</td>
                    <td className="py-1.5 pr-4 text-right">{r.pending ? <Pill tone={STATUS_TONE.pending}>{r1(r.pending)}</Pill> : <span className="text-slate-300">—</span>}</td>
                    <td className="py-1.5 pr-4 text-right">{r1(r.used)}</td>
                    <td className="py-1.5 pr-4 text-right"><Pill tone={r.balance >= 0 ? "bg-teal-100 text-teal-800" : "bg-red-100 text-red-800"}>{r1(r.balance)}</Pill></td>
                    <td className="py-1.5 pr-4 text-right text-slate-500">{r.entries}</td>
                    <td className="py-1.5 pr-4 text-slate-500">{r.last ? fmtShort(r.last) : "—"}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 font-semibold">
                  <td className="py-2 pr-4">All</td><td />
                  <td className="py-2 pr-4 text-right">{r1(tot("earned"))}</td><td className="py-2 pr-4 text-right">{r1(tot("pending"))}</td>
                  <td className="py-2 pr-4 text-right">{r1(tot("used"))}</td><td className="py-2 pr-4 text-right">{r1(tot("balance"))}</td>
                  <td className="py-2 pr-4 text-right">{tot("entries")}</td><td />
                </tr>
              </tbody>
            </table>
            {pager}
            <p className="mt-2 text-xs text-slate-400">Balance = approved earned − {coName} taken as leave. Pending days don't count until approved. Click Ledger for the individual entries.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

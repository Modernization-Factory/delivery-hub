import { useState } from "react";
import { fmt, fmtShort } from "../lib/dates.js";
import { LEAVE_COLORS, balancesFor, findOverlaps, isDuplicate, leaveDays } from "../lib/leave.js";
import { Btn, Card, Field, Notice, Pill, Stat, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";

// ============================================================
// MY LEAVE (all roles) — submit + own history + balances
// ============================================================
export function MyLeave(ctx) {
  const { user, leaves, comps, leaveTypes, weekendDays, holidaySet, setLeaves, nextId, canManage, employees, todayISO } = ctx;
  const [who, setWho] = useState(user.name);
  const [start, setStart] = useState(todayISO);
  const [end, setEnd] = useState(todayISO);
  const [type, setType] = useState(leaveTypes[0].name);
  const [msg, setMsg] = useState(null);
  const [pendingOverlap, setPendingOverlap] = useState(null);

  const canForAnyone = ctx.can("leave.forAnyone");
  const canOwn = ctx.can("leave.own");
  const target = canForAnyone ? who : user.name;
  const bal = balancesFor(target, leaves, comps, leaveTypes, weekendDays, holidaySet);
  const my = leaves.filter((l) => l.name === target).sort((a, b) => b.start.localeCompare(a.start));

  function submit(force) {
    setMsg(null);
    if (!start || !end) return setMsg({ tone: "error", text: "Both start and end dates are required." });
    if (end < start) return setMsg({ tone: "error", text: "End date can't be before the start date." });
    const entry = { name: target, start, end, type };
    if (isDuplicate(leaves, entry)) return setMsg({ tone: "error", text: "This exact leave already exists — duplicate entries are blocked (mirrors the DUPLICATE? check in the old tracker)." });
    const days = leaveDays(start, end, type, leaveTypes, weekendDays, holidaySet);
    if (days === 0) return setMsg({ tone: "error", text: "That range has no working days (weekend / holiday only), so no leave is needed." });
    if (type === "Comp-Off" && bal.compOffBalance < days) {
      return setMsg({ tone: "error", text: `Comp-off balance is ${bal.compOffBalance} day(s) — not enough for a ${days}-day comp-off leave. Ask your lead to log earned comp-off first.` });
    }
    const overlaps = findOverlaps(leaves, entry);
    if (overlaps.length && !force) {
      setPendingOverlap(overlaps);
      return;
    }
    setLeaves([...leaves, { id: nextId("l"), ...entry }]);
    setPendingOverlap(null);
    setMsg({ tone: "ok", text: `Leave recorded — ${days} working day(s) of ${type} for ${target}.` });
  }
  function remove(id) {
    setLeaves(leaves.filter((l) => l.id !== id));
    setMsg({ tone: "ok", text: "Leave entry deleted." });
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>My Leave</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {leaveTypes.map((t) => (
          <Stat key={t.name} label={t.name + " taken"} value={bal.byType[t.name] || 0} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Comp-off earned" value={bal.compOffEarned} />
        <Stat label="Comp-off used" value={bal.compOffUsed} />
        <Stat label="Comp-off balance" value={bal.compOffBalance} sub={bal.compOffBalance < 0 ? "Negative — review entries" : ""} />
      </div>

      {!canOwn && !canForAnyone && <Notice tone="warn">Read-only access — your role can browse leave data but can't submit entries. An Admin can grant this in the permission matrix.</Notice>}
      {(canOwn || canForAnyone) && <Card title="Request leave">
        <div className="grid gap-3 sm:grid-cols-4">
          {canForAnyone && (
            <Field label="Employee (PM / Lead can file for anyone)">
              <select className={inputCls} value={who} onChange={(e) => setWho(e.target.value)}>
                {employees.map((e) => <option key={e.id} value={e.name}>{e.name}{e.term && e.term <= todayISO ? " (ended)" : ""}</option>)}
              </select>
            </Field>
          )}
          <Field label="Start date"><input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="End date"><input type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <Field label="Leave type">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              {leaveTypes.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.value} day)</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Btn onClick={() => submit(false)}>Submit leave</Btn>
          <span className="text-xs text-slate-500">
            Counts {leaveDays(start, end, type, leaveTypes, weekendDays, holidaySet)} working day(s) — weekends & holidays excluded.
          </span>
        </div>
        {pendingOverlap && (
          <div className="mt-3">
            <Notice tone="warn">
              Overlaps {pendingOverlap.length} existing entr{pendingOverlap.length > 1 ? "ies" : "y"}: {pendingOverlap.map((o) => fmtShort(o.start) + "–" + fmtShort(o.end) + " " + o.type).join(", ")}.
              <span className="ml-2 inline-flex gap-2">
                <Btn small kind="ghost" onClick={() => submit(true)}>Save anyway</Btn>
                <Btn small kind="ghost" onClick={() => setPendingOverlap(null)}>Cancel</Btn>
              </span>
            </Notice>
          </div>
        )}
        {msg && <div className="mt-3"><Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice></div>}
      </Card>}

      <Card title={"Leave history — " + target}>
        {my.length === 0 ? (
          <p className="text-sm text-slate-500">No leave recorded yet. Your first request will appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Dates</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Working days</th><th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {my.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-4">{fmt(l.start)}{l.start !== l.end ? " → " + fmt(l.end) : ""}</td>
                    <td className="py-2 pr-4"><Pill tone={LEAVE_COLORS[l.type] || "bg-slate-100 text-slate-600"}>{l.type}</Pill></td>
                    <td className="py-2 pr-4">{leaveDays(l.start, l.end, l.type, leaveTypes, weekendDays, holidaySet)}</td>
                    <td className="py-2 text-right">
                      {(canForAnyone || (canOwn && l.name === user.name)) && <Btn small kind="danger" onClick={() => remove(l.id)}>Delete</Btn>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

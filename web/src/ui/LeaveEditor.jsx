import { useState } from "react";
import { fmt, fmtShort } from "../lib/dates.js";
import { canDeletePastLeave } from "../lib/permissions.js";
import { leaveColor, leaveDays, tcWeekDays } from "../lib/leave.js";
import { Btn, Field, Notice, Pill, inputCls } from "./atoms.jsx";

// Who may change a leave: PM / Admin any leave at any time; anyone else only their own, and
// only before it starts. (The server enforces the same rule.)
export function canEditLeave(l, user, todayISO) {
  if (canDeletePastLeave(user.role)) return true;
  return l.name === user.name && l.start >= todayISO;
}

// Inline editor for one leave: dates, type, comment. `onSave(patch)` returns a promise.
export function LeaveEditForm({ leave, leaveTypes, user, todayISO, onSave, onCancel }) {
  const manager = canDeletePastLeave(user.role);
  const [f, setF] = useState({ start: leave.start, end: leave.end, type: leave.type, comment: leave.comment || "" });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setErr(null);
    if (!f.start || !f.end || f.end < f.start) return setErr("End date can't be before the start date.");
    if (!manager && f.start < todayISO) return setErr("You can only move your leave to today or later.");
    setBusy(true);
    try { await onSave({ start: f.start, end: f.end, type: f.type, comment: f.comment.trim() }); }
    catch (e) { setErr((e.data && e.data.detail) || e.message); setBusy(false); }
  }
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="Start"><input type="date" className={inputCls} min={manager ? undefined : todayISO} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="End"><input type="date" className={inputCls} min={f.start} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
        <Field label="Type">
          <select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {leaveTypes.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            {!leaveTypes.some((t) => t.name === f.type) && <option value={f.type}>{f.type} (not configured)</option>}
          </select>
        </Field>
        <Field label="Comment"><input className={inputCls} maxLength={300} value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} placeholder="optional" /></Field>
      </div>
      {err && <div className="mt-2"><Notice tone="error">{err}</Notice></div>}
      <div className="mt-2 flex gap-2">
        <Btn small disabled={busy} onClick={save}>Save leave</Btn>
        <Btn small kind="ghost" disabled={busy} onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

// One person's leave for one timecard week (dated by its Sunday, covering the Mon-Fri after),
// with add / edit / delete in place. Used from a timecard grid cell.
export function WeekLeavePanel({ name, weekISO, ctx, onClose }) {
  const { leaves, leaveTypes, weekendDays, holidaySet, user, todayISO, setLeaves, updateLeave, nextId } = ctx;
  const days = tcWeekDays(weekISO, weekendDays, holidaySet);
  const mon = days[0] || weekISO, fri = days[days.length - 1] || weekISO;
  const inWeek = leaves.filter((l) => l.name === name && l.start <= fri && mon <= l.end).sort((a, b) => a.start.localeCompare(b.start));
  const canAdd = ctx.can("leave.forAnyone") || (name === user.name && ctx.can("leave.own"));
  const [editing, setEditing] = useState(null); // leave id, or "new"
  const [msg, setMsg] = useState(null);
  const blank = { start: mon < todayISO && !canDeletePastLeave(user.role) ? todayISO : mon, end: fri, type: (leaveTypes[0] || {}).name, comment: "" };
  async function add(patch) {
    setLeaves([...leaves, { id: nextId("l"), name, ...patch }]);
    setEditing(null);
    setMsg("Leave added for " + name + ".");
  }
  async function save(l, patch) {
    await updateLeave(l.id, patch);
    setEditing(null);
    setMsg("Leave updated.");
  }
  function remove(l) {
    if (!window.confirm("Delete " + name + "'s " + l.type + " (" + fmtShort(l.start) + (l.start !== l.end ? " – " + fmtShort(l.end) : "") + ")?")) return;
    setLeaves(leaves.filter((x) => x.id !== l.id));
    setMsg("Leave deleted.");
  }
  const canDel = (l) => (ctx.can("leave.forAnyone") || (l.name === user.name && ctx.can("leave.own"))) && (l.start >= todayISO || canDeletePastLeave(user.role));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">{name} · week of {fmt(mon)} – {fmt(fri)}</div>
        <Btn small kind="ghost" onClick={onClose}>Close</Btn>
      </div>
      {msg && <Notice tone="ok">{msg}</Notice>}
      {inWeek.length === 0 && editing !== "new" && <p className="text-sm text-slate-500">No leave this week.</p>}
      <ul className="space-y-2">
        {inWeek.map((l) => (
          <li key={l.id}>
            {editing === l.id ? (
              <LeaveEditForm leave={l} leaveTypes={leaveTypes} user={user} todayISO={todayISO} onSave={(p) => save(l, p)} onCancel={() => setEditing(null)} />
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Pill tone={leaveColor(l.type, leaveTypes)}>{l.type}</Pill>
                <span className="text-slate-700">{fmtShort(l.start)}{l.start !== l.end ? " – " + fmtShort(l.end) : ""}</span>
                <span className="text-xs text-slate-400">{leaveDays(l.start, l.end, l.type, leaveTypes, weekendDays, holidaySet)} working day(s)</span>
                {l.comment && <span className="text-xs italic text-slate-600">“{l.comment}”</span>}
                <span className="ml-auto flex gap-1">
                  {canEditLeave(l, user, todayISO) && <Btn small kind="ghost" onClick={() => setEditing(l.id)}>Edit</Btn>}
                  {canDel(l) && <Btn small kind="danger" onClick={() => remove(l)}>Delete</Btn>}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing === "new"
        ? <LeaveEditForm leave={blank} leaveTypes={leaveTypes} user={user} todayISO={todayISO} onSave={add} onCancel={() => setEditing(null)} />
        : canAdd && <Btn small kind="ghost" onClick={() => { setMsg(null); setEditing("new"); }}>+ Add leave this week</Btn>}
      {days.length < 5 && <p className="text-xs text-slate-400">{5 - days.length} holiday(s) this week.</p>}
    </div>
  );
}

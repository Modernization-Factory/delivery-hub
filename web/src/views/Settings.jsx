import { useState } from "react";
import { DOW, fmt } from "../lib/dates.js";
import { LEAVE_COLORS } from "../lib/leave.js";
import { Btn, Card, Notice, Pill, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";

// ============================================================
// LEAVE SETTINGS (PM / Admin)
// ============================================================
export function SettingsView(ctx) {
  const { leaveTypes, setLeaveTypes, weekendDays, setWeekendDays, holidays, setHolidays } = ctx;
  const [newType, setNewType] = useState("");
  const [newVal, setNewVal] = useState("1");
  const [newHol, setNewHol] = useState("");
  const [msg, setMsg] = useState(null);
  function addType() {
    setMsg(null);
    const n = newType.trim();
    if (!n) return;
    if (leaveTypes.length >= 5) return setMsg({ tone: "error", text: "The tracker supports up to 5 leave types (source-tracker rule). Remove one first." });
    if (leaveTypes.some((t) => t.name.toLowerCase() === n.toLowerCase())) return setMsg({ tone: "error", text: "That leave type already exists." });
    setLeaveTypes([...leaveTypes, { name: n, value: Number(newVal) }]);
    setNewType("");
  }
  function addHoliday() {
    setMsg(null);
    if (!newHol) return;
    if (holidays.includes(newHol)) return setMsg({ tone: "error", text: "That date is already a holiday." });
    setHolidays([...holidays, newHol].sort());
    setNewHol("");
  }
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Leave Settings</h2>
      <Notice tone="warn">Changing these recalculates every balance and calendar instantly — the whole app reads from this single config, replacing the SETTINGS sheet.</Notice>
      {msg && <Notice tone="error">{msg.text}</Notice>}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={"Leave types (" + leaveTypes.length + "/5)"}>
          <ul className="mb-3 divide-y divide-slate-100">
            {leaveTypes.map((t) => (
              <li key={t.name} className="flex items-center justify-between py-2 text-sm">
                <span><Pill tone={LEAVE_COLORS[t.name] || "bg-slate-100 text-slate-600"}>{t.name}</Pill><span className="ml-2 text-xs text-slate-500">{t.value} day / working day</span></span>
                <Btn small kind="danger" onClick={() => setLeaveTypes(leaveTypes.filter((x) => x.name !== t.name))}>Remove</Btn>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="New type" value={newType} onChange={(e) => setNewType(e.target.value)} />
            <select className={inputCls + " w-24"} value={newVal} onChange={(e) => setNewVal(e.target.value)}>
              <option value="1">1</option><option value="0.5">0.5</option>
            </select>
            <Btn small onClick={addType}>Add</Btn>
          </div>
        </Card>
        <Card title="Weekend days">
          <div className="space-y-1">
            {DOW.map((d, i) => (
              <label key={d} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <span className={weekendDays.includes(i) ? "font-medium text-slate-800" : "text-slate-500"}>{d}</span>
                <input
                  type="checkbox"
                  checked={weekendDays.includes(i)}
                  onChange={() =>
                    setWeekendDays(weekendDays.includes(i) ? weekendDays.filter((x) => x !== i) : [...weekendDays, i])
                  }
                  className="h-4 w-4 accent-emerald-700"
                />
              </label>
            ))}
          </div>
        </Card>
        <Card title={"Holidays (" + holidays.length + ")"}>
          <div className="mb-3 flex gap-2">
            <input type="date" className={inputCls} value={newHol} onChange={(e) => setNewHol(e.target.value)} />
            <Btn small onClick={addHoliday}>Add</Btn>
          </div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-auto">
            {holidays.map((h) => (
              <li key={h} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-slate-700">{fmt(h)}</span>
                <Btn small kind="danger" onClick={() => setHolidays(holidays.filter((x) => x !== h))}>Remove</Btn>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

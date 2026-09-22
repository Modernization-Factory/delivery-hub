import { useState } from "react";
import { fmt } from "../lib/dates.js";
import { isActiveDuring } from "../lib/leave.js";
import { CustomFieldsCard } from "../ui/CustomFieldsCard.jsx";
import { Btn, Card, Field, Notice, Pill, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";

// ============================================================
// EMPLOYEES (Lead view · PM/Admin edit)
// ============================================================
export function EmployeesView(ctx) {
  const { employees, setEmployees, nextId, todayISO, empFields, setEmpFields } = ctx;
  const canConfigure = ctx.can("employees.edit");
  const isAdmin = ctx.user.role === "Admin";
  const [q, setQ] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [edit, setEdit] = useState(null); // employee object or "new"
  const [msg, setMsg] = useState(null);
  const activeCount = employees.filter((e) => isActiveDuring(e, todayISO, todayISO)).length;
  const rows = employees
    .filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) && (!activeOnly || isActiveDuring(e, todayISO, todayISO)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const { rows: pageRows, pager } = usePaged(rows, 25);
  function save(form) {
    setMsg(null);
    if (!form.name.trim()) return setMsg({ tone: "error", text: "Name is required." });
    const clash = employees.find((e) => e.name.trim() === form.name.trim() && e.id !== form.id);
    if (clash) return setMsg({ tone: "error", text: "An employee named " + form.name + " already exists — names must be unique (they key all three trackers)." });
    if (form.term && form.start && form.term < form.start) return setMsg({ tone: "error", text: "End date can't be before the start date." });
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setMsg({ tone: "error", text: "That doesn't look like a valid email address." });
    const emailClash = form.email && employees.find((e) => e.email && e.email.toLowerCase() === form.email.trim().toLowerCase() && e.id !== form.id);
    if (emailClash) return setMsg({ tone: "error", text: "That email is already on " + emailClash.name + " — emails are the login identity and must be unique." });
    if (form.email) form = { ...form, email: form.email.trim().toLowerCase() };
    if (form.id) setEmployees(employees.map((e) => (e.id === form.id ? form : e)));
    else setEmployees([...employees, { ...form, id: nextId("e") }]);
    setEdit(null);
    setMsg({ tone: "ok", text: "Employee saved." });
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Employee Master ({activeCount} active · {employees.length} total)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            Active only
          </label>
          <input className={inputCls + " w-56"} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          {canConfigure && <Btn onClick={() => setEdit({ id: null, name: "", email: "", role: "Developer", company: "MDB", start: "", term: null, streamLead: false, viewer: false, custom: {} })}>Add employee</Btn>}
        </div>
      </div>
      {!canConfigure && <Notice tone="warn">View only — the employee master is maintained by the Project Manager (same rule as the source tracker).</Notice>}
      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}
      {edit && canConfigure && (
        <Card title={edit.id ? "Edit " + edit.name : "New employee"}>
          <EmpForm initial={edit} empFields={empFields} onSave={save} onCancel={() => setEdit(null)} />
        </Card>
      )}
      {isAdmin && <CustomFieldsCard empFields={empFields} setEmpFields={setEmpFields} nextId={nextId} />}
      <Card>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Email (login identity)</th><th className="py-2 pr-4">Role</th><th className="py-2 pr-4">Company</th><th className="py-2 pr-4">Start</th><th className="py-2 pr-4">End date</th>{empFields.map((cf) => <th key={cf.id} className="py-2 pr-4">{cf.label}</th>)}{canConfigure && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((e) => (
                <tr key={e.id}>
                  <td className="py-1.5 pr-4 font-medium text-slate-800">{e.name}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{e.email || <span className="text-amber-600" title="No email — this person can't log in to the live app">not set</span>}</td>
                  <td className="py-1.5 pr-4"><Pill tone={e.role === "Project Manager" ? "bg-purple-100 text-purple-800" : e.role === "Lead Developer" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"}>{e.role}</Pill>{e.streamLead && <Pill tone="ml-1 bg-indigo-100 text-indigo-800">Stream Lead</Pill>}{e.viewer && <Pill tone="ml-1 bg-teal-100 text-teal-800">Viewer</Pill>}</td>
                  <td className="py-1.5 pr-4 text-slate-600">{e.company}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{fmt(e.start)}</td>
                  <td className="py-1.5 pr-4 text-slate-500">
                    {e.term ? (
                      <span className="inline-flex items-center gap-1.5">
                        {fmt(e.term)}
                        <Pill tone={e.term <= todayISO ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>{e.term <= todayISO ? "Ended" : "Ending"}</Pill>
                      </span>
                    ) : "—"}
                  </td>
                  {empFields.map((cf) => <td key={cf.id} className="py-1.5 pr-4 text-slate-600">{(e.custom || {})[cf.id] || <span className="text-slate-300">—</span>}</td>)}
                  {canConfigure && <td className="py-1.5 text-right"><Btn small kind="ghost" onClick={() => setEdit({ ...e, email: e.email || "", custom: { ...(e.custom || {}) } })}>Edit</Btn></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pager}
      </Card>
    </div>
  );
}

export function EmpForm({ initial, empFields = [], onSave, onCancel }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setCustom = (id) => (e) => setF({ ...f, custom: { ...(f.custom || {}), [id]: e.target.value } });
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-5">
        <Field label="Full name"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
        <Field label="Email (login identity)"><input type="email" className={inputCls} value={f.email || ""} onChange={set("email")} placeholder="name@company.com" /></Field>
        <Field label="Role">
          <select className={inputCls} value={f.role} onChange={set("role")}>
            {["Developer", "Senior Developer", "Lead Developer", "Project Manager"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Company">
          <select className={inputCls} value={f.company} onChange={set("company")}>
            {["MDB", "WeKan", "Ciklum", "Globant"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Start date"><input type="date" className={inputCls} value={f.start || ""} onChange={set("start")} /></Field>
        <Field label="End date (last working day; leave blank if ongoing)"><input type="date" className={inputCls} value={f.term || ""} onChange={(e) => setF({ ...f, term: e.target.value || null })} /></Field>
      </div>
      {(f.role === "Developer" || f.role === "Senior Developer") && (
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={!!f.streamLead} onChange={(e) => setF({ ...f, streamLead: e.target.checked })} />
          Stream Lead — grants Lead access (leave management, timecards, allocations, performance scoring)
        </label>
      )}
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={!!f.viewer} onChange={(e) => setF({ ...f, viewer: e.target.checked })} />
        Viewer — read-only access to everything; can't add or update until granted in the permission matrix (overrides other access)
      </label>
      {empFields.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          {empFields.map((cf) => (
            <Field key={cf.id} label={cf.label}>
              <input className={inputCls} value={(f.custom || {})[cf.id] || ""} onChange={setCustom(cf.id)} />
            </Field>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Btn onClick={() => onSave(f)}>Save employee</Btn>
        <Btn kind="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

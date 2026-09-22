import { useState } from "react";
import { Btn, Card, Field, Notice, inputCls } from "./atoms.jsx";

// Custom employee fields manager (Admin) — labels defined here become inputs on every employee
export function CustomFieldsCard({ empFields, setEmpFields, nextId }) {
  const [label, setLabel] = useState("");
  const [m, setM] = useState(null);
  function add() {
    setM(null);
    const t = label.trim();
    if (!t) return setM("A field label is required.");
    if (empFields.some((f) => f.label.toLowerCase() === t.toLowerCase())) return setM("A field with that label already exists.");
    if (empFields.length >= 8) return setM("Up to 8 custom fields — the master table needs to stay readable.");
    setEmpFields([...empFields, { id: nextId("cf"), label: t }]);
    setLabel("");
  }
  return (
    <Card title={"Custom employee fields (" + empFields.length + "/8)"}>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="New field label"><input className={inputCls + " w-64"} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Employee ID, JIRA handle, Location" onKeyDown={(e) => e.key === "Enter" && add()} /></Field>
        <Btn small onClick={add}>Add field</Btn>
      </div>
      {m && <div className="mt-2"><Notice tone="error">{m}</Notice></div>}
      {empFields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {empFields.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
              {f.label}
              <button className="text-slate-400 hover:text-red-600" title="Remove field (stored values are kept and reappear if you re-add it)" onClick={() => setEmpFields(empFields.filter((x) => x.id !== f.id))}>✕</button>
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">Fields appear as free-text inputs on every employee and as columns in the master table. Removing a field hides it but keeps stored values.</p>
    </Card>
  );
}

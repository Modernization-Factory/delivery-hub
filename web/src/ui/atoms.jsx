import { BRAND_FONT } from "./brand.jsx";

// ============================================================
// SMALL UI ATOMS
// ============================================================
export function Pill({ children, tone = "" }) {
  return <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " + tone}>{children}</span>;
}

export function Card({ title, right, children, className = "" }) {
  return (
    <div className={"rounded-xl border border-slate-200 bg-white shadow-sm " + className}>
      {(title || right) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm" style={{ borderTop: "3px solid #00ED64" }}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "mdb-input w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800";

export function Btn({ children, onClick, kind = "primary", disabled, small }) {
  const base = small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const styles = {
    primary: "mdb-btn-primary text-white",
    ghost: "border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white",
    danger: "border border-red-200 text-red-700 hover:bg-red-50",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={base + " rounded-lg font-medium transition " + styles[kind]}>
      {children}
    </button>
  );
}

export function Notice({ tone, children }) {
  const t = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return <div className={"rounded-lg border px-3 py-2 text-sm " + t}>{children}</div>;
}

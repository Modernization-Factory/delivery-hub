import { MODULES_V2 } from "../lib/constants.js";
import { BRAND_FONT } from "../ui/brand.jsx";

// ============================================================
// COMING SOON (locked v2 modules)
// ============================================================
export function ComingSoon({ id, role }) {
  const m = MODULES_V2.find((x) => x.id === id);
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">🔒</div>
        <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>{m ? m.label : "Module"} arrives in v2</h2>
        <p className="mt-2 text-sm text-slate-500">{m ? m.note : ""}</p>
        <p className="mt-3 text-xs text-slate-400">The role model, employee backbone and navigation are already wired for it — enabling this module won't require rework. You're seeing this because your role ({role}) will have access when it ships.</p>
      </div>
    </div>
  );
}

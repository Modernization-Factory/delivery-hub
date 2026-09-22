import { useState } from "react";
import { Field, Notice, inputCls } from "../ui/atoms.jsx";
import { BRAND_CSS, BRAND_FONT, Leaf } from "../ui/brand.jsx";

// ============================================================
// LOGIN
// ============================================================
export function LoginLive({ onEnter }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  async function go() {
    if (!email.trim() || busy) return;
    setErr(null); setBusy(true);
    try { await onEnter(email.trim().toLowerCase()); }
    catch (e) {
      setBusy(false);
      setErr(e.status === 403 ? (e.message || "No active employee record for that email — ask your PM to add you.") : e.status === 401 ? "Not authenticated." : "Can't reach the API on :8080 — is it running? (" + e.message + ")");
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ fontFamily: BRAND_FONT, backgroundColor: "#001E2B" }}>
      <style>{BRAND_CSS}</style>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: "#001E2B", border: "1px solid #023430" }}><Leaf size={28} /></div>
          <h1 className="text-2xl font-semibold text-white" style={{ fontFamily: BRAND_FONT }}>DeliveryHub</h1>
          <p className="mt-1 text-sm" style={{ color: "#E3FCF7", opacity: 0.75 }}>Leave · Timecard · Allocations · Performance · Runway · Team Plans — live against MongoDB</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl">
          <Field label="Your work email (must match your employee record)">
            <input className={inputCls} type="email" placeholder="you@mongodb.com" value={email}
              onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} autoFocus />
          </Field>
          {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
          <div className="mt-5">
            <button onClick={go} disabled={busy} className="mdb-btn-primary w-full rounded-lg py-2.5 text-sm font-semibold text-white transition">
              {busy ? "Checking…" : "Enter console"}
            </button>
          </div>
          <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
            Identity is verified by the API and your role is derived from the employee master — Viewers get read-only access everywhere. In production this screen is replaced by Okta SSO; locally, activate emails via mongosh (see the README).
          </p>
        </div>
      </div>
    </div>
  );
}

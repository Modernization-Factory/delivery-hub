/** DeliveryHub API — entrypoint. Kanopy-ready: PORT env, /healthz + /readyz probes. */
const cfg = require("./config");
const db = require("./db");
const app = require("./app");

// Listen before Mongo is up: /healthz must answer so the liveness probe doesn't kill the
// pod while the driver is still selecting a server (30s), which would hide the real
// error. /readyz stays 503 until the connection succeeds, so no traffic arrives early.
app.listen(cfg.PORT, () => console.log(`DeliveryHub API on :${cfg.PORT} (auth mode: ${cfg.AUTH_MODE})`));
// Retry rather than exit: a paused or briefly unreachable cluster would otherwise leave
// the pod in CrashLoopBackOff, whose back-off outlasts the outage.
(function connectWithRetry(delayMs = 5000) {
  db.connect().then(() => console.log("Mongo connected")).catch((e) => {
    console.error(`Mongo connection failed: ${e.message} — retrying in ${delayMs / 1000}s`);
    setTimeout(() => connectWithRetry(Math.min(delayMs * 2, 60000)), delayMs);
  });
})();

process.on("SIGTERM", async () => { await db.close(); process.exit(0); });

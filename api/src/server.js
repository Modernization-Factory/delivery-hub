/** DeliveryHub API — entrypoint. Kanopy-ready: PORT env, /healthz + /readyz probes. */
const express = require("express");
const cfg = require("./config");
const db = require("./db");
const { resolveUser, authorizeUrl, handleCallback, logout } = require("./auth");
const routes = require("./routes");
const { integrationRouter } = require("./integration");
const crypto = require("crypto");

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));

// probes (unauthenticated)
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/readyz", async (_req, res) => res.status((await db.ready()) ? 200 : 503).json({ mongo: await db.ready() }));

// OIDC endpoints (mode B only; harmless no-ops behind proxy-headers)
if (cfg.AUTH_MODE === "oidc") {
  app.get("/auth/login", (_req, res) => res.redirect(authorizeUrl(crypto.randomUUID())));
  app.get("/auth/callback", (req, res, next) => handleCallback(req, res, req.query).catch(next));
}
app.post("/auth/logout", (_req, res) => { logout(res); res.json({ ok: true }); });

// token-authed, read-only integration API (mounted BEFORE user auth — machine identity, not a person)
app.use("/api/integration", integrationRouter);

// authenticated API
app.use("/api", resolveUser, routes);

// central error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal", detail: err.message });
});

db.connect().then(() => {
  app.listen(cfg.PORT, () => console.log(`DeliveryHub API on :${cfg.PORT} (auth mode: ${cfg.AUTH_MODE})`));
}).catch((e) => { console.error("Mongo connection failed:", e.message); process.exit(1); });

process.on("SIGTERM", async () => { await db.close(); process.exit(0); });

/** DeliveryHub API — entrypoint. Kanopy-ready: PORT env, /healthz + /readyz probes. */
const express = require("express");
const cfg = require("./config");
const db = require("./db");
const { resolveUser, authorizeUrl, handleCallback, logout } = require("./auth");
const routes = require("./routes");
const { integrationRouter } = require("./integration");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

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

/**
 * Static frontend (same origin as the API, so /api needs no CORS and one Kanopy
 * ingress covers both). STATIC_DIR is the built web/dist; the Dockerfile copies it
 * to /app/public. When the directory is absent (local API-only dev, where Vite
 * serves the app on :5173 and proxies here) these handlers are simply not mounted.
 */
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(__dirname, "..", "public"));
if (fs.existsSync(path.join(STATIC_DIR, "index.html"))) {
  // Only /assets carries a content hash in the filename, so only it can be cached
  // immutably. Everything else served from here (favicon.svg and friends) keeps a
  // stable name, and a year-long cache would strand clients on the old file after a
  // replacement. index.html is handled separately below and is never cached.
  app.use(express.static(STATIC_DIR, {
    index: false,
    etag: true,
    setHeaders: (res, filePath) => {
      const hashed = path.relative(STATIC_DIR, filePath).split(path.sep)[0] === "assets";
      res.setHeader("Cache-Control", hashed ? "public, max-age=31536000, immutable" : "public, max-age=3600");
    },
  }));
  app.get(/^(?!\/(api|auth|healthz|readyz)\b).*/, (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(STATIC_DIR, "index.html"));
  });
  console.log("Serving frontend from " + STATIC_DIR);
} else {
  console.log("No frontend bundle at " + STATIC_DIR + " — API-only mode");
}

// central error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal", detail: err.message });
});

db.connect().then(() => {
  app.listen(cfg.PORT, () => console.log(`DeliveryHub API on :${cfg.PORT} (auth mode: ${cfg.AUTH_MODE})`));
}).catch((e) => { console.error("Mongo connection failed:", e.message); process.exit(1); });

process.on("SIGTERM", async () => { await db.close(); process.exit(0); });

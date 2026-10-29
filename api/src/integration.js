/**
 * Read-only integration API for downstream reporting systems
 * (e.g. the Program Health app), which PULL from DeliveryHub as the
 * system of record.
 *
 * Auth: `Authorization: Bearer <token>` where <token> is listed in the
 * INTEGRATION_TOKENS env var (comma-separated). No user context, no writes.
 * Every item carries a stable `external_id` (the Mongo _id); all dates are
 * YYYY-MM-DD strings. Lists are wrapped as { items: [...] } so the
 * consumer's sync engine can use items_path = "items".
 */
const express = require("express");
const crypto = require("crypto");
const { col } = require("./db");

const integrationRouter = express.Router();

function tokens() {
  return (process.env.INTEGRATION_TOKENS || "").split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Constant-time token check. Comparing the raw strings (=== or Array.includes)
 * short-circuits on the first differing byte, which leaks the shared prefix and
 * lets a token be recovered a byte at a time. Hashing first gives both sides a
 * fixed 32-byte length — timingSafeEqual throws on a length mismatch, so it must
 * never be handed the attacker-controlled length directly — and the loop
 * accumulates rather than returning early, so the runtime doesn't reveal which
 * entry matched or how far down the list it sat.
 */
const sha256 = (s) => crypto.createHash("sha256").update(String(s), "utf8").digest();
function tokenMatches(presented, list) {
  const a = sha256(presented);
  let ok = false;
  for (const candidate of list) if (crypto.timingSafeEqual(a, sha256(candidate))) ok = true;
  return ok;
}

integrationRouter.use((req, res, next) => {
  const list = tokens();
  if (!list.length) return res.status(503).json({ error: "integration_disabled", hint: "set INTEGRATION_TOKENS env var" });
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (!tok || !tokenMatches(tok, list)) return res.status(401).json({ error: "invalid_token" });
  next();
});

const d = (x) => (x ? new Date(x).toISOString().slice(0, 10) : null);

integrationRouter.get("/projects", async (_req, res, next) => {
  try {
    const ps = await col("projects").find({ closedAt: null }).sort({ name: 1 }).toArray(); // closed projects aren't tracked
    res.json({ items: ps.map((p) => ({
      external_id: String(p._id),
      name: p.name,
      pm: p.pm || null,
      phase: p.currentPhase || null,
      phases: p.phases || [],
      start: d(p.start),
      end: d(p.end),
      description: p.description || "",
    })) });
  } catch (e) { next(e); }
});

integrationRouter.get("/milestones", async (_req, res, next) => {
  try {
    const [ms, ps] = await Promise.all([col("milestones").find().toArray(), col("projects").find({ closedAt: null }).toArray()]);
    const nameById = Object.fromEntries(ps.map((p) => [String(p._id), p.name]));
    res.json({ items: ms.filter((x) => nameById[String(x.projectId)]).map((x) => ({
      external_id: String(x._id),
      project_name: nameById[String(x.projectId)] || null,
      name: x.name,
      phase: x.phase || "",
      planned: d(x.planned),
      actual: d(x.actual),
      status: x.status,
      rag: x.rag,
      comments: x.comments || "",
    })) });
  } catch (e) { next(e); }
});

integrationRouter.get("/raid", async (_req, res, next) => {
  try {
    const [xs, ps] = await Promise.all([col("raid").find().toArray(), col("projects").find({ closedAt: null }).toArray()]);
    const nameById = Object.fromEntries(ps.map((p) => [String(p._id), p.name]));
    res.json({ items: xs.filter((x) => nameById[String(x.projectId)]).map((x) => ({
      external_id: String(x._id),
      project_name: nameById[String(x.projectId)] || null,
      type: x.type,
      description: x.desc,
      impact: x.impact,
      probability: x.probability,
      owner: x.owner || "",
      target_date: d(x.targetDate),
      status: x.status,
      linked_item: x.link || "",
      comments: x.comments || "",
    })) });
  } catch (e) { next(e); }
});

module.exports = { integrationRouter };

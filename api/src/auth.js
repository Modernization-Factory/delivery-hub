/**
 * Okta authentication — two modes, selected by AUTH_MODE:
 *
 * "proxy-headers" (Kanopy ingress performs the Okta OIDC flow):
 *   The ingress forwards a verified identity header (default x-forwarded-email).
 *   HARD REQUIREMENT: the pod must only be reachable through the ingress —
 *   a directly exposed app would let anyone forge the header. Standard on Kanopy.
 *
 * "oidc" (app-managed authorization-code flow):
 *   /auth/login  -> redirect to Okta authorize endpoint
 *   /auth/callback -> exchange code, verify ID token via Okta JWKS (jose),
 *   then issue an HMAC-signed, HTTP-only session cookie.
 *
 * In BOTH modes, authorization is the employee master: verified email must match
 * an active employee. Role derives from the employee record on every request.
 */
const crypto = require("crypto");
const cfg = require("./config");
const { col } = require("./db");
const R = require("./rules");

const COOKIE = "dh_session";

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", cfg.SESSION_SECRET).update(body).digest("base64url");
  return body + "." + sig;
}
function verify(token) {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expect = crypto.createHmac("sha256", cfg.SESSION_SECRET).update(body).digest("base64url");
  // timingSafeEqual throws when the buffers differ in length, and `sig` is whatever
  // the client sent — so hash both sides to a fixed 32 bytes before comparing. A
  // malformed cookie must be an unauthenticated 401, never a 500.
  const h = (s) => crypto.createHash("sha256").update(s, "utf8").digest();
  if (!crypto.timingSafeEqual(h(sig), h(expect))) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  return payload;
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1));
  });
  return out;
}

// ---- OIDC endpoints (mode B) ----
let jose = null;
function getJose() {
  if (!jose) jose = require("jose");
  return jose;
}
function authorizeUrl(state) {
  const u = new URL(cfg.OKTA_ISSUER + "/v1/authorize");
  u.searchParams.set("client_id", cfg.OKTA_CLIENT_ID);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("redirect_uri", cfg.APP_URL + "/auth/callback");
  u.searchParams.set("state", state);
  return u.toString();
}
async function handleCallback(req, res, query) {
  const { code } = query;
  const tokenRes = await fetch(cfg.OKTA_ISSUER + "/v1/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.APP_URL + "/auth/callback",
      client_id: cfg.OKTA_CLIENT_ID,
      client_secret: cfg.OKTA_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) throw new Error("Token exchange failed: " + tokenRes.status);
  const { id_token } = await tokenRes.json();
  const { createRemoteJWKSet, jwtVerify } = getJose();
  const jwks = createRemoteJWKSet(new URL(cfg.OKTA_ISSUER + "/v1/keys"));
  const { payload } = await jwtVerify(id_token, jwks, { issuer: cfg.OKTA_ISSUER, audience: cfg.OKTA_CLIENT_ID });
  if (!payload.email) throw new Error("ID token has no email claim");
  const token = sign({ email: String(payload.email).toLowerCase(), exp: Date.now() + cfg.SESSION_TTL_HOURS * 3600 * 1000 });
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${cfg.SESSION_TTL_HOURS * 3600}`);
  res.writeHead(302, { Location: "/" });
  res.end();
}
function logout(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

/**
 * Identity from the ingress header. Kanopy's X-Kanopy-Internal-Authorization carries an
 * Okta-backed JWT, while local development sends a bare email through the same header,
 * so both shapes are accepted: anything containing "@" is treated as an address, a
 * three-segment token as a JWT.
 *
 * A JWT is only meaningful once verified — an unverified one is just a string the caller
 * chose, so anything able to reach the pod could mint an identity. Verification therefore
 * requires IDENTITY_JWKS_URL, and skipping it has to be opted into deliberately via
 * TRUST_UNVERIFIED_IDENTITY_JWT (defensible only when nothing can bypass the ingress).
 */
let jwks = null;
async function identityFromHeader(raw) {
  if (!raw) return null;
  let v = String(Array.isArray(raw) ? raw[0] : raw).trim();
  v = v.replace(/^Bearer\s+/i, "");
  if (!v) return null;
  if (v.includes("@") || v.split(".").length !== 3) return v.toLowerCase(); // plain address

  const { createRemoteJWKSet, jwtVerify, decodeJwt } = getJose();
  let claims;
  if (cfg.IDENTITY_JWKS_URL) {
    if (!jwks) jwks = createRemoteJWKSet(new URL(cfg.IDENTITY_JWKS_URL));
    const opts = {};
    if (cfg.IDENTITY_ISSUER) opts.issuer = cfg.IDENTITY_ISSUER;
    if (cfg.IDENTITY_AUDIENCE) opts.audience = cfg.IDENTITY_AUDIENCE;
    try {
      ({ payload: claims } = await jwtVerify(v, jwks, opts));
    } catch (err) {
      // A bad signature, wrong issuer or expired token is a failed authentication,
      // not a server fault.
      const e = new Error("invalid_identity_token");
      e.status = 401;
      e.detail = err.message;
      throw e;
    }
  } else if (cfg.TRUST_UNVERIFIED_IDENTITY_JWT) {
    claims = decodeJwt(v); // signature NOT checked — see the comment above
  } else {
    const e = new Error("identity_jwt_unverifiable");
    e.status = 500;
    e.detail = "The identity header holds a JWT but IDENTITY_JWKS_URL is not configured.";
    throw e;
  }
  const names = cfg.IDENTITY_CLAIM ? [cfg.IDENTITY_CLAIM] : ["email", "preferred_username", "sub"];
  for (const n of names) if (claims[n]) return String(claims[n]).toLowerCase();
  return null;
}

// ---- Identity resolution middleware (both modes) ----
async function resolveUser(req, res, next) {
  try {
    let email = null;
    if (cfg.AUTH_MODE === "proxy-headers") {
      email = await identityFromHeader(req.headers[cfg.IDENTITY_HEADER]);
    } else {
      const session = verify(parseCookies(req)[COOKIE]);
      email = session && session.email;
    }
    if (!email) return res.status(401).json({ error: "not_authenticated" });
    const employee = await col("employees").findOne({ email: String(email).toLowerCase() });
    if (!employee) return res.status(403).json({ error: "no_employee_record", detail: "Ask your PM to add you to the employee master with this email." });
    const today = R.toISO(new Date());
    const e = { start: employee.startDate ? R.toISO(employee.startDate) : null, term: employee.endDate ? R.toISO(employee.endDate) : null };
    if (!R.isActiveDuring(e, today, today)) return res.status(403).json({ error: "inactive", detail: "This account's end date has passed." });
    const appRole = employee.isAdmin ? "Admin" : R.appRoleForEmp({ role: employee.role, streamLead: employee.streamLead, viewer: employee.viewer });
    const permsDoc = await col("permissions").findOne({ _id: "global" });
    // mergePerms backfills roles/capabilities added after the stored doc was written (e.g. Viewer, plans.*)
    const perms = R.mergePerms(permsDoc && permsDoc.perms);
    req.user = { employee, role: appRole };
    req.can = (cap) => R.canDo(perms, appRole, cap);
    next();
  } catch (err) {
    next(err);
  }
}
function requireCap(cap) {
  return (req, res, next) => (req.can(cap) ? next() : res.status(403).json({ error: "forbidden", cap }));
}
function requireAdmin(req, res, next) {
  return req.user.role === "Admin" ? next() : res.status(403).json({ error: "admin_only" });
}

module.exports = { resolveUser, requireCap, requireAdmin, authorizeUrl, handleCallback, logout, sign, verify, COOKIE };

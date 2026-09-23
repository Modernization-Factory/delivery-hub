/** Central config from environment. Fails fast on missing required vars. */
function req(name) {
  const v = process.env[name];
  if (!v) throw new Error("Missing required env var: " + name);
  return v;
}
const AUTH_MODE = process.env.AUTH_MODE || "proxy-headers"; // proxy-headers | oidc

module.exports = {
  PORT: Number(process.env.PORT || 8080),
  MONGODB_URI: req("MONGODB_URI"),
  DB_NAME: process.env.DB_NAME || "deliveryhub",
  AUTH_MODE,
  // Mode A: Kanopy ingress performs Okta OIDC and forwards a trusted identity header.
  // On Kanopy that header is X-Kanopy-Internal-Authorization and carries an Okta-backed
  // JWT, not a bare address; locally it is a plain email. auth.js accepts either.
  // IDENTITY_HEADER is the current name; TRUSTED_EMAIL_HEADER is kept as a fallback.
  IDENTITY_HEADER: (process.env.IDENTITY_HEADER || process.env.TRUSTED_EMAIL_HEADER || "x-forwarded-email").toLowerCase(),
  // JWKS used to verify that JWT. Without it the token cannot be trusted, so an
  // unverified token is refused unless TRUST_UNVERIFIED_IDENTITY_JWT is explicitly set.
  IDENTITY_JWKS_URL: process.env.IDENTITY_JWKS_URL || null,
  IDENTITY_ISSUER: process.env.IDENTITY_ISSUER || null,
  IDENTITY_AUDIENCE: process.env.IDENTITY_AUDIENCE || null,
  IDENTITY_CLAIM: process.env.IDENTITY_CLAIM || null, // default: first of email/preferred_username/sub
  TRUST_UNVERIFIED_IDENTITY_JWT: process.env.TRUST_UNVERIFIED_IDENTITY_JWT === "true",
  // Mode B: app-managed OIDC against Okta.
  OKTA_ISSUER: AUTH_MODE === "oidc" ? req("OKTA_ISSUER") : process.env.OKTA_ISSUER,
  OKTA_CLIENT_ID: AUTH_MODE === "oidc" ? req("OKTA_CLIENT_ID") : process.env.OKTA_CLIENT_ID,
  OKTA_CLIENT_SECRET: AUTH_MODE === "oidc" ? req("OKTA_CLIENT_SECRET") : process.env.OKTA_CLIENT_SECRET,
  SESSION_SECRET: AUTH_MODE === "oidc" ? req("SESSION_SECRET") : process.env.SESSION_SECRET,
  APP_URL: process.env.APP_URL || "http://localhost:8080",
  SESSION_TTL_HOURS: Number(process.env.SESSION_TTL_HOURS || 10),
};

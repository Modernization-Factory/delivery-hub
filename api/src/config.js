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
  TRUSTED_EMAIL_HEADER: (process.env.TRUSTED_EMAIL_HEADER || "x-forwarded-email").toLowerCase(),
  // Mode B: app-managed OIDC against Okta.
  OKTA_ISSUER: AUTH_MODE === "oidc" ? req("OKTA_ISSUER") : process.env.OKTA_ISSUER,
  OKTA_CLIENT_ID: AUTH_MODE === "oidc" ? req("OKTA_CLIENT_ID") : process.env.OKTA_CLIENT_ID,
  OKTA_CLIENT_SECRET: AUTH_MODE === "oidc" ? req("OKTA_CLIENT_SECRET") : process.env.OKTA_CLIENT_SECRET,
  SESSION_SECRET: AUTH_MODE === "oidc" ? req("SESSION_SECRET") : process.env.SESSION_SECRET,
  APP_URL: process.env.APP_URL || "http://localhost:8080",
  SESSION_TTL_HOURS: Number(process.env.SESSION_TTL_HOURS || 10),
};

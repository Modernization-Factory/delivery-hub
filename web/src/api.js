/**
 * API client. In local dev (AUTH_MODE=proxy-headers) identity is the
 * x-forwarded-email header — set once at login via setIdentity().
 * In production behind Kanopy, the ingress injects the header / cookie
 * itself; the extra header from here is simply ignored or overwritten.
 */
// Persisted so a page refresh keeps the session; cleared on "Switch user".
const IDENTITY_KEY = "deliveryhub.identity";
let identity = localStorage.getItem(IDENTITY_KEY);
export function setIdentity(email) {
  identity = email;
  if (email) localStorage.setItem(IDENTITY_KEY, email);
  else localStorage.removeItem(IDENTITY_KEY);
}
export function getIdentity() { return identity; }

export async function api(path, { method = "GET", body, formData } = {}) {
  const headers = {};
  if (identity) headers["x-forwarded-email"] = identity;
  if (body) headers["content-type"] = "application/json";
  const res = await fetch("/api" + path, {
    method,
    headers,
    body: formData ? formData : body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error((data && (data.detail || data.error)) || res.status + " " + res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

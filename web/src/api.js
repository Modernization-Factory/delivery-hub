/**
 * API client. In local dev (AUTH_MODE=proxy-headers) identity is the
 * x-forwarded-email header — set once at login via setIdentity().
 * In production behind Kanopy, the ingress injects the header / cookie
 * itself; the extra header from here is simply ignored or overwritten.
 */
let identity = null;
export function setIdentity(email) { identity = email; }
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

# DeliveryHub API

Backend for the AMP APAC unified tracker. **Node 20 · Express · MongoDB Atlas · Okta SSO (via Kanopy)**.

## Quickstart
```bash
npm install
cp .env.example .env         # fill in MONGODB_URI (+ Okta vars for oidc mode)
npm run seed                 # one-time: loads all reconciled tracker data
npm start                    # http://localhost:8080
npm test                     # pure business-rules test suite
```

## Auth modes (set AUTH_MODE)
- **proxy-headers** (default; typical Kanopy setup): the Okta-gated ingress forwards
  identity in `TRUSTED_EMAIL_HEADER`. The app must only be reachable through the ingress.
- **oidc**: app-managed Okta authorization-code flow (`/auth/login`, `/auth/callback`),
  ID token verified against Okta JWKS, HTTP-only signed session cookie.

Either way, **the employee master authorizes**: the verified email must match an active
employee document; role derives from it per request (Stream Leads get Lead access,
`isAdmin` grants everything). Permissions beyond that are the editable per-capability
matrix stored in the `permissions` collection — same registry the frontend Admin panel uses.

## Post-seed checklist
1. Backfill `employees.email` with Okta login emails (nobody can sign in until set).
2. Set `isAdmin: true` for the admin PMs.
3. Confirm partner staff (WeKan/Ciklum/Globant) hold Okta identities.

## Kanopy notes
- Probes: `GET /healthz` (liveness), `GET /readyz` (readiness — pings Mongo).
- The image is built from the **repo root** `Dockerfile` (multi-stage: builds `web/`, copies
  the bundle to `/app/public`). `server.js` serves it with an SPA fallback that excludes
  `/api`, `/auth`, `/healthz`, `/readyz`. Override the location with `STATIC_DIR`; when the
  directory is missing the app runs API-only.
- `/api/integration` must be carved out of the ingress's Okta enforcement — it is
  bearer-token auth for machines. See `deploy/ingress.reference.yaml`.
- `PORT` env respected; container runs as non-root; secrets via platform secret store.
- Confirm the exact identity header name with the Kanopy docs → `TRUSTED_EMAIL_HEADER`.

## Endpoints (all under /api, capability-gated)
me · employees (CRUD) · leaves (list/create/delete with duplicate-block + overlap-warn +
comp-off balance semantics) · compoffs · timecards (grid, cell edit, add-week, .xlsx import
with the same parser + name aliases as the prototype) · projects (CRUD + trackJira) ·
assignments (create with same-project overlap block / cross-project FTE split, end, delete) ·
burn (derived capacity per project→phase) · scores (list/upsert) · perf/report/{scorecard|
vendors|resource} · perf/config (weights must total 100) · settings · admin/permissions ·
audit. Errors are structured JSON with meaningful HTTP codes (409 conflict, 422 validation).

## Frontend
`delivery-hub.jsx` (the prototype) maps 1:1: each view's in-memory store swaps for these
endpoints (React Query recommended). Business rules are identical on both sides — same
`rules.js` functions, same tests.

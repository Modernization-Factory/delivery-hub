# DeliveryHub

The unified delivery tracker for AMP APAC — leave, comp-off, timecards, allocations,
projects, team plans, performance, program health and remaining runway in one app,
replacing the spreadsheet trackers it was reconciled from.

**Stack:** Node 20 · Express · MongoDB Atlas · React 18 + Vite · Okta SSO (via Kanopy).

```
.
├── api/                Express + MongoDB backend (the system of record)
│   ├── src/            server, routes, auth, rules (shared business logic), integration API
│   ├── scripts/        one-time data imports (seed.json, ph-seed.json)
│   └── test/           business-rules test suite
├── web/                React frontend (Vite)
│   ├── src/lib/        pure domain logic, unit-tested        (see web/README.md)
│   ├── src/ui/         shared atoms + hooks
│   ├── src/views/      one module per screen
│   └── test/           unit, render-smoke and structure tests
└── delivery-hub.jsx    the original single-file prototype (historical reference only —
                        the live app is web/src, do not edit this)
```

---

## 1. Prerequisites

| Need | Version / note |
|---|---|
| Node.js | 20+ (the repo is developed on 20–26; the API container pins `node:20-alpine`) |
| MongoDB | Atlas cluster, or a local `mongod` for development |
| Okta | Only for production auth. Local development uses a header identity — see below. |

---

## 2. Local setup

### 2.1 API

```bash
cd api
npm install
cp .env.example .env           # then edit it
npm run seed                   # one-time: loads the reconciled tracker data
npm start                      # http://localhost:8080
```

Minimum `.env` for local work:

```ini
MONGODB_URI=mongodb://localhost:27017      # or your Atlas SRV string
DB_NAME=deliveryhub
AUTH_MODE=proxy-headers                    # trust the identity header (local + Kanopy ingress)
TRUSTED_EMAIL_HEADER=x-forwarded-email
PORT=8080
```

Full variable list:

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | Connection string. The process exits on a failed connection. |
| `DB_NAME` | no (`deliveryhub`) | Database name. |
| `PORT` | no (`8080`) | HTTP port; Kanopy injects this. |
| `AUTH_MODE` | no (`proxy-headers`) | `proxy-headers` or `oidc`. |
| `TRUSTED_EMAIL_HEADER` | no (`x-forwarded-email`) | Header the ingress injects. Confirm the exact name in the Kanopy docs. |
| `OKTA_ISSUER`, `OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET`, `SESSION_SECRET` | only in `oidc` mode | App-managed authorization-code flow. |
| `APP_URL` | no | Public URL, used to build the OIDC redirect URI. |
| `SESSION_TTL_HOURS` | no (`10`) | Session cookie lifetime in `oidc` mode. |
| `INTEGRATION_TOKENS` | no | Comma-separated bearer tokens for the read-only integration API. Unset = that surface returns 503. |

### 2.2 Activate a sign-in identity

Nobody can sign in until an employee record carries their email — the employee master is
what authorizes, and the role comes from it (there is no role picker).

```javascript
// mongosh
use deliveryhub
db.employees.updateOne({ name: "Dushyant Sharma" }, { $set: { email: "dushyant@local.test", isAdmin: true } })
db.employees.updateOne({ name: "Samriti" },        { $set: { email: "samriti@local.test" } })   // a Lead persona
```

### 2.3 Web

```bash
cd web
npm install
npm run dev                    # http://localhost:5173 (proxies /api, /auth, /healthz -> :8080)
```

Sign in with one of the emails you just activated. To test another persona, activate a
second email and open it in a private window.

### 2.4 Optional: Program Health history

```bash
cd api
node --env-file=.env scripts/import-program-health.js
```

Idempotent. Imported rows carry `source: "ph-import"` and are wiped and reloaded on each
run, so anything entered in-app survives. Projects are upserted by name and only register
fields are touched — streams, funding and links are never overwritten.

---

## 3. Tests

```bash
cd api && npm test     # shared business rules (leave, timecard, capacity, dates)
cd web && npm test     # 99 tests: lib unit tests, render smoke tests, structure guards
cd web && npm run build # bundles the app; also the type/import check for the views
```

`web/test/structure.test.js` enforces the module layering (`lib/` stays pure, views never
import each other, `App.jsx` stays a thin shell) and fails on any import cycle. See
`web/README.md` for the code layout those rules protect.

---

## 4. Auth model

Two modes, same authorization:

- **`proxy-headers` (default, and how Kanopy is normally set up).** The Okta-gated ingress
  authenticates and forwards the verified email in `TRUSTED_EMAIL_HEADER`. **The app must
  only be reachable through that ingress** — anything that can reach the container directly
  can set the header itself.
- **`oidc`.** The app runs the Okta authorization-code flow (`/auth/login`, `/auth/callback`),
  verifies the ID token against Okta JWKS and issues an HTTP-only signed session cookie.

In both modes the verified email must match an **active** employee document. Role derives
from that record per request (Stream Leads get Lead access, `isAdmin` grants everything);
finer-grained rights come from the editable capability matrix in the `permissions`
collection — the same registry the frontend Admin panel edits.

---

## 5. Deployment (Kanopy)

### 5.1 Build the API image

```bash
cd api
docker build -t <registry>/deliveryhub-api:<tag> .
docker push  <registry>/deliveryhub-api:<tag>
```

The image runs as the non-root `node` user, listens on `$PORT` (default 8080) and starts
`src/server.js`.

### 5.2 Build and ship the frontend

```bash
cd web
npm ci
npm run build          # -> web/dist/
```

Serve `web/dist/` from the **same origin** as the API so `/api` needs no CORS and the
ingress covers both: either copy it into the API container/volume and serve it statically,
or host it behind the same Kanopy ingress path.

### 5.3 Platform configuration

- **Probes:** liveness `GET /healthz`, readiness `GET /readyz` (pings Mongo, 503 when down).
- **Secrets:** `MONGODB_URI`, plus the Okta values in `oidc` mode and `INTEGRATION_TOKENS`
  if the integration API is enabled — all via the platform secret store, never committed.
- **Ingress:** must enforce Okta and inject the identity header. Verify the header name
  against the Kanopy docs and set `TRUSTED_EMAIL_HEADER` to match.
- **Network:** no direct route to the container that bypasses the ingress.

### 5.4 First deploy — data setup

Run once against the target database, from a machine that can reach it:

```bash
cd api
MONGODB_URI="<atlas-uri>" DB_NAME="deliveryhub" node scripts/import-seed.js
```

This **drops and recreates** `employees`, `leaves`, `compOffs`, `timecards`, `projects`,
`assignments`, `scores`, `settings` and `permissions` — it is a first-run import, not a
migration. Never point it at a database that already holds live entries.

Then:

1. Backfill `employees.email` with Okta login emails (nobody can sign in until set).
2. Set `isAdmin: true` on the admin PMs.
3. Confirm partner staff (WeKan / Ciklum / Globant) hold Okta identities.
4. Smoke-test: `GET /healthz`, `GET /readyz`, then sign in and load Dashboard, Timecard and
   Program Health.

### 5.5 Upgrades

Push a new image tag and roll the deployment. Application data lives entirely in MongoDB;
no build step touches it, and no seed script should be re-run on an established database.

---

## 6. Integration API (read-only)

DeliveryHub is the system of record; the Program Health app pulls from it and never writes
back.

```bash
# generate a token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# enable it
INTEGRATION_TOKENS=<token>[,<second-token>]
# smoke test
curl -H "Authorization: Bearer $TOK" http://localhost:8080/api/integration/projects
```

`GET /api/integration/{projects,milestones,raid}`, each wrapped as `{ "items": [...] }`,
keyed for upserts on the stable `external_id`. Requests without a valid bearer token get
401; with no tokens configured the whole surface answers 503. Consumer configuration is in
`api/sync_config.snippet.json`; details in `api/INTEGRATION.md`.

---

## 7. Where to look next

| Question | File |
|---|---|
| Frontend structure, module rules, test layout | `web/README.md` |
| Endpoint list, auth modes, post-seed checklist | `api/README.md` |
| Program Health data feed | `api/INTEGRATION.md` |
| Shared business rules (the authoritative maths) | `api/src/rules.js`, `web/src/lib/` |

# DeliveryHub

The unified delivery tracker for AMP APAC — leave, comp-off, timecards, allocations,
projects, team plans, performance, program health and remaining runway in one app,
replacing the spreadsheet trackers it was reconciled from.

**Stack:** Node 20 · Express · MongoDB Atlas · React 18 + Vite · Okta SSO (via Kanopy).

```
.
├── api/                Express + MongoDB backend (the system of record)
│   ├── src/            server, routes, auth, rules (shared business logic), integration API
│   ├── scripts/        seed builders + importers, identity backfill (see 2.5)
│   └── test/           business-rules test suite
├── web/                React frontend (Vite)
│   ├── src/lib/        pure domain logic, unit-tested        (see web/README.md)
│   ├── src/ui/         shared atoms + hooks
│   ├── src/views/      one module per screen
│   └── test/           unit, render-smoke and structure tests
├── scripts/            dev.mjs — runs api + web together (npm run dev)
├── deploy/             Kanopy reference: Okta, identity JWT, deploy trigger
├── raw-seed-files/     source .xlsx exports the seed is generated from
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

### 2.1 Quickstart

```bash
npm run setup                  # npm ci in api/ and web/
cp api/.env.example api/.env   # then set MONGODB_URI
npm run seed                   # one-time: loads the reconciled tracker data
npm run dev                    # starts BOTH, Ctrl-C stops both
```

Then open **http://localhost:5173** — not `:8080`. Vite serves the UI and proxies
`/api`, `/auth` and `/healthz` through to the API.

Root scripts:

| Command | Does |
|---|---|
| `npm run setup` | `npm ci` in both workspaces |
| `npm run dev` | API + Vite together, output prefixed `api │` / `web │` |
| `npm test` | both test suites |
| `npm run build` | production frontend bundle |
| `npm run seed` | the one-time data import (see 5.4 before using it) |

`npm run dev` checks its preconditions first and fails with the command to fix them
rather than a stack trace. If either process exits, the other is stopped too, so the
stack is never left half-running with a port held.

Minimum `.env` for local work:

```ini
MONGODB_URI=mongodb://localhost:27017      # or your Atlas SRV string
DB_NAME=deliveryhub
AUTH_MODE=proxy-headers                    # trust the identity header (local + Kanopy ingress)
PORT=8080
```

> `npm start` in `api/` does **not** read `.env` — that is deliberate, because the
> container supplies its environment directly and `--env-file` fails on a missing file.
> Use `npm run dev` (root, or inside `api/`) for local work.

Full variable list:

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | Connection string. The process exits on a failed connection. |
| `DB_NAME` | no (`deliveryhub`) | Database name. |
| `PORT` | no (`8080`) | HTTP port; Kanopy injects this. |
| `AUTH_MODE` | no (`proxy-headers`) | `proxy-headers` or `oidc`. |
| `IDENTITY_HEADER` | no (`x-forwarded-email`) | Header the ingress injects. On Kanopy: `x-kanopy-internal-authorization`. `TRUSTED_EMAIL_HEADER` still works as a fallback name. |
| `IDENTITY_JWKS_URL` | on Kanopy | JWKS used to verify the identity JWT. Required whenever that header carries a token. |
| `IDENTITY_ISSUER` | no | Expected `iss`. On Kanopy: `login.corp.mongodb.com` (both environments). |
| `IDENTITY_AUDIENCE` | no | Expected `aud`. **Leave unset on Kanopy** — those tokens carry no `aud` claim, so setting it rejects everything. |
| `IDENTITY_CLAIM` | no (`email`) | Claim holding the address; falls back to `preferred_username`, then `sub`. |
| `TRUST_UNVERIFIED_IDENTITY_JWT` | no (`false`) | Accept the JWT without verifying it. Only defensible when nothing can bypass the ingress. |
| `OKTA_ISSUER`, `OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET`, `SESSION_SECRET` | only in `oidc` mode | App-managed authorization-code flow. |
| `APP_URL` | no | Public URL, used to build the OIDC redirect URI. |
| `SESSION_TTL_HOURS` | no (`10`) | Session cookie lifetime in `oidc` mode. |
| `INTEGRATION_TOKENS` | no | Comma-separated bearer tokens for the read-only integration API. Unset = that surface returns 503. |
| `STATIC_DIR` | no (`../public`) | Built frontend to serve same-origin. Absent = API-only mode. |

### 2.2 Activate a sign-in identity

Nobody can sign in until an employee record carries their email — the employee master is
what authorizes, and the role comes from it (there is no role picker).

`npm run seed` reloads every employee with `email: null`, so this has to be redone after
each reload. Keep the mapping in a file rather than retyping it:

```bash
node scripts/backfill-identities.js scripts/identities.local.json            # dry run
node scripts/backfill-identities.js scripts/identities.local.json --write
```

`scripts/identities.local.json` ships the two dev personas — `dushyant@local.test`
(Admin) and `samriti@local.test` (Lead). Add your own the same way:

```json
{ "Employee Name": { "email": "you@local.test", "isAdmin": true } }
```

Names must match `employees.name` **exactly**. The script reports anything that doesn't
match and exits non-zero — unlike a bare `db.employees.updateOne({ name: ... })`, which
matches nothing and still reports success. Employee names change when the master is
refreshed (e.g. "Samriti" became "Samriti Arora"), so that silent no-op is easy to hit.

For a real environment, copy `scripts/identities.example.json`, fill in Okta login
emails, and point the script at it:

```bash
MONGODB_URI="<atlas-uri>" node scripts/backfill-identities.js identities.prod.json --write
```

The script only ever updates `email`, `isAdmin`, `streamLead` and `viewer` on existing
employees — it never inserts, deletes or drops, and re-running it is a no-op.

### 2.3 Running the halves separately

`npm run dev` at the root covers normal work. To run just one — debugging the API
against a paused frontend, say:

```bash
npm run dev --prefix api    # :8080, reads api/.env
npm run dev --prefix web    # :5173, proxies /api, /auth, /healthz -> :8080
```

Sign in with one of the emails you activated above. To test another persona, activate a
second email and open it in a private window.

### 2.4 Optional: Program Health history

```bash
cd api
node --env-file=.env scripts/import-program-health.js
```

Idempotent. Imported rows carry `source: "ph-import"` and are wiped and reloaded on each
run, so anything entered in-app survives. Projects are upserted by name and only register
fields are touched — streams, funding and links are never overwritten.

### 2.5 Refreshing the seed from the source workbooks

`seed.json` and `ph-seed.json` are generated, not hand-edited. Drop the current exports
into `raw-seed-files/` and rebuild:

```bash
cd api
node scripts/build-seed.js                 # dry run: prints a per-dataset diff
node scripts/build-seed.js --write
node scripts/build-ph-seed.js              # dry run
node scripts/build-ph-seed.js --write
```

Expected files in `raw-seed-files/`:

| File | Feeds |
|---|---|
| `Leave Tracker.xlsx` | employees, leaves, comp-offs, holidays |
| `Copy of Resource Allocation - Mar'26 ++.xlsx` | the `Timecard-Proactiveness` sheet |
| `AMP APAC Program Health - v2.0.xlsx` | projects, weekly health, pipeline, RAID, milestones |

Both builders parse through `src/rules.js` (`excelToISO`, `parseTimecardGrid`,
`NAME_ALIASES`), so the seed is built by the same code as the in-app `.xlsx` import.

**Always read the dry-run warnings.** The builders are deliberately non-destructive where
the workbooks disagree with what is already seeded:

- Allocations (`A`) and performance scores (`P`) have no workbook source and are carried
  over verbatim.
- A person still referenced by leave/comp-off/timecard/score history but missing from the
  EMPLOYEES sheet is **carried forward** from the previous seed, not dropped — otherwise
  `import-seed.js` throws on `orphan()` and the history is destroyed. Retiring someone for
  real is a manual decision.
- The Timecard-Proactiveness export has covered fewer people than the seed. Anyone absent
  from it keeps their previous rows, re-aligned onto the new week axis **by date**, never
  by position.
- A project with weekly/RAID/milestone history but no row in the register is carried
  forward, or its history would import with a null `projectId`.

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

### 5.1 Build the image

One image holds both halves: the root `Dockerfile` builds `web/` in a first stage and
copies the bundle into the API image at `/app/public`. Build from the **repo root**, not
from `api/` — the web build stage needs it in context.

```bash
docker build -t <registry>/deliveryhub:<tag> .
docker push  <registry>/deliveryhub:<tag>
```

The image runs as the non-root `node` user, listens on `$PORT` (default 8080) and starts
`src/server.js`.

### 5.2 How the frontend is served

`src/server.js` mounts `/app/public` (override with `STATIC_DIR`) as static files with an
SPA fallback, so the app and `/api` share one origin: no CORS, and one ingress covers both.

- Hashed assets under `/assets` are served `max-age=31536000`; `index.html` is `no-store`,
  so a deploy can't leave clients pinned to a stale bundle.
- The fallback deliberately excludes `/api`, `/auth`, `/healthz` and `/readyz`, so a bad
  API path returns a 404 rather than a page of HTML.
- If the directory is absent the handlers aren't mounted and the process runs API-only —
  which is what local `npm start` does, with Vite serving the app on :5173.

### 5.3 Platform configuration

- **Probes:** liveness `GET /healthz`, readiness `GET /readyz` (pings Mongo, 503 when down).
- **Secrets:** `MONGODB_URI`, plus the Okta values in `oidc` mode and `INTEGRATION_TOKENS`
  if the integration API is enabled — all via the platform secret store, never committed.
- **Okta:** declared in the service catalog entry, not with ingress annotations:
  `serviceCatalogEntry.authorization.clientPrincipals: [<okta_client_id>]`.
- **Identity:** the ingress forwards `X-Kanopy-Internal-Authorization`, which carries a
  Kanopy-issued, Okta-backed **JWT — not a bare email**. Set `IDENTITY_HEADER` to that
  name and `IDENTITY_JWKS_URL` so the app can verify it and read the email claim. Without
  the JWKS the app refuses the request rather than trusting an unverified token.
- **Network:** no direct route to the container that bypasses the ingress.

#### The integration path must bypass Okta

`/api/integration` is called by machines (the Program Health app) holding a bearer token,
not by people holding an Okta session. `clientPrincipals` applies to the whole service
catalog entry, so those calls get an auth challenge instead of JSON and the feed breaks.

**This is the one deployment question still unanswered.** `clientPrincipals` is declared
per service, so it may not be scopeable to a path — the question to put to Kanopy is
whether a path prefix can be excluded, or whether a second Service is required. Both
shapes are written up in `deploy/kanopy.reference.yaml`; neither has been guessed at.

It blocks launch only if the Program Health feed is in scope on day one. Everything else
can deploy without it.

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

1. Backfill sign-in identities — nobody can sign in until this is done. Copy
   `scripts/identities.example.json`, fill in Okta login emails plus the `isAdmin` and
   `streamLead` flags, then:
   ```bash
   MONGODB_URI="<atlas-uri>" node scripts/backfill-identities.js identities.prod.json          # dry run first
   MONGODB_URI="<atlas-uri>" node scripts/backfill-identities.js identities.prod.json --write
   ```
   The dry run lists every name that doesn't match `employees.name`; resolve those before
   writing. Re-running is a no-op, so it is safe after any future reload.
2. Confirm partner staff (WeKan / Ciklum / Globant) hold Okta identities — they cannot
   sign in without one, whatever the mapping file says.
4. Smoke-test: `GET /healthz`, `GET /readyz`, then sign in and load Dashboard, Timecard and
   Program Health.

### 5.5 How a deploy is triggered

Kanopy deploys through Drone, driven by `.drone.yml` at the repo root. The pipeline is
gated on the branch:

```yaml
trigger:
  branch:
    - main
```

So a push or merge to **`main`** builds the image and rolls the deployment.

> **Changed with the repo split.** In the `amp-pm-apac` monorepo the trigger branch was
> `delivery-hub`. This is now a dedicated repository whose default branch is `main`, so
> the Kanopy/Drone configuration must be re-pointed to `main` — otherwise the pipeline
> waits on a branch that no longer exists here.

The pipeline mirrors amp-delivery-estimator: one `publish` step (kaniko → ECR
`amp-delivery/<repo>`, tagged `git-<sha7>` and `latest`) and one `deploy-staging` step
(`mongodb/web-app` chart 4.25.0, release `delivery-hub`, namespace `amp-delivery`, host
`delivery-hub.amp-delivery.staging.corp.mongodb.com`). Environment values, probes and the
secret reference live in `environments/staging.yaml`.

One-time setup before the first merge to `main`:

1. Activate the repo in Drone and add three secrets under the repo's Drone settings
   (same names as amp-delivery-estimator). All three are read from the **staging**
   cluster, `amp-delivery` namespace:
   ```bash
   kubectl config use-context api.staging.corp.mongodb.com
   kubectl config set-context api.staging.corp.mongodb.com --namespace=amp-delivery
   ```

   | Drone secret | Command |
   | --- | --- |
   | `staging_kubernetes_token` | `kubectl get secret kanopy-cicd-token -o jsonpath="{.data.token}" \| base64 --decode && echo` |
   | `ecr_access_key` | `kubectl get secret ecr -o jsonpath="{.data.ecr_access_key}" \| base64 --decode && echo` |
   | `ecr_secret_key` | `kubectl get secret ecr -o jsonpath="{.data.ecr_secret_key}" \| base64 --decode && echo` |

   Paste each value straight into Drone; don't commit it or share it in chat.
2. Create the Mongo secret in the namespace:
   ```bash
   kubectl config use-context api.staging.corp.mongodb.com
   helm ksec set delivery-hub-creds MONGODB_URI='<atlas-uri>'
   ```
3. Make sure the Atlas project allows the Kanopy egress IP (otherwise `/readyz` stays 503
   and the pod never becomes ready).
4. Register the Okta `clientPrincipals` in the service catalog entry (5.3).

Two consequences worth holding onto:

- **`main` is a deploying branch, not a working branch.** Anything merged into it goes
  out. Do feature work on a side branch and merge deliberately.
- The seed and identity scripts are *not* part of the pipeline. They are run manually
  against the target database (5.4), and `import-seed.js` must never be re-run on an
  established one.

### 5.6 Upgrades

Merge to `main`; Drone builds a new image tag and rolls the deployment. Application data lives entirely in MongoDB; no build step touches it, and
no seed script should be re-run on an established database.

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
| Kanopy config, Okta and the integration carve-out | `deploy/kanopy.reference.yaml` |
| Shared business rules (the authoritative maths) | `api/src/rules.js`, `web/src/lib/` |

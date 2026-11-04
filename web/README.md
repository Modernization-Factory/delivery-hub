# DeliveryHub Web — live frontend

The prototype UI wired to the DeliveryHub API. Same views, but all data loads
from MongoDB and every change persists through the endpoints (optimistic local
update + API write + refetch on creates; a red banner with "Reload from server"
appears if a write fails).

## Run locally (API first, then this)
```bash
# terminal 1 — API (from the api/ folder)
node --env-file=.env src/server.js

# terminal 2 — web (this folder)
npm install
npm run dev            # http://localhost:5173  (proxies /api -> :8080)
```
Sign in with an email you've activated on an employee record, e.g.:
```javascript
// mongosh
use deliveryhub
db.employees.updateOne({name:"Dushyant Sharma"},{$set:{email:"dushyant@local.test",isAdmin:true}})
db.employees.updateOne({name:"Samriti"},{$set:{email:"samriti@local.test"}})   // a Lead persona
```
Role comes from the employee record — no role picker. To test personas,
activate more emails and sign in as them (open a second browser/incognito).

## Code layout
```
src/
  main.jsx            mounts <App/>
  api.js              fetch wrapper + identity header
  App.jsx             root shell only: stores, the LIVE SYNC LAYER, nav, routing
  lib/                pure domain logic — no React, no JSX, unit-tested
    dates.js          parseISO/toISO/fmt, working days, WORKDAY math, week anchor
    leave.js          leave days, duplicates/overlaps, balances, leave-by-project
    workdays.js       working days per resource/month, net of leave and comp-off
    timecard.js       proactiveness stats, compliance %, Excel grid parser
    allocations.js    assignment overlap rules, day-weighted effort, computeBurn
    runway.js         consumption, per-role runway, runwaySummary
    programHealth.js  elapsed %, burn vs plan, schedule variance, phOverallStatus
    performance.js    weighted scores, stars, RAG, scorecard & trends
    permissions.js    capability registry, role defaults, canDo
    plans.js          team-plan effort maths        paging.js   pageSlice
    roles.js          role mappings                 raid.js     RAID/milestone enums
    constants.js      SEED, OPEN_END                xlsx.js     downloadXlsx
  ui/                 shared presentation: atoms.jsx (Card/Btn/Pill/Stat/Field/
                      Notice), brand.jsx, usePaged.jsx, CustomFieldsCard.jsx
  views/              one module per screen (Dashboard, MyLeave, Projects,
                      Runway, ProgramHealth, …), each a named export taking ctx
```
Three rules keep it navigable, and `test/structure.test.js` enforces them:
1. `lib/` is pure — it imports nothing from `ui/` or `views/` and never touches React.
2. `views/` never import each other; anything shared moves to `ui/` or `lib/`.
3. `App.jsx` stays a shell — state, sync and routing, no screen markup.

## How the wiring works
- `src/api.js` — fetch wrapper; in local dev it sends your email as the
  `x-forwarded-email` identity header (exactly what the Kanopy ingress will
  inject in production, so nothing changes at deploy time).
- `src/App.jsx` — the LIVE SYNC LAYER lives in `App()`: every ctx setter updates
  state instantly, then diffs prev→next by id and fires POST/PUT/PATCH/DELETE
  accordingly. Views receive `ctx` and don't know the backend exists.
- Timecard Excel import goes server-side (multipart to /api/timecards/import),
  then refetches; "+ Add week" calls POST /api/timecards/weeks.

## Tests
```bash
npm test     # node --test, no extra dependencies
```
`test/` covers the pure modules in `src/lib/` — dates & WORKDAY maths, the leave
engine, timecard parsing/compliance, allocation splits and burn, runway
(consumption, overrides, leave extension, tightest-role summary), program-health
derivations, performance scoring, permissions and pagination — plus
`structure.test.js`, which fails the build-out of any import cycle or layering
violation. UI modules are covered by `npm run build` (type/bundle check).

## Production build
`npm run build` → static files in `dist/` — serve from the API container or any
static host behind the same Kanopy ingress (so /api shares the origin).

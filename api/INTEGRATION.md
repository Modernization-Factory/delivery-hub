# DeliveryHub → Program Health integration (read-only)

DeliveryHub is the system of record; the Program Health app PULLS from these
endpoints with its existing `sync.py` engine. DeliveryHub never receives writes
through this surface.

## Enable
Add to the API `.env` (or Kanopy secret), then restart:

    INTEGRATION_TOKENS=<long-random-token>[,<second-token>]

Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Never commit tokens. Requests without a valid `Authorization: Bearer <token>`
get 401; with no tokens configured, the surface answers 503 (disabled).

## Endpoints (all GET, all wrapped as { "items": [...] })
| Path | Contents |
|---|---|
| /api/integration/projects   | external_id, name, pm, phase (current), phases[], start, end, description |
| /api/integration/milestones | external_id, project_name, name, phase, planned, actual, status, rag, comments |
| /api/integration/raid       | external_id, project_name, type, description, impact, probability, owner, target_date, status, linked_item, comments |

Dates are `YYYY-MM-DD` strings or null. `external_id` is the stable Mongo id —
key upserts on it. `project_name` is denormalized onto milestones and RAID so no
join is needed on the consumer side. Milestone statuses: Not Started / In
Progress / Complete. RAID types: Risk / Issue / Dependency / Decision; impact &
probability are H/M/L; RAID statuses: Open / In Progress / Closed.

## Consumer config (paste into webapp/sync_config.json, adjust base_url)
See sync_config.snippet.json next to this file.

## Smoke test
    curl -H "Authorization: Bearer $TOK" http://localhost:8080/api/integration/projects

## RAID link-out
The Program Health config's `raid_log_url_template` can point at
`http://<web-host>:5173/#projects` — DeliveryHub's web UI honors `#<menu-id>`
deep links (projects, plans, runway, ...). There is no per-project sub-route
yet; the link lands on the Projects page where each project's RAID panel is
one click away.

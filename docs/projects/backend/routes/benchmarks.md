---
title: Benchmarks API
description: Normative athletic benchmark standards by sport, team, and position in SSP-API (Phase 1).
outline: deep
---

# Benchmarks API (Phase 1)

The Benchmarks API exposes precomputed normative athletic standards held in the
`benchmarks` table. Each row keys a metric (`metric_name`) to a squad average
(`squad_average`) and a 90th-percentile mark (`percentile_90`) for a given sport,
team, and playing position, letting coaches compare athlete output against
cohort references. See also [Goals](./goals) and [Analytics](./analytics) for
how targets and trend data consume these references.

Source: `src/routes/benchmarks.ts`.

---

## 1. List Benchmarks (`GET /benchmarks`)

Returns benchmark rows for the caller's tenant. Non-super-admins are scoped to
their `primaryOrganisationId`; `ssp_super_admin` callers with no organisation
filter read across all tenants. Optional equality filters narrow the result set
on `sport_id`, `team_id`, and `position_label`.

- **Path:** `/benchmarks`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** `coach`, `organisation_admin`, `ssp_super_admin`
  (admitted via `requireRoles` cascade; `sub_coach` is **not** admitted)
- **Tenant Scope:** Org — `eq('organisation_id', ctx.primaryOrganisationId)`
  unless the caller is `ssp_super_admin`
- **Query Parameters:**
  - `sport_id` (`uuid`, optional): Equality filter on `benchmarks.sport_id`.
  - `team_id` (`uuid`, optional): Equality filter on `benchmarks.team_id`.
  - `position_label` (`string`, optional): Equality filter on
    `benchmarks.position_label` (e.g. `"Flyhalf"`, `"Winger"`).

Query strings are read manually via `c.req.query(...)` and applied only when
truthy — no `zValidator('query', …)` is registered.

### Response (`200 OK`)

`{ benchmarks: [...] }` from `benchmarks` `select('*')`. Row columns (per the
generated DB types): `id`, `metric_name`, `organisation_id`, `percentile_90`
(nullable), `position_label` (nullable), `sport_id`, `squad_average` (nullable),
`team_id` (nullable), `unit` (nullable), `computed_at` (nullable), `created_at`
(nullable), `updated_at` (nullable). An empty result yields `{ benchmarks: [] }`.

```json
{
  "benchmarks": [
    {
      "id": "22222222-3333-4444-5555-666666666666",
      "metric_name": "max_speed_mps",
      "organisation_id": "9df0f0e0-47b1-4f67-88eb-116f1997380d",
      "percentile_90": 9.2,
      "position_label": "Flyhalf",
      "sport_id": "9df0f0e0-47b1-4f67-88eb-116f1997380d",
      "squad_average": 8.4,
      "team_id": "11111111-2222-3333-4444-555555555555",
      "unit": "m/s",
      "computed_at": "2026-07-15T00:00:00.000Z",
      "created_at": "2026-07-15T00:00:00.000Z",
      "updated_at": "2026-07-15T00:00:00.000Z"
    },
    {
      "id": "33333333-4444-5555-6666-777777777777",
      "metric_name": "session_distance_meters",
      "organisation_id": "9df0f0e0-47b1-4f67-88eb-116f1997380d",
      "percentile_90": 8200.0,
      "position_label": "Flyhalf",
      "sport_id": "9df0f0e0-47b1-4f67-88eb-116f1997380d",
      "squad_average": 6800.0,
      "team_id": "11111111-2222-3333-4444-555555555555",
      "unit": "meters",
      "computed_at": "2026-07-15T00:00:00.000Z",
      "created_at": "2026-07-15T00:00:00.000Z",
      "updated_at": "2026-07-15T00:00:00.000Z"
    }
  ]
}
```

### Errors

| Status | When |
| :--- | :--- |
| 403 | Caller fails `requireRoles('coach', 'organisation_admin', 'ssp_super_admin')` (also the fail-closed outcome if the `user_roles` query errors and roles load as `[]`). |

Unhandled errors collapse to `500 { error: "<message>" }` via the app-level
`onError` handler.
---
title: Workload & Readiness API
description: Daily athlete workload, ACWR, and readiness records in SSP-API.
outline: deep
---

# Workload & Readiness API (Phase 1)

The Workload API exposes longitudinal training-load and readiness records for an athlete, read from the `workload_readiness` table. The handler lives in `src/routes/workload.ts` and is root-mounted in `app.ts`, so its real path is `/athletes/:id/workload` (not under `/athletes`). See [Athletes](./athletes) for the athlete resource and [Analytics](./analytics) for aggregated trend analytics.

---

## 1. Get Athlete Workload (`GET /athletes/:id/workload`)

Returns the daily workload and readiness rows recorded for an athlete over an optional date window, ordered by `recorded_at` ascending.

- **Path:** `/athletes/:id/workload`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none — manual access check via `canSeeAthlete`. The following pass:
  - `organisation_admin` and `ssp_super_admin` (always)
  - The athlete themselves, when the athlete row's `user_id === user.id`
  - A `coach` whose `loadCallerContext` team ids intersect one of the athlete's active (`left_at is null`) `team_memberships.team_id`
- **Tenant Scope:** Athlete
- **Path Parameters:**
  - `id` (`string`, required): Athlete id.
- **Query Parameters** (parsed manually via `c.req.query`, no Zod validator):
  - `from` (`string`, optional): Lower bound on `recorded_at` (applied as `gte`). Any string accepted by the DB; pass an ISO timestamp or date.
  - `to` (`string`, optional): Upper bound on `recorded_at` (applied as `lte`).

### Response (`200 OK`)

Returns `{ workload: [...] }` from `workload_readiness` selected with `select('*')` and filtered `eq('athlete_id', id)`; optional `gte('recorded_at', from)` and `lte('recorded_at', to)`; ordered `recorded_at asc`. `workload` is `[]` when no rows match.

```json
{
  "workload": [
    {
      "id": "12345678-1234-5678-1234-567812345678",
      "athlete_id": "44444444-5555-6666-7777-888888888888",
      "organisation_id": "11111111-2222-3333-4444-555555555555",
      "acwr": 1.11,
      "availability_score": 88,
      "availability_status": "available",
      "energy_score": 7,
      "load_balance_score": 1.2,
      "workload_score": 1420.5,
      "recorded_at": "2026-08-15T06:00:00.000Z",
      "created_at": "2026-08-15T06:00:01.000Z",
      "updated_at": "2026-08-15T06:00:01.000Z"
    }
  ]
}
```

### `workload_readiness` columns

| Column | Type | Nullable | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `string` (uuid) | no | Row id. |
| `athlete_id` | `string` (uuid) | no | Athlete the record belongs to. |
| `organisation_id` | `string` (uuid) | no | Owning organisation. |
| `acwr` | `number` | yes | Acute:Chronic Workload Ratio. |
| `availability_score` | `number` | yes | Composite availability score. |
| `availability_status` | `string` | yes | Availability status label. |
| `energy_score` | `number` | yes | Energy score. |
| `load_balance_score` | `number` | yes | Load balance score. |
| `workload_score` | `number` | yes | Workload score. |
| `recorded_at` | `string` (timestamptz) | yes | Timestamp the record applies to; used for `from`/`to` filtering and ordering. |
| `created_at` | `string` (timestamptz) | yes | Row insert time. |
| `updated_at` | `string` (timestamptz) | yes | Row last-update time. |

### Errors

| Status | Body | When |
| :--- | :--- | :--- |
| 403 | `{ "error": "Forbidden" }` | `canSeeAthlete` returns false (caller is not the athlete, an org/super admin, or a coach on a shared team). |
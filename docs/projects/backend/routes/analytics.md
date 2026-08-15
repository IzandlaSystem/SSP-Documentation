---
title: Analytics API
description: Squad aggregate workloads and per-athlete longitudinal trend analytics in SSP-API (Phase 1).
outline: deep
---

# Analytics API (Phase 1)

The Analytics API surfaces aggregated training load across a squad's sessions and a per-session metric trend for a single athlete. Handlers live in [`src/routes/analytics.ts`](https://github.com/IzandlaSystems/SSP-API/blob/main/src/routes/analytics.ts) and are **root-mounted** in `app.ts` (`route('/', analytics)`), so the full paths are `/teams/:id/analytics` and `/athletes/:id/analytics` — even though the handlers are not in `teams.ts` or `athletes.ts`. Both read from the `session_athlete_metrics` table populated by the telemetry parse pipeline.

See also: [Teams](./teams), [Athletes](./athletes), [Metrics & Targets](./metrics).

---

## 1. Squad Analytics (`GET /teams/:id/analytics`)

Aggregates `session_athlete_metrics` across every session a squad held within an optional date window. Useful for coaches and sports scientists evaluating squad workload over time.

- **Path:** `/teams/:id/analytics`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** `coach`, `organisation_admin`, `ssp_super_admin` (via `requireRoles`; `coach` cascades up to org admin and super admin)
- **Tenant Scope:** Team — gated by `hasTeamResourceAccess(user, teamId)` (403 if denied)
- **Query Parameters:**
  - `from` (`string`, optional): ISO datetime; filters sessions where `planned_start_at >= from`.
  - `to` (`string`, optional): ISO datetime; filters sessions where `planned_start_at <= to`.

The handler first selects session `id`s from `sessions` where `team_id = :id` and the optional `planned_start_at` bounds apply. If no sessions match, it short-circuits with the empty payload below. Otherwise it selects `distance_meters`, `max_speed_mps`, `sprint_count`, and `workload_index` from `session_athlete_metrics` where `session_id` is in that set, then averages `workload_index` and `distance_meters` across all returned rows (`null` when there are no rows). `top_metrics` is the raw row array.

### Response (`200 OK`)

```json
{
  "team_id": "22222222-3333-4444-5555-666666666666",
  "session_count": 12,
  "squad_avg_load": 74,
  "avg_distance_meters": 7140,
  "top_metrics": [
    {
      "distance_meters": 6820.5,
      "max_speed_mps": 9.45,
      "sprint_count": 14,
      "workload_index": 78
    },
    {
      "distance_meters": 7461.0,
      "max_speed_mps": 8.92,
      "sprint_count": 11,
      "workload_index": 70
    }
  ]
}
```

When the window contains no sessions for the team:

```json
{
  "team_id": "22222222-3333-4444-5555-666666666666",
  "session_count": 0,
  "squad_avg_load": null,
  "top_metrics": []
}
```

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 403 | `{ "error": "Forbidden" }` | `hasTeamResourceAccess` denied (user is not a member/admin of this team's organisation). |

---

## 2. Athlete Analytics Trend (`GET /athletes/:id/analytics`)

Returns the full `session_athlete_metrics` history for a single athlete as a time-ordered trend, optionally narrowed by date. There is no `requireRoles` gate; access is decided manually.

- **Path:** `/athletes/:id/analytics`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none — manual access check. Passes if the caller is an `organisation_admin` or `ssp_super_admin`, is the athlete themselves (`athletes.user_id === user.id`), or is a `coach` whose caller-context teams intersect the athlete's active `team_memberships` (`left_at is null`).
- **Tenant Scope:** Athlete — cross-tenant for admins, self for athletes, shared-team for coaches
- **Query Parameters:**
  - `from` (`string`, optional): ISO datetime; filters `recorded_at >= from`.
  - `to` (`string`, optional): ISO datetime; filters `recorded_at <= to`.

The handler selects `*` from `session_athlete_metrics` where `athlete_id = :id`, applies the optional `recorded_at` bounds, and orders ascending by `recorded_at`. The `trend` array therefore contains complete metric rows (see `session_athlete_metrics` columns: `distance_meters`, `max_speed_mps`, `sprint_count`, `workload_index`, `recorded_at`, and the rest).

### Response (`200 OK`)

```json
{
  "athlete_id": "44444444-5555-6666-7777-888888888888",
  "trend": [
    {
      "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "session_id": "11111111-2222-3333-4444-555555555555",
      "athlete_id": "44444444-5555-6666-7777-888888888888",
      "organisation_id": "00000000-0000-0000-0000-000000000000",
      "distance_meters": 7420.0,
      "max_speed_mps": 9.15,
      "sprint_count": 13,
      "workload_index": 82,
      "duration_seconds": 3600,
      "impact_count": 4,
      "step_count_delta": 5210,
      "acceleration_magnitude_summary": 3.12,
      "load_balance_score": null,
      "data_quality_status": "valid",
      "data_source": "mobile_ble",
      "recorded_at": "2026-07-04T18:30:00.000Z",
      "created_at": "2026-07-04T18:31:05.000Z",
      "updated_at": "2026-07-04T18:31:05.000Z"
    },
    {
      "id": "ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb",
      "session_id": "12121212-3434-5656-7878-909090909090",
      "athlete_id": "44444444-5555-6666-7777-888888888888",
      "organisation_id": "00000000-0000-0000-0000-000000000000",
      "distance_meters": 6985.5,
      "max_speed_mps": 8.74,
      "sprint_count": 10,
      "workload_index": 71,
      "duration_seconds": 3480,
      "impact_count": 2,
      "step_count_delta": 4980,
      "acceleration_magnitude_summary": 2.87,
      "load_balance_score": null,
      "data_quality_status": "valid",
      "data_source": "mobile_ble",
      "recorded_at": "2026-07-11T18:30:00.000Z",
      "created_at": "2026-07-11T18:31:12.000Z",
      "updated_at": "2026-07-11T18:31:12.000Z"
    }
  ]
}
```

Field values are nullable per the `session_athlete_metrics` schema; `trend` is `[]` when no metric rows match the athlete and window.

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 403 | `{ "error": "Forbidden" }` | Caller is not an admin, not the athlete themselves, and not a coach with a shared active team. |
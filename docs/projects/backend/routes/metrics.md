---
title: Metrics & Targets API
description: Athlete performance metrics, squad session summaries, and coach workload targets in SSP-API.
outline: deep
---

# Metrics & Targets API (Phase 1)

The Metrics & Targets API exposes per-athlete performance outputs (distance, velocity, sprint counts, impacts), squad-level session rollups, and coach-configured session targets. All data is read from tables populated by the telemetry ingest pipeline; see [Ingestion Pipeline](../ingestion-pipeline) and [Sessions API](./sessions).

> **Source file (root-mounted).** These handlers live in `src/routes/metrics.ts`, which is mounted at `/` in `app.ts`, **not** under the `/sessions` router. Their real paths are nevertheless `/sessions/:id/metrics`, `/sessions/:id/summary`, and `/sessions/:id/targets` (no collision with the `sessions` router because the sub-paths differ). The [Sessions API](./sessions) doc does **not** own these endpoints; this doc does. Mount-prefix and access semantics are covered in [Architecture](../architecture) and [Auth & Security](../auth-and-security).

---

## 1. Get Session Metrics (`GET /sessions/:id/metrics`)

Returns performance metrics for all athletes recorded in a session, from the `session_athlete_metrics` table.

- **Path:** `/sessions/:id/metrics`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none: manual access check via `ensureSessionAccess` (super admin, session creator, org admin of the session's org, coach/sub_coach of the session's team, or an enrolled athlete pass)
- **Tenant Scope:** Team (session-scoped)
- **Path Parameters:**
  - `id` (`uuid`, required): Session ID.

### Response (`200 OK`)

```json
{
  "metrics": [
    {
      "id": "11111111-2222-3333-4444-555555555555",
      "session_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
      "athlete_id": "44444444-5555-6666-7777-888888888888",
      "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
      "distance_meters": 7420.5,
      "duration_seconds": 4800,
      "max_speed_mps": 8.92,
      "sprint_count": 14,
      "impact_count": 6,
      "step_count_delta": 6240,
      "workload_index": 73,
      "load_balance_score": null,
      "acceleration_magnitude_summary": 4120.0,
      "data_source": "mobile_ble",
      "data_quality_status": "valid",
      "recorded_at": "2026-08-15T15:30:00.000Z",
      "created_at": "2026-08-15T15:35:00.000Z",
      "updated_at": "2026-08-15T15:35:00.000Z"
    }
  ]
}
```

When the session has no metric rows, `metrics` is `[]`. Fields are nullable per the `session_athlete_metrics` table; `distance_meters`, `duration_seconds`, `max_speed_mps`, `sprint_count`, `impact_count`, `step_count_delta`, `workload_index`, `load_balance_score`, `acceleration_magnitude_summary`, `data_source`, `data_quality_status`, and `recorded_at` may be `null`.

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 403 | `{ "error": "Forbidden" }` | `ensureSessionAccess` denied (or session not found, which collapses to 403 here). |

---

## 2. Get Athlete Session Metrics (`GET /sessions/:id/metrics/:athleteId`)

Fetches the single metric row for a specific athlete within a session.

- **Path:** `/sessions/:id/metrics/:athleteId`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none: manual access check. `ensureSessionAccess` gates the session, then `ensureAthleteAccess` gates the athlete: `coach`, `organisation_admin`, and `ssp_super_admin` pass; an athlete must own the row (`athletes.user_id === user.id`).
- **Tenant Scope:** Team (session-scoped) / User (for athlete self-access)
- **Path Parameters:**
  - `id` (`uuid`, required): Session ID.
  - `athleteId` (`uuid`, required): Athlete ID.

### Response (`200 OK`)

Returns the single `session_athlete_metrics` row (same shape as each element in section 1).

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 403 | `{ "error": "Forbidden" }` | Session access denied, or athlete access denied (non-owner athlete, or athlete not found). |
| 404 | `{ "error": "Not found" }` | No metric row matched `session_id` + `athlete_id`. |

---

## 3. Get Session Summary (`GET /sessions/:id/summary`)

Returns the squad-level rollup row for a session from the `session_summaries` table.

- **Path:** `/sessions/:id/summary`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none: manual access check via `ensureSessionAccess` (same gate as section 1).
- **Tenant Scope:** Team (session-scoped)
- **Path Parameters:**
  - `id` (`uuid`, required): Session ID.

### Response (`200 OK`)

```json
{
  "id": "22222222-3333-4444-5555-666666666666",
  "session_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
  "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
  "total_distance_meters": 118450.0,
  "athlete_count": 22,
  "average_intensity": null,
  "max_speed_mps": 9.45,
  "total_sprint_count": 218,
  "data_quality_status": "valid",
  "completed_at": "2026-08-15T15:35:00.000Z",
  "created_at": "2026-08-15T15:35:00.000Z",
  "updated_at": "2026-08-15T15:35:00.000Z"
}
```

`total_distance_meters`, `athlete_count`, `average_intensity`, `max_speed_mps`, `total_sprint_count`, `data_quality_status`, and `completed_at` are nullable.

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 403 | `{ "error": "Forbidden" }` | Session access denied (or session not found, collapses to 403). |
| 404 | `{ "error": "Not found" }` | No `session_summaries` row for the session. |

---

## 4. List Session Targets (`GET /sessions/:id/targets`)

Returns all coach-configured target rows for a session from the `session_targets` table.

- **Path:** `/sessions/:id/targets`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** `coach`, `organisation_admin`, `ssp_super_admin` (via `requireRoles`; cascade admits higher-privilege roles; `sub_coach` is **not** admitted)
- **Tenant Scope:** Team (session-scoped)
- **Path Parameters:**
  - `id` (`uuid`, required): Session ID.

### Response (`200 OK`)

```json
{
  "targets": [
    {
      "id": "33333333-4444-5555-6666-777777777777",
      "session_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
      "athlete_id": "44444444-5555-6666-7777-888888888888",
      "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
      "target_scope": "individual",
      "target_group_label": null,
      "target_distance_meters": 8000,
      "target_sprint_count": 15,
      "target_max_speed_mps": 9.0,
      "target_workload_index": 70,
      "target_duration_minutes": 80,
      "session_objective": "Repeat-sprint conditioning",
      "coach_notes": "Hold 9 m/s top end through the final block.",
      "created_at": "2026-08-15T13:10:00.000Z",
      "updated_at": "2026-08-15T13:10:00.000Z"
    }
  ]
}
```

When the session has no targets, `targets` is `[]`. `athlete_id`, `target_group_label`, all `target_*` numeric fields, `session_objective`, and `coach_notes` are nullable; `target_scope` is always present.

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 403 | `{ "error": "Forbidden" }` | Role gate failed, or `ensureSessionAccess` denied (session not found also collapses to 403 here). |

---

## 5. Create Session Target (`POST /sessions/:id/targets`)

Creates a new target row for a session. Inserts `session_id` (from the path), `athlete_id` (from the body, nullable), `organisation_id` (from the loaded session's org), and the remaining body fields.

- **Path:** `/sessions/:id/targets`
- **Method:** `POST`
- **Auth:** JWT
- **Required Roles:** `coach`, `organisation_admin`, `ssp_super_admin` (via `requireRoles`)
- **Tenant Scope:** Team (session-scoped)
- **Path Parameters:**
  - `id` (`uuid`, required): Session ID.
- **Validation:** request body via `zValidator('json', createTarget)`.

### Request Body Schema (`createTarget`)

```json
{
  "target_scope": "individual",
  "athlete_id": "44444444-5555-6666-7777-888888888888",
  "target_group_label": "Forwards",
  "target_distance_meters": 8000,
  "target_sprint_count": 15,
  "target_max_speed_mps": 9.0,
  "target_workload_index": 70,
  "target_duration_minutes": 80,
  "session_objective": "Repeat-sprint conditioning",
  "coach_notes": "Hold 9 m/s top end through the final block."
}
```

| Field | Type | Required | Constraints |
| :--- | :--- | :--- | :--- |
| `athlete_id` | `uuid` | optional | &mdash; |
| `target_scope` | `enum` | required | one of `squad`, `group`, `individual` |
| `target_group_label` | `string` | optional | max 100 chars |
| `target_distance_meters` | `integer` | optional | min 0 |
| `target_sprint_count` | `integer` | optional | min 0 |
| `target_max_speed_mps` | `number` | optional | min 0 |
| `target_workload_index` | `integer` | optional | min 0, max 100 |
| `target_duration_minutes` | `integer` | optional | min 0 |
| `session_objective` | `string` | optional | max 500 chars |
| `coach_notes` | `string` | optional | max 2000 chars |

### Response (`201 Created`)

The created `session_targets` row (same shape as each element in section 4).

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 400 | structured `@hono/zod-validator` body | Body validation failed. |
| 403 | `{ "error": "Forbidden" }` | Role gate failed, or `loadSessionAccess` denied access. |
| 404 | `{ "error": "Session not found" }` | `loadSessionAccess` could not find the session. |
| 500 | `{ "error": "<message>" }` | Insert failed. |

---

## 6. Update Session Target (`PATCH /sessions/:id/targets/:targetId`)

Updates an existing target row for a session. Verifies the target belongs to the session before applying the patch.

- **Path:** `/sessions/:id/targets/:targetId`
- **Method:** `PATCH`
- **Auth:** JWT
- **Required Roles:** `coach`, `organisation_admin`, `ssp_super_admin` (via `requireRoles`)
- **Tenant Scope:** Team (session-scoped)
- **Path Parameters:**
  - `id` (`uuid`, required): Session ID.
  - `targetId` (`uuid`, required): Target ID.
- **Validation:** request body via `zValidator('json', updateTarget)`.

### Request Body Schema (`updateTarget`)

`updateTarget = createTarget.partial()`; every field is optional, including `target_scope`.

```json
{
  "target_distance_meters": 8500,
  "target_sprint_count": 18
}
```

### Response (`200 OK`)

The updated `session_targets` row (same shape as each element in section 4).

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 400 | structured `@hono/zod-validator` body | Body validation failed. |
| 403 | `{ "error": "Forbidden" }` | Role gate failed, or `loadSessionAccess` denied access. |
| 404 | `{ "error": "Session not found" }` or `{ "error": "Target not found" }` | Session not found, or no target matched `targetId` + `session_id`. |
| 500 | `{ "error": "<message>" }` | Update failed. |
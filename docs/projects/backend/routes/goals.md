---
title: Goals API
description: Performance goal creation, progress tracking, and status updates in SSP-API (Phase 1).
outline: deep
---

# Goals API (Phase 1)

The Goals API lets coaches and admins define specific, measurable performance goals scoped to a team or an individual athlete (e.g. a top-speed target, a cumulative monthly distance, or a workload threshold) and update progress and status over time. Athletes can read their own goals; coaches and admins read and write across their organisation. Goals are tracked alongside the underlying metrics they reference, which can be compared against [Benchmarks](./benchmarks) and the athletes listed under [Athletes](./athletes).

---

## 1. List Goals (`GET /goals`)

Lists goals, optionally filtered by team or athlete. Non-super-admins are scoped to their primary organisation; pure athletes (those holding only the `athlete` role) are further narrowed to their own athlete record.

- **Path:** `/goals`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none — manual access check. Super admins see all goals; everyone else is scoped to `ctx.primaryOrganisationId`; pure athletes see only their own.
- **Tenant Scope:** Org / Self
- **Query Parameters:**
  - `team_id` (`uuid`, optional): Filter goals for a team.
  - `athlete_id` (`uuid`, optional): Filter goals for a specific athlete.

### Response (`200 OK`)

Returns `{ goals: [...] }` ordered by `created_at` descending. Each row is a full `goals` row (`select('*')`).

```json
{
  "goals": [
    {
      "id": "11111111-2222-3333-4444-555555555555",
      "organisation_id": "55555555-6666-7777-8888-999999999999",
      "team_id": null,
      "athlete_id": "44444444-5555-6666-7777-888888888888",
      "title": "Reach 9.2 m/s top speed by October",
      "description": "Sprint-focused target for the conditioning block.",
      "category": "Speed",
      "target_value": 9.2,
      "current_value": 8.92,
      "unit": "m/s",
      "deadline": "2026-09-30",
      "status": "On Track",
      "created_by_user_id": "12121212-3434-5656-7878-909090909090",
      "created_at": "2026-08-01T08:00:00.000Z",
      "updated_at": "2026-08-12T17:30:00.000Z"
    }
  ]
}
```

---

## 2. Create Goal (`POST /goals`)

Creates a new goal. The body must identify a target via `team_id` or `athlete_id`, and the `organisation_id` must match the caller's primary organisation unless the caller is a super admin.

- **Path:** `/goals`
- **Method:** `POST`
- **Auth:** JWT
- **Required Roles:** `coach`, `organisation_admin`, `ssp_super_admin`
- **Tenant Scope:** Org

### Request Body Schema (`createGoal`)

Validated with `zValidator('json', createGoal)`. The schema enforces `.refine(v => v.team_id || v.athlete_id, 'Either team_id or athlete_id is required')`.

| Field | Type | Required | Constraints |
| :--- | :--- | :--- | :--- |
| `organisation_id` | `uuid` | yes | Must match caller's org (non-super-admins). |
| `team_id` | `uuid` | no | Either `team_id` or `athlete_id` is required. |
| `athlete_id` | `uuid` | no | Either `team_id` or `athlete_id` is required. |
| `title` | `string` | yes | min 1, max 200. |
| `description` | `string` | no | max 2000. |
| `category` | `string` | no | max 100. |
| `target_value` | `number` | no | — |
| `current_value` | `number` | no | — |
| `unit` | `string` | no | max 50. |
| `deadline` | `string` (ISO date `YYYY-MM-DD`) | no | — |

```json
{
  "organisation_id": "55555555-6666-7777-8888-999999999999",
  "athlete_id": "44444444-5555-6666-7777-888888888888",
  "title": "Reach 9.2 m/s top speed by October",
  "description": "Sprint-focused target for the conditioning block.",
  "category": "Speed",
  "target_value": 9.2,
  "current_value": 8.6,
  "unit": "m/s",
  "deadline": "2026-09-30"
}
```

### Response (`201 Created`)

Returns the created `goals` row. The server injects `created_by_user_id` from the authenticated user; `created_at` / `updated_at` are set by the database.

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 400 | `@hono/zod-validator` structured body | Validation failure (incl. missing `team_id`/`athlete_id`). |
| 403 | `{ "error": "Forbidden" }` | Non-super-admin with `organisation_id` outside their org. |
| 500 | `{ "error": "<message>" }` | Insert failure. |

---

## 3. Update Goal (`PATCH /goals/:id`)

Updates progress (`current_value`) or status on an existing goal. The existing goal's `organisation_id` must match the caller's primary organisation unless the caller is a super admin.

- **Path:** `/goals/:id`
- **Method:** `PATCH`
- **Auth:** JWT
- **Required Roles:** `coach`, `organisation_admin`, `ssp_super_admin`
- **Tenant Scope:** Org
- **Path Parameters:**
  - `id` (`uuid`): The goal identifier.

### Request Body Schema (`updateGoal`)

Validated with `zValidator('json', updateGoal)`. All fields optional.

| Field | Type | Required | Constraints |
| :--- | :--- | :--- | :--- |
| `current_value` | `number` | no | — |
| `status` | `string` (enum) | no | One of `On Track`, `At Risk`, `Achieved`, `Behind`. |

```json
{
  "current_value": 9.25,
  "status": "Achieved"
}
```

### Response (`200 OK`)

Returns the updated `goals` row.

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 400 | `@hono/zod-validator` structured body | Validation failure. |
| 403 | `{ "error": "Forbidden" }` | Non-super-admin goal outside their org. |
| 404 | `{ "error": "Goal not found" }` | No goal for `id`. |
| 500 | `{ "error": "<message>" }` | Update failure. |
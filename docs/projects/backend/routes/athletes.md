---
title: Athletes API
description: Athlete profile records, sport memberships, and roster lookups in SSP-API.
outline: deep
---

# Athletes API (Phase 1)

The Athletes API manages athlete profile records (`athletes` table) and their sport memberships. Roster enrollment itself happens via the [Teams API](./teams) (`team_memberships`); per-session metrics live in [Metrics & Targets](./metrics), and rolling readiness scores in [Workload](./workload). All routes are JWT-authenticated and mounted at `/athletes` (source: `src/routes/athletes.ts`).

---

## 1. List Athletes (`GET /athletes`)

Lists athletes visible to the caller, filtered by team and/or organisation.

- **Path:** `/athletes`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** `coach`, `organisation_admin`, `ssp_super_admin` (via `requireRoles`; `coach` admits org admins and super admins via cascade)
- **Tenant Scope:** Organisation (defaults to caller's primary organisation); `team_id` narrows further
- **Query Parameters:**
  - `team_id` (`uuid`, optional): When set, filters to athletes with an active `team_memberships` row (`team_id` match, `left_at IS NULL`).
  - `organisation_id` (`uuid`, optional): Filters by `organisation_memberships` (`organisation_id` match, `left_at IS NULL`). Defaults to `ctx.primaryOrganisationId`. If supplied and the caller is not a super admin and `hasOrgAccess` fails → `403 Forbidden`.

The select projects exactly `id, user_id, first_name, last_name, squad_number, date_of_birth`. Super admins with no `organisation_id` omit the org-membership filter and return across all tenants.

### Response (`200 OK`)

```json
{
  "athletes": [
    {
      "id": "44444444-5555-6666-7777-888888888888",
      "user_id": "55555555-6666-7777-8888-999999999999",
      "first_name": "Siya",
      "last_name": "Khumalo",
      "squad_number": 10,
      "date_of_birth": "2007-04-12"
    }
  ]
}
```

### Errors

| Status | Body | Cause |
| :---: | :--- | :--- |
| `403` | `{ "error": "Forbidden" }` | Non-super-admin supplied an `organisation_id` they do not belong to. |

---

## 2. Get Athlete (`GET /athletes/:id`)

Fetches a single athlete row with its sport memberships nested.

- **Path:** `/athletes/:id`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none — manual access check
- **Tenant Scope:** Self / org / shared team
- **Path Parameters:**
  - `id` (`uuid`): Athlete ID.

Access is granted when any of the following holds: the athlete's `user_id` equals the caller's `user.id` (self); the caller is `organisation_admin` or `ssp_super_admin`; or the caller is a `coach` whose loaded `teamIds` intersect the athlete's active `team_memberships` (`left_at IS NULL`). Otherwise `403`. The select is `*, athlete_sport_memberships(*)`.

### Response (`200 OK`)

```json
{
  "id": "44444444-5555-6666-7777-888888888888",
  "user_id": "55555555-6666-7777-8888-999999999999",
  "first_name": "Siya",
  "last_name": "Khumalo",
  "squad_number": 10,
  "date_of_birth": "2007-04-12",
  "created_at": "2026-02-01T10:00:00.000Z",
  "updated_at": "2026-08-15T13:00:00.000Z",
  "athlete_sport_memberships": [
    {
      "id": "1f0f0f0e-47b1-4f67-88eb-116f1997380a",
      "athlete_id": "44444444-5555-6666-7777-888888888888",
      "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
      "sport_id": "9df0f0e0-47b1-4f67-88eb-116f1997380d",
      "team_id": "22222222-3333-4444-5555-666666666666",
      "position_label": "Flyhalf",
      "is_active": true,
      "joined_at": "2026-02-01T10:00:00.000Z",
      "left_at": null,
      "created_at": "2026-02-01T10:00:00.000Z",
      "updated_at": "2026-02-01T10:00:00.000Z"
    }
  ]
}
```

### Errors

| Status | Body | Cause |
| :---: | :--- | :--- |
| `403` | `{ "error": "Forbidden" }` | Caller is not self, not an admin, and not a coach on a shared team. |
| `404` | `{ "error": "Not found" }` | No athlete row for `id`. |

---

## 3. Create Athlete (`POST /athletes`)

Creates a new athlete record linked to an existing user account.

- **Path:** `/athletes`
- **Method:** `POST`
- **Auth:** JWT
- **Required Roles:** `organisation_admin`, `ssp_super_admin` (via `requireRoles`)
- **Tenant Scope:** Cross-tenant (no org-scope insert check; the role gate plus DB constraints are authoritative)
- **Body validation:** `zValidator('json', createAthlete)` — validation failures return `400` with the `@hono/zod-validator` structured body.

### Request Body Schema (`createAthlete`)

| Field | Type | Required | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `user_id` | `uuid` | Yes | Valid UUID | Target user account to link the athlete record to. |
| `first_name` | `string` | Yes | 1–100 chars | Given name. |
| `last_name` | `string` | Yes | 1–100 chars | Family name. |
| `squad_number` | `integer` | No | `0`–`999` | Jersey / squad number. |
| `date_of_birth` | `string` | No | ISO date `YYYY-MM-DD` | Date of birth. |

### Example Request

```json
{
  "user_id": "55555555-6666-7777-8888-999999999999",
  "first_name": "Siya",
  "last_name": "Khumalo",
  "squad_number": 10,
  "date_of_birth": "2007-04-12"
}
```

### Response (`201 Created`)

The created `athletes` row (`select *`):

```json
{
  "id": "44444444-5555-6666-7777-888888888888",
  "user_id": "55555555-6666-7777-8888-999999999999",
  "first_name": "Siya",
  "last_name": "Khumalo",
  "squad_number": 10,
  "date_of_birth": "2007-04-12",
  "created_at": "2026-08-15T13:00:00.000Z",
  "updated_at": "2026-08-15T13:00:00.000Z"
}
```

### Errors

| Status | Body | Cause |
| :---: | :--- | :--- |
| `400` | zod-validator structured body | Body failed `createAthlete` validation. |
| `403` | `{ "error": "Forbidden" }` | Caller lacks `organisation_admin` / `ssp_super_admin`. |
| `500` | `{ "error": "<message>" }` | Supabase insert error. |

---

## 4. Update Athlete (`PATCH /athletes/:id`)

Updates profile fields on an existing athlete record.

- **Path:** `/athletes/:id`
- **Method:** `PATCH`
- **Auth:** JWT
- **Required Roles:** none — manual access check (self or admin)
- **Tenant Scope:** Self / org
- **Path Parameters:**
  - `id` (`uuid`): Athlete ID.
- **Body validation:** `updateAthlete.safeParse(await c.req.json())` (manual, not `zValidator`). On failure → `400 { error: 'Invalid body', issues: [...] }`.

Access is granted when `existing.user_id === user.id` (self) or the caller holds `organisation_admin` / `ssp_super_admin`. The handler loads `athletes.user_id` first; a missing row returns `404` before the authorization check.

### Request Body Schema (`updateAthlete`)

All fields optional. At least one field should be supplied; sending `{}` is a valid (no-op) parse and results in an update that returns the unchanged row.

| Field | Type | Required | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `first_name` | `string` | No | 1–100 chars | Given name. |
| `last_name` | `string` | No | 1–100 chars | Family name. |
| `squad_number` | `integer` | No | `0`–`999` | Jersey / squad number. |

### Example Request

```json
{
  "squad_number": 12,
  "last_name": "Naidoo"
}
```

### Response (`200 OK`)

The updated `athletes` row (`select *`):

```json
{
  "id": "44444444-5555-6666-7777-888888888888",
  "user_id": "55555555-6666-7777-8888-999999999999",
  "first_name": "Siya",
  "last_name": "Naidoo",
  "squad_number": 12,
  "date_of_birth": "2007-04-12",
  "created_at": "2026-02-01T10:00:00.000Z",
  "updated_at": "2026-08-15T15:00:00.000Z"
}
```

### Errors

| Status | Body | Cause |
| :---: | :--- | :--- |
| `400` | `{ "error": "Invalid body", "issues": [...] }` | `updateAthlete.safeParse` failed. |
| `403` | `{ "error": "Forbidden" }` | Caller is not self and not an admin. |
| `404` | `{ "error": "Not found" }` | No athlete row for `id`. |
| `500` | `{ "error": "<message>" }` | Supabase update error. |

---

## Related

- [Teams & Rosters API](./teams) — enrolls athletes into squads (`team_memberships`) and lists rosters.
- [Metrics & Targets API](./metrics) — per-session `session_athlete_metrics` and `session_targets`.
- [Workload API](./workload) — `workload_readiness` trend for an athlete.
- [Architecture](../architecture) and [Auth & Security](../auth-and-security) for the JWT middleware and role cascade.
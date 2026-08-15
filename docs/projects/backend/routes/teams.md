---
title: Teams & Rosters API
description: Endpoints for squad management, roster enrollment, and member listings in SSP-API.
outline: deep
---

# Teams & Rosters API (Phase 1)

The Teams API manages squads (`teams`), active rosters (`team_memberships`), and
coach/athlete enrollment. Each team belongs to one organisation and is scoped to a
sport. Access is enforced manually per route via `hasTeamResourceAccess` (super
admin, org admin of the team's organisation, or a caller whose own team memberships
include the team). See [Auth & Security](../auth-and-security) for the role cascade
and JWT model; [Athletes](./athletes) and [Coaches](./coaches) for the referenced
profile resources.

---

## 1. List Teams (`GET /teams`)

Lists teams, scoped to the caller's primary organisation by default. Super admins
with no organisation filter receive every team across all organisations.

- **Path:** `/teams`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none — any authenticated user
- **Tenant Scope:** Org (caller's primary org) / Cross-tenant for `ssp_super_admin`
- **Query Parameters:**
  - `organisation_id` (`uuid`, optional): Filter to a specific organisation. Defaults
    to `ctx.primaryOrganisationId`. If set and the caller is not a super admin and
    `hasOrgAccess(roles, primaryOrganisationId, organisation_id)` is false → `403`.

When `organisation_id` is resolved, the query filters `eq('organisation_id', …)`.
Super admins that omit the parameter receive all teams unfiltered.

### Response (`200 OK`)

```json
{
  "teams": [
    {
      "id": "22222222-3333-4444-5555-666666666666",
      "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
      "name": "Under-19 Academy XV",
      "sport_id": "9df0f0e0-47b1-4f67-88eb-116f1997380d",
      "created_at": "2026-02-01T10:00:00.000Z",
      "updated_at": "2026-02-01T10:00:00.000Z"
    }
  ]
}
```

### Errors

| Status | Body | When |
| :---: | :--- | :--- |
| `403` | `{ "error": "Forbidden" }` | `organisation_id` set, caller is not super admin, and `hasOrgAccess` fails. |

---

## 2. Get Team (`GET /teams/:id`)

Fetches a single team row. The team is loaded first; a missing row yields `404`
before the access check runs.

- **Path:** `/teams/:id`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none — manual access check via `hasTeamResourceAccess`
  (passes for `ssp_super_admin`, `organisation_admin` of the team's organisation,
  or any caller whose `ctx.teamIds` contains `:id`)
- **Tenant Scope:** Team
- **Path Parameters:**
  - `id` (`uuid`, required): Team ID.

### Response (`200 OK`)

```json
{
  "id": "22222222-3333-4444-5555-666666666666",
  "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
  "name": "Under-19 Academy XV",
  "sport_id": "9df0f0e0-47b1-4f67-88eb-116f1997380d",
  "created_at": "2026-02-01T10:00:00.000Z",
  "updated_at": "2026-02-01T10:00:00.000Z"
}
```

### Errors

| Status | Body | When |
| :---: | :--- | :--- |
| `403` | `{ "error": "Forbidden" }` | Team exists but caller fails `hasTeamResourceAccess`. |
| `404` | `{ "error": "Not found" }` | No team row for `:id`. |

---

## 3. Get Team Roster (`GET /teams/:id/roster`)

Returns the active roster — every `team_memberships` row for the team with
`left_at IS NULL`, each nested with its full `athletes(*)` and `coaches(*)`
profile. Gated by `hasTeamResourceAccess` before any roster data is read.

- **Path:** `/teams/:id/roster`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none — manual access check via `hasTeamResourceAccess`
- **Tenant Scope:** Team
- **Path Parameters:**
  - `id` (`uuid`, required): Team ID.

### Response (`200 OK`)

```json
{
  "roster": [
    {
      "id": "33333333-4444-5555-6666-777777777777",
      "team_id": "22222222-3333-4444-5555-666666666666",
      "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
      "sport_id": "9df0f0e0-47b1-4f67-88eb-116f1997380d",
      "athlete_id": "44444444-5555-6666-7777-888888888888",
      "coach_id": null,
      "sub_coach_id": null,
      "role_in_team": "Flyhalf",
      "assigned_by_user_id": "11111111-2222-3333-4444-555555555555",
      "joined_at": "2026-02-01T10:00:00.000Z",
      "left_at": null,
      "created_at": "2026-02-01T10:00:00.000Z",
      "updated_at": "2026-02-01T10:00:00.000Z",
      "athletes": {
        "id": "44444444-5555-6666-7777-888888888888",
        "user_id": "55555555-6666-7777-8888-999999999999",
        "first_name": "Siya",
        "last_name": "Khumalo",
        "squad_number": 10,
        "date_of_birth": "2007-04-12",
        "created_at": "2026-02-01T10:00:00.000Z",
        "updated_at": "2026-02-01T10:00:00.000Z"
      },
      "coaches": null
    },
    {
      "id": "33333333-4444-5555-6666-777777777778",
      "team_id": "22222222-3333-4444-5555-666666666666",
      "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
      "sport_id": "9df0f0e0-47b1-4f67-88eb-116f1997380d",
      "athlete_id": null,
      "coach_id": "66666666-7777-8888-9999-000000000000",
      "sub_coach_id": null,
      "role_in_team": "Head Coach",
      "assigned_by_user_id": "11111111-2222-3333-4444-555555555555",
      "joined_at": "2026-02-01T10:00:00.000Z",
      "left_at": null,
      "created_at": "2026-02-01T10:00:00.000Z",
      "updated_at": "2026-02-01T10:00:00.000Z",
      "athletes": null,
      "coaches": {
        "id": "66666666-7777-8888-9999-000000000000",
        "user_id": "77777777-8888-9999-0000-111111111111",
        "first_name": "Thabo",
        "last_name": "Mokoena",
        "email": "thabo.m@sharkacademy.co.za",
        "phone": "+27821234567",
        "created_at": "2026-01-15T08:00:00.000Z",
        "updated_at": "2026-01-15T08:00:00.000Z"
      }
    }
  ]
}
```

### Errors

| Status | Body | When |
| :---: | :--- | :--- |
| `403` | `{ "error": "Forbidden" }` | Caller fails `hasTeamResourceAccess`. |

---

## 4. Create Team (`POST /teams`)

Creates a new team. The body's `organisation_id` must match the caller's primary
organisation unless the caller is a super admin.

- **Path:** `/teams`
- **Method:** `POST`
- **Auth:** JWT
- **Required Roles:** `organisation_admin`, `ssp_super_admin`
- **Tenant Scope:** Org (must match caller's primary org unless super admin)
- **Request Body:** validated by `zValidator('json', createTeam)`

### Request Body Schema (`createTeam`)

| Field | Type | Required | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `organisation_id` | `uuid` | Yes | Valid UUID | Owning organisation. Non-super admins must pass `hasOrgAccess(roles, primaryOrganisationId, organisation_id)`. |
| `sport_id` | `uuid` | Yes | Valid UUID | Sport classification for the team. |
| `name` | `string` | Yes | 1–200 chars | Name of the team/squad. |

### Example Request

```json
{
  "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
  "sport_id": "9df0f0e0-47b1-4f67-88eb-116f1997380d",
  "name": "Senior Men 1st XV"
}
```

### Response (`201 Created`)

```json
{
  "id": "66666666-7777-8888-9999-000000000000",
  "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
  "sport_id": "9df0f0e0-47b1-4f67-88eb-116f1997380d",
  "name": "Senior Men 1st XV",
  "created_at": "2026-08-15T15:00:00.000Z",
  "updated_at": "2026-08-15T15:00:00.000Z"
}
```

### Errors

| Status | Body | When |
| :---: | :--- | :--- |
| `400` | `@hono/zod-validator` body | `createTeam` validation fails. |
| `403` | `{ "error": "Forbidden" }` | Caller is not a super admin and `hasOrgAccess` fails for `body.organisation_id`. |
| `500` | `{ "error": "<message>" }` | Insert fails (returned PostgREST error message). |

---

## 5. Add Team Member (`POST /teams/:id/members`)

Enrolls an athlete or assigns a coach to a team's active roster. The caller must
have team resource access; the team's `organisation_id` and `sport_id` are copied
onto the membership row (sport_id is nullable and passed through as-is).

- **Path:** `/teams/:id/members`
- **Method:** `POST`
- **Auth:** JWT
- **Required Roles:** `organisation_admin`, `ssp_super_admin`
- **Tenant Scope:** Team (must pass `hasTeamResourceAccess(user, :id)`)
- **Path Parameters:**
  - `id` (`uuid`, required): Team ID to enroll into.
- **Request Body:** validated by `zValidator('json', addTeamMember)`

### Request Body Schema (`addTeamMember`)

| Field | Type | Required | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `athlete_id` | `uuid` | Conditional | Valid UUID | Athlete to enroll. At least one of `athlete_id` or `coach_id` is required (`.refine`). |
| `coach_id` | `uuid` | Conditional | Valid UUID | Coach to assign. At least one of `athlete_id` or `coach_id` is required (`.refine`). |
| `role_in_team` | `string` | No | Max 100 chars | Free-text role label (e.g. `Flyhalf`, `Head Coach`). |

### Example Request

```json
{
  "athlete_id": "44444444-5555-6666-7777-888888888888",
  "role_in_team": "Flyhalf"
}
```

### Response (`201 Created`)

The created `team_memberships` row. The handler inserts `team_id`, `organisation_id`
and `sport_id` (copied from the team; `sport_id` is nullable), `athlete_id`,
`coach_id`, `role_in_team`, and `assigned_by_user_id` (the caller's user ID).

```json
{
  "id": "77777777-8888-9999-0000-111111111111",
  "team_id": "22222222-3333-4444-5555-666666666666",
  "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
  "sport_id": "9df0f0e0-47b1-4f67-88eb-116f1997380d",
  "athlete_id": "44444444-5555-6666-7777-888888888888",
  "coach_id": null,
  "sub_coach_id": null,
  "role_in_team": "Flyhalf",
  "assigned_by_user_id": "11111111-2222-3333-4444-555555555555",
  "joined_at": "2026-08-15T15:10:00.000Z",
  "left_at": null,
  "created_at": "2026-08-15T15:10:00.000Z",
  "updated_at": "2026-08-15T15:10:00.000Z"
}
```

### Errors

| Status | Body | When |
| :---: | :--- | :--- |
| `400` | `@hono/zod-validator` body | `addTeamMember` validation fails (including the `athlete_id`/`coach_id` refine). |
| `403` | `{ "error": "Forbidden" }` | Caller fails `hasTeamResourceAccess` for `:id`. |
| `404` | `{ "error": "Team not found" }` | Access passed but no `teams` row exists for `:id` (organisation/sport lookup returns null). |
| `500` | `{ "error": "<message>" }` | Insert fails (returned PostgREST error message). |
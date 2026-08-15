---
title: Coaches API
description: Coach roster management in SSP-API.
outline: deep
---

# Coaches API (Phase 1)

The Coaches API manages coach profiles within an organisation. A coach row is the
roster record linking a Supabase user to coaching staff membership; organisational
scope is resolved through `organisation_memberships` rather than a column on
`coaches`. See [Teams](./teams) for team assignment and [Athletes](./athletes) for
the athlete roster.

Source: `src/routes/coaches.ts`, schema `createCoach` in `src/schemas/athlete.ts`.

---

## 1. List Coaches (`GET /coaches`)

Lists coaches in the caller's organisation. When `organisation_id` is supplied (or
inferred from the caller's primary organisation), the result is restricted to
coaches with an active `organisation_memberships` row
(`left_at` is null) for that organisation.

- **Path:** `/coaches`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** `organisation_admin`, `ssp_super_admin`
- **Tenant Scope:** Org
- **Query Parameters:**
  - `organisation_id` (`uuid`, optional): Target organisation. Defaults to
    `ctx.primaryOrganisationId`. If set and the caller is neither a super admin
    nor a member of that organisation (`!hasOrgAccess`), the request is rejected
    with `403`.

### Response (`200 OK`)

Returns `{ coaches: [...] }` where each row is the full `coaches` record
(`select('*')`): `id`, `user_id`, `first_name`, `last_name`, `phone`, `email`,
`created_at`, `updated_at`.

```json
{
  "coaches": [
    {
      "id": "77777777-8888-9999-0000-222222222222",
      "user_id": "11111111-2222-3333-4444-555555555555",
      "first_name": "Dave",
      "last_name": "Williams",
      "phone": "+27 82 000 0000",
      "email": "coach.dave@sharkacademy.co.za",
      "created_at": "2026-01-20T09:00:00.000Z",
      "updated_at": "2026-01-20T09:00:00.000Z"
    }
  ]
}
```

### Errors

| Status | Body | Condition |
| :---: | :--- | :--- |
| 403 | `{ "error": "Forbidden" }` | `organisation_id` set and caller lacks org access. |

---

## 2. Create Coach (`POST /coaches`)

Creates a new coach row linked to an existing user. There is no org-scope check
on insert — authorisation relies on the `organisation_admin` / `ssp_super_admin`
role gate and the database. Organisational membership is assigned separately via
`organisation_memberships`.

- **Path:** `/coaches`
- **Method:** `POST`
- **Auth:** JWT
- **Required Roles:** `organisation_admin`, `ssp_super_admin`
- **Tenant Scope:** Cross-tenant (no org-scope enforcement on insert)
- **Body:** validated by `zValidator('json', createCoach)`

### Request Body Schema (`createCoach`)

| Field | Type | Required | Constraints |
| :--- | :--- | :---: | :--- |
| `user_id` | `uuid` | Yes | Target user account ID. |
| `first_name` | `string` | Yes | `min(1)`, `max(100)`. |
| `last_name` | `string` | Yes | `min(1)`, `max(100)`. |
| `phone` | `string` | No | `max(50)`. |
| `email` | `string` | No | Valid email (`z.string().email()`). |

### Example Request

```json
{
  "user_id": "11111111-2222-3333-4444-555555555555",
  "first_name": "Dave",
  "last_name": "Williams",
  "phone": "+27 82 000 0000",
  "email": "coach.dave@sharkacademy.co.za"
}
```

### Response (`201 Created`)

Returns the created `coaches` row (`insert(body).select().single()`).

```json
{
  "id": "77777777-8888-9999-0000-222222222222",
  "user_id": "11111111-2222-3333-4444-555555555555",
  "first_name": "Dave",
  "last_name": "Williams",
  "phone": "+27 82 000 0000",
  "email": "coach.dave@sharkacademy.co.za",
  "created_at": "2026-08-15T15:30:00.000Z",
  "updated_at": "2026-08-15T15:30:00.000Z"
}
```

### Errors

| Status | Body | Condition |
| :---: | :--- | :--- |
| 400 | structured zValidator body | Invalid request body (schema validation). |
| 500 | `{ "error": "<message>" }` | Insert failure (returned from Supabase). |
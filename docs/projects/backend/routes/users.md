---
title: Users & Profile API
description: Endpoints for caller identity, personal profile updates, and active roles in SSP-API.
outline: deep
---

# Users & Profile API (Phase 1)

The Users API exposes the authenticated caller's own identity, profile, and active roles. It is mounted at the root (`/`) in `src/app.ts`, so its only paths are `/me` and `PATCH /me`; there is no collection route. Both handlers read and write the `users` table keyed by the JWT subject (`user.id`); no role gate is applied, so any valid JWT holder may read or patch their own row. Roles are merged into the response from `user.roles` (loaded from the DB on every request; see [Auth & Security](../auth-and-security)).

Source: `src/routes/users.ts`.

---

## 1. Get Current User (`GET /me`)

Returns the identity, profile details, primary organisation, active flag, and active roles for the authenticated user.

- **Path:** `/me`
- **Method:** `GET`
- **Auth:** JWT (Supabase access token verified by the `auth` middleware)
- **Required Roles:** none (any authenticated user)
- **Tenant Scope:** Self (the row is selected by `user.id`)

### Response (`200 OK`)

The handler selects `id, email, phone, full_name, avatar_url, primary_organisation_id, is_active` from the `users` table (`maybeSingle`) and merges `user.roles`. It ignores the returned query error, so either a missing row or a Supabase read failure can produce `{ roles: [...] }` with HTTP 200.

```json
{
  "id": "11111111-2222-3333-4444-555555555555",
  "email": "coach.dave@sharkacademy.co.za",
  "phone": "+27821234567",
  "full_name": "Dave Williams",
  "avatar_url": "https://storage.ssp.izandla.co.za/avatars/coach_dave.jpg",
  "primary_organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
  "is_active": true,
  "roles": [
    "coach",
    "athlete"
  ]
}
```

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 401 | `{ "error": "Missing or malformed Authorization header" }` / `{ "error": "Invalid or expired token" }` | Bad or missing JWT. |

---

## 2. Update Profile (`PATCH /me`)

Updates editable personal profile fields for the authenticated caller. Only the three fields below are writable through this route; `email`, `primary_organisation_id`, `is_active`, and `id` cannot be changed here.

- **Path:** `/me`
- **Method:** `PATCH`
- **Auth:** JWT
- **Required Roles:** none (any authenticated user)
- **Tenant Scope:** Self (the row is updated by `user.id`)

### Request Body Schema (`patchMe`)

Defined locally in `src/routes/users.ts` (not in `src/schemas/`). Validated with `safeParse`, not `zValidator('json', …)`, so a validation failure returns a custom `400 { error: 'Invalid body', issues: [...] }` envelope rather than the `@hono/zod-validator` default.

| Field | Type | Required | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `full_name` | `string` | No | Max 200 chars | Display name. |
| `avatar_url` | `string` | No | Valid URL (`z.string().url()`), max 500 chars | Profile picture URL. |
| `phone` | `string` | No | Max 50 chars | Contact number. |

All fields are optional; the schema is a plain `z.object({ … }).partial()`-equivalent (each property declared `.optional()`). An empty object `{}` is valid and performs a no-op update.

### Example Request

```json
{
  "full_name": "Dave J. Williams",
  "phone": "+27829876543"
}
```

### Response (`200 OK`)

The handler runs `db().from('users').update(parsed.data).eq('id', user.id).select('id, email, phone, full_name, avatar_url, primary_organisation_id').single()` and merges `user.roles`. The PATCH response omits `is_active`. It also ignores the returned Supabase `error`; because object-spreading null yields no fields, a failed/no-row update can return `200 { roles: [...] }` rather than 500.

```json
{
  "id": "11111111-2222-3333-4444-555555555555",
  "email": "coach.dave@sharkacademy.co.za",
  "phone": "+27829876543",
  "full_name": "Dave J. Williams",
  "avatar_url": "https://storage.ssp.izandla.co.za/avatars/coach_dave.jpg",
  "primary_organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
  "roles": [
    "coach",
    "athlete"
  ]
}
```

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 400 | `{ "error": "Invalid body", "issues": [...] }` | Body failed `patchMe.safeParse` (bad URL, field too long, wrong type). |
| 401 | `{ "error": "Missing or malformed Authorization header" }` / `{ "error": "Invalid or expired token" }` | Bad or missing JWT. |
| 200 | `{ "roles": [...] }` | Current failure mode when Supabase returns `data: null` plus an ignored query error. |

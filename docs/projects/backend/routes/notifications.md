---
title: Notifications API
description: In-app notification inbox and read-receipt management for authenticated users in SSP-API (Phase 1).
outline: deep
---

# Notifications API (Phase 1)

The Notifications API delivers each user a personal inbox of in-app alerts and lets them mark items as read. Both routes are JWT-authenticated with no role gate; every notification is scoped to its `recipient_user_id`, so a caller only sees or touches their own rows. See [Auth & Security](../auth-and-security) for how the `auth` middleware verifies the Supabase JWT and loads DB roles on every request.

Routes are defined in `src/routes/notifications.ts` and mounted at `/notifications` in `app.ts`.

---

## 1. List Notifications (`GET /notifications`)

Returns the authenticated caller's notifications, newest first.

- **Path:** `/notifications`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none (any authenticated user, recipient-scoped)
- **Tenant Scope:** Self (`recipient_user_id = user.id`)
- **Query Parameters:**
  - `unread` (`string`, optional): when set to the literal `'true'`, filters to unread rows via `is('read_at', null)`. Any other value (or omitting the param) returns all notifications, read and unread.

The query is `select('*')` from `notifications` filtered `eq('recipient_user_id', user.id)` with an optional `is('read_at', null)`, ordered `created_at desc`.

### Response (`200 OK`)

```json
{
  "notifications": [
    {
      "id": "11111111-2222-3333-4444-555555555555",
      "recipient_user_id": "55555555-6666-7777-8888-999999999999",
      "organisation_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "notification_type": "session_scheduled",
      "title": "New Training Session Scheduled",
      "body": "Coach Dave scheduled 'Tactical Scrimmage' for tomorrow at 08:30.",
      "related_entity_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
      "related_entity_type": "session",
      "read_at": null,
      "created_at": "2026-08-15T16:00:00.000Z",
      "updated_at": null
    }
  ]
}
```

The array is empty (`[]`) when the caller has no notifications. All `notifications` table columns are returned: `id`, `recipient_user_id`, `organisation_id`, `notification_type`, `title`, `body` (nullable), `related_entity_id` (nullable), `related_entity_type` (nullable), `read_at` (nullable), `created_at` (nullable), `updated_at` (nullable).

### Errors

| Status | When |
| :--- | :--- |
| 401 | Missing/invalid JWT (from `auth` middleware). |

---

## 2. Mark Notification as Read (`PATCH /notifications/:id/read`)

Records the `read_at` timestamp on a notification owned by the caller.

- **Path:** `/notifications/:id/read`
- **Method:** `PATCH`
- **Auth:** JWT
- **Required Roles:** none (any authenticated user; must be the recipient)
- **Tenant Scope:** Self (`recipient_user_id = user.id`)
- **Path Parameters:**
  - `id` (`uuid`, required): the notification to mark read.

Performs `update({ read_at: new Date().toISOString() })` on `notifications` filtered by both `eq('id', id)` and `eq('recipient_user_id', user.id)` via `.select().maybeSingle()`. Because the recipient filter is part of the update predicate, a notification belonging to another user matches no row and returns `404`.

### Response (`200 OK`)

Returns the full updated `notifications` row (same columns as the list endpoint):

```json
{
  "id": "11111111-2222-3333-4444-555555555555",
  "recipient_user_id": "55555555-6666-7777-8888-999999999999",
  "organisation_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "notification_type": "session_scheduled",
  "title": "New Training Session Scheduled",
  "body": "Coach Dave scheduled 'Tactical Scrimmage' for tomorrow at 08:30.",
  "related_entity_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
  "related_entity_type": "session",
  "read_at": "2026-08-15T16:05:00.000Z",
  "created_at": "2026-08-15T16:00:00.000Z",
  "updated_at": null
}
```

### Errors

| Status | Body | When |
| :--- | :--- | :--- |
| 401 | `{ error: "..." }` | Missing/invalid JWT (from `auth` middleware). |
| 404 | `{ error: "Not found" }` | No row matched: either the `id` does not exist or it belongs to another user (recipient scope). |
| 500 | `{ error: "<message>" }` | Supabase returned an error from the update. |
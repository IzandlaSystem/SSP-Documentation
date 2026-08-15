---
title: API Route Directory & Reference
description: Master endpoint index, HTTP methods, auth modes, required roles, request body schemas, success status codes, source files, and phases for every SSP-API route handler.
outline: deep
---

# API Route Directory & Reference

This **master route catalog** covers **SSP-API**, the Hono + Zod + Supabase gateway configured for Vercel Functions. Every route handler registered in `src/app.ts` is listed below, grouped by phase and resource. The full mounted path is shown even for handlers that live in root-mounted routers (`metrics`, `workload`, `analytics`, `ingest`) whose real paths begin with `/sessions/:id/...` or `/athletes/:id/...`.

See [Architecture](./architecture) for topology and [Auth & Security](./auth-and-security) for the JWT/role model. The tables below link each endpoint to its per-resource route page.

::: warning Authorization baseline
The tables below describe the checks the handlers actually perform; they are not a claim that tenant isolation is complete. See [Known source-level authorization gaps](./auth-and-security#known-source-level-authorization-gaps) for missing-primary-org fail-open queries, cross-tenant organisation-admin paths, and reporter-trusted firmware confirmation.
:::

---

## Auth modes

| Label | Meaning |
| :--- | :--- |
| **Public** | No authentication. Only `GET /health`. |
| **JWT** | Supabase-issued access token verified by the `auth` middleware. `Authorization: Bearer <token>`. Roles are loaded from the database (`user_roles` joined to `roles(name)` with `revoked_at IS NULL`) on every request, never from JWT `app_metadata.roles`. Fail-closed to `roles: []` on DB error (→ 403 on role-gated routes). |
| **CRON_SECRET** | Shared secret for `/internal/parse/:sessionId` and `/internal/parse/pending`. Sent via the `x-cron-secret` header **or** `Authorization: Bearer <secret>`. |
| **FIRMWARE_RELEASE_SECRET** | Shared secret for `POST /internal/firmware-releases`. Sent via the `x-cron-secret` header **or** `Authorization: Bearer <secret>`. The secret is selected per request by checking `c.req.path.endsWith('/firmware-releases')`. |

## Role cascade

`SSP_ROLES = ['ssp_super_admin', 'organisation_admin', 'coach', 'sub_coach', 'athlete']`.

`requireRoles(...required)` admits a caller if `hasAnyRole(user.roles, required)` returns true, using the cascade helpers:

- `ssp_super_admin > organisation_admin > coach > sub_coach > athlete` (lower `ROLE_HIERARCHY` number = higher privilege).
- `requireRoles('coach')` admits `coach`, `organisation_admin`, and `ssp_super_admin`, **not** `sub_coach` (sub_coach is lower privilege and does not cascade up).
- `requireRoles('sub_coach')` admits everyone except `athlete`.
- **`isAthlete` does NOT cascade.** `requireRoles('athlete')` admits only literal `athlete` role holders. A coach is not an athlete by this check. Several routes list `'athlete'` alongside `'coach'` explicitly (session start/pause/stop, device pair) for this reason.

Rows marked **"none (manual)"** under Required roles do not call `requireRoles`; access is decided inside the handler via `loadSessionAccess`, `hasTeamResourceAccess`, `hasOrgAccess`, `canSeeAthlete`, or an ownership check. The manual rule is given in the **Notes** column.

## Mount prefixes

The mount list below is confirmed verbatim from `src/app.ts`. A common doc-location mistake is assuming `/sessions/:id/metrics` lives in `sessions.ts`; it lives in the root-mounted `metrics.ts` router.

| Router | Mount | Source file | Real path prefix |
| :--- | :--- | :--- | :--- |
| `users` | `/` | `routes/users.ts` | `/me` |
| `organisations` | `/organisations` | `routes/organisations.ts` | `/organisations` |
| `teams` | `/teams` | `routes/teams.ts` | `/teams` |
| `athletes` | `/athletes` | `routes/athletes.ts` | `/athletes` |
| `coaches` | `/coaches` | `routes/coaches.ts` | `/coaches` |
| `devices` | `/devices` | `routes/devices.ts` | `/devices` |
| `firmwareReleases` | `/firmware-releases` | `routes/firmware-releases.ts` | `/firmware-releases` |
| `sessions` | `/sessions` | `routes/sessions.ts` | `/sessions` |
| `metrics` | `/` (root) | `routes/metrics.ts` | `/sessions/:id/metrics`, `/sessions/:id/metrics/:athleteId`, `/sessions/:id/summary`, `/sessions/:id/targets` |
| `workload` | `/` (root) | `routes/workload.ts` | `/athletes/:id/workload` |
| `goals` | `/goals` | `routes/goals.ts` | `/goals` |
| `benchmarks` | `/benchmarks` | `routes/benchmarks.ts` | `/benchmarks` |
| `notifications` | `/notifications` | `routes/notifications.ts` | `/notifications` |
| `analytics` | `/` (root) | `routes/analytics.ts` | `/teams/:id/analytics`, `/athletes/:id/analytics` |
| `ingest` | `/` (root) | `routes/ingest.ts` | `/sessions/:id/ingest-url`, `/sessions/:id/complete`, `/sessions/:id/sync`, `/sessions/:id/telemetry` |
| `internal` | `/internal` | `routes/internal.ts` | `/internal/firmware-releases`, `/internal/parse/:sessionId`, `/internal/parse/pending` |
| standalone | — | `src/app.ts` | `GET /health` |

`/health` and `/internal` are mounted **before** the JWT routers so wildcard auth middleware can never intercept them.

---

## Validation note

- Only request **bodies** use `zValidator('json', schema)`. Validation failures from `@hono/zod-validator` return `400` with a structured body automatically.
- **Query strings are parsed manually.** `GET /sessions/:id/telemetry` uses `safeParse` and returns `400 { error: 'Invalid query', issues: [...] }`. `GET /sessions` instead calls `sessionListQuery.parse(...)`; invalid values throw and currently reach `onError` as a `500`. Other query parameters are passed directly to fluent filters without Zod validation. There is no `zValidator('query', …)`, `'param'`, or `'header'` usage.
- Several handlers validate the body with `safeParse` instead of `zValidator` (e.g. `PATCH /me`, `POST /sessions/:id/ingest-url`, `POST /sessions/:id/complete`, `PATCH /athletes/:id`). These return `400 { error: 'Invalid body', issues: [...] }` rather than the `@hono/zod-validator` default 400 body.
- Handlers with no body schema column (e.g. `POST /sessions/:id/pause`, `POST /devices/:id/unpair`, all `GET`/`DELETE` routes) do not validate a request body.

---

## Status codes

| Code | Meaning |
| :--- | :--- |
| `200` | Success (GET, PATCH, DELETE, idempotent POST-complete). |
| `201` | Resource created (POST). |
| `400` | Validation failure: either `@hono/zod-validator` structured body (zValidator routes) or manual `400 { error: 'Invalid body' | 'Invalid query', issues: [...] }` (safeParse routes). |
| `401` | Auth failure: missing/malformed `Authorization` header, invalid/expired token, missing subject, or missing/wrong shared secret for `/internal/*`. |
| `403` | Forbidden: `requireRoles` denied, or a manual access check (`hasOrgAccess`, `hasTeamResourceAccess`, `loadSessionAccess`, `ensureSessionAccess`, ownership) failed. Also returned when `c.get('user')` is missing (`requireRoles` → `401 { error: 'Not authenticated' }` is treated as 401, but some handlers return 403 for not-authenticated in manual checks). |
| `404` | Not found: resource row missing, or no rows matched a scoped query (e.g. notification scoped to `recipient_user_id`). |
| `409` | Conflict: firmware release incompatible with device (`POST /devices/:id/firmware-update/status`), or sync record has no Storage object (`POST /sessions/:id/complete`). |
| `500` | Thrown/unhandled error or a DB/Storage failure a handler explicitly maps to 500. Supabase returns `{ data, error }`; handlers that ignore `error` may instead return empty/404/partial success. |

### Error envelope shapes

- **Unhandled 500** (from `onError`): `{ error: string }`; the message is `err.message` if `Error` instance, else `'Internal server error'`.
- **zValidator 400** (automatic): structured body from `@hono/zod-validator` using the validator's default shape.
- **Manual safeParse 400**:
  - Body: `400 { error: 'Invalid body', issues: [{ path, message }, ...] }` (e.g. `PATCH /me`, `POST /sessions/:id/ingest-url`, `POST /sessions/:id/complete`, `PATCH /athletes/:id`).
  - Query: `400 { error: 'Invalid query', issues: [...] }` (e.g. `GET /sessions/:id/telemetry`).
- **Auth 401**: `{ error: 'Missing or malformed Authorization header' }` | `{ error: 'Invalid or expired token' }` | `{ error: 'Token missing subject' }` | (internal) `{ error: 'Unauthorized' }`.
- **Role 403**: `{ error: 'Forbidden' }` (from `requireRoles`); manual checks return `{ error: 'Forbidden' }` or a contextual message (e.g. `'User has no primary organisation'`).

---

# Phase 1 — Core routes

The identity, roster, device, session, metrics, workload, goal, benchmark, notification, and analytics handlers.

## Health

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | none | — | `200` | `src/app.ts` | 1 | Returns `{ ok: true }`. Standalone handler mounted before auth routers. |

[Deployment and runtime details](./architecture#deployment--environment)

---

## Users & Profile (`/me`)

[Details](./routes/users)

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/me` | JWT | none | — | `200` | `routes/users.ts` | 1 | Returns `{ ...usersRow, roles }` (`id, email, phone, full_name, avatar_url, primary_organisation_id, is_active` + merged `user.roles`). |
| `PATCH` | `/me` | JWT | none | `patchMe` (safeParse) | `200` | `routes/users.ts` | 1 | `full_name? max200`, `avatar_url? url max500`, `phone? max50`. Manual `safeParse` → `400 { error:'Invalid body', issues }`. |

---

## Organisations (`/organisations`)

[Details](./routes/organisations)

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/organisations` | JWT | `ssp_super_admin` | — | `200` | `routes/organisations.ts` | 1 | Cross-tenant list; `requireRoles('ssp_super_admin')`. |
| `GET` | `/organisations/:id` | JWT | none (manual) | — | `200` | `routes/organisations.ts` | 1 | Super admin **or** `ctx.primaryOrganisationId === id`. 403 Forbidden / 404 Not found. |

---

## Teams (`/teams`)

[Details](./routes/teams)

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/teams` | JWT | none (manual) | — | `200` | `routes/teams.ts` | 1 | Query `organisation_id` (defaults to `ctx.primaryOrganisationId`). Non-super-admin with no primary org and no explicit filter reaches an unscoped query. |
| `GET` | `/teams/:id` | JWT | none (manual) | — | `200` | `routes/teams.ts` | 1 | `hasTeamResourceAccess(user, id)` gate. 403 / 404. |
| `GET` | `/teams/:id/roster` | JWT | none (manual) | — | `200` | `routes/teams.ts` | 1 | `hasTeamResourceAccess` gate. Returns `team_memberships` joined to `athletes(*)`, `coaches(*)` where `left_at is null`. |
| `POST` | `/teams` | JWT | `organisation_admin`, `ssp_super_admin` | `createTeam` (zValidator) | `201` | `routes/teams.ts` | 1 | Non-super-admin requires `hasOrgAccess(..., body.organisation_id)`. |
| `POST` | `/teams/:id/members` | JWT | `organisation_admin`, `ssp_super_admin` | `addTeamMember` (zValidator) | `201` | `routes/teams.ts` | 1 | `hasTeamResourceAccess(user, teamId)` gate. 404 `'Team not found'`. Inserts `team_id, organisation_id, sport_id (from team, nullable), athlete_id, coach_id, role_in_team, assigned_by_user_id`. |

---

## Athletes (`/athletes`)

[Details](./routes/athletes)

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/athletes` | JWT | `coach`, `organisation_admin`, `ssp_super_admin` | — | `200` | `routes/athletes.ts` | 1 | Query `team_id`, `organisation_id`; no-primary-org callers can reach an unscoped query, and `team_id` is not separately authorized. |
| `GET` | `/athletes/:id` | JWT | none (manual) | — | `200` | `routes/athletes.ts` | 1 | Self, any literal org/super admin, or coach in a shared team. Organisation admins are not target-org checked. |
| `POST` | `/athletes` | JWT | `organisation_admin`, `ssp_super_admin` | `createAthlete` (zValidator) | `201` | `routes/athletes.ts` | 1 | No org-scope check on insert (relies on role gate + DB). |
| `PATCH` | `/athletes/:id` | JWT | none (manual) | `updateAthlete` (safeParse) | `200` | `routes/athletes.ts` | 1 | Self or any literal org/super admin; organisation admins are not target-org checked. |

---

## Coaches (`/coaches`)

[Details](./routes/coaches)

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/coaches` | JWT | `organisation_admin`, `ssp_super_admin` | — | `200` | `routes/coaches.ts` | 1 | Query `organisation_id` (defaults to `ctx.primaryOrganisationId`). `!hasOrgAccess` → 403. Filters via `organisation_memberships.coach_id` where `left_at is null`. |
| `POST` | `/coaches` | JWT | `organisation_admin`, `ssp_super_admin` | `createCoach` (zValidator) | `201` | `routes/coaches.ts` | 1 | No org-scope check on insert. |

---

## Devices (`/devices`)

[Details](./routes/devices). Module constant: `FIRMWARE_DOWNLOAD_TTL_SECONDS = 15 * 60` (900s).

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/devices` | JWT | `coach`, `organisation_admin`, `ssp_super_admin` | — | `200` | `routes/devices.ts` | 1 | Query `organisation_id` (defaults to `ctx.primaryOrganisationId`). Org-scope check; `eq('organisation_id', …)`. |
| `GET` | `/devices/:id` | JWT | none (manual) | — | `200` | `routes/devices.ts` | 1 | `hasOrgAccess(roles, ctx.primaryOrganisationId, data.organisation_id)`. Selects `*, device_assignments(*), pairing_states(*)`. 403 / 404. |
| `POST` | `/devices` | JWT | `organisation_admin`, `ssp_super_admin` | `createDevice` (zValidator) | `201` | `routes/devices.ts` | 1 | Org-scope check against `body.organisation_id`. |
| `PATCH` | `/devices/:id` | JWT | `organisation_admin`, `ssp_super_admin` | `updateDevice` (zValidator) | `200` | `routes/devices.ts` | 1 | Loads device `organisation_id`, checks `hasOrgAccess`. 403 / 404. |
| `POST` | `/devices/:id/pair` | JWT | `athlete`, `coach`, `organisation_admin`, `ssp_super_admin` | `pairDevice` (zValidator) | `201` | `routes/devices.ts` | 1 | Revokes prior active pairing, inserts new `pairing_states` (`bond_status:'bonded'`, `paired_user_id: user.id`). 404 if device missing. |
| `POST` | `/devices/:id/unpair` | JWT | none (manual) | — | `200` | `routes/devices.ts` | 1 | No `requireRoles`; any authenticated user with org access can unpair. Returns `{ ok: true }`. |
| `POST` | `/devices/:id/assign` | JWT | `organisation_admin`, `ssp_super_admin` | `assignDevice` (zValidator) | `201` | `routes/devices.ts` | 1 | Inserts `device_id, athlete_id, organisation_id, assigned_by_user_id`. 404 if device missing. |
| `DELETE` | `/devices/:id/assign` | JWT | `organisation_admin`, `ssp_super_admin` | — | `200` | `routes/devices.ts` | 1 | Sets `unassigned_at` on current active assignment. Returns `{ ok: true, unassigned: <row|null> }`. |
| `GET` | `/devices/:id/firmware-update` | JWT | none (manual) | — | `200` | `routes/devices.ts` | 3 | Server offer contract; no current mobile caller/DFU transport. Selects by exact compatibility fields and `version_code desc`; signed URL TTL 15 minutes. |
| `POST` | `/devices/:id/firmware-update/status` | JWT | none (manual) | `reportFirmwareUpdate` (zValidator) | `200` | `routes/devices.ts` | 3 | Reporter-trusted progress. `confirmed` updates stored device version without independent boot/image attestation; no current mobile caller. |

---

## Sessions (`/sessions`)

[Details](./routes/sessions)

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/sessions` | JWT | none (manual filter) | — | `200` | `routes/sessions.ts` | 1 | Query via `sessionListQuery.parse`; invalid values currently become 500. Visibility filtering happens **after** DB `range`, so a page can contain fewer than `limit` visible rows and later visible rows can be skipped. |
| `GET` | `/sessions/:id` | JWT | none (manual: `loadSessionAccess`) | — | `200` | `routes/sessions.ts` | 1 | Selects `*, session_participants(*), session_summaries(*)`. 403 / 404. |
| `POST` | `/sessions` | JWT | `coach`, `organisation_admin`, `ssp_super_admin` | `createSession` (zValidator) | `201` | `routes/sessions.ts` | 1 | `canAccessTeam(user, body.team_id)`. Requires `ctx.primaryOrganisationId` (else 400 `'User has no primary organisation'`). Inserts `created_by_user_id, organisation_id, status:'ready', sync_status:'pending'`. |
| `PATCH` | `/sessions/:id` | JWT | `coach`, `organisation_admin`, `ssp_super_admin` | `updateSession` (zValidator) | `200` | `routes/sessions.ts` | 1 | `loadSessionAccess` gate. 403 / 404. |
| `POST` | `/sessions/:id/start` | JWT | `athlete`, `coach`, `organisation_admin`, `ssp_super_admin` | `startSession` (zValidator) | `200` | `routes/sessions.ts` | 1 | `loadSessionAccess` gate. Sets `status:'recording'`, `actual_start_at: now`, `firmware_session_id`, `firmware_sport_code`. Athletes can start. |
| `POST` | `/sessions/:id/pause` | JWT | `athlete`, `coach`, `organisation_admin`, `ssp_super_admin` | — | `200` | `routes/sessions.ts` | 1 | No body validator. Sets `status:'paused'`. |
| `POST` | `/sessions/:id/stop` | JWT | `athlete`, `coach`, `organisation_admin`, `ssp_super_admin` | `stopSession` (zValidator) | `200` | `routes/sessions.ts` | 1 | Sets `status:'ended'`, `actual_end_at`, `data_point_count`. |
| `POST` | `/sessions/:id/participants` | JWT | `coach`, `organisation_admin`, `ssp_super_admin` | `addParticipant` (zValidator) | `201` | `routes/sessions.ts` | 1 | `loadSessionAccess` gate. Inserts `session_participants` (`status:'enrolled'`, `added_by_user_id`, `organisation_id` from session access). |
| `DELETE` | `/sessions/:id/participants/:athleteId` | JWT | `coach`, `organisation_admin`, `ssp_super_admin` | — | `200` | `routes/sessions.ts` | 1 | `loadSessionAccess` gate. Returns `{ ok: true }`. |
| `DELETE` | `/sessions/:id` | JWT | none (manual) | — | `200` | `routes/sessions.ts` | 1 | Creator or any literal organisation/super admin. No `loadSessionAccess` or target-org comparison. |

---

## Metrics, Summaries & Targets (`/sessions/:id/...`)

[Details](./routes/metrics). Handlers live in `routes/metrics.ts`, which is **root-mounted** so paths begin with `/sessions/:id/...`.

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/sessions/:id/metrics` | JWT | none (manual: `ensureSessionAccess`) | — | `200` | `routes/metrics.ts` | 1 | Returns `{ metrics: [...] }` from `session_athlete_metrics` `eq('session_id', id)`. 403 if denied. |
| `GET` | `/sessions/:id/metrics/:athleteId` | JWT | none (manual) | — | `200` | `routes/metrics.ts` | 1 | `ensureSessionAccess` + `ensureAthleteAccess`; admin/coach pass, while an athlete must own the metric. 404 if no row. |
| `GET` | `/sessions/:id/summary` | JWT | none (manual: `ensureSessionAccess`) | — | `200` | `routes/metrics.ts` | 1 | Returns single `session_summaries` row. 403 / 404. |
| `GET` | `/sessions/:id/targets` | JWT | `coach`, `organisation_admin`, `ssp_super_admin` | — | `200` | `routes/metrics.ts` | 1 | `ensureSessionAccess`. Returns `{ targets: [...] }` from `session_targets`. |
| `POST` | `/sessions/:id/targets` | JWT | `coach`, `organisation_admin`, `ssp_super_admin` | `createTarget` (zValidator) | `201` | `routes/metrics.ts` | 1 | `loadSessionAccess`. Inserts `session_id, athlete_id, organisation_id, ...body`. 404 if session missing. |
| `PATCH` | `/sessions/:id/targets/:targetId` | JWT | `coach`, `organisation_admin`, `ssp_super_admin` | `updateTarget` (zValidator) | `200` | `routes/metrics.ts` | 1 | `loadSessionAccess`; verifies target exists for session. 403 / 404. |

---

## Workload (`/athletes/:id/workload`)

[Details](./routes/workload). Handler lives in `routes/workload.ts` (root-mounted).

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/athletes/:id/workload` | JWT | none (manual: `canSeeAthlete`) | — | `200` | `routes/workload.ts` | 1 | org admin/super admin pass; self (athlete's `user_id === user.id`); coach via shared team. Query `from`, `to` (optional). Returns `{ workload: [...] }` from `workload_readiness`, optional `gte('recorded_at', from)` / `lte('recorded_at', to)`, ordered `recorded_at asc`. |

---

## Goals (`/goals`)

[Details](./routes/goals)

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/goals` | JWT | none (manual) | — | `200` | `routes/goals.ts` | 1 | Query `team_id`, `athlete_id`. Non-super-admins scoped to `ctx.primaryOrganisationId`. Pure athletes (no coach/admin role) filtered to their own athlete id (in-memory post-query). `hasTeamAccess`/`hasOrgAccess` imported but `void`ed (unused). |
| `POST` | `/goals` | JWT | `coach`, `organisation_admin`, `ssp_super_admin` | `createGoal` (zValidator) | `201` | `routes/goals.ts` | 1 | Org-scope check. Adds `created_by_user_id`. |
| `PATCH` | `/goals/:id` | JWT | `coach`, `organisation_admin`, `ssp_super_admin` | `updateGoal` (zValidator) | `200` | `routes/goals.ts` | 1 | Org-scope check against existing goal's `organisation_id`. 403 / 404. |

---

## Benchmarks (`/benchmarks`)

[Details](./routes/benchmarks)

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/benchmarks` | JWT | `coach`, `organisation_admin`, `ssp_super_admin` | — | `200` | `routes/benchmarks.ts` | 1 | Query `sport_id`, `team_id`, `position_label`. Non-super-admins scoped to `ctx.primaryOrganisationId`. Optional `eq` filters for the three query params. |

---

## Notifications (`/notifications`)

[Details](./routes/notifications)

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/notifications` | JWT | none | — | `200` | `routes/notifications.ts` | 1 | Query `unread` (`'true'` → `is('read_at', null)`). Recipient-scoped (`recipient_user_id === user.id`), ordered `created_at desc`. |
| `PATCH` | `/notifications/:id/read` | JWT | none | — | `200` | `routes/notifications.ts` | 1 | Marks `read_at: now`, scoped to `recipient_user_id === user.id` (404 if no row matched). |

---

## Team & Athlete Analytics (`/teams/:id/analytics`, `/athletes/:id/analytics`)

[Details](./routes/analytics). Handlers live in `routes/analytics.ts` (root-mounted).

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/teams/:id/analytics` | JWT | `coach`, `organisation_admin`, `ssp_super_admin` | — | `200` | `routes/analytics.ts` | 1 | `hasTeamResourceAccess` gate. Query `from`, `to`. Pulls session ids for team in window, then `session_athlete_metrics` (`distance_meters, max_speed_mps, sprint_count, workload_index`). Returns `{ team_id, session_count, squad_avg_load, avg_distance_meters, top_metrics: [...] }` (or nulls/empty array when no sessions). |
| `GET` | `/athletes/:id/analytics` | JWT | none (manual) | — | `200` | `routes/analytics.ts` | 1 | admin/self/coach-shared-team. Query `from`, `to`. Returns `{ athlete_id, trend: [...] }` from `session_athlete_metrics` `eq('athlete_id', id)`, ordered `recorded_at asc`. |

---

# Phase 3 — Telemetry & OTA routes

The ingest pipeline, retry-safe same-payload upserts, and firmware-release publishing handlers. The parser's queue claim is not atomic. Phase 2 was skipped/deferred.

## Ingest (`/sessions/:id/...`)

[Details](./routes/ingest). Handlers live in `routes/ingest.ts` (root-mounted, JWT, gated by `loadSessionAccess`). Constants: `SIGNED_UPLOAD_TTL_SECONDS = 2 * 60 * 60` (7200s); `DEFAULT_BUCKET = 'session-telemetry'`.

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/sessions/:id/ingest-url` | JWT | none (manual: `loadSessionAccess`) | `createIngestUpload` (safeParse, empty `{}` ok) | `201` | `routes/ingest.ts` | 3 | Builds storage path `${org_id}/${sessionId}/${uuid}.${ext}`; `createSignedUploadUrl`. Creates `sync_records` (`source_type:'mobile_app'`, `entity_type:'session'`, `sync_status:'pending'`, format/compression). If athlete, looks up `athletes.id` for `athlete_id`. Returns `{ sync_id, bucket, path, signed_url, token, expires_in: 7200, format, compression }`. `400 { error:'Invalid body', issues:[{path,message}] }`. |
| `POST` | `/sessions/:id/complete` | JWT | none (manual: `loadSessionAccess`) | `completeIngest` (safeParse, empty `{}` ok) | `200` | `routes/ingest.ts` | 3 | Finds sync record by `sync_id` or latest pending for session. Idempotent if `sync_status === 'completed'`. Else sets `sync_status:'in_progress'`, `attempted_at: now`, `payload_size_bytes`/`point_count`, and session `sync_status:'in_progress'`, `status:'syncing'`. 409 `'Sync record has no Storage object'` if `!storage_bucket || !storage_path`. Returns `{ ok: true, sync: <updatedSync> }`. |
| `GET` | `/sessions/:id/sync` | JWT | none (manual: `loadSessionAccess`) | — | `200` | `routes/ingest.ts` | 3 | Lists `sync_records` for session, ordered `created_at desc`. Returns `{ session_id, sync_status, records }` (`sync_status` defaults to `'pending'` if no records). |
| `GET` | `/sessions/:id/telemetry` | JWT | none (manual: `loadSessionAccess`) | — | `200` | `routes/ingest.ts` | 3 | Query via `telemetryListQuery` `safeParse` (`athlete_id?`, `after_index` default -1, `limit` default 1000 max 5000). `gte('point_index', after_index + 1)`, ordered `point_index asc`, `limit`. `has_more = points.length === limit`. `400 { error:'Invalid query', issues }`. Returns `{ session_id, points, next_after_index, has_more }` selecting `athlete_id, point_index, timestamp, latitude, longitude, speed_mps, accel_magnitude, impact_count, step_count_delta, data_quality_status`. |

---

## Firmware Release Publishing

Two publish paths call the same `storeFirmwareRelease` helper. The JWT path records `created_by_user_id`; the machine/CI path passes `null`.

[Details: Firmware Releases](./routes/firmware-releases)

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/firmware-releases` | JWT | `ssp_super_admin` | `publishFirmwareRelease` (zValidator) | `201` | `routes/firmware-releases.ts` | 3 | Stores supplied bytes and computes SHA-256; does not verify an MCUboot signature/container. 400 on schema/base64/empty artifact. |
| `POST` | `/internal/firmware-releases` | FIRMWARE_RELEASE_SECRET | n/a | `publishFirmwareRelease` (zValidator) | `201` | `routes/internal.ts` | 3 | Machine/CI path. Delegates to `storeFirmwareRelease(body, null)` (no user). 401 if secret missing/wrong. 400 on base64/empty artifact. |

---

## Internal Parsing & Maintenance (`/internal/parse/*`)

[Details: Internal](./routes/internal). The `/internal/firmware-releases` handler is cataloged once under **Firmware Release Publishing** above. The router is **not** JWT-protected; every request picks the secret by path (`FIRMWARE_RELEASE_SECRET` if `c.req.path.endsWith('/firmware-releases')` else `CRON_SECRET`) and checks `x-cron-secret === secret` or `Authorization: Bearer <secret>`. Else `401 { error: 'Unauthorized' }`.

| Method | Full path | Auth | Required roles | Body schema | Success | Source file | Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/internal/parse/:sessionId` | CRON_SECRET | n/a | — | `200` | `routes/internal.ts` | 3 | Manual/id-specific invocation. Runs `processTelemetry(sessionId)`. Returns `{ ok, processed, session_id?, sync_id?, point_count?, athlete_count? }` or `{ ok, processed:false, message }` or `{ error }` (500). 401 if secret missing/wrong. |
| `GET` | `/internal/parse/pending` | CRON_SECRET | n/a | — | `200` | `routes/internal.ts` | 3 | Vercel Cron entry. Runs `processTelemetry('pending')`, which claims the single oldest `in_progress`/`failed` sync across **all** sessions (no `session_id` filter). Same response shapes as above. 401 if secret missing/wrong. |

See [Ingestion Pipeline](./ingestion-pipeline) for the implemented telemetry flow and [Firmware OTA](./firmware-ota) for the server-side OTA contract and its open client/device gates. `/internal/parse/pending` is not session-specific; concurrent cron runs could race on the same sync record because the `sync_status` claim update is the only guard.

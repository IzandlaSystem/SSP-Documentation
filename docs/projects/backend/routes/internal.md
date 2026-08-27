---
title: Internal API
description: Secret-gated worker surface for firmware release publishing and asynchronous telemetry parsing in SSP-API (Phase 3).
outline: deep
---

# Internal API (Phase 3)

The Internal API exposes the machine/worker side of Phase 3: a CI path for publishing firmware releases and a Vercel Cron / manual entry point for parsing uploaded telemetry blobs into derived metrics. It is mounted at `/internal` (`src/routes/internal.ts`) and is **never JWT-authenticated**; access is controlled entirely by shared secrets.

These routes consume work produced by the JWT-gated ingestion flow (the `sync_records` rows and Storage objects created by `POST /sessions/:id/ingest-url` + `POST /sessions/:id/complete`). See [Ingestion Pipeline](../ingestion-pipeline) for the upload side, and [Auth & Security](../auth-and-security) for the two auth modes.

---

## Shared-Secret Authentication

Every `/internal/*` request passes through a mount-level middleware that picks the secret per path and never imports or applies the JWT `auth` middleware.

- **Secret selection:** per request, `secret = FIRMWARE_RELEASE_SECRET` if `c.req.path.endsWith('/firmware-releases')`, otherwise `secret = CRON_SECRET`.
- **Authorization check:** the request is authorized when `!!secret && (x-cron-secret header === secret || Authorization === \`Bearer ${secret}\`)`. Both headers are accepted interchangeably.
- **Failure:** any unauthorized request returns `401 { error: 'Unauthorized' }` with no further processing.
- **Unset secret caveat:** if the relevant secret env var is unset, `!!secret` is false and that route **always** returns `401`, regardless of the headers sent. There is no fallback.

There are no roles on this surface; possession of the secret is the only credential. See [Auth & Security](../auth-and-security).

---

## 1. Publish Firmware Release (`POST /internal/firmware-releases`)

Publishes a firmware release from a CI / machine context. This is the shared-secret counterpart to the admin JWT path `POST /firmware-releases` (see [Firmware Releases](./firmware-releases)); both converge on the same `storeFirmwareRelease` routine, but the machine path passes `created_by_user_id: null` (no user).

- **Path:** `/internal/firmware-releases`
- **Method:** `POST`
- **Auth:** `FIRMWARE_RELEASE_SECRET` (via `x-cron-secret` header or `Authorization: Bearer <secret>`)
- **Required Roles:** n/a (secret-gated, no JWT)
- **Tenant Scope:** Cross-tenant (global firmware catalog)

### Request Body Schema (`publishFirmwareRelease`)

Validated with `zValidator('json', publishFirmwareRelease)`, the same schema as `POST /firmware-releases` (see `src/schemas/firmware.ts`).

```json
{
  "target": "nrf5340_app",
  "hardware_model": "SSP-S1-PRO",
  "hardware_revision": "revB",
  "version": "1.2.0",
  "version_code": 1020,
  "protocol_version": "v1",
  "mandatory": false,
  "release_notes": "Fix GNSS warm-start regression; bump BLE bond cache TTL.",
  "content_type": "application/octet-stream",
  "artifact_base64": "<base64-encoded artifact, max 3,000,000 chars>"
}
```

| Field | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `target` | `'nrf5340_app'` | yes | Literal (the only accepted update target). |
| `hardware_model` | string (1–100) | yes | |
| `hardware_revision` | string (1–100) \| null | optional | |
| `version` | string (semver-shaped, max 50) | yes | Must match `/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/`. Stored as a string; **not** used for ordering. |
| `version_code` | integer > 0 | yes | The integer used as the "latest release" comparator (DB orders `version_code desc`). See [Firmware OTA](../firmware-ota). |
| `protocol_version` | string (1–50) | yes | |
| `mandatory` | boolean | no | Defaults to `false`. |
| `release_notes` | string (max 10,000) \| null | optional | |
| `content_type` | string (1–100) | no | Defaults to `application/octet-stream`. |
| `artifact_base64` | string (1–3,000,000) | yes | Base64-encoded firmware binary; decoded, sha256-hashed, and uploaded to the firmware Storage bucket. |

### Response (`201 Created`)

The created `firmware_releases` row (same shape returned by the JWT publish path):

```json
{
  "id": "6fa85f64-5717-4562-b3fc-2c963f66afa9",
  "target": "nrf5340_app",
  "hardware_model": "SSP-S1-PRO",
  "hardware_revision": "revB",
  "version": "1.2.0",
  "version_code": 1020,
  "protocol_version": "v1",
  "mandatory": false,
  "release_notes": "Fix GNSS warm-start regression; bump BLE bond cache TTL.",
  "content_type": "application/octet-stream",
  "storage_bucket": "firmware-releases",
  "storage_path": "nrf5340_app/SSP-S1-PRO/1.2.0/a1b2c3d4-....bin",
  "file_size": 482304,
  "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "created_by_user_id": null,
  "created_at": "2026-08-15T09:30:00.000Z"
}
```

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| `400` | `{ error }` (zValidator structured) or `{ error: 'artifact_base64 is not valid base64' }` / `{ error: 'Firmware artifact is empty' }` | Body validation failure or undecodable/empty artifact. |
| `401` | `{ error: 'Unauthorized' }` | Missing/incorrect secret, or `FIRMWARE_RELEASE_SECRET` unset. |
| `500` | `{ error }` | Storage upload failure or `firmware_releases` insert failure (the uploaded object is rolled back on insert error). |

> The artifact is stored in the bucket named by `FIRMWARE_BUCKET` (default `'firmware-releases'`) under `target/hardware_model/version/<uuid>.bin`. See [Firmware OTA](../firmware-ota) for the full delivery flow.

---

## 2. Parse Session Telemetry (`POST /internal/parse/:sessionId`)

Manually (or id-specifically) triggers the asynchronous telemetry parser for a single session. Intended for manual retries or targeted reprocessing of a `failed`/`in_progress` sync.

- **Path:** `/internal/parse/:sessionId`
- **Method:** `POST`
- **Auth:** `CRON_SECRET` (via `x-cron-secret` header or `Authorization: Bearer <secret>`)
- **Required Roles:** n/a (secret-gated, no JWT)
- **Tenant Scope:** Cross-tenant (the sync is selected by `session_id`, not by organisation)
- **Path Parameters:**
  - `sessionId` (`uuid`, required): The session whose oldest `in_progress`/`failed` sync record to process.

### Response (`200 OK`)

When a sync is found and fully processed:

```json
{
  "ok": true,
  "processed": true,
  "session_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
  "sync_id": "7fa85f64-5717-4562-b3fc-2c963f66af10",
  "point_count": 86432,
  "athlete_count": 3
}
```

When no eligible sync is found (no `in_progress`/`failed` sync for that `session_id`):

```json
{
  "ok": true,
  "processed": false,
  "message": "No in-progress telemetry sync found"
}
```

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| `401` | `{ error: 'Unauthorized' }` | Missing/incorrect secret, or `CRON_SECRET` unset. |
| `500` | `{ error }` | Any failure during parse (session/sync marked `failed`; `error_message` truncated to 2000 chars on `sync_records`). |

---

## 3. Parse Pending Sync (`GET /internal/parse/pending`)

The Vercel Cron entry point. Picks the **single oldest** `in_progress` or `failed` sync **across all sessions** (no `session_id` filter) and processes it. Intended to be invoked on a schedule; each run claims and completes at most one sync.

- **Path:** `/internal/parse/pending`
- **Method:** `GET`
- **Auth:** `CRON_SECRET` (via `x-cron-secret` header or `Authorization: Bearer <secret>`)
- **Required Roles:** n/a (secret-gated, no JWT)
- **Tenant Scope:** Cross-tenant (global queue, scans all sessions)
- **Path Parameters:** none
- **Query Parameters:** none

### Response (`200 OK`)

Same response shapes as [Parse Session Telemetry](#2-parse-session-telemetry-post-internal-parse-sessionid) above, `{ ok, processed, session_id?, sync_id?, point_count?, athlete_count? }` on success, or `{ ok: true, processed: false, message }` when the queue is empty.

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| `401` | `{ error: 'Unauthorized' }` | Missing/incorrect secret, or `CRON_SECRET` unset. |
| `500` | `{ error }` | Any failure during parse (session/sync marked `failed`; `error_message` truncated to 2000 chars on `sync_records`). |

> **Race caveat:** `findSync('pending')` selects the oldest eligible sync without a `session_id` filter, and the claim is a plain `sync_records` update (`sync_status: 'in_progress'`). Two concurrent runs can both read the same sync before either claims it. Same-payload upserts overwrite their conflict keys, but the worker is not single-writer or transactionally idempotent.

---

## `processTelemetry`: Worker Flow

Both parse routes call `processTelemetry(sessionIdParam)`. The `pending` path passes the literal string `'pending'`, which `findSync` treats specially (no `eq('session_id')` filter); any other value is used as the `session_id` filter. At a high level:

1. **Find sync.** Query `sync_records` for the oldest row with `sync_status` in `['in_progress', 'failed']` (`attempted_at asc`, `limit 1`). If `sessionIdParam !== 'pending'`, also filter `eq('session_id', sessionIdParam)`. If none found (or no `session_id`), short-circuit with `{ ok: true, processed: false, message: 'No in-progress telemetry sync found' }`.
2. **Claim sync.** Update that `sync_records` row to `sync_status: 'in_progress'`, set `attempted_at`, clear `error_message`. (This is the only mutual-exclusion mechanism; see the race caveat above.)
3. **Load session + participants.** Fetch the `sessions` row (`id, organisation_id, firmware_session_id`) and the distinct `session_participants.athlete_id` set. Throw if the session is missing or has no enrolled athletes.
4. **Download blob.** `bucket = sync.storage_bucket ?? process.env.TELEMETRY_BUCKET ?? 'session-telemetry'`; `db().storage.from(bucket).download(sync.storage_path)`. Throw if the object is missing.
5. **Decode envelope.** `format = telemetryFormat.parse(sync.payload_format ?? 'json')`; `compression = telemetryCompression.parse(sync.compression ?? 'gzip')`; `envelope = await decodeTelemetryBlob(blob, format, compression)`. This enforces the `TELEMETRY_MAX_POINTS` limit (default `100_000`) at decode time; an oversized blob throws `'Telemetry blob exceeds the ${maxPoints} point limit'`.
6. **Validate session + enrollment.** If `envelope.session_id` is set and differs from the sync's session, throw. Normalize points; every point's resolved `athleteId` must be in the participant set, else throw `'Athlete ${id} is not enrolled in the session'`.
7. **Normalize + aggregate.** Build per-point telemetry rows (including a PostGIS `SRID=4326;POINT(lng lat)` `location` or `null`) and per-athlete metrics via `aggregateTelemetry` (haversine distance, sprint count at ≥ 7 m/s, max speed, mean accel magnitude, duration, `data_quality_status: 'valid'` when ≥ 2 GPS points else `'partial'`).
8. **Upsert derived rows.**
   - `session_telemetry_points`, chunked in batches of 500, `upsert(..., { onConflict: 'session_id,athlete_id,point_index' })`.
   - `session_athlete_metrics`, `upsert(..., { onConflict: 'session_id,athlete_id' })` (`data_source: 'mobile_ble'`).
   - `session_summaries`, `upsert(..., { onConflict: 'session_id' })` with totals (`total_distance_meters`, `athlete_count`, `max_speed_mps`, `total_sprint_count`, `completed_at`, `data_quality_status: 'valid'` only if every athlete is valid else `'partial'`; `average_intensity: null`).
9. **Mark complete.** Update `sessions` (`sync_status: 'completed'`, `status: 'synced'`, `data_point_count`) and `sync_records` (`sync_status: 'completed'`, `completed_at`, `point_count`). Return `{ ok: true, processed: true, session_id, sync_id, point_count, athlete_count }`.
10. **On any thrown error.** `updateFailure` sets `sessions.sync_status = 'failed'` and (if a `syncId` exists) `sync_records.sync_status = 'failed'` with `error_message` truncated to 2000 chars; the route returns `500 { error: <message> }`.

**Idempotency:** the `sync_status` claim (step 2) plus the explicit `onConflict` keys on every upsert make re-runs safe. `processTelemetry` only selects `in_progress`/`failed` syncs (never `completed`), so a sync already finished is not reprocessed; the `completed` short-circuit lives in `POST /sessions/:id/complete` on the upload side. See [Ingestion Pipeline](../ingestion-pipeline).

---

## Environment Variables

| Variable | Used by | Purpose | Default |
| :--- | :--- | :--- | :--- |
| `CRON_SECRET` | middleware | Shared secret for `/internal/parse/*`. Checked against the `x-cron-secret` header or `Authorization: Bearer <secret>`. | none: if unset, the parse routes **always** return `401`. |
| `FIRMWARE_RELEASE_SECRET` | middleware | Shared secret for `POST /internal/firmware-releases` (selected when `c.req.path.endsWith('/firmware-releases')`). | none: if unset, the publish route **always** returns `401`. |
| `TELEMETRY_BUCKET` | `processTelemetry` | Private Storage bucket for raw session telemetry blobs (download side). Falls back to `sync.storage_bucket` when present. | `'session-telemetry'` |
| `TELEMETRY_MAX_POINTS` | `decodeTelemetryBlob` | Max points accepted in one decoded telemetry envelope; enforced at decode time, not at upload. Used only if a safe positive integer. | `100_000` |

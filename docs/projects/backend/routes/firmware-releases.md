---
title: Firmware Releases API
description: Publish surface for nRF5340 application firmware artifacts, with JWT (super-admin) and shared-secret (CI/cron) publish paths in SSP-API (Phase 3).
outline: deep
---

# Firmware Releases API (Phase 3)

The Firmware Releases API stores supplied **SSP-S1** nRF5340 application artifacts and their metadata. The publisher is responsible for signing and validating the image; the gateway only validates request metadata/base64 size, rejects an empty decoded artifact, and computes SHA-256 over the uploaded bytes. Two routes delegate to `storeFirmwareRelease(body, createdByUserId)`. There is no list or delete route; once published, a `firmware_releases` row is immutable, and device update selection orders by `version_code` (a DB integer), **not** semver parsing.

Sources: `src/routes/firmware-releases.ts` (JWT path) and `src/routes/internal.ts` (secret path); storage logic in `src/lib/firmware.ts`; body schema in `src/schemas/firmware.ts`.

---

## Authentication

This API has **two publish paths** that run the same storage routine with different identities:

- **JWT path (`POST /firmware-releases`).** Protected by the `auth` middleware (Supabase access token) and then `requireRoles('ssp_super_admin')`. The handler records `created_by_user_id = user.id` (the JWT subject), so publishes are attributable to the operator. Roles are DB-loaded on every request from `user_roles` joined to `roles(name)` with `revoked_at IS NULL`, not from JWT `app_metadata.roles`, and fail-closed to `[]` (→ 403) on a DB error (see [Auth & Security](../auth-and-security)).
- **Shared-secret path (`POST /internal/firmware-releases`).** Mounted under `/internal`, which never applies `auth`. A per-request middleware selects `FIRMWARE_RELEASE_SECRET` (because the path ends in `/firmware-releases`) and authorizes when `!!secret && (x-cron-secret === secret || Authorization === \`Bearer ${secret}\`)`. This is the machine/CI publish path: `storeFirmwareRelease(body, null)` records `created_by_user_id: null`. If `FIRMWARE_RELEASE_SECRET` is unset, every publish attempt returns `401`.

Both routes validate the body with the same `zValidator('json', publishFirmwareRelease)` schema, so a validation failure returns the `@hono/zod-validator` default `400` structured body automatically.

---

## 1. Publish Firmware Release (JWT) (`POST /firmware-releases`)

Publishes a new firmware artifact for the nRF5340 application core, attributable to the calling super admin. Mounted at `/firmware-releases` in `src/app.ts`.

- **Path:** `/firmware-releases`
- **Method:** `POST`
- **Auth:** JWT (Supabase access token verified by the `auth` middleware)
- **Required Roles:** `ssp_super_admin` (via `requireRoles`: only the literal role admits; no upward cascade applies as this is the top of the hierarchy)
- **Tenant Scope:** Cross-tenant (super-admin only; firmware releases are global, not org-scoped)

### Request Body Schema (`publishFirmwareRelease`)

Validated with `zValidator('json', publishFirmwareRelease)` in `src/schemas/firmware.ts`.

| Field | Type | Required | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `target` | `string` | Yes | Literal `'nrf5340_app'` | Firmware target core. Only the nRF5340 application core is supported. |
| `hardware_model` | `string` | Yes | Min 1, max 100 chars | Hardware model the artifact targets (e.g. `SSP-S1-PRO`). |
| `hardware_revision` | `string` | No | Min 1, max 100 chars; nullable | PCB revision. Omitted/null matches devices whose `hardware_revision` is null. |
| `version` | `string` | Yes | Regex `/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/`, max 50 chars | Human-readable version string. **Not** the ordering key; see [Versioning](#versioning) below. |
| `version_code` | `integer` | Yes | Positive (`z.number().int().positive()`) | Monotonic DB ordering key for device update selection. |
| `protocol_version` | `string` | Yes | Min 1, max 50 chars | Device protocol version the artifact requires. |
| `mandatory` | `boolean` | No | Default `false` | Forces the update when offered to devices. |
| `release_notes` | `string` | No | Max 10,000 chars; nullable | Free-text release notes. |
| `content_type` | `string` | No | Min 1, max 100 chars; default `'application/octet-stream'` | Storage `Content-Type` for the uploaded binary. |
| `artifact_base64` | `string` | Yes | Min 1, max 3,000,000 chars | Base64-encoded firmware binary. Decoded server-side; invalid/empty base64 returns 400. |

### Example Request

```json
{
  "target": "nrf5340_app",
  "hardware_model": "SSP-S1-PRO",
  "hardware_revision": "revB",
  "version": "1.2.0",
  "version_code": 1020,
  "protocol_version": "v1",
  "mandatory": false,
  "release_notes": "BLE bond stability fix and GPS cold-start improvement.",
  "content_type": "application/octet-stream",
  "artifact_base64": "QkFTRTY0ZWRFd2FyZWJpbmFyeQ=="
}
```

### Response (`201 Created`)

Returns the created `firmware_releases` row (`select().single()`). The `artifact_base64` field is stripped from the stored body; `storage_bucket`, `storage_path`, `file_size`, `sha256`, and `created_by_user_id` are set by `storeFirmwareRelease`, not the client.

```json
{
  "id": "7fa85f64-5717-4562-b3fc-2c963f66afa9",
  "target": "nrf5340_app",
  "hardware_model": "SSP-S1-PRO",
  "hardware_revision": "revB",
  "version": "1.2.0",
  "version_code": 1020,
  "protocol_version": "v1",
  "storage_bucket": "firmware-releases",
  "storage_path": "nrf5340_app/SSP-S1-PRO/1.2.0/a1b2c3d4-e5f6-7890-abcd-ef1234567890.bin",
  "file_size": 262144,
  "sha256": "9e1c3f5b8a2d4e6f0c1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e",
  "content_type": "application/octet-stream",
  "mandatory": false,
  "release_notes": "BLE bond stability fix and GPS cold-start improvement.",
  "created_by_user_id": "11111111-2222-3333-4444-555555555555",
  "published_at": "2026-08-15T09:00:00.000Z",
  "created_at": "2026-08-15T09:00:00.000Z"
}
```

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 400 | `@hono/zod-validator` structured body | `publishFirmwareRelease` validation failure (bad `target`, missing `version_code`, oversized `artifact_base64`, etc.). |
| 400 | `{ "error": "artifact_base64 is not valid base64" }` | `artifact_base64` could not be decoded. |
| 400 | `{ "error": "Firmware artifact is empty" }` | Decoded artifact has zero bytes. |
| 401 | `{ "error": "Missing or malformed Authorization header" }` / `{ "error": "Invalid or expired token" }` | Bad or missing JWT. |
| 403 | `{ "error": "Forbidden" }` | Authenticated but not `ssp_super_admin` (or roles failed closed to `[]` after a DB error). |
| 500 | `{ "error": "<message>" }` | Storage upload failure, DB insert failure, or unhandled error. Storage upload is rolled back on insert error (see [storeFirmwareRelease](#storefirmwarerelease-behavior)). |

---

## 2. Publish Firmware Release (Shared Secret) (`POST /internal/firmware-releases`)

Machine/CI publish path: same body and storage routine as the JWT route, but authenticated with `FIRMWARE_RELEASE_SECRET` and recorded with `created_by_user_id: null`. Mounted under `/internal` in `src/app.ts`, before the JWT-protected routers, so the wildcard `auth` middleware can never intercept it.

- **Path:** `/internal/firmware-releases`
- **Method:** `POST`
- **Auth:** `FIRMWARE_RELEASE_SECRET` (sent via the `x-cron-secret` header **or** `Authorization: Bearer <secret>`)
- **Required Roles:** n/a (secret-gated, no role check)
- **Tenant Scope:** Cross-tenant (global publish; no user identity recorded)

The middleware selects `FIRMWARE_RELEASE_SECRET` because `c.req.path.endsWith('/firmware-releases')`. The body is validated with the same `zValidator('json', publishFirmwareRelease)` schema, then the handler calls `storeFirmwareRelease(c.req.valid('json'), null)`.

### Example Request

```http
POST /internal/firmware-releases
Content-Type: application/json
x-cron-secret: <FIRMWARE_RELEASE_SECRET>

{ ...same publishFirmwareRelease body as route 1... }
```

### Response (`201 Created`)

Same `firmware_releases` row shape as route 1, except `created_by_user_id` is `null`:

```json
{
  "id": "8fa85f64-5717-4562-b3fc-2c963f66afaa",
  "target": "nrf5340_app",
  "hardware_model": "SSP-S1-PRO",
  "hardware_revision": null,
  "version": "1.2.1",
  "version_code": 1021,
  "protocol_version": "v1",
  "storage_bucket": "firmware-releases",
  "storage_path": "nrf5340_app/SSP-S1-PRO/1.2.1/b2c3d4e5-f6a7-8901-bcde-f23456789012.bin",
  "file_size": 262208,
  "sha256": "0f2d4b6c8a0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a",
  "content_type": "application/octet-stream",
  "mandatory": false,
  "release_notes": null,
  "created_by_user_id": null,
  "published_at": "2026-08-15T09:05:00.000Z",
  "created_at": "2026-08-15T09:05:00.000Z"
}
```

### Errors

| Status | Body | Cause |
| :--- | :--- | :--- |
| 400 | `@hono/zod-validator` structured body | `publishFirmwareRelease` validation failure. |
| 400 | `{ "error": "artifact_base64 is not valid base64" }` | `artifact_base64` could not be decoded. |
| 400 | `{ "error": "Firmware artifact is empty" }` | Decoded artifact has zero bytes. |
| 401 | `{ "error": "Unauthorized" }` | `FIRMWARE_RELEASE_SECRET` unset, or `x-cron-secret` / `Authorization: Bearer` does not match it. |
| 500 | `{ "error": "<message>" }` | Storage upload failure, DB insert failure, or unhandled error. Storage upload is rolled back on insert error. |

---

## storeFirmwareRelease Behavior

Both routes delegate to `storeFirmwareRelease(body, createdByUserId)` in `src/lib/firmware.ts`. The routine is the single source of truth for storage and DB insertion; it performs no version comparison (see [Versioning](#versioning)).

1. **Decode base64.** `decodeBase64(body.artifact_base64)` via `atob` → `Uint8Array`. On throw → `400 { error: 'artifact_base64 is not valid base64' }`. If the decoded artifact has zero bytes → `400 { error: 'Firmware artifact is empty' }`.
2. **Resolve bucket.** `bucket = process.env.FIRMWARE_BUCKET ?? 'firmware-releases'` (the `DEFAULT_BUCKET`).
3. **Build storage path.** `[target, safePathSegment(hardware_model), version, \`${crypto.randomUUID()}.bin\`]` joined with `/`. `safePathSegment` replaces any run of characters outside `[0-9A-Za-z._-]+` with `-`, so `hardware_model` cannot inject path traversal. `version` is used verbatim (already constrained by the `firmwareVersion` regex).
4. **Compute sha256.** `crypto.subtle.digest('SHA-256', …)` → 64-char hex; stored on the row and constrained by the DB `CHECK (~ '^[0-9a-f]{64}$')`.
5. **Upload to Storage.** `db().storage.from(bucket).upload(path, artifact, { contentType: body.content_type, upsert: false })`. On error → `500 { error: uploadError.message }`. `upsert: false` means a colliding `storage_path` (unique in the DB) fails at insert rather than overwriting an existing artifact.
6. **Insert `firmware_releases` row.** `artifact_base64` is stripped from the body; `hardware_revision` and `release_notes` default to `null` when omitted. The insert carries `storage_bucket`, `storage_path`, `file_size` (the decoded byte length), `sha256`, and `created_by_user_id`. `.select().single()` returns the created row.
7. **Rollback on insert error.** If the insert fails or `data` is null, `db().storage.from(bucket).remove([path])` deletes the just-uploaded artifact and the routine returns `500 { error: error?.message ?? 'Unable to publish firmware release' }`.
8. **Success.** Returns `{ data: <firmware_releases row>, status: 201 }`.

---

## Versioning

The `version` string is **human-readable only**; it is validated for format (`/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/`, max 50) but never parsed or compared by `lib/firmware.ts`. The database ordering key for device update selection is `version_code`, a positive integer. The consumer is `GET /devices/:id/firmware-update` in the [Devices API](./devices): it finds the latest `firmware_releases` row matching the device's `target`, `hardware_model`, `protocol_version`, and `hardware_revision` (or `is('hardware_revision', null)`), ordered by `version_code desc` with `limit(1)`, then skips the release when `release.version === device.firmware_version` or `device.firmware_version_code !== null && release.version_code <= device.firmware_version_code`. Any doc claiming semver ordering is wrong; see [Firmware OTA](../firmware-ota) for the full offer/confirm flow.

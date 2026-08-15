---
title: Devices API
description: Hardware tracker registration, BLE mobile pairing, athlete assignment, and firmware-update orchestration in SSP-API (Phase 1 + Phase 3).
outline: deep
---

# Devices API (Phase 1)

The Devices API manages the lifecycle of the **SSP-S1** wearable trackers, including hardware inventory registration, mobile Bluetooth Low Energy (BLE) pairing bonds, athlete assignments, and operational status tracking. It also exposes the device-side firmware-update offer and status-report endpoints that close the OTA loop with the [Firmware OTA](../firmware-ota) pipeline.

All routes are mounted at `/devices` (source: `src/routes/devices.ts`). Unless noted, every handler is JWT-authenticated via the `auth` middleware; roles are loaded from the database on each request (not from the JWT). See [Auth & Security](../auth-and-security).

---

## 1. List Devices (`GET /devices`)

Lists physical tracking devices registered to an organisation.

- **Path:** `/devices`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** `coach`, `organisation_admin`, `ssp_super_admin`
- **Tenant Scope:** Org
- **Query Parameters:**
  - `organisation_id` (`uuid`, optional): Filter by organisation. Defaults to `ctx.primaryOrganisationId` when omitted.

The handler performs an org-scope check: if `organisation_id` is supplied and the caller is not a super admin and `hasOrgAccess` fails, the request is rejected with `403`. Otherwise the result is filtered with `eq('organisation_id', organisation_id)`.

### Response (`200 OK`)

```json
{
  "devices": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
      "serial_number": "SSP-S1-2026-00481",
      "hardware_model": "SSP-S1-PRO",
      "hardware_revision": "revB",
      "ble_device_name": "SSP-00481",
      "capability_mask": null,
      "firmware_version": "1.0.0",
      "firmware_version_code": 1000,
      "protocol_version": "v1",
      "status": "available",
      "last_battery_pct": 94,
      "last_gnss_state": "fix_3d",
      "last_app_state": "idle",
      "last_seen_at": "2026-08-15T08:30:00.000Z",
      "last_firmware_session_id": null,
      "created_at": "2026-03-01T08:00:00.000Z",
      "updated_at": "2026-08-15T08:30:00.000Z"
    }
  ]
}
```

### Errors

| Status | Meaning |
| :--- | :--- |
| 403 | Forbidden — caller lacks a required role or fails the org-scope check. |

---

## 2. Get Device Details (`GET /devices/:id`)

Fetches the full device row plus its complete `device_assignments` and `pairing_states` arrays for a single tracker.

- **Path:** `/devices/:id`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none — manual access check. `hasOrgAccess` is evaluated against the loaded device's `organisation_id`; super admins and members of the device's organisation pass.
- **Tenant Scope:** Org
- **Path Parameters:**
  - `id` (`uuid`): Device identifier.

The row is selected as `select('*, device_assignments(*), pairing_states(*)')`, so the response embeds the **full** `device_assignments` and `pairing_states` arrays (not single active records).

### Response (`200 OK`)

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
  "serial_number": "SSP-S1-2026-00481",
  "hardware_model": "SSP-S1-PRO",
  "hardware_revision": "revB",
  "ble_device_name": "SSP-00481",
  "capability_mask": null,
  "firmware_version": "1.0.0",
  "firmware_version_code": 1000,
  "protocol_version": "v1",
  "status": "assigned",
  "last_battery_pct": 94,
  "last_gnss_state": "fix_3d",
  "last_app_state": "idle",
  "last_seen_at": "2026-08-15T08:30:00.000Z",
  "last_firmware_session_id": null,
  "created_at": "2026-03-01T08:00:00.000Z",
  "updated_at": "2026-08-15T08:30:00.000Z",
  "device_assignments": [
    {
      "id": "5fa85f64-5717-4562-b3fc-2c963f66afa8",
      "device_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "athlete_id": "44444444-5555-6666-7777-888888888888",
      "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
      "assigned_by_user_id": "11111111-2222-3333-4444-555555555555",
      "assigned_at": "2026-08-10T10:00:00.000Z",
      "unassigned_at": null,
      "created_at": "2026-08-10T10:00:00.000Z",
      "updated_at": "2026-08-10T10:00:00.000Z"
    }
  ],
  "pairing_states": [
    {
      "id": "4fa85f64-5717-4562-b3fc-2c963f66afa7",
      "device_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
      "paired_user_id": "11111111-2222-3333-4444-555555555555",
      "app_instance_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "mobile_device_label": "Coach iPhone 15",
      "bond_status": "bonded",
      "encryption_required": true,
      "encryption_confirmed": true,
      "last_seen_at": "2026-08-15T08:30:00.000Z",
      "revoked_at": null,
      "created_at": "2026-08-15T08:30:00.000Z",
      "updated_at": "2026-08-15T08:30:00.000Z"
    }
  ]
}
```

### Errors

| Status | Meaning |
| :--- | :--- |
| 403 | Forbidden — caller fails `hasOrgAccess` for the device's organisation. |
| 404 | Not found — no device with that `id`. |

---

## 3. Register Hardware Unit (`POST /devices`)

Registers a new hardware tracker in the inventory.

- **Path:** `/devices`
- **Method:** `POST`
- **Auth:** JWT
- **Required Roles:** `organisation_admin`, `ssp_super_admin`
- **Tenant Scope:** Org
- **Tenant Scope Check:** `hasOrgAccess` is evaluated against `body.organisation_id`; non-super-admins may only register devices in their own organisation.

### Request Body Schema (`createDevice`)

Validated by `zValidator('json', createDevice)`.

| Field | Type | Required | Constraints |
| :--- | :--- | :--- | :--- |
| `organisation_id` | `uuid` | yes | UUID |
| `serial_number` | `string` | yes | min 1, max 100 |
| `hardware_model` | `string` | yes | max 100 |
| `hardware_revision` | `string` | no | max 100 |
| `ble_device_name` | `string` | no | max 100 |
| `capability_mask` | `string` | no | max 255 |
| `firmware_version` | `string` | no | max 50 |
| `firmware_version_code` | `integer` | no | positive int |
| `protocol_version` | `string` | no | max 50 |

```json
{
  "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
  "serial_number": "SSP-S1-2026-00482",
  "hardware_model": "SSP-S1-PRO",
  "hardware_revision": "revB",
  "ble_device_name": "SSP-00482",
  "capability_mask": null,
  "firmware_version": "1.0.0",
  "firmware_version_code": 1000,
  "protocol_version": "v1"
}
```

### Response (`201 Created`)

The created `devices` row (`select('*')`).

### Errors

| Status | Meaning |
| :--- | :--- |
| 403 | Forbidden — missing role or fails org-scope check against `body.organisation_id`. |
| 500 | Unhandled / DB error (`{ error: "<message>" }`). |

---

## 4. Update Device (`PATCH /devices/:id`)

Updates firmware version, hardware/protocol metadata, or the telemetry status fields on a single tracker.

- **Path:** `/devices/:id`
- **Method:** `PATCH`
- **Auth:** JWT
- **Required Roles:** `organisation_admin`, `ssp_super_admin`
- **Tenant Scope:** Org
- **Path Parameters:**
  - `id` (`uuid`): Device identifier.

The handler loads the device's `organisation_id` and evaluates `hasOrgAccess` before applying the update.

### Request Body Schema (`updateDevice`)

Validated by `zValidator('json', updateDevice)`. All fields optional.

| Field | Type | Constraints |
| :--- | :--- | :--- |
| `firmware_version` | `string` | max 50 |
| `firmware_version_code` | `integer` | positive int |
| `hardware_revision` | `string` | max 100 |
| `protocol_version` | `string` | max 50 |
| `status` | `string` | max 50 |
| `last_battery_pct` | `integer` | 0–100 |
| `last_gnss_state` | `string` | max 50 |
| `last_app_state` | `string` | max 50 |

```json
{
  "status": "maintenance",
  "last_battery_pct": 12,
  "last_app_state": "error"
}
```

### Response (`200 OK`)

The updated `devices` row.

### Errors

| Status | Meaning |
| :--- | :--- |
| 403 | Forbidden — missing role or fails `hasOrgAccess`. |
| 404 | Not found — no device with that `id`. |
| 500 | Unhandled / DB error. |

---

## 5. Mobile BLE Pairing (`POST /devices/:id/pair`)

Establishes a BLE bond between the mobile application and the tracker unit. Automatically revokes any prior active pairing for the device before inserting the new bond.

- **Path:** `/devices/:id/pair`
- **Method:** `POST`
- **Auth:** JWT
- **Required Roles:** `athlete`, `coach`, `organisation_admin`, `ssp_super_admin`
- **Tenant Scope:** Org
- **Path Parameters:**
  - `id` (`uuid`): Device identifier.

> `athlete` is listed explicitly because `isAthlete` does **not** cascade — a `coach` is not treated as an `athlete` by the role helper. `sub_coach` is **not** included; requiring `coach` admits `coach`, `organisation_admin`, and `ssp_super_admin` but does not cascade down to `sub_coach`.

On success the handler:

1. Revokes the prior active pairing — `update pairing_states set revoked_at = now() where device_id = :id and revoked_at is null`.
2. Inserts a new `pairing_states` row with `bond_status: 'bonded'` and `paired_user_id: user.id`.

### Request Body Schema (`pairDevice`)

Validated by `zValidator('json', pairDevice)`.

| Field | Type | Required | Constraints / Default |
| :--- | :--- | :--- | :--- |
| `app_instance_id` | `string` | yes | min 1, max 200 |
| `mobile_device_label` | `string` | no | max 200 |
| `encryption_required` | `boolean` | no | default `true` |

```json
{
  "app_instance_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "mobile_device_label": "Player Android 14",
  "encryption_required": true
}
```

### Response (`201 Created`)

The created `pairing_states` row.

### Errors

| Status | Meaning |
| :--- | :--- |
| 403 | Forbidden — missing role. |
| 404 | Not found — no device with that `id`. |
| 500 | Unhandled / DB error. |

---

## 6. Unpair Device (`POST /devices/:id/unpair`)

Revokes the active BLE pairing bond on a device.

- **Path:** `/devices/:id/unpair`
- **Method:** `POST`
- **Auth:** JWT
- **Required Roles:** none — manual access check. Any authenticated user with `hasOrgAccess` to the device's organisation can unpair; there is no `requireRoles` gate.
- **Tenant Scope:** Org
- **Path Parameters:**
  - `id` (`uuid`): Device identifier.

### Response (`200 OK`)

```json
{
  "ok": true
}
```

### Errors

| Status | Meaning |
| :--- | :--- |
| 403 | Forbidden — caller fails `hasOrgAccess` for the device's organisation. |
| 404 | Not found — no device with that `id`. |

---

## 7. Assign Device to Athlete (`POST /devices/:id/assign`)

Assigns the tracker to an athlete by inserting a `device_assignments` row.

- **Path:** `/devices/:id/assign`
- **Method:** `POST`
- **Auth:** JWT
- **Required Roles:** `organisation_admin`, `ssp_super_admin`
- **Tenant Scope:** Org
- **Path Parameters:**
  - `id` (`uuid`): Device identifier.

The inserted row carries `device_id`, `athlete_id`, `organisation_id`, and `assigned_by_user_id` (the caller).

### Request Body Schema (`assignDevice`)

Validated by `zValidator('json', assignDevice)`.

| Field | Type | Required | Constraints |
| :--- | :--- | :--- | :--- |
| `athlete_id` | `uuid` | yes | UUID |

```json
{
  "athlete_id": "44444444-5555-6666-7777-888888888888"
}
```

### Response (`201 Created`)

The created `device_assignments` row.

### Errors

| Status | Meaning |
| :--- | :--- |
| 403 | Forbidden — missing role. |
| 404 | Not found — no device with that `id`. |
| 500 | Unhandled / DB error. |

---

## 8. Unassign Device (`DELETE /devices/:id/assign`)

Removes the current active athlete assignment by setting `unassigned_at` on the active `device_assignments` row.

- **Path:** `/devices/:id/assign`
- **Method:** `DELETE`
- **Auth:** JWT
- **Required Roles:** `organisation_admin`, `ssp_super_admin`
- **Tenant Scope:** Org
- **Path Parameters:**
  - `id` (`uuid`): Device identifier.

### Response (`200 OK`)

```json
{
  "ok": true,
  "unassigned": {
    "id": "5fa85f64-5717-4562-b3fc-2c963f66afa8",
    "device_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "athlete_id": "44444444-5555-6666-7777-888888888888",
    "organisation_id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
    "assigned_by_user_id": "11111111-2222-3333-4444-555555555555",
    "assigned_at": "2026-08-10T10:00:00.000Z",
    "unassigned_at": "2026-08-16T09:12:00.000Z",
    "created_at": "2026-08-10T10:00:00.000Z",
    "updated_at": "2026-08-16T09:12:00.000Z"
  }
}
```

`unassigned` is `null` when no active assignment was found to clear.

### Errors

| Status | Meaning |
| :--- | :--- |
| 403 | Forbidden — missing role. |
| 404 | Not found — no device with that `id`. |
| 500 | Unhandled / DB error. |

---

## 9. Firmware Update Offer (`GET /devices/:id/firmware-update`)

Checks whether a newer firmware release is available for the device and, if so, returns a signed download URL. This is a **Phase 3** (firmware OTA) endpoint. See [Firmware OTA](../firmware-ota) for the full publish/parse pipeline.

- **Path:** `/devices/:id/firmware-update`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none — manual access check via `hasOrgAccess` against the device's `organisation_id`.
- **Tenant Scope:** Org
- **Path Parameters:**
  - `id` (`uuid`): Device identifier.

### Selection logic

If the device has no `protocol_version`, the handler short-circuits before querying releases and returns `{ update_available: false, current_version, reason: 'Device protocol version is unknown' }` (see the response variant below).

The handler looks up the latest `firmware_releases` row for `target: 'nrf5340_app'` matching the device's `hardware_model`, `protocol_version`, and `hardware_revision` (matched literally, or where `hardware_revision is null`), ordered by `version_code desc` with `limit 1`. "Latest" is determined by the integer `version_code`, **not** semver parsing.

The release is **skipped** (treated as not an update) when either:

- `release.version === device.firmware_version`, or
- `device.firmware_version_code !== null && release.version_code <= device.firmware_version_code`.

When an update is available, a signed Storage download URL is created with a TTL of `FIRMWARE_DOWNLOAD_TTL_SECONDS` (900 seconds / 15 minutes). `storage_bucket` and `storage_path` are stripped from the release object before it is returned.

### Response (`200 OK`) — update available

```json
{
  "update_available": true,
  "current_version": "1.0.0",
  "release": {
    "id": "6ace1d20-7f2a-4c10-9b1b-3f3a0d9c1e10",
    "target": "nrf5340_app",
    "hardware_model": "SSP-S1-PRO",
    "hardware_revision": "revB",
    "version": "1.1.0",
    "version_code": 1100,
    "protocol_version": "v1",
    "mandatory": false,
    "release_notes": "Stability and BLE bonding fixes.",
    "content_type": "application/octet-stream",
    "file_size": 262144,
    "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "published_at": "2026-08-01T12:00:00.000Z"
  },
  "signed_url": "https://example.supabase.co/storage/v1/object/sign/firmware-releases/...?token=...",
  "expires_in": 900
}
```

### Response (`200 OK`) — no update available

```json
{
  "update_available": false,
  "current_version": "1.1.0"
}
```

### Response (`200 OK`) — device protocol version unknown

When the device has no `protocol_version`, the handler short-circuits before querying releases and returns a `reason`:

```json
{
  "update_available": false,
  "current_version": "1.0.0",
  "reason": "Device protocol version is unknown"
}
```

### Errors

| Status | Meaning |
| :--- | :--- |
| 403 | Forbidden — caller fails `hasOrgAccess` for the device's organisation. |
| 404 | Not found — no device with that `id`. |
| 500 | Unhandled / DB / Storage error. |

---

## 10. Firmware Update Status Report (`POST /devices/:id/firmware-update/status`)

Records the device-side progress of a firmware update attempt in `device_update_attempts`. This is a **Phase 3** (firmware OTA) endpoint. See [Firmware OTA](../firmware-ota).

- **Path:** `/devices/:id/firmware-update/status`
- **Method:** `POST`
- **Auth:** JWT
- **Required Roles:** none — manual access check via `hasOrgAccess` against the device's `organisation_id`.
- **Tenant Scope:** Org
- **Path Parameters:**
  - `id` (`uuid`): Device identifier.

### Request Body Schema (`reportFirmwareUpdate`)

Validated by `zValidator('json', reportFirmwareUpdate)`.

| Field | Type | Required | Constraints |
| :--- | :--- | :--- | :--- |
| `attempt_id` | `uuid` | yes | UUID |
| `firmware_release_id` | `uuid` | yes | UUID |
| `status` | `enum` | yes | one of `downloading`, `transferring`, `testing`, `rebooting`, `confirmed`, `failed`, `cancelled` |
| `progress_pct` | `integer` | no | 0–100, nullable |
| `error_code` | `string` | no | max 100, nullable |
| `error_message` | `string` | no | max 2000, nullable |

```json
{
  "attempt_id": "7bce1d20-7f2a-4c10-9b1b-3f3a0d9c1e20",
  "firmware_release_id": "6ace1d20-7f2a-4c10-9b1b-3f3a0d9c1e10",
  "status": "transferring",
  "progress_pct": 42
}
```

### Behaviour

1. Loads the referenced `firmware_releases` row; if it does not exist, returns `404 { error: 'Firmware release not found' }`. Otherwise validates compatibility with the device — `target`, `hardware_model`, `hardware_revision`, and `protocol_version` must all match. A mismatch returns `409 { error: 'Firmware release is not compatible with device' }`.
2. If the `attempt_id` already exists but belongs to a different user or device, the request is rejected with `403`.
3. Upserts the `device_update_attempts` row with the reported `status`, `progress_pct`, `error_code`, and `error_message`.
4. Terminal statuses — `confirmed`, `failed`, `cancelled` — set `completed_at`.
5. On `confirmed`, the handler also updates `devices.firmware_version` and `devices.firmware_version_code` to the release's values, completing the OTA loop.

### Response (`200 OK`)

```json
{
  "attempt": {
    "id": "7bce1d20-7f2a-4c10-9b1b-3f3a0d9c1e20",
    "device_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "firmware_release_id": "6ace1d20-7f2a-4c10-9b1b-3f3a0d9c1e10",
    "requested_by_user_id": "11111111-2222-3333-4444-555555555555",
    "from_version": "1.0.0",
    "status": "transferring",
    "progress_pct": 42,
    "error_code": null,
    "error_message": null,
    "started_at": "2026-08-16T09:00:00.000Z",
    "completed_at": null,
    "created_at": "2026-08-16T09:00:00.000Z",
    "updated_at": "2026-08-16T09:01:00.000Z"
  }
}
```

### Errors

| Status | Meaning |
| :--- | :--- |
| 403 | Forbidden — caller fails `hasOrgAccess`, or the attempt belongs to another user/device. |
| 404 | Not found — no device with that `id`, or the referenced `firmware_release_id` does not exist. |
| 409 | Conflict — firmware release is not compatible with the device. |
| 500 | Unhandled / DB error. |
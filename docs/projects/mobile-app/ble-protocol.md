---
title: BLE GATT Protocol
description: GATT service, characteristic map (0x02–0x08), binary parsers/builders, and implemented-vs-spec divergences for the SSP-S1 SportTracker firmware protocol used by SSP-Mobile-App.
outline: deep
---

# BLE GATT Protocol

The mobile app talks to the **SSP-S1** tracker (Nordic Thingy:91X / nRF9151) over a single custom GATT service. The wire format is fully defined in `src/features/tracker/protocol.ts` — binary, little-endian, no JSON on the wire. This page documents the **implemented** protocol as it exists in code.

> [!IMPORTANT]
> The implemented `protocol.ts` is **authoritative** for this app. The design spec `docs/superpowers/specs/2026-06-23-ble-protocol-alignment-design.md` is a **Draft** and diverges from the code in several places (download command byte, session-ID width, list-entry layout, missing DELETE/DFU). See [Divergence from spec](#divergence-from-spec). Where the two disagree, the code wins.

Source: `src/features/tracker/protocol.ts`. Service layer (BleManager, connect/download timeouts, provider): see [Live Tracking & Sync](./tracker-and-sync). Upload of parsed sessions to the backend: see [Ingestion Pipeline](../backend/ingestion-pipeline).

---

## Constants

| Constant | Value | Notes |
| :--- | :--- | :--- |
| `TRACKER_NAME` | `"SportTracker"` | Advertised device name used to filter scan results. |
| `TRACKER_SERVICE_UUID` | `00000001-1234-5678-9ABC-DEF012345678` | The single custom GATT service. |
| `STATUS_CHARACTERISTIC_UUID` | `00000002-1234-5678-9ABC-DEF012345678` | 0x02 — Status. |
| `SESSION_LIST_CHARACTERISTIC_UUID` | `00000003-1234-5678-9ABC-DEF012345678` | 0x03 — Session list. |
| `SESSION_CONTROL_CHARACTERISTIC_UUID` | `00000004-1234-5678-9ABC-DEF012345678` | 0x04 — Session control (write). |
| `SESSION_DATA_CHARACTERISTIC_UUID` | `00000005-1234-5678-9ABC-DEF012345678` | 0x05 — Session data (notify). |
| `AGPS_CHARACTERISTIC_UUID` | `00000006-1234-5678-9ABC-DEF012345678` | 0x06 — A-GPS reference location. |
| `LIVE_DATA_CHARACTERISTIC_UUID` | `00000008-1234-5678-9ABC-DEF012345678` | 0x08 — Live IMU/GNSS samples. |

There is **no** `0x07` (DFU Control) characteristic UUID defined in `protocol.ts`. DFU is not implemented at the protocol layer — see [Divergence from spec](#divergence-from-spec).

### Session control commands (`SESSION_COMMAND`)

| Command | Bytes | Payload |
| :--- | :--- | :--- |
| `start` | `[0x01]` | 1 byte — begin recording. |
| `stop` | `[0x02]` | 1 byte — stop recording. |
| `list` | `[0x10]` | 1 byte — request the stored-session list (delivered on 0x03). |
| `download(sessionId)` | `[0x11, sid & 0xff, (sid >>> 8) & 0xff]` | 3 bytes — `0x11` + session ID as **u16 LE**. |

---

## Characteristic table

All multi-byte fields are **little-endian**. Offsets are relative to the characteristic value payload.

| UUID | Name | Direction | Implemented payload & semantics | Spec doc says | Divergence |
| :---: | :--- | :--- | :--- | :--- | :--- |
| `0x02` | STATUS | notify / read | **8 bytes**, `parseStatus`. Byte 0 `batteryPercent` (u8); byte 1 `gnssState` (u8); byte 2 `isRecording` (bool, `!== 0`); byte 3 unused; bytes 4–7 `firmwareSessionId` (u32 LE, exposed as `null` when `0`). | 8-byte status: battery, gnss_state, app_state, session_id. | Conceptually matches; parser exposes `firmwareSessionId` as `number \| null` and skips byte 3. |
| `0x03` | SESSION_LIST | notify / read | **15-byte entries**, `parseSessionListEntry`, OR a single `0x00` byte (→ `null`, empty/terminator). Entry fields actually decoded: `firmwareSessionId` (u16 LE @0), `recordCount` (u32 LE @2), `unixEpochSeconds` (u32 LE @6), `fileSizeBytes` (u16 LE @10). The parser requires exactly 15 bytes but only decodes the first 12; bytes 12–14 are part of the frame but unused by the type. | **17-byte** entries: `session_id` u32, `start_time_utc` u32, `duration_s` u32, `sport` u8, `point_count` u16, `crc16` u16. | **Major.** Code uses 15 B + `0x00` terminator and a u16 session ID with a different field set (`recordCount`/`unixEpochSeconds`/`fileSizeBytes`) — not the spec's 17 B `start_time`/`duration`/`sport`/`point_count`/`crc16`. |
| `0x04` | SESSION_CONTROL | write | `SESSION_COMMAND`: start `[0x01]`, stop `[0x02]`, list `[0x10]`, download `[0x11, sid_u16_LE]`. | `0x01` START, `0x02` STOP, `0x03` DELETE (stub), `0x04` STREAM `[0x04, sid_u32_LE]`. | **Major.** Download is `0x11` + **u16** in code vs `0x04` + **u32** in spec. Code has **no** `0x03` DELETE. Code adds `0x10` list (spec reads the list via 0x03 directly). |
| `0x05` | SESSION_DATA | notify | `parseSessionDownloadEvent`. `0x01` chunk (payload = `bytes.slice(1)`, requires ≥ 2 B); `0x00` complete (**7 B**: `firmwareSessionId` u16 LE @1, `totalBytes` u32 LE @3); `0xff` error (**4 B**: `firmwareSessionId` u16 LE @1, `code` u8 @3). Chunk payloads are concatenated and parsed as a v2 firmware session via `parseFirmwareSession`. | 10-byte chunk headers (message_type, session_id **u32**, chunk_index, total_chunks, point_count) + 36-byte `session_data_point_t`. EOS 9 B `[0x00, sid_u32, 0x0000, 0x0000]`; error 6 B `[0xFF, sid_u32, err]`. | **Major.** Code uses **u16** session IDs (7 B complete / 4 B error) vs spec **u32** (9 B / 6 B). Code chunks are raw v2-firmware-session bytes (no chunk_index/total_chunks/point_count header), not the spec's 36-byte point stream. |
| `0x06` | AGPS | write / notify | `buildReferenceLocationRequest` → 23 B; `parseReferenceLocationResult` → 4 B with subtype `0x20`. See [A-GPS reference location](#a-gps-reference-location-0x06). | 0x06 A-GPS. | Matches. |
| `0x07` | DFU Control | — | **Not implemented.** No UUID constant, no parser, no builder in `protocol.ts`. | Spec references a DFU Control characteristic. | **Major.** DFU does not exist in code. |
| `0x08` | LIVE_DATA | notify | `parseLiveSample`. IMU `0x01` (**21 B**) / GNSS `0x02` (requires ≥ **23 B**, tolerates up to 43 B trailing). See [Live data](#live-data-0x08). | New 0x08: IMU 0x01 21 B, GPS 0x02 43 B. | IMU matches. **GNSS encoding differs**: code parses 23 B of scaled integers (int32 lat/lng ÷1e7, int16 alt ÷100, u16 speed ÷100, u64 timestamp, u8 satellites, u8 valid); spec describes a 43-byte IEEE-float layout (float64 lat/lng, float32 alt/speed/heading/hdop, u8 satellites/fix_valid @33/34, int64 timestamp @35). Code exposes no heading/hdop. |

---

## Live data (0x08)

`parseLiveSample` reads a type tag from byte 0 and dispatches.

**IMU (`0x01`) — 21 bytes**

| Offset | Size | Field | Type | Notes |
| :---: | :---: | :--- | :--- | :--- |
| 0 | 1 | type | u8 | `0x01` = IMU. |
| 1 | 2 | accelerationMg.x | i16 LE | millig. |
| 3 | 2 | accelerationMg.y | i16 LE | millig. |
| 5 | 2 | accelerationMg.z | i16 LE | millig. |
| 7 | 2 | gyroscopeRaw.x | i16 LE | raw. |
| 9 | 2 | gyroscopeRaw.y | i16 LE | raw. |
| 11 | 2 | gyroscopeRaw.z | i16 LE | raw. |
| 13 | 8 | timestampMs | u64 LE | read via `readUint64Le` (safe-integer check). |

**GNSS (`0x02`) — minimum 23 bytes (tolerates trailing bytes up to 43)**

| Offset | Size | Field | Type | Notes |
| :---: | :---: | :--- | :--- | :--- |
| 0 | 1 | type | u8 | `0x02` = GNSS. |
| 1 | 4 | latitude | i32 LE | ÷ 1e7 → degrees. |
| 5 | 4 | longitude | i32 LE | ÷ 1e7 → degrees. |
| 9 | 2 | altitudeMeters | i16 LE | ÷ 100 → metres. |
| 11 | 2 | speedMps | u16 LE | ÷ 100 → m/s. |
| 13 | 8 | timestampMs | u64 LE | safe-integer check. |
| 21 | 1 | satellites | u8 | — |
| 22 | 1 | valid | u8 | `!== 0` → fix valid. |

The parser throws `Unknown live sample type` for any other byte-0 value.

---

## A-GPS reference location (0x06)

`buildReferenceLocationRequest(requestId, reference: PhoneReferenceLocation)` builds a **23-byte** write payload. It validates that `requestId` fits in 16 bits and that lat/long are finite and in range, then rounds/ceils the metadata into firmware limits (altitude as i16, accuracy 1–65535, epoch 1–0xffffffff, uncertainty 0–65535).

| Offset | Size | Field | Type | Value |
| :---: | :---: | :--- | :--- | :--- |
| 0 | 1 | subtype | u8 | `1` |
| 1 | 1 | — | u8 | `1` |
| 2 | 2 | requestId | u16 LE | caller-supplied. |
| 4 | 4 | latitude | i32 LE | `round(lat * 1e7)`. |
| 8 | 4 | longitude | i32 LE | `round(lng * 1e7)`. |
| 12 | 2 | altitudeMeters | i16 LE | `round(altitude)`. |
| 14 | 2 | horizontalAccuracyMeters | u16 LE | `ceil(accuracy)`. |
| 16 | 1 | — | u8 | `68` (firmware constant). |
| 17 | 4 | unixEpochSeconds | u32 LE | `floor(epoch)`. |
| 21 | 2 | timeUncertaintyMs | u16 LE | `ceil(uncertainty)`. |

`parseReferenceLocationResult` reads **4 bytes**: byte 0 must be `0x20` (subtype), `requestId` u16 LE @1, `code` u8 @3. Any other subtype throws.

---

## Firmware session binary format (0x05 chunks)

Download chunks from 0x05 are concatenated and handed to `parseFirmwareSession`, which expects a **v2** binary session file.

**Header — 32 bytes**

| Offset | Size | Field | Type | Notes |
| :---: | :---: | :--- | :--- | :--- |
| 0 | 4 | magic | u32 LE | must equal `0x53535031` (`"SSP1"`). |
| 4 | 1 | version | u8 | must equal `2`. |
| 8 | 4 | startUptimeMs | u32 LE | uptime anchor for record timestamps. |
| 12 | 4 | unixEpochSeconds | u32 LE | GPS/UTC anchor; `0` ⇒ session cannot be uploaded. |

**Record — 17 bytes**, repeating from offset 32. `(byteLength − 32) % 17` must be `0` else a partial-record error is thrown.

| Offset | Size | Field | Type | Notes |
| :---: | :---: | :--- | :--- | :--- |
| 0 | 1 | type | u8 | `0x01` IMU · `0x02` GNSS · other ⇒ error. |
| **IMU (`0x01`)** | | | | |
| 1 | 2 | accelerationMg.x | i16 LE | |
| 3 | 2 | accelerationMg.y | i16 LE | |
| 5 | 2 | accelerationMg.z | i16 LE | |
| 7 | 2 | gyroscopeRaw.x | i16 LE | |
| 9 | 2 | gyroscopeRaw.y | i16 LE | |
| 11 | 2 | gyroscopeRaw.z | i16 LE | |
| 13 | 4 | uptimeMs | u32 LE | updates `lastUptimeMs` anchor. |
| **GNSS (`0x02`)** | | | | |
| 1 | 4 | latitude | i32 LE | ÷ 1e7. |
| 5 | 4 | longitude | i32 LE | ÷ 1e7. |
| 9 | 2 | altitudeMeters | i16 LE | ÷ 100. |
| 11 | 2 | speedMps | u16 LE | ÷ 100. |
| 13 | 1 | hdop | u8 | |
| 14 | 1 | satellites | u8 | |
| 15 | 1 | valid | u8 | `!== 0`. |
| 16 | — | approximateUptimeMs | — | reconstructed from the last IMU `uptimeMs` (firmware omits GNSS record time). |

---

## Parsers & builders

| Function | Input | Output | Validation / behaviour |
| :--- | :--- | :--- | :--- |
| `buildReferenceLocationRequest` | `requestId: number`, `reference: PhoneReferenceLocation` | `Uint8Array` (23 B) | Validates 16-bit request ID, lat/long range, firmware limits on altitude/accuracy/epoch/uncertainty. |
| `parseReferenceLocationResult` | `Uint8Array` | `ReferenceLocationResult` | Requires 4 B; byte 0 must be `0x20`. |
| `parseStatus` | `Uint8Array` | `TrackerStatus` | Requires 8 B; `firmwareSessionId` `0` → `null`. |
| `parseLiveSample` | `Uint8Array` | `LiveSample` (IMU or GNSS) | IMU requires 21 B; GNSS requires ≥ 23 B; unknown type throws. |
| `parseSessionListEntry` | `Uint8Array` | `StoredSessionInfo \| null` | 1-byte `0x00` → `null`; otherwise requires 15 B. |
| `parseSessionDownloadEvent` | `Uint8Array` | `SessionDownloadEvent` | `0x01` chunk (≥ 2 B), `0x00` complete (7 B), `0xff` error (4 B). |
| `parseFirmwareSession` | `Uint8Array` | `ParsedFirmwareSession` | Magic `0x53535031`, version `2`, header 32 B, record 17 B; rejects partial records. |
| `toTelemetryEnvelope` | `ParsedFirmwareSession`, `options?: { backendSessionId?, firmwareSessionId? }` | `TelemetryEnvelope` | Rejects > 100,000 points. **Requires `unixEpochSeconds !== 0`** (no GPS/UTC anchor) — checked even for empty sessions so an invalid file can never be marked synced. IMU → `accel_magnitude` in m/s² (`Math.hypot(x,y,z) * 0.00980665`); GNSS included only when `valid`. |

`toTelemetryEnvelope` is the bridge from a parsed firmware session to the backend ingest contract. The envelope is then uploaded via a signed URL (no bearer) and finalized with `completeIngest` — see [Live Tracking & Sync](./tracker-and-sync) and [Ingestion Pipeline](../backend/ingestion-pipeline).

---

## Types

Exported from `protocol.ts`:

- `TrackerStatus` — `{ batteryPercent, gnssState, isRecording, firmwareSessionId: number | null }`.
- `PhoneReferenceLocation` — `{ latitude, longitude, altitudeMeters, horizontalAccuracyMeters, unixEpochSeconds, timeUncertaintyMs }`.
- `ReferenceLocationResult` — `{ requestId, code }`.
- `LiveImuSample` — `{ kind: "imu", accelerationMg: {x,y,z}, gyroscopeRaw: {x,y,z}, timestampMs }`.
- `LiveGnssSample` — `{ kind: "gnss", latitude, longitude, altitudeMeters, speedMps, timestampMs, satellites, valid }`.
- `LiveSample` — `LiveImuSample | LiveGnssSample`.
- `StoredSessionInfo` — `{ firmwareSessionId, recordCount, unixEpochSeconds, fileSizeBytes }`.
- `SessionDownloadEvent` — `{ kind: "chunk", bytes } | { kind: "complete", firmwareSessionId, totalBytes } | { kind: "error", firmwareSessionId, code }`.
- `StoredImuRecord` — `{ kind: "imu", accelerationMg: {x,y,z}, gyroscopeRaw: {x,y,z}, uptimeMs }`.
- `StoredGnssRecord` — `{ kind: "gnss", latitude, longitude, altitudeMeters, speedMps, hdop, satellites, valid, approximateUptimeMs }`.
- `StoredRecord` — `StoredImuRecord | StoredGnssRecord`.
- `ParsedFirmwareSession` — `{ version: 2, startUptimeMs, unixEpochSeconds, records: StoredRecord[], byteLength }`.
- `TelemetryEnvelope` — `{ version: 1, session_id?, firmware_session_id?, points: { timestamp, lat?, lng?, speed_mps?, accel_magnitude? }[] }`.

---

## Divergence from spec

The design spec (`docs/superpowers/specs/2026-06-23-ble-protocol-alignment-design.md`, status **Draft**) describes the intended firmware protocol. The shipped `protocol.ts` was written against the real firmware and diverges in the ways below. **The implemented behaviour is authoritative for this app**; the spec is Draft and has not been reconciled.

### Primary divergences (4)

1. **Download command — `0x11` + u16 vs `0x04` + u32.**
   Code writes `[0x11, sid & 0xff, (sid >>> 8) & 0xff]` (3 bytes, session ID as **u16 LE**) to characteristic 0x04. The spec defines `0x04` STREAM with `[0x04, sid_LE32]` (5 bytes, **u32 LE**). The code's session IDs are 16-bit throughout (`parseSessionListEntry`, `parseSessionDownloadEvent` both read u16 IDs).

2. **No `0x03` DELETE.**
   `SESSION_COMMAND` exposes only `start` (`0x01`), `stop` (`0x02`), `list` (`0x10`), and `download` (`0x11`). The spec's `0x03` DELETE (with implicit confirmation via an updated 0x03 list notification) is **not implemented** — there is no way to delete a stored session over BLE from the app.

3. **No `0x07` DFU Control.**
   There is no DFU characteristic UUID, parser, or builder in `protocol.ts`. The spec references a DFU Control characteristic; it does not exist in code. Do not assume any OTA/DFU path through this module. (Firmware OTA, when it exists, is a separate concern — see [Configuration & Build](./configuration).)

4. **Session list entry — 15 B + null vs 17 B.**
   `parseSessionListEntry` requires 15 bytes and also accepts a 1-byte `0x00` payload as `null` (empty/terminator). The decoded fields are `firmwareSessionId` (u16), `recordCount` (u32), `unixEpochSeconds` (u32), `fileSizeBytes` (u16) — 12 decoded bytes; bytes 12–14 are frame bytes the type ignores. The spec's 17-byte entry is a different layout: `session_id` u32, `start_time_utc` u32, `duration_s` u32, `sport` u8, `point_count` u16, `crc16` u16. The field sets do not line up.

### Secondary encoding divergences

These follow from the u16 session-ID model and the v2 firmware-session format, but are worth stating explicitly for anyone implementing against this protocol:

- **0x05 complete/error events use u16 session IDs.** Code: complete is 7 B (`0x00`, `firmwareSessionId` u16, `totalBytes` u32), error is 4 B (`0xff`, `firmwareSessionId` u16, `code` u8). Spec: EOS is 9 B (`0x00`, `sid` u32, two reserved u16) and error is 6 B (`0xff`, `sid` u32, `code`). The code's complete event also carries `totalBytes` (total downloaded bytes), which the spec's EOS does not.
- **0x05 chunk framing differs.** Code chunks are raw firmware-session bytes (`bytes.slice(1)`), concatenated and parsed by `parseFirmwareSession` as a v2 binary file (magic `0x53535031`, 32-byte header, 17-byte records). The spec's chunks carry a 10-byte header (`message_type`, `session_id` u32, `chunk_index`, `total_chunks`, `point_count`) followed by 36-byte `session_data_point_t` records. The code does not parse `chunk_index`/`total_chunks`/`point_count` and does not use the spec's 36-byte point layout.
- **0x08 GNSS field encoding differs.** IMU (`0x01`, 21 B) matches the spec. GNSS (`0x02`) does not: the code parses 23 bytes of scaled integers (int32 lat/lng ÷1e7, int16 alt ÷100, u16 speed ÷100, u64 timestamp @13, u8 satellites @21, u8 valid @22) and tolerates trailing bytes up to 43. The spec describes a 43-byte IEEE-float layout (float64 lat @1/lng @9, float32 alt @17/speed @21/heading @25/hdop @29, u8 satellites @33/fix_valid @34, int64 timestamp @35). The code exposes no heading or hdop. The firmware currently emits a 43-byte structure, but only the first 23 bytes are documented/decoded.

### Not a divergence (clarification)

- The "5 s / 6 s timeout convention" appears in the stale `CLAUDE.md` prose only. It is **not** in the spec and **not** in the code. Real BLE operation timeouts live in the service layer (`tracker-service.ts`): connect 15 s, status-confirm 10 s, reference 10 s, list 30 s, download 90 s. Those are documented in [Live Tracking & Sync](./tracker-and-sync), not here.

---

## Session streaming flow

The end-to-end flow for listing, downloading, and uploading a stored session. The service layer (BleManager, timeouts, sequential operation slots) is in [Live Tracking & Sync](./tracker-and-sync); this diagram shows the protocol-level exchange.

```mermaid
sequenceDiagram
    autonumber
    participant App as App (protocol.ts)
    participant FW as SSP-S1 firmware
    participant BE as Backend (SSP-API)

    App->>FW: write 0x04 SESSION_CONTROL list [0x10]
    FW-->>App: notify 0x03 SESSION_LIST (15 B entries, 0x00 terminator)
    Note over App: parseSessionListEntry → StoredSessionInfo[]{ firmwareSessionId, recordCount, unixEpochSeconds, fileSizeBytes }
    App->>FW: write 0x04 SESSION_CONTROL download [0x11, sid_u16_LE]
    loop chunked notify
        FW-->>App: notify 0x05 SESSION_DATA chunk [0x01, ...bytes]
        Note over App: parseSessionDownloadEvent → {kind:"chunk", bytes}
    end
    FW-->>App: notify 0x05 SESSION_DATA complete [0x00, sid_u16, totalBytes_u32]
    Note over App: concatenate chunks → parseFirmwareSession (magic 0x53535031, v2, 32 B header, 17 B records)
    Note over App: toTelemetryEnvelope (requires unixEpochSeconds ≠ 0; max 100 k points)
    App->>BE: createIngestUrl → PUT signed URL (no bearer) → completeIngest
    Note over App: uploadFirmwareSession returns point count
```

If the firmware cannot find the requested session or the stream fails, it sends a `0xff` error event (`{ kind: "error", firmwareSessionId, code }`) on 0x05 instead of reaching `complete`.

---

## Tests

- `src/features/tracker/protocol.test.ts` (vitest) — covers every parser, the v2 firmware-session parse, `toTelemetryEnvelope` (including the refusal of a no-GPS-anchor session), and the 23-byte A-GPS request builder.

Test runners and the full tracker test surface are described in [Testing](./testing).
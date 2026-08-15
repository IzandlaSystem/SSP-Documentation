---
title: Testing
description: Dual-runner test architecture for the SSP-Mobile-App — vitest unit tests and node --test source-contract tests, with the brand-contract and ux-truth-source enforcement gates.
outline: deep
---

# Testing

The **SSP-Mobile-App** runs **two test runners in one command**. `npm test`
executes `vitest run` first, then `npm run test:legacy` (`node --test` over every
`.test.mjs` file). The split is deliberate, not legacy baggage: the two runners
guard two different kinds of truth about the codebase.

```mermaid
flowchart LR
    NPM["npm test"] --> Vitest["vitest run<br/>src/**/*.test.ts"]
    NPM --> Legacy["npm run test:legacy<br/>node --test *.test.mjs"]
    Vitest -->|"imports modules<br/>runs in VM/transform"| Unit["Unit tests<br/>protocol, api, adapter, sync"]
    Legacy -->|"reads source as text<br/>grep + regex asserts"| Contract["Source-contract tests<br/>brand, ux-truth, device, tracker-ui, ..."]
```

Source: `package.json` (`scripts.test`, `scripts.test:legacy`),
`vitest.config.ts`.

> **Stale-CLAUDE.md note.** The mobile repo's `CLAUDE.md` claims there is "No
> test runner". That is wrong. The dual runner below is wired in `package.json`
> and `vitest.config.ts` and covers 18 test files. Cite those files, not
> `CLAUDE.md`.

---

## Why two runners

| Runner | Files | What it asserts | Why it needs its own runner |
| :--- | :--- | :--- | :--- |
| `vitest run` | `src/**/*.test.ts` (4 files) | **Unit behavior** — import the module, call the function, assert on the returned value. | Needs ESM/TS transform + a mockable `fetch`. Vitest provides both; tests `vi.mock("./supabase")` and stub `fetchImpl`. |
| `node --test` | `src/**/*.test.mjs` (14 files) | **Source-contract + behavioral facts** — read the source file as text, assert that specific strings, regexes, and structural facts hold (e.g. `assert.doesNotMatch(css, /34 197 94/)`, `assert.match(layout, /Figtree/) !== ...`). | Runs under plain Node so tests can `readFileSync` the source tree and grep it. No transform step, no module graph — the assertions are about what is literally on disk. |

The `.test.mjs` suite is named "legacy" in the npm script only because it predates
the vitest addition. It is not deprecated: it carries the highest-value
enforcement tests in the repo (brand-contract and ux-truth-source, below).

### Vitest configuration

`vitest.config.ts` is minimal and explicit:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: [".worktrees/**", "node_modules/**"],
  },
});
```

The glob `src/**/*.test.ts` is what scopes vitest to the 4 unit-test files; the
`.mjs` source-contract files are never picked up by vitest because they do not
match the `include` pattern. The `.worktrees/**` exclusion keeps agent worktree
copies out of the run.

---

## Vitest files (4)

These are the only files vitest runs. All four import the module under test and
assert on real return values.

| File | Scope |
| :--- | :--- |
| `src/lib/api.test.ts` | Hand-rolled fetch client: Bearer token attached, 401 when no Supabase session, `ApiError` on 403, `uploadToSignedUrl` sends **no** Bearer, and the full 28-method path+HTTP-method map. Mocks `./supabase` and a `fetchImpl`. |
| `src/lib/api-session-adapter.test.ts` | Unit conversions (m→km, mps→kmh×3.6), `intensity` thresholds (High at ≥70, etc.), `totalMetrics`, and `telemetryToHeatPoints` normalization. |
| `src/features/tracker/protocol.test.ts` | Every BLE parser: `parseStatus`, `parseLiveSample` (IMU 21B / GNSS), `parseSessionListEntry` (15B + null), `parseSessionDownloadEvent`, `parseFirmwareSession` (v2 magic `0x53535031`), `buildReferenceLocationRequest` (23B), `parseReferenceLocationResult`, and `toTelemetryEnvelope` including the refusal of a no-GPS anchor (`unixEpochSeconds === 0`). |
| `src/features/tracker/sync.test.ts` | `uploadFirmwareSession`: `createIngestUrl` → `uploadToSignedUrl` (no bearer) → `completeIngest`, returns point count. |

---

## node --test files (14)

Each `.test.mjs` file is a Node test suite that reads source as text and/or
imports pure modules. One-line summaries below; full descriptions live in the
relevant sibling doc.

| File | One-line summary |
| :--- | :--- |
| `src/app/index-source.test.mjs` | `FORCE_DASHBOARD` routes coach home; otherwise the onboarding/remember/supabase session gate resolves role. |
| `src/components/dashboard/brand-contract.test.mjs` | **Brand enforcement** — all 14 CSS/theme token triples, no `34 197 94` / `#22C55E`, no Figtree, gluestack system-mode clearing, shared-primitive brand typography + 48dp + no palette utilities, auth Switch `min-h-12`, avatar `bg-primary` (no `bg-green-`), NativeTabs `tintColor="#003399"`, `ssp-mark.png` sha256 pin. |
| `src/components/dashboard/charts/time-series-chart.test.mjs` | Plot geometry finite for empty/one-point/flat/negative/normal data, cubic controls in-segment range, accessibility label (range/unit/extrema/latest/direction), latest comparison, both roles day/week/month datasets. |
| `src/components/dashboard/coach-feedback.test.mjs` | Fixture length 3, dates newest-first, deterministic absolute dates (`"18 Jul 2026"`). |
| `src/components/dashboard/dashboard-helpers.test.mjs` | `getProgressPercentage` clamps, `usesLargeTextLayout` at 1.5 + rejects NaN/Infinity, `buildPerformanceSummaryAccessibilityLabel` up/down/no-change with NaN/Infinity fallback. |
| `src/components/dashboard/heatmap-density.test.mjs` | Invalid samples removed/clamped, nearby greater than isolated density, empty/single stable, dominant third / insight / peak percent, accessibility label. |
| `src/components/dashboard/session-history-source.test.mjs` | Both analytics screens expose `SessionHistorySection` + `useApiSessions`, expansion/row accessibility, wrapper-rotation (not icon), detail bounded nav + heatmap legend + role metrics, SVG instance-scoped defs + markings on top, role routes stable + `router.replace` (no `router.back`), semantic blue→red density, session detail preserves API UUID + truthful missing states. |
| `src/components/dashboard/session-history.test.mjs` | Fixture length 4, ordered earliest to latest, valid ISO timestamps, duration greater than 0, gpsPoints 0 to 1 normalized, adjacent-nav boundaries, newest-first sort, role metric selection (coach=teamMetrics, player=playerMetrics). |
| `src/components/dashboard/ux-truth-source.test.mjs` | **Truthfulness gate** — coach mail `Linking.canOpenURL/openURL` + catch + Alert + 48dp, remember-me one Switch no Pressable, auth `signInWithPassword` + `getMe` + shared `LogoutSettingsRow`, device Demo disclosure ("no hardware contacted"), organisation InfoRow "Not connected" no onPress, weekly goals read-only 48dp no Save, `AccountStep` `supabase.signUp`, dashboard semantic canvas + SVG colors, 112px tab clearance, performance summary one accessible summary no decorative ring + stacks at font scales, player home bounded text + `DASHBOARD_MAX_FONT_SIZE_MULTIPLIER`, `DeviceReadinessCard` presentational, readiness row alignment + status icons, coach/player home order, 48dp headers/rows, `PowerScoreRing` trend badge, no legacy green constants, squad/trainer truthful searchable lists, people rows one status no fake actions, team/organisation non-interactive explanatory, logout failure-tolerant local, role boundaries + `DevRoleSwitcher` disabled. |
| `src/components/onboarding/onboarding-brand-source.test.mjs` | Entry + auth use `ssp-mark` (no ShieldCheck), auth guards concurrent sign-in + truthful copy, onboarding header SSP identity once, primary/secondary actions wired + dashboard bypass dev-only, carousel replaces legacy icon hero, form labels/errors/password accessible, motion bounded + ReduceMotion (duration 0.2, no spring), choice cards + progress dots 48dp. |
| `src/features/devices/device-state.test.mjs` | Exhaustive reducer/selector coverage: coach vs player visibility, readiness states, priority, add/assign/rename/sync/update/connect/disconnect/unlink determinism, duplicate-pairing failure, `sessionCleared`, capacity/battery clamps, bulk selectors, assignment labels, operation labels, attention reasons, activity uniqueness/newest-first. |
| `src/features/devices/device-ui-source.test.mjs` | Mock-only import enforcement (no `react-native-ble-plx`/supabase/async-storage in `src/features/devices/**`), 48dp buttons, accessibility props, Demo disclosures, role wrappers, checkout-relative imports (no `@/features/devices`), fixtures coverage, bulk preview disclosure, `DemoModeBanner`, status badges, `DeviceRow` single Pressable, `SessionCapacity` guards, `AddDeviceScreen` 3 steps + `usePreventRemove` + `ExitIntent` + pairing result, `FirmwareUpdateSheet` state machine, provider timer cancellation + coach-only assignment. |
| `src/features/tracker/tracker-ui-source.test.mjs` | Live tracking state labels + elapsed + connection quality + one primary action, brand red non-text only (`backgroundColor: "#FF0000"`, no `text-[#FF0000]` / `color:`), secondary ops disabled + motion-free, elapsed resets on connection/recording loss, device/API Pressables expose blocked state. |
| `src/lib/logout.test.mjs` | Logout attempts every cleanup, navigate LAST (`allSettled`, even if `signOut` throws). |

---

## Enforcement highlights

Two of the `.test.mjs` files do disproportionate work. They are the reason the
source-contract suite exists.

### `brand-contract.test.mjs` — the forbidden-green / Figtree / ssp-mark / 48dp gate

This single file pins the visual identity of the app by reading source as
text. If any of the following regress, `npm test` fails:

- **Forbidden green.** `assert.doesNotMatch(css, /34 197 94/)` and
  `assert.doesNotMatch(theme, /#22C55E/i)` — the Tailwind v4 RGB triple and the
  hex form of `#22C55E` are both blocked across `global.css` and `src/theme.tsx`.
- **Forbidden Figtree.** `assert.doesNotMatch(packageJson, /@expo-google-fonts\/figtree/)`
  and `assert.doesNotMatch(layout, /Figtree/)` — only `@expo-google-fonts/lato`
  is allowed, and all four faces (`Lato_300Light/400Regular/700Bold/900Black`)
  must be loaded.
- **`ssp-mark.png` sha256 pin.**
  `285d48c68c00ec1060f4cc0c0cd0c4694bada2522766c0ccb9c4eec9995bd3f5` — the
  brand mark asset is hashed and compared exactly, so a swapped or recompressed
  PNG fails the suite.
- **48dp touch targets.** `min-h-12` on the auth RememberMe `<Switch>`,
  `min-h-12 rounded-lg ring-ring` on the shared `button` primitive, and
  `min-h-12 min-w-12` enforced across headers/rows throughout the suite.
- **Semantic tokens.** All 14 light + dark CSS triples are matched, the
  `SEMANTIC_COLORS` object is matched by a single multi-line regex, and the
  gluestack provider's `mode === "system" ? "unspecified" : mode` +
  `Appearance.setColorScheme(resolvedMode)` clearing behavior is pinned.
- **NativeTabs brand.** `tintColor="#003399"` on both coach and player tab
  layouts. Shared primitives (text/heading/button/card) must use brand typography
  classes and must NOT contain hardcoded hex or palette utilities
  (`bg-green-`, `bg-white`, `bg-black`, etc.).

See [Design System](./design-system) for the full brand spec these tests guard.

### `ux-truth-source.test.mjs` — the truthfulness gate

Where `brand-contract` guards the *look*, `ux-truth-source` guards *what the UI
claims to do*. It asserts that screens only surface actions that are actually
wired and only show data that is actually fetched — no fake buttons, no mocked
data presented as real, no demo actions presented as live hardware. Highlights:

- **No fake actions.** People rows (`PlayerRow`) have one status and no
  `onPress`; team/organisation screens are non-interactive and explanatory
  ("Team settings are read-only in SSP", "Not available in SSP"); the squad
  weekly-goals modal is read-only with no Save button; `DevRoleSwitcher` returns
  `null` (disabled).
- **Mock disclosures.** The device flow must disclose "no hardware was
  contacted" (see [Device Management](./devices)); the organisation InfoRow must
  show "Not connected" with no `onPress`.
- **Real API data only where claimed.** Session history uses
  `useApiSessions`/`useApiSession`; profile uses `useApiMe`; analytics charts use
  empty `MOCK_*` arrays (not API-fed) — the test enforces that dashboard
  components do not import green constants or present mock arrays as live data.
- **Auth + logout wiring.** `supabase.auth.signInWithPassword` +
  `api.getMe()` + shared `LogoutSettingsRow`; `logoutLocalSession` runs
  `Promise.allSettled` and navigates to `/auth` LAST, even if `signOut` throws.
- **Accessibility + motion.** 48dp across headers/rows/dots, motion bounded
  (`duration: 0.2`, no spring, `ReduceMotionProvider`), `accessibilityRole`
  set correctly on summary/alert/listitem, 112px tab bottom clearance,
  `DASHBOARD_MAX_FONT_SIZE_MULTIPLIER` enforced on player home.

---

## Commands

All commands run from the mobile repo root
(`/Users/nduzi/Documents/IzandlaSystems/SSP-Mobile-App`). Scripts are defined in
`package.json`; `tsc --noEmit` is invoked via `npx` (there is no dedicated
typecheck script).

| Command | What it does | When to use it |
| :--- | :--- | :--- |
| `npm run lint` | `expo lint` (ESLint via `eslint-config-expo`). | After any source change. |
| `npx tsc --noEmit` | Typecheck the whole project against `tsconfig.json` (`strict: true`, paths `@/* → [./src/*, ./*]`). | Before commit; catches type drift the unit tests do not. |
| `npm test` | `vitest run && npm run test:legacy` — runs all 4 vitest files then all 14 `node --test` files. | The full gate. CI should run this. |
| `npm run test:legacy` | `node --test $(find src -name '*.test.mjs' -print)` — only the 14 source-contract files. | Iterate on a single `.mjs` suite without waiting for vitest. |
| `npx expo start` | Start the Metro bundler / Expo dev server (web + Expo Go). | Non-BLE development; BLE is **not** available in Expo Go (falls back to `FallbackTrackerService`). |
| `npx expo run:ios` | Build + launch an iOS **development build** on a simulator or connected device. | Required for real BLE (`react-native-ble-plx` native module). See [Configuration & Build](./configuration). |
| `npx expo run:android` | Build + launch an Android **development build** on an emulator or connected device. | Required for real BLE on Android. |

> **BLE and the dev build.** The tracker subsystem needs the
> `react-native-ble-plx` native module, which Expo Go does not bundle. Run a
> development build (`npx expo run:ios` / `run:android`) to exercise real BLE; in
> Expo Go the app falls back to `FallbackTrackerService` and every tracker
> operation throws. This is covered in [Live Tracking & Sync](./tracker-and-sync).

---

## Cross-references

- [Design System](./design-system) — the brand tokens, Lato typography, and 48dp
  rules that `brand-contract.test.mjs` enforces.
- [Dashboard & Analytics](./dashboard-and-analytics) — the mock-vs-real data
  distinction that `ux-truth-source.test.mjs` guards.
- [Device Management](./devices) — the Demo-mode disclosures enforced by
  `device-ui-source.test.mjs`.
- [Live Tracking & Sync](./tracker-and-sync) — the tracker UI labels and
  brand-red recording dot enforced by `tracker-ui-source.test.mjs`.
- [API Client](./api-client) — the 28-method fetch contract verified by
  `src/lib/api.test.ts`.
- [Configuration & Build](./configuration) — env vars, EAS build profiles, and
  the dev-build requirement for BLE.
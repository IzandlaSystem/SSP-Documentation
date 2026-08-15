---
title: Mobile App Design System
description: Brand colors, typography, radii, semantic tokens, gluestack-ui v5 setup, NativeWind v5 toolchain, motion, and accessibility rules for the SSP Mobile App.
outline: deep
---

# Mobile App Design System

The SSP Mobile App runs on a flat, tonal, semantic design system built from four binding sources: `PRODUCT.md`, `DESIGN.md`, `global.css`, and `src/theme.tsx`. The system is **partly test-enforced**: `src/components/dashboard/brand-contract.test.mjs` and `src/components/dashboard/ux-truth-source.test.mjs` pin specific colors, fonts, the `ssp-mark`, and named 48 dp controls. They are not a substitute for runtime accessibility review across every screen. This page documents what is implemented and calls out the prohibitions.

For environment variables, build profiles, and the BLE dev-build requirement, see [Configuration & Build](./configuration).

---

## Brand Colors (binding)

The approved Steele Athletic Training Centre / SSP graphic standards are binding. Three brand colors are canonical; one common color is **forbidden**.

| Role | Hex | RGB triple (`global.css`) | Where it lives |
| :--- | :--- | :--- | :--- |
| Primary (brand blue) | `#003399` | `0 51 153` | `--primary` (light), actions, active nav, primary data, large performance fields |
| Destructive (brand red) | `#C70000` | `199 0 0` | `--destructive` (light), readable error/destructive text and actions |
| Mark / live emphasis (brand red) | `#FF0000` | — | `assets/brand/ssp-mark.png` and the **non-text** recording dot only |
| Brand grey | `#B2B2B2` | — | `DESIGN.md`/`PRODUCT.md` frontmatter; structural neutral role |
| Dark primary | `#7FA6FF` | `127 166 255` | `--primary` (dark), accessible blue for dark surfaces |
| Dark destructive | `#FF6B6B` | `255 107 107` | `--destructive` (dark), readable red for dark surfaces |

Source: `PRODUCT.md` "Brand Commitments", `DESIGN.md` frontmatter, `global.css`, `src/theme.tsx`.

::: warning FORBIDDEN: green and Figtree are test-enforced
- **Green `#22C55E` / RGB `34 197 94` is FORBIDDEN.** `brand-contract.test.mjs` asserts `assert.doesNotMatch(css, /34 197 94/)` and `assert.doesNotMatch(theme, /#22C55E/i)`. `ux-truth-source.test.mjs` asserts no legacy green across 16 dashboard components. Do not describe a "green CTA" or "success green"; success does not introduce a competing green accent.
- **Figtree is FORBIDDEN.** `brand-contract.test.mjs` asserts `assert.doesNotMatch(packageJson, /@expo-google-fonts\/figtree/)` and `assert.doesNotMatch(layout, /Figtree/)`. The family is **Lato**. The stale `CLAUDE.md` claim of "Figtree font" is wrong.
:::

Status is never communicated by color alone; it is always **icon + text + color** (e.g. attention → `CircleAlert` + `text-destructive`; ready → `CheckCircle2` + `text-primary`). See [Dashboard & Analytics](./dashboard-and-analytics).

---

## Typography — Lato

The application family on web, iOS, and Android is **Lato**, loaded once in `src/app/_layout.tsx` from `@expo-google-fonts/lato`. Four faces are loaded:

| Role | Face | Weight | CSS var (`global.css`) |
| :--- | :--- | :--- | :--- |
| Body / data labels | `Lato_400Regular` | 400 | `--font-body`, `--font-sans` |
| Emphasis | `Lato_700Bold` | 700 | `--font-body-bold` |
| Headings / major values / decisive actions | `Lato_900Black` | 900 | `--font-heading` |
| Spacious display | `Lato_300Light` | 300 | — (limited to high-contrast display moments) |

`global.css` declares the font roles inside `@theme inline`:

```css
@theme inline {
  --font-body: "Lato_400Regular";
  --font-body-bold: "Lato_700Bold";
  --font-heading: "Lato_900Black";
  --font-sans: "Lato_400Regular";
}
```

NativeWind keeps the `font-sans` role on the loaded application face on native too, via `@media ios` / `@media android` overrides that re-pin `--font-sans: "Lato_400Regular"`. `brand-contract.test.mjs` asserts Lato is loaded exactly once with all four faces and that **Figtree does not appear** in `_layout.tsx` or `package.json`.

The gluestack primitives enforce the family: `components/ui/text/styles.tsx` sets `text-foreground font-body`; `components/ui/heading/styles.tsx` sets `text-foreground font-heading`; `components/ui/button/index.tsx` sets `web:select-none font-heading` on button text. No primitive hardcodes a hex color or palette utility (the contract asserts `doesNotMatch(... /#(?:[0-9a-f]{3}){1,2}\b/i)` across text/heading/button/card sources).

---

## Radii and Spacing

From `DESIGN.md` frontmatter. Fully rounded shapes are reserved for progress tracks, small status dots, avatars, and icon buttons, not every container.

| Radii | Value | Tailwind | Used by |
| :--- | :--- | :--- | :--- |
| Control | 8 px | `rounded-lg` | Buttons (`button/index.tsx` base `rounded-lg`) |
| Card | 12 px | `rounded-xl` | Cards (`card/styles.tsx` base `rounded-xl`) |
| Feature | 16 px | — | Feature summaries |

| Spacing | Value |
| :--- | :--- |
| xs | 4 px |
| sm | 8 px |
| md | 12 px |
| lg | 16 px |
| xl | 24 px |

---

## `SEMANTIC_COLORS` (`src/theme.tsx`)

SVG props and native APIs cannot consume NativeWind classes, so `src/theme.tsx` mirrors the semantic token values beside theme resolution. These exact hex values are **pinned by `brand-contract.test.mjs`** via a regex that matches the whole `SEMANTIC_COLORS` literal.

```ts
export const SEMANTIC_COLORS = {
  light: { background: "#F8FAFC", card: "#FFFFFF", foreground: "#111827",
           mutedForeground: "#5B6470", primary: "#003399",
           destructive: "#C70000", border: "#D7DAE0" },
  dark:  { background: "#071225", card: "#0D1B33", foreground: "#F8FAFC",
           mutedForeground: "#B2BAC7", primary: "#7FA6FF",
           destructive: "#FF6B6B", border: "#2E456C" },
} as const;
```

| Token | Light | Dark |
| :--- | :--- | :--- |
| `background` | `#F8FAFC` | `#071225` |
| `card` | `#FFFFFF` | `#0D1B33` |
| `foreground` | `#111827` | `#F8FAFC` |
| `mutedForeground` | `#5B6470` | `#B2BAC7` |
| `primary` | `#003399` | `#7FA6FF` |
| `destructive` | `#C70000` | `#FF6B6B` |
| `border` | `#D7DAE0` | `#2E456C` |

### Theme provider

`ThemeProvider` (in `src/theme.tsx`) exposes:

- `mode: "light" | "dark" | "system"`, persisted to AsyncStorage under the key `"theme-mode"` (restored once on mount, written thereafter).
- `setMode(mode)` and `toggle()`: toggle flips light↔dark, and `system` → `dark` on first press (`m === "dark" ? "light" : "dark"`).
- `useTheme()` throws if used outside `ThemeProvider`.

`DashboardScreen` resolves `SEMANTIC_COLORS[resolvedScheme].background` for the canvas; charts resolve `SEMANTIC_COLORS[resolvedScheme]` for `stroke`/`fill`. See [Dashboard & Analytics](./dashboard-and-analytics).

---

## `global.css` — Tailwind v4 tokens

`global.css` holds the Tailwind v4 theme tokens as **RGB triples** (space-separated, so `rgb(var(--primary))` resolves them). Light defaults live in `:root`; dark defaults live in `@media (prefers-color-scheme: dark) :root` (NativeWind maps this to `Appearance.getColorScheme()` on native) and are re-asserted at higher specificity in `:root.dark` / `:root.light` for the web class toggle.

| Token (`--*`) | Light (RGB) | Hex | Dark (RGB) | Hex |
| :--- | :--- | :--- | :--- | :--- |
| `primary` | `0 51 153` | `#003399` | `127 166 255` | `#7FA6FF` |
| `primary-foreground` | `255 255 255` | `#FFFFFF` | `7 18 37` | `#071225` |
| `destructive` | `199 0 0` | `#C70000` | `255 107 107` | `#FF6B6B` |
| `destructive-foreground` | `255 255 255` | `#FFFFFF` | `7 18 37` | `#071225` |
| `background` | `248 250 252` | `#F8FAFC` | `7 18 37` | `#071225` |
| `card` | `255 255 255` | `#FFFFFF` | `13 27 51` | `#0D1B33` |
| `foreground` | `17 24 39` | `#111827` | `248 250 252` | `#F8FAFC` |
| `muted-foreground` | `91 100 112` | `#5B6470` | `178 186 199` | `#B2BAC7` |
| `border` / `input` / `muted` / `secondary` | `215 218 224` | `#D7DAE0` | `46 69 108` | `#2E456C` |
| `ring` | `0 51 153` | `#003399` | `127 166 255` | `#7FA6FF` |
| `accent` | `215 218 224` | `#D7DAE0` | `46 69 108` | `#2E456C` |
| `accent-foreground` | `0 51 153` | `#003399` | `127 166 255` | `#7FA6FF` |

`@theme inline` maps these to `--color-*` so NativeWind/Tailwind utilities (`bg-primary`, `text-foreground`, `border-border`, etc.) resolve to `rgb(var(--*))`. **There is no `34 197 94` / `#22C55E` anywhere**; `brand-contract.test.mjs` asserts this.

---

## gluestack-ui v5

The component library is **gluestack-ui v5** (`@gluestack-ui/core`). Generated components live in `components/ui/*` at the **repo root**, not under `src/components/ui`. The TS path alias `@/*` maps to `[./src/*, ./*]` (see [Configuration & Build](./configuration)), so both `@/components/ui/...` and relative imports resolve.

### Provider

`components/ui/gluestack-ui-provider/index.tsx` wraps `OverlayProvider` + `ToastProvider` and reconciles the native color scheme:

- `mode === "system" ? "unspecified" : mode` is passed to `Appearance.setColorScheme(resolvedMode)` in a `useEffect`.
- There is **no `if (mode !== "system")` guard**: `brand-contract.test.mjs` asserts `doesNotMatch(provider, /if \(mode !== ["']system["']\)/)`. Letting the native system theme clear app overrides is intentional: when the user returns to `system`, native surfaces revert to the OS scheme.

### Primitive styles (brand-enforced)

| Primitive file | Base style | Contract assertion |
| :--- | :--- | :--- |
| `components/ui/text/styles.tsx` | `text-foreground font-body` | brand typography, no hex |
| `components/ui/heading/styles.tsx` | `text-foreground font-heading tracking-sm` | brand typography, no hex |
| `components/ui/button/index.tsx` | `min-h-12 rounded-lg ring-ring ... font-heading` | `assert.match(button, /min-h-12[^']*rounded-lg[^']*ring-ring/)`, 48 dp + brand radius + ring token |
| `components/ui/card/styles.tsx` | `border border-border rounded-xl shadow-xs` | 12 px card radius, semantic border |
| `components/ui/avatar/index.tsx` | status badge `bg-primary` (not `bg-green-`) | `assert.doesNotMatch(source, /bg-green-/)` |

Across `text`, `heading`, `button`, and `card`, the contract asserts `doesNotMatch(... /#(?:[0-9a-f]{3}){1,2}\b/i)`: no hardcoded hex and no arbitrary palette utilities (`white`/`black`/`red`/`green`/`blue`) in these primitives.

---

## NativeWind v5 / Tailwind v4 toolchain

Styling is NativeWind v5 over Tailwind v4. The toolchain is wired across three files:

| File | Role |
| :--- | :--- |
| `postcss.config.mjs` | `{ plugins: { '@tailwindcss/postcss': {} } }`, Tailwind v4 PostCSS plugin |
| `metro.config.js` | `withNativewind(config, { inlineRem: 16 })`, inlines `rem` units as 16 px on native |
| `babel.config.js` | `babel-preset-expo` + `module-resolver` (`@/` → `./`) + `react-native-worklets/plugin`, with an override that applies `nativewind/babel` to everything **except** `react-native-web` |

`global.css` imports `tailwindcss/theme.css`, `tailwindcss/preflight.css`, `tailwindcss/utilities.css`, and `nativewind/theme`, then declares the design tokens in `@layer theme` and the font roles in `@theme inline`. This is the single source of truth for CSS-driven surfaces; SVG and native APIs read `SEMANTIC_COLORS` from `src/theme.tsx` instead.

::: tip BLE requires a development build
NativeWind works in Expo Go, but `react-native-ble-plx` does not. BLE tracking needs `npx expo run:ios` / `run:android`; Expo Go falls back to `FallbackTrackerService`. See [Configuration & Build](./configuration) and [Live Tracking & Sync](./tracker-and-sync).
:::

---

## Motion and Accessibility

### ReduceMotion

`src/components/get-started/motion.tsx` provides `ReduceMotionProvider`, `useReduceMotion`, and the animation helpers used by the get-started wizard and dashboard cards:

- `FadeIn`: `Motion.View` with <code v-pre>initial=&#123;&#123; opacity: 0, y: 12 &#125;&#125;</code> → <code v-pre>animate=&#123;&#123; opacity: 1, y: 0 &#125;&#125;</code>. When `reduce` is true, children render static (no `Motion.View`). Otherwise <code v-pre>transition=&#123;&#123; type: "tween", duration: 0.2, delay &#125;&#125;</code>; **no spring**.
- `MotionCard`: entrance fade + rise and a press-response scale (0.97) split across two `Motion.View`s so the press never lags behind the entrance delay. The `Pressable` keeps `min-h-12`.
- `ProgressBar`: `bg-primary/20` track + `bg-primary` fill; `transition: reduce ? { duration: 0 } : { duration: 0.2 }`.

Local motion is brief (roughly 160–220 ms in the implementation) and limited to entrance, selection, progress, and completion. `ReduceMotionProvider` removes or replaces movement with static/immediate state changes. Do not add continuous decorative animation. The onboarding carousel reads `AccessibilityInfo.isReduceMotionEnabled` and animates only when `!reduceMotion`.

### Font scaling

`src/components/dashboard/dashboard-helpers.ts` exports `DASHBOARD_MAX_FONT_SIZE_MULTIPLIER = 1.5`, applied across dashboard screens. `PerformanceSummaryCard` applies `maxFontSizeMultiplier` (≥7 uses the constant) and stacks its metrics into a `VStack` at large font scales via `usesLargeTextLayout(fontScale)` (true when `fontScale >= 1.5`, rejecting `NaN`/`Infinity`). Score text drops from `5xl` to `3xl` and the metrics row switches from `HStack` to `VStack`. Labels and values wrap; there is no `numberOfLines` truncation on operational facts.

### Touch targets

Minimum touch targets are **48 dp Android / 44 pt iOS**, enforced across the shared implementation as `min-h-12 min-w-12` (48 dp satisfies the stricter Android baseline and the 44 pt iOS baseline):

- `ScreenHeader` back and trailing icon buttons (48 dp).
- `SettingsRow` `Pressable` + `Switch` (both `min-h-12 min-w-12`).
- `SectionHeader` `Pressable`, `ProgressDots`, choice cards, auth RememberMe `Switch` (`min-h-12 min-w-12`, no wrapping `Pressable`).
- gluestack `Button` base (`min-h-12`) and `icon` size (`min-w-12`).
- `DeviceRow` single `Pressable` (`min-h-12`, `accessibilityRole="button"`).

`brand-contract.test.mjs` asserts the auth Switch regex `<Switch[\s\S]*?accessibilityLabel="Remember me"[\s\S]*?className="min-h-12 min-w-12"`. The tab bar uses `NativeTabs tintColor="#003399"` (asserted by the contract).

### Recording dot — brand red, non-text only

The live-recording indicator in `src/features/tracker/FirmwareTrackerScreen.tsx` uses inline style `backgroundColor: "#FF0000"`. This is the **non-text** brand red reserved for the official mark and live/recording emphasis. `tracker-ui-source.test.mjs` asserts the brand red appears as `backgroundColor: "#FF0000"` and **not** as `text-[#FF0000]` or `color:`. Never use `#FF0000` for normal-size white text; use `--destructive` (`#C70000`) for readable error/destructive text.

---

## The SSP mark

`assets/brand/ssp-mark.png` is the official SSP triquetra mark. It is the app icon, the Android adaptive-icon foreground (background `#000000`), and the loading/logo image shown by `src/app/index.tsx` and `src/app/auth.tsx` (no `ShieldCheck` hero).

- **Pinned by test.** `brand-contract.test.mjs` reads the file via `new URL("../../../assets/brand/ssp-mark.png", import.meta.url)` and asserts its sha256 is `285d48c68c00ec1060f4cc0c0cd0c4694bada2522766c0ccb9c4eec9995bd3f5`.
- **Preserve proportions.** Do not stretch, rotate, recolor, crop, or add effects/shadows/animation. Use only approved full-colour, single-colour, black, or accessibility-safe reversed treatments.

---

## DESIGN.md — Do's and Don'ts

`DESIGN.md` is the directional design spec (frontmatter carries the brand tokens, Lato family, radii, and spacing). The body sets the visual rules summarized below.

### Navigation and screen chrome

- Keep exactly **four `NativeTabs` destinations per role**: Coach: Home, Analytics, Squad, Profile; Player: Home, Analytics, Trainer, Profile. `ScreenHeader` supplies title/context plus optional 48 dp back or trailing actions. Do not create a second navigation system. See [Architecture & Navigation](./architecture).

### Cards and summaries

- `PerformanceSummaryCard` is the **dominant primary field** (`bg-primary`), not a decorative score ring. `PowerScoreRing` exists as an SVG ring with an optional trend badge but is **not** used by the summary card.
- `DeviceReadinessCard` uses aligned connection, battery, pending-upload, and status rows with one real Device Hub action; it is presentational only (no `expo-router`/`useDeviceDemo` import).
- Settings and information use grouped rows; empty, loading, failure, retry, disabled, and unavailable states remain visually and verbally distinct.

### Charts and activity history

- Use resolved semantic SSP blue (`primary`) for primary series. Use resolved destructive red only for meaningful comparison, peak density, live, or attention states.
- Every time-series chart shows selected range, unit, latest value, and a visible latest-versus-previous comparison; its accessible summary includes min, max, latest, and direction.
- Heat density runs from semantic primary → destructive (no green/yellow/orange). `FootballPitchHeatmap` uses a `LinearGradient` legend `primary→destructive`. Numeric axes stay finite and histories stay newest-first.

### Elevation and depth

The system is primarily flat and tonal. Cards use a one-pixel semantic border, card/background contrast, and at most `shadow-xs`. Performance fields use solid primary color.

### Do

- **Do** keep Coach and Player hierarchy, density, spacing, and device prominence equally finished.
- **Do** keep every visible action wired to implemented navigation/state/operations or clearly disabled and explanatory.
- **Do** preserve backend UUIDs separately from firmware numeric session identifiers.
- **Do** expose connection, sync, battery, firmware, failure, retry, and live states with icon plus copy.
- **Do** verify light/dark, compact/expanded widths, large text, screen readers, Reduce Motion, keyboard/insets, and native Back on running iOS and Android builds.

### Don't

- **Don't** replace gluestack-ui v5, NativeWind, Expo Router, or the native tab architecture.
- **Don't** add a parallel design system, chart library, social feature, unsupported backend/device behavior, or enabled placeholder control.
- **Don't** bring back Figtree, legacy green, arbitrary palette utilities, decorative score rings, generated screenshot values, decorative surface gradients, glow, or glass. Data-visualization gradients already used by the area chart and heatmap remain intentional.
- **Don't** treat web export, source tests, approved comps, simulator checks, or mocked device states as real SSP-S1 hardware proof.

---

## Enforcement

Two node `--test` files are the enforcement mechanism (see [Testing](./testing)):

| Test file | What it enforces |
| :--- | :--- |
| `src/components/dashboard/brand-contract.test.mjs` | All 14 CSS token triples, `SEMANTIC_COLORS` regex pin, no `34 197 94` / `#22C55E`, gluestack system-mode clearing, Lato loaded once (4 faces, no Figtree), shared primitives brand typography + 48 dp + no palette utilities, auth Switch `min-h-12`, avatar `bg-primary` (no `bg-green-`), `NativeTabs tintColor="#003399"`, `ssp-mark.png` sha256 pin. |
| `src/components/dashboard/ux-truth-source.test.mjs` | No legacy green across 16 dashboard components, performance summary is one accessible summary (no decorative ring) + stacks at font scales, `DASHBOARD_MAX_FONT_SIZE_MULTIPLIER` applied, 112 px tab clearance, 48 dp headers/rows, status = icon + text + color (never color alone), device Demo disclosures, truthful missing states. |

---

## Cross-references

- [Configuration & Build](./configuration): env vars, build profiles, the BLE dev-build requirement, and the full toolchain config.
- [Architecture & Navigation](./architecture): provider hierarchy, route tree, role-gated tabs.
- [Dashboard & Analytics](./dashboard-and-analytics): how `SEMANTIC_COLORS` and the chart/heatmap rules are applied.
- [Testing](./testing): the dual runner and every `.test.mjs` / `.test.ts` file.

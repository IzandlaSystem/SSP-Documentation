---
title: Mobile App Architecture & Navigation
description: App shell and provider hierarchy, Expo Router file-based routing with typedRoutes, the full route tree, the entry-gate decision flow, per-role native tabs, and navigation conventions for the SSP-Mobile-App.
outline: deep
---

# Mobile App Architecture & Navigation

The **SSP-Mobile-App** is an Expo (React Native) companion app for SSP-S1 trackers, serving coaches and athletes with equal priority. Its navigation layer is built on **Expo Router** with file-based routing and `experiments.typedRoutes` enabled, split into two role-scoped route groups, `(coach)` and `(player)`, each gated by a role guard and each presenting its own native tab bar. This page documents the shell, the route tree, the entry-gate decision flow, and the navigation conventions the app enforces. Screen *content* (what each dashboard, device, or tracker screen renders) lives in the sibling docs cross-linked at the bottom.

## App Shell & Provider Hierarchy

Source: `src/app/_layout.tsx`, `src/theme.tsx`, `components/ui/gluestack-ui-provider/index.tsx`.

The root export is `RootLayout`, which wraps the entire app in `ThemeProvider` and then renders `AppShell`. `AppShell` is responsible for font loading, splash control, and assembling the native provider stack.

```mermaid
flowchart TB
    Root["RootLayout<br/><code>export default</code>"]
    Theme["ThemeProvider<br/><i>src/theme.tsx</i><br/>mode: light / dark / system<br/>AsyncStorage key <code>theme-mode</code>"]
    Shell["AppShell"]
    Fonts["useFonts<br/>Lato_300Light / 400Regular<br/>700Bold / 900Black"]
    Splash["SplashScreen<br/>preventAutoHideAsync<br/>hideAsync when fontsLoaded / fontError"]
    Safe["SafeAreaProvider<br/><i>react-native-safe-area-context</i>"]
    Gluestack["GluestackUIProvider<br/><code>mode={mode}</code><br/>resolves system → unspecified<br/>Appearance.setColorScheme"]
    SB["StatusBar<br/>style = resolvedMode === light ? dark : light"]
    Stack["Stack<br/>headerShown: false<br/>animation: slide_from_right<br/>contentStyle: transparent"]

    Root --> Theme --> Shell
    Shell --> Fonts
    Fonts --> Splash
    Splash --> Safe
    Safe --> Gluestack --> SB --> Stack
```

### Font loading and splash control

`AppShell` loads the four Lato faces via `useFonts({ Lato_300Light, Lato_400Regular, Lato_700Bold, Lato_900Black })` from `@expo-google-fonts/lato`. `SplashScreen.preventAutoHideAsync()` is called at module load so the native splash stays visible while fonts load (no text flash). Once `fontsLoaded || fontError` is true, a `useEffect` calls `SplashScreen.hideAsync()`. Until then the component returns `null`. The Lato family is the only type family; Figtree is forbidden (see [Design System](./design-system)).

### Resolved color mode and status bar

`useTheme().mode` is `light | dark | system`. The resolved scheme is `mode === "system" ? (systemScheme ?? "light") : mode`, where `systemScheme` comes from React Native's `useColorScheme()`. The status bar style is `resolvedMode === "light" ? "dark" : "light"`. `GluestackUIProvider` receives the raw `mode` and is responsible for resolving `system` to `"unspecified"` and calling `Appearance.setColorScheme(resolvedMode)` so native system-theme overrides clear correctly.

### Root Stack

The root `Stack` is configured with <code v-pre>screenOptions=&#123;&#123; headerShown: false, contentStyle: &#123; backgroundColor: "transparent" &#125;, animation: "slide_from_right" &#125;&#125;</code>. It declares four top-level screens, in order:

| # | Screen name | File |
| :-: | :--- | :--- |
| 1 | `index` | `src/app/index.tsx` (entry gate) |
| 2 | `onboarding` | `src/app/onboarding.tsx` |
| 3 | `get-started` | `src/app/get-started.tsx` |
| 4 | `auth` | `src/app/auth.tsx` |

Everything below these (the role groups and their tab screens) mounts inside the `(coach)` and `(player)` groups, not at the root.

## Expo Router & typedRoutes

Source: `app.json`, `tsconfig.json`, route files under `src/app/`.

Routing is **file-based** under `src/app/`. Expo Router maps the directory tree to routes: `index.tsx` is the route leaf, `_layout.tsx` is the layout for a directory, and parentheses denote **route groups** that group files without contributing a segment to the URL (e.g. `src/app/(coach)/device/add.tsx` is the route `/(coach)/device/add`, and `(coach)` is a grouping-only segment).

`app.json` sets `experiments.typedRoutes: true`, so `router.push` / `router.replace` accept typed `Href` values. Where a path is built from a dynamic segment the app casts through `as Href` (for example `src/app/(coach)/device.tsx` uses `router.push("/(coach)/device/add" as Href)`). `tsconfig.json` extends `expo/tsconfig/base` with `strict: true` and the path alias `@/* -> [./src/*, ./*]`.

Each role group layout exports `unstable_settings = { initialRouteName: "(tabs)" }` so deep links and initial mounts land on the tab group rather than a push screen.

## Route Tree

The full route tree, with file paths relative to the mobile repo root. Group `_layout.tsx` files apply the role guard and wrap their screens in `TrackerProvider` + `DeviceProvider`; the `(tabs)/_layout.tsx` files declare Expo Router `Tabs` with the custom floating presentation.

### Top-level routes

| Route | File | Purpose |
| :--- | :--- | :--- |
| `/` | `src/app/index.tsx` | Entry gate (see [Entry gate flow](#entry-gate-flow)) |
| `/onboarding` | `src/app/onboarding.tsx` | 3-page onboarding carousel |
| `/get-started` | `src/app/get-started.tsx` | Multi-step registration wizard |
| `/auth` | `src/app/auth.tsx` | Supabase sign-in |

### Coach group `(coach)`

Layout: `src/app/(coach)/_layout.tsx`. `useRoleGuard("coach")`, `unstable_settings.initialRouteName: "(tabs)"`, wraps in `TrackerProvider` > `DeviceProvider role="coach"` > `Stack` (`headerShown: false`).

| Route | File | Screen component |
| :--- | :--- | :--- |
| `/(coach)/(tabs)` | `src/app/(coach)/(tabs)/_layout.tsx` | Tabs + `FloatingTabBar` (home/analytics/squad/profile) |
| `/(coach)/(tabs)/home` | `src/app/(coach)/(tabs)/home.tsx` | `CoachHomeScreen` |
| `/(coach)/(tabs)/analytics` | `src/app/(coach)/(tabs)/analytics.tsx` | Coach analytics |
| `/(coach)/(tabs)/squad` | `src/app/(coach)/(tabs)/squad.tsx` | Squad list |
| `/(coach)/(tabs)/profile` | `src/app/(coach)/(tabs)/profile.tsx` | Coach profile |
| `/(coach)/session/[id]` | `src/app/(coach)/session/[id].tsx` | `SessionDetailScreen role="coach"` |
| `/(coach)/device` | `src/app/(coach)/device.tsx` | `DeviceHubScreen role="coach"` |
| `/(coach)/device/add` | `src/app/(coach)/device/add.tsx` | `AddDeviceScreen role="coach"` |
| `/(coach)/device/firmware` | `src/app/(coach)/device/firmware.tsx` | `FirmwareTrackerScreen` |
| `/(coach)/device/[id]` | `src/app/(coach)/device/[id].tsx` | `DeviceDetailsScreen role="coach"` |
| `/(coach)/device/[id]/session/[sessionId]` | `src/app/(coach)/device/[id]/session/[sessionId].tsx` | `DeviceSessionDetailScreen role="coach"` |
| `/(coach)/team` | `src/app/(coach)/team.tsx` | Read-only team details |
| `/(coach)/organisation` | `src/app/(coach)/organisation.tsx` | Read-only org details |

### Player group `(player)`

Layout: `src/app/(player)/_layout.tsx`. `useRoleGuard("player")`, `unstable_settings.initialRouteName: "(tabs)"`, wraps in `TrackerProvider` > `DeviceProvider role="player"` > `Stack` (`headerShown: false`). The player tab group uses `dashboard` as the route name (with the label "Home") rather than `home`.

| Route | File | Screen component |
| :--- | :--- | :--- |
| `/(player)/(tabs)` | `src/app/(player)/(tabs)/_layout.tsx` | Tabs + `FloatingTabBar` (dashboard/analytics/trainer/profile) |
| `/(player)/(tabs)/dashboard` | `src/app/(player)/(tabs)/dashboard.tsx` | `PlayerDashboardScreen` |
| `/(player)/(tabs)/analytics` | `src/app/(player)/(tabs)/analytics.tsx` | Player analytics |
| `/(player)/(tabs)/trainer` | `src/app/(player)/(tabs)/trainer.tsx` | Trainer / today's session |
| `/(player)/(tabs)/profile` | `src/app/(player)/(tabs)/profile.tsx` | Player profile |
| `/(player)/session/[id]` | `src/app/(player)/session/[id].tsx` | `SessionDetailScreen role="player"` |
| `/(player)/device` | `src/app/(player)/device.tsx` | `DeviceHubScreen role="player"` |
| `/(player)/device/add` | `src/app/(player)/device/add.tsx` | `AddDeviceScreen role="player"` |
| `/(player)/device/firmware` | `src/app/(player)/device/firmware.tsx` | `FirmwareTrackerScreen` |
| `/(player)/device/[id]` | `src/app/(player)/device/[id].tsx` | `DeviceDetailsScreen role="player"` |
| `/(player)/device/[id]/session/[sessionId]` | `src/app/(player)/device/[id]/session/[sessionId].tsx` | `DeviceSessionDetailScreen role="player"` |
| `/(player)/team` | `src/app/(player)/team.tsx` | Read-only team details |
| `/(player)/organisation` | `src/app/(player)/organisation.tsx` | Read-only org details |

::: warning Legacy firmware route is currently disconnected
Both role stacks still register `device/firmware`, but Device Hub's route wrappers still pass a removed `onOpenFirmware` prop. The current device UI exposes `FirmwareUpdatePanel` inside a connected device's Details screen instead. This mismatch is one of the two app-source TypeScript errors recorded in [Testing](./testing).
:::

## Entry Gate Flow

Source: `src/app/index.tsx`. Verified by `src/app/index-source.test.mjs`.

`src/app/index.tsx` is the first screen mounted. It renders only the SSP mark on a neutral background while it decides where to route, so the entry surface is "identity only, never a dashboard or auth state that may be replaced a moment later." The decision flow, in order:

1. **`FORCE_DASHBOARD` override**: `process.env.EXPO_PUBLIC_FORCE_DASHBOARD === "true"` → `router.replace("/(coach)/(tabs)/home")` and return. (This var is referenced in `index.tsx` but is **not** listed in `.env.example`; it is a dev-only convenience.)
2. **`FORCE_ONBOARDING` override**: `process.env.EXPO_PUBLIC_FORCE_ONBOARDING === "true"` → `router.replace("/onboarding")` and return.
3. **Onboarding completion**: `isOnboardingComplete()` (AsyncStorage key `"onboarding-complete"`). If incomplete → `router.replace("/onboarding")`.
4. **Remember-session flag**: `shouldRememberSession()` (AsyncStorage key `"remember-session"`, treated as `true` unless the stored value is exactly `"false"`). If the user did not choose to stay signed in → `supabase.auth.signOut({ scope: "local" })` then `router.replace("/auth")`.
5. **Supabase session**: `supabase.auth.getSession()`. If no session → `router.replace("/auth")`.
6. **Role resolution**: start with `getUserRole()` (supabase `user_metadata.role` with `athlete` mapped to `player`, then AsyncStorage `"user-role"`, default `"coach"`). Call `api.getMe()`; if `me.roles.includes("athlete")` set role to `"player"`, otherwise `"coach"`. If `api.getMe()` throws (e.g. API temporarily unreachable) the persisted role is kept.
7. **Role tab**: `router.replace(role === "player" ? "/(player)/(tabs)/dashboard" : "/(coach)/(tabs)/home")`.

```mermaid
flowchart TD
    Start(["App mounts<br/>src/app/index.tsx"])
    Render["Render ssp-mark on<br/>bg-background (loading)"]
    FD{"FORCE_DASHBOARD?<br/><i>EXPO_PUBLIC_FORCE_DASHBOARD</i>"}
    FO{"FORCE_ONBOARDING?<br/><i>EXPO_PUBLIC_FORCE_ONBOARDING</i>"}
    OnbDone{"isOnboardingComplete()?"}
    Remember{"shouldRememberSession()?"}
    SignOut["supabase.auth.signOut<br/>{scope: 'local'}"]
    HasSession{"supabase.auth.getSession()<br/>data.session?"}
    GetRole["role = getUserRole()<br/><i>athlete→player, default coach</i>"]
    GetMe["me = api.getMe()<br/><i>try/catch keeps persisted role</i>"]
    Resolve{"me.roles.includes('athlete')?"}
    PlayerTab["/(player)/(tabs)/dashboard"]
    CoachTab["/(coach)/(tabs)/home"]
    Onboarding["/onboarding"]
    Auth["/auth"]

    Start --> Render --> FD
    FD -- true --> CoachTab
    FD -- false --> FO
    FO -- true --> Onboarding
    FO -- false --> OnbDone
    OnbDone -- false --> Onboarding
    OnbDone -- true --> Remember
    Remember -- false --> SignOut --> Auth
    Remember -- true --> HasSession
    HasSession -- none --> Auth
    HasSession -- session --> GetRole --> GetMe --> Resolve
    Resolve -- yes --> PlayerTab
    Resolve -- no --> CoachTab
```

`api.getMe()` is a hand-rolled `fetch` against the SSP-API gateway, not a Hono `hc()` client or an `AppType` contract import. See [API Client](./api-client) and the [Backend Client Contract](../backend/client-contract).

## Role Guards

Source: `src/hooks/useRoleGuard.ts`, `src/lib/session.ts`.

Each role group layout calls `useRoleGuard(allowedRole)` before rendering any screen. The hook reads the persisted role with `getUserRole()` and, if `actualRole !== allowedRole`, replaces the current route with the matching role's tab:

| allowedRole | Mismatch redirect |
| :--- | :--- |
| `"coach"` | `/(coach)/(tabs)/home` |
| `"player"` | `/(player)/(tabs)/dashboard` |

The hook uses an `active` flag cleaned up in the effect's return, so a rapid unmount does not fire a stale `router.replace`. The guard runs inside the group `_layout.tsx`, so it executes before any of the group's screens mount. The role model (`Role` = `"coach" | "player"`) is the app's UI role, distinct from the backend `ApiRole` enum (`athlete`/`coach`/`sub_coach`/`organisation_admin`/`ssp_super_admin`). `getUserRole` maps the backend `athlete` value to the UI `player`; the default is `coach`. See [Auth & Onboarding](./auth-and-onboarding).

This guard is an information-architecture convenience, **not an authorization boundary**. Its fallback can read user-editable Supabase `user_metadata` or local AsyncStorage. The SSP-API must continue to authorize every request from its verified JWT and database-backed roles; changing a local role can only affect which mobile screens are attempted.

## Tabs per Role

Source: `src/app/(coach)/(tabs)/_layout.tsx`, `src/app/(player)/(tabs)/_layout.tsx`.

Both role layouts use Expo Router's standard `Tabs` navigator with `headerShown: false` and pass `FloatingTabBar` as the `tabBar` renderer. The floating pill consumes React Navigation's `state`, `descriptors`, and `navigation`, emits `tabPress`/`tabLongPress`, and maps the route filename to a Lucide icon. Focus is brand blue; each tab has a 48-point minimum target and the scrolling screens reserve 112 px beneath their content.

### Coach tabs

| # | `name` | Label | Icon |
| :-: | :--- | :--- | :--- |
| 1 | `home` | Home | `Home` |
| 2 | `analytics` | Analytics | `ChartBar` |
| 3 | `squad` | Squad | `Users` |
| 4 | `profile` | Profile | `CircleUserRound` |

### Player tabs

| # | `name` | Label | Icon |
| :-: | :--- | :--- | :--- |
| 1 | `dashboard` | Home | `Home` |
| 2 | `analytics` | Analytics | `ChartBar` |
| 3 | `trainer` | Trainer | `Dumbbell` |
| 4 | `profile` | Profile | `CircleUserRound` |

The player's first tab is the route `dashboard` but is labeled "Home" in the UI. The coach's first tab is the route `home`. `FloatingTabBar` keys its icon map by these route filenames, so the player `dashboard` and coach `home` both map to `Home`.

## Navigation Conventions

The app uses three distinct navigation patterns, chosen per screen so that back-stack and state stay truthful.

### `router.dismissTo` for device add and device detail

`AddDeviceScreen` (both roles) finishes with `router.dismissTo` back to the device hub, passing the newly added device id so the hub can highlight it:

```ts
// src/app/(coach)/device/add.tsx
onCancel={() => router.dismissTo("/(coach)/device")}
onComplete={(deviceId) =>
  router.dismissTo({
    pathname: "/(coach)/device",
    params: { addedDeviceId: deviceId },
  } as Href)
}
```

`DeviceDetailsScreen` uses a `useCallback`-stable `goToHub = () => router.dismissTo("/(coach)/device")` for both `onBack` and `onMissingDevice`, so the hub is revealed (not pushed) when the user leaves a detail or when the device id is missing.

### `router.replace` (not `router.back`) for session detail

`SessionDetailScreen` (both roles) uses `router.replace` for back and for adjacent-session navigation:

```ts
// src/app/(coach)/session/[id].tsx
onBack={() => router.replace("/(coach)/(tabs)/analytics")}
onNavigate={(nextId) =>
  router.replace({ pathname: "/(coach)/session/[id]", params: { id: nextId } })
}
```

This is **enforced** by `src/components/dashboard/session-history-source.test.mjs`: both `src/app/(coach)/session/[id].tsx` and `src/app/(player)/session/[id].tsx` must match `/router\.replace/` and must **not** match `/router\.back/`. Replacing (rather than popping) keeps the analytics tab as the stable origin and avoids a growing back-stack of session ids. Previous/Next are bounded inside `SessionDetailScreen` (`isDisabled={!previousId}` / `isDisabled={!nextId}`), so the user cannot navigate past the first or last session.

### Where `router.back` is used

`router.back()` does appear in `onBack` handlers for push screens that have a genuine parent in the stack. Examples include `team.tsx` and `organisation.tsx` (a bare `router.back()`) and `device/firmware.tsx` and `device.tsx`'s hub header (both guarded with `router.canGoBack() ? router.back() : router.replace(...)` so a deep-link entry still has somewhere to go). The test-enforced ban is scoped to session detail only, where a pop would break the stable-origin invariant; `device/[id].tsx` avoids `router.back` by convention (it uses `router.dismissTo` to reveal the hub) but is not covered by the test.

## Provider / Component Dependency Diagram

The diagram below shows how the providers, screens, and services compose at runtime. `TrackerProvider` owns the BLE connection, cache, reconnect and sync engine. `DeviceProvider` overlays SSP-API inventory and per-phone BLE bindings. Screens consume those contexts plus API-backed hooks. Supabase is used directly for auth only; data reads and writes go through SSP-API.

```mermaid
flowchart TB
    subgraph Root["Root (src/app/_layout.tsx)"]
        Theme["ThemeProvider<br/><i>src/theme.tsx</i>"]
        AppShell["AppShell<br/>SafeAreaProvider → GluestackUIProvider<br/>→ StatusBar → Stack"]
        Theme --> AppShell
    end

    subgraph Entry["Top-level screens"]
        Index["index.tsx<br/>entry gate"]
        Auth["auth.tsx<br/>Supabase signIn"]
        Onb["onboarding.tsx"]
        GS["get-started.tsx"]
    end

    subgraph CoachGroup["(coach) group _layout.tsx"]
        GuardC["useRoleGuard('coach')"]
        TrackC["TrackerProvider<br/><i>real BLE context</i>"]
        DeviceC["DeviceProvider role='coach'<br/><i>inventory + BLE bindings</i>"]
        CoachStack["Stack<br/>(tabs) · session/[id] · device routes · team · organisation"]
        GuardC --> TrackC --> DeviceC --> CoachStack
    end

    subgraph PlayerGroup["(player) group _layout.tsx"]
        GuardP["useRoleGuard('player')"]
        TrackP["TrackerProvider"]
        DeviceP["DeviceProvider role='player'"]
        PlayerStack["Stack<br/>(tabs) · session/[id] · device routes · team · organisation"]
        GuardP --> TrackP --> DeviceP --> PlayerStack
    end

    subgraph Tabs["Tabs + FloatingTabBar"]
        CoachTabs["Coach: home · analytics · squad · profile"]
        PlayerTabs["Player: dashboard(Home) · analytics · trainer · profile"]
    end

    subgraph Services["Services & data layer"]
        Api["api.ts<br/>hand-rolled fetch<br/>createApiClient · Bearer JWT"]
        Supabase["supabase.ts<br/>Auth only (signIn/signUp/session)"]
        TrackerSvc["tracker-service.ts<br/>NativeTrackerService / Fallback / Web"]
    end

    subgraph External["External"]
        Gateway["SSP-API gateway<br/><i>Hono on Vercel</i>"]
        SupabaseCloud["Supabase Auth"]
        S1["SSP-S1 tracker<br/><i>custom BLE GATT service</i>"]
    end

    AppShell --> Index
    Index -- "onboarding / auth" --> Onb & Auth & GS
    Index -- "role tab" --> CoachGroup & PlayerGroup
    CoachStack --> CoachTabs
    PlayerStack --> PlayerTabs
    CoachStack & PlayerStack -- "API hooks" --> Api
    CoachStack & PlayerStack -- "useDevices" --> DeviceC & DeviceP
    CoachStack & PlayerStack -- "useTracker" --> TrackC & TrackP
    Auth & Index & GS -- "supabase.auth" --> Supabase
    TrackC & TrackP --> TrackerSvc
    Api -- "HTTPS + Bearer JWT" --> Gateway
    Supabase -- "JWT" --> SupabaseCloud
    TrackerSvc -- "react-native-ble-plx" --> S1
```

## Cross-References

- [Mobile App Overview](./): product summary, stack table, current state (mocked vs real).
- [API Client](./api-client): the hand-rolled `fetch` client and its current gateway surface.
- [Auth & Onboarding](./auth-and-onboarding): Supabase sign-in, the onboarding carousel, and the get-started wizard.
- [Devices](./devices): live device inventory, pairing, bindings, telemetry, sessions, and DFU.
- [Tracker & Sync](./tracker-and-sync): real BLE tracking via `TrackerProvider` and `NativeTrackerService`.
- [Dashboard & Analytics](./dashboard-and-analytics): what each coach/player tab screen renders.
- [Design System](./design-system): brand colors, Lato typography, SEMANTIC_COLORS, 48dp touch targets.
- [Backend Architecture](../backend/architecture): the SSP-API gateway this app calls.
- [Backend Client Contract](../backend/client-contract): the `AppType` the backend publishes (the mobile app does **not** consume it; it hand-rolls fetch against the same paths).
- [Backend Auth & Security](../backend/auth-and-security): the JWT the mobile Supabase token becomes at the gateway.

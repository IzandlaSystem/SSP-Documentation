---
title: Client Contract & Typed RPC
description: Consuming SSP-API using the Hono RPC client, end-to-end TypeScript safety, and contract generation.
outline: deep
---

# Client Contract & Typed RPC

The **SSP-API** publishes a single typed contract (`AppType`) that both client apps — the **Web Frontend** (`SSP-Software`, Next.js) and the **Mobile App** (`SSP-Mobile-App`, Expo) — import through `hono/client`'s `hc<AppType>(url)`. This eliminates hand-written API clients, out-of-sync REST documentation, and runtime typing drift: the Hono route chain *is* the source of truth, and TypeScript carries request *and* response shapes end-to-end.

---

## 1. How it works

`AppType` is `typeof app` from [`src/app.ts`](https://github.com/IzandlaSystem/SSP-API/blob/main/src/app.ts) — the fully composed Hono instance after every `.route()` call has been chained onto it. Hono's client library (`hono/client`) turns that type into an RPC proxy at compile time, inferring:

- HTTP method and path parameters (`/sessions/:id`)
- Query parameters (`?team_id=…&status=recording`)
- JSON request bodies validated by Zod (`zValidator('json', schema)`)
- JSON response structures returned by `c.json(data)`

The contract is published as compiled declaration files in `dist/` by **tsup** (`npm run build` emits `dist/index.js` + `dist/index.d.ts`), and clients consume it as a GitHub dependency.

```mermaid
flowchart LR
    GatewaySrc["SSP-API<br/>src/app.ts (route chain)"] -->|tsup build| Dist["dist/index.d.ts & dist/index.js<br/>AppType + role model"]
    Dist -->|github:IzandlaSystem/SSP-API#main| WebClient["SSP-Software<br/>(Next.js)"]
    Dist -->|github:IzandlaSystem/SSP-API#main| MobileClient["SSP-Mobile-App<br/>(Expo)"]

    WebClient -->|hc<AppType>(NEXT_PUBLIC_API_URL)| GatewaySrc
    MobileClient -->|hc<AppType>(EXPO_PUBLIC_API_URL)| GatewaySrc
```

---

## 2. The published surface (`src/index.ts`)

`src/index.ts` is the contract entry point — the file `tsup` bundles into `dist/` as the published package surface. It re-exports exactly three things:

| Export | Kind | Source | Purpose |
| :--- | :--- | :--- | :--- |
| `AppType` | `export type` | `./app.js` | `typeof app` — the Hono route chain type passed to `hc<AppType>()`. |
| `SSP_ROLES, ROLE_HIERARCHY, getPrimaryRole, hasAnyRole, hasOrgAccess, hasTeamAccess, isCoach, isAthlete, isOrganisationAdmin, isSspSuperAdmin, isSubCoach` | `export` (values) | `./schemas/roles.js` | The shared role model clients use for client-side gating/UI. |
| `SspRole` | `export type` | `./schemas/roles.js` | The role union type (`typeof SSP_ROLES[number]`). |

::: warning `isSubCoach` is exported for clients, not for routes
`isSubCoach` is re-exported so client apps can mirror the same cascade helpers the gateway uses, but **no gateway route calls `isSubCoach` directly**. `SspRole` is type-only (erased at runtime). See [Auth & Security](./auth-and-security) for the full role cascade and which routes admit which roles.
:::

The role helpers in `src/schemas/roles.ts` are the canonical role model — mirrored from `SSP-Software/src/lib/auth/roles.ts` so the web app, mobile app, and gateway all agree on `ssp_super_admin > organisation_admin > coach > sub_coach > athlete` and the non-cascading `isAthlete`. The Zod schemas in `src/schemas/*` are the shared request-body contract the same way.

---

## 3. Installing the contract in a client app

Add `ssp-api` to `devDependencies` as a GitHub dependency (the README's pattern). Both apps pin to `#main`:

```jsonc
// SSP-Software or SSP-Mobile-App package.json
"devDependencies": {
  "ssp-api": "github:IzandlaSystem/SSP-API#main"
}
```

Then create a typed client. The README's canonical example:

```ts
import { hc } from 'hono/client';
import type { AppType } from 'ssp-api';

// web:  NEXT_PUBLIC_API_URL   mobile:  EXPO_PUBLIC_API_URL
export const api = hc<AppType>(process.env.NEXT_PUBLIC_API_URL!);

// fully typed — wrong field → TS error, response typed
const res = await api.sessions.$post({
  json: { title, team_id, sport_id, classification_id, planned_start_at },
});
const session = await res.json();
```

A production helper typically also injects the Supabase Auth JWT per request:

```ts
import { hc } from 'hono/client';
import type { AppType } from 'ssp-api';

const baseUrl =
  process.env.NEXT_PUBLIC_API_URL! || process.env.EXPO_PUBLIC_API_URL!;

export const api = hc<AppType>(baseUrl, {
  headers: async () => {
    const token = await getSessionToken(); // Supabase Auth JWT
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});
```

### Client environment variables

| App | Variable | Purpose |
| :--- | :--- | :--- |
| Web (Next.js) | `NEXT_PUBLIC_API_URL` | Gateway base URL exposed to the browser. |
| Mobile (Expo) | `EXPO_PUBLIC_API_URL` | Gateway base URL bundled into the app. |

Both must be set at build time (the `PUBLIC_` prefix inlines the value into client bundles). The gateway itself reads neither — these are purely client-side.

---

## 4. Type-safe usage examples

### Fetching identity (`GET /me`)
```ts
const res = await api.me.$get();
if (res.ok) {
  const user = await res.json();
  console.log('Logged in user:', user.email, user.roles);
}
```

### Creating a training session (`POST /sessions`)
TypeScript enforces every required field from the `createSession` Zod schema, and the response row type comes straight from the `sessions` table type:

```ts
const res = await api.sessions.$post({
  json: {
    title: 'Pre-Season Conditioning Block',
    team_id: '8ef0f0e0-47b1-4f67-88eb-116f1997380c',
    sport_id: '9df0f0e0-47b1-4f67-88eb-116f1997380d',
    classification_id: 'aef0f0e0-47b1-4f67-88eb-116f1997380e',
    planned_start_at: '2026-08-16T08:30:00.000Z',
  },
});

if (res.status === 201) {
  const newSession = await res.json();
  console.log('Created session ID:', newSession.id);
}
```

### Starting session recording (`POST /sessions/:id/start`)
```ts
const res = await api.sessions[':id'].start.$post({
  param: { id: sessionId },
  json: {
    firmware_session_id: 'FW-SES-20260816-01',
    firmware_sport_code: 'RUGBY_UNION',
  },
});
```

---

## 5. The "chain must stay intact" caution

`src/app.ts` builds `AppType` by **chaining** every `.route()` call onto a single `new Hono()` expression and exporting the final value:

```ts
const routedApp = new Hono()
  .use('*', cors({...}))
  .use('*', logger())
  .get('/health', (c) => c.json({ ok: true }))
  .route('/internal', internal)
  .route('/', users)
  // …one .route() per router, in order
  .route('/', ingest);

export const app = routedApp;
export type AppType = typeof app;
```

A comment in `app.ts` warns why this shape is load-bearing:

> Keep the route registration chain intact: Hono accumulates its typed client schema through each returned instance. Mutating a separately-declared Hono would make the published `AppType` collapse to `BlankSchema`.

Concretely: each `.route()` returns a *new* Hono type with the mounted router's routes merged in. If someone declares `const app = new Hono()` separately and calls `app.route(...)` as void statements (instead of chaining), Hono's type inference sees the original unchained `Hono` — whose client schema is `BlankSchema` — and every `api.sessions.$post(...)` call stops type-checking. The route chain is the contract; break the chain and the contract goes blank.

### After route changes: rebuild and bump

When a route is added, removed, or its schema/response shape changes, clients only pick up the new types once the contract is rebuilt and the dependency is bumped:

```bash
# In SSP-API
npm run build          # tsup → dist/index.{js,d.ts}
git commit -am "feat: add team analytics endpoint"
git push origin main

# In SSP-Software / SSP-Mobile-App
npm update ssp-api     # pulls the new #main commit
```

::: tip Upgrade path
The current GitHub-dependency model is intentional for the monorepo stage. The README notes the future plan: publish `@izandla/ssp-api` as a private npm package once versioned releases are warranted, at which point the GitHub dep is swapped for a semver range and `npm update` resolves to tagged versions.
:::

---

## 6. Typed responses, not just typed requests

The contract gives you typed *responses* because the gateway's Supabase client is itself typed. `lib/supabase.ts` builds `createClient<Database>(...)` with the service-role key, where `Database` is the generated type from the committed `src/lib/database.types.ts`. That means every `.select(...)` query returns rows typed against the real schema, and every `c.json(data)` in a handler carries those concrete row types into `AppType` — and out through `hono/client` to the caller.

Two layers of typing flow into the client:

| Layer | Source | What it types |
| :--- | :--- | :--- |
| Request bodies | `zValidator('json', schema)` in each route + schemas in `src/schemas/*` | The `json` argument to `$post` / `$patch`. A wrong or missing required field is a compile error. |
| Responses | `createClient<Database>(...)` + `c.json(row)` | The `await res.json()` return type — concrete table row shapes, not `unknown`. |

::: warning Response accuracy depends on `select(...)` column lists
`hono/client` infers the response type from what the handler returns to `c.json(...)`. If a route does `db().from('athletes').select('id, first_name, last_name')`, the client sees exactly those three columns — not the full `athletes` row. Routes that `select('*')` expose every column of the generated row type. Do not assume a field exists on a response unless the route's `select(...)` (or `select('*')`) includes it. See the route tables in [Architecture](./architecture) for the column lists each handler selects.
:::

### Regenerating database types

`src/lib/database.types.ts` is generated from the live Supabase schema and **committed** to the repo (it is not generated at build time). Regenerate it after any migration so response types stay accurate — the README's step:

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
# then:
npm run typecheck      # confirm the new types still satisfy the routes
npm run build          # tsup → dist/ with the updated AppType
git add src/lib/database.types.ts dist/
git commit -m "chore: regenerate database types"
```

Skipping this after a migration leaves `Database` describing the old schema: new columns won't appear in response types, and dropped columns become phantom fields that fail at runtime.

---

## 7. Contract regeneration & publishing (full checklist)

1. **Regenerate database types** (only if a migration landed):
   ```bash
   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
   ```
2. **Typecheck** to confirm the routes still satisfy the (possibly changed) `Database` type:
   ```bash
   npm run typecheck
   ```
3. **Build the contract bundle** — tsup emits clean, bundled declarations to `dist/`:
   ```bash
   npm run build
   ```
4. **Commit & push to `main`** — `dist/` is the published artifact clients consume:
   ```bash
   git add dist/ src/lib/database.types.ts
   git commit -m "feat: add team analytics endpoint"
   git push origin main
   ```
5. **Bump the dep in each client** so the GitHub ref resolves to the new commit:
   ```bash
   # in SSP-Software and SSP-Mobile-App
   npm update ssp-api
   ```

---

## 8. Related

- [Architecture](./architecture) — full route table, mount prefixes, and which source file owns each path.
- [Auth & Security](./auth-and-security) — JWT verification, the role cascade, `requireRoles`, and the two auth modes (JWT vs. shared secret).
- [Database Schema](./database-schema) — the tables and columns the generated `Database` type is built from.
- [API Reference](./api-reference) — per-resource endpoint details.
---
title: Published Client Contract & Adoption Status
description: SSP-API's generated Hono contract, current client adoption status, and the optional typed-RPC integration path.
outline: deep
---

# Published Client Contract & Adoption Status

The **SSP-API** builds and commits a typed Hono contract (`AppType`) in `dist/`. It is usable with `hono/client`, but it is **not currently consumed by either client app**. `SSP-Software` uses `src/lib/api/request.ts`; `SSP-Mobile-App` uses `src/lib/api.ts`. Both are hand-written `fetch` clients with local response types, and neither package declares `ssp-api` or `hono` as a dependency. The generated contract is therefore an available integration path, not current end-to-end type safety.

::: warning Current drift boundary
An API route or response change can compile successfully in this repository while either client remains stale. Until the clients adopt `AppType`, verify their local request wrappers and types explicitly after every contract change.
:::

---

## 1. How it works

`AppType` is `typeof app` from [`src/app.ts`](https://github.com/IzandlaSystem/SSP-API/blob/main/src/app.ts), the composed Hono instance after every `.route()` call has been chained onto it. Hono's client library (`hono/client`) turns that type into an RPC proxy at compile time, inferring:

- HTTP method and path parameters (`/sessions/:id`)
- Query parameters (`?team_id=…&status=recording`)
- JSON request bodies validated by Zod (`zValidator('json', schema)`)
- JSON response structures returned by `c.json(data)`

The contract is built as compiled declaration files in `dist/` by **tsup** (`npm run build` emits `dist/index.js` + `dist/index.d.ts`). No current client consumes it as a GitHub dependency.

```mermaid
flowchart LR
    GatewaySrc["SSP-API<br/>src/app.ts (route chain)"] -->|tsup build| Dist["dist/index.d.ts & dist/index.js<br/>AppType + role model"]
    Dist -.->|optional future dependency| WebClient["SSP-Software<br/>(hand-written fetch today)"]
    Dist -.->|optional future dependency| MobileClient["SSP-Mobile-App<br/>(hand-written fetch today)"]

    WebClient -->|requestWithToken(SSP_API_URL)| GatewaySrc
    MobileClient -->|createApiClient(EXPO_PUBLIC_API_URL)| GatewaySrc
```

---

## 2. The published surface (`src/index.ts`)

`src/index.ts` is the contract entry point: the file `tsup` bundles into `dist/` as the published package surface. It re-exports exactly three things:

| Export | Kind | Source | Purpose |
| :--- | :--- | :--- | :--- |
| `AppType` | `export type` | `./app.js` | `typeof app`, the Hono route chain type passed to `hc<AppType>()`. |
| `SSP_ROLES, ROLE_HIERARCHY, getPrimaryRole, hasAnyRole, hasOrgAccess, hasTeamAccess, isCoach, isAthlete, isOrganisationAdmin, isSspSuperAdmin, isSubCoach` | `export` (values) | `./schemas/roles.js` | The shared role model clients use for client-side gating/UI. |
| `SspRole` | `export type` | `./schemas/roles.js` | The role union type (`typeof SSP_ROLES[number]`). |

::: warning `isSubCoach` is exported for clients, not for routes
`isSubCoach` is re-exported so client apps can mirror the same cascade helpers the gateway uses, but **no gateway route calls `isSubCoach` directly**. `SspRole` is type-only (erased at runtime). See [Auth & Security](./auth-and-security) for the full role cascade and which routes admit which roles.
:::

The role helpers in `src/schemas/roles.ts` are canonical for the gateway and are exported for optional client reuse. Current clients do not import them; they maintain local role and request/response types, so agreement must be checked rather than assumed.

---

## 3. Optional client adoption

Neither app currently has these dependencies. To adopt the generated contract, add `ssp-api` and a compatible direct `hono` dependency to `devDependencies` (or publish a versioned API package first):

```jsonc
// Proposed SSP-Software or SSP-Mobile-App package.json entry
"devDependencies": {
  "hono": "<compatible-version>",
  "ssp-api": "github:IzandlaSystem/SSP-API#main"
}
```

Then create a typed client:

```ts
import { hc } from 'hono/client';
import type { AppType } from 'ssp-api';

export const api = hc<AppType>(baseUrl);

// fully typed: wrong field → TS error, response typed
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
| Web (Next.js) | `SSP_API_URL` or `NEXT_PUBLIC_SSP_API_URL` | Current `requestWithToken` base URL lookup; the server-only variable is preferred where possible. |
| Mobile (Expo) | `EXPO_PUBLIC_API_URL` | Gateway base URL bundled into the app. |

`EXPO_PUBLIC_API_URL` and `NEXT_PUBLIC_SSP_API_URL` are public bundle values. `SSP_API_URL` is read server-side by the web wrapper. The mobile wrapper currently falls back to `https://ssp-api-rosy.vercel.app` when `EXPO_PUBLIC_API_URL` is absent. The gateway itself reads none of these client variables.

---

## 4. Type-safe adoption examples

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

Each `.route()` returns a *new* Hono type with the mounted router's routes merged in. If someone declares `const app = new Hono()` separately and calls `app.route(...)` as void statements (instead of chaining), Hono's type inference sees the original unchained `Hono` (whose client schema is `BlankSchema`), and every `api.sessions.$post(...)` call stops type-checking. The route chain is the contract; break the chain and the contract goes blank.

### After route changes: rebuild and bump

When a route is added, removed, or its schema/response shape changes, rebuild the contract. If a client later adopts it, that client must also bump the dependency:

```bash
# In SSP-API
npm run build          # tsup → dist/index.{js,d.ts}
git commit -am "feat: add team analytics endpoint"
git push origin main

# In an adopting client
npm update ssp-api
```

::: tip Adoption choice
A pinned Git commit is safer than `#main` for reproducibility. A private versioned package becomes useful only when both clients are ready to consume and upgrade the contract deliberately.
:::

---

## 6. Typed responses, not just typed requests

For a consumer that adopts it, the contract provides typed *responses* because the gateway's Supabase client is itself typed. `lib/supabase.ts` builds `createClient<Database>(...)` with the service-role key, where `Database` is the committed type in `src/lib/database.types.ts`. Every `.select(...)` query carries those row types into `AppType` and through `hono/client`.

Two layers of typing flow into the client:

| Layer | Source | What it types |
| :--- | :--- | :--- |
| Request bodies | `zValidator('json', schema)` in each route + schemas in `src/schemas/*` | The `json` argument to `$post` / `$patch`. A wrong or missing required field is a compile error. |
| Responses | `createClient<Database>(...)` + `c.json(row)` | The `await res.json()` return type: concrete table row shapes, not `unknown`. |

::: warning Response accuracy depends on `select(...)` column lists
`hono/client` infers the response type from what the handler returns to `c.json(...)`. If a route does `db().from('athletes').select('id, first_name, last_name')`, the client sees those three columns, not the full `athletes` row. Routes that `select('*')` expose every column of the generated row type. Do not assume a field exists on a response unless the route's `select(...)` (or `select('*')`) includes it. See the route tables in [Architecture](./architecture) for the column lists each handler selects.
:::

### Regenerating database types

`src/lib/database.types.ts` is committed and described by the repo as generated from Supabase (it is not generated at build time). This audit confirmed that it includes the local OTA additions, but did not regenerate it from or compare it with the live project. Regenerate it after applying migrations so response types stay accurate:

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
3. **Build the contract bundle**: tsup emits clean, bundled declarations to `dist/`:
   ```bash
   npm run build
   ```
4. **Commit and publish the intended revision**: `dist/` is the package artifact an adopting client would consume:
   ```bash
   git add dist/ src/lib/database.types.ts
   git commit -m "feat: add team analytics endpoint"
   git push origin main
   ```
5. **If a client has adopted the package, bump and typecheck it**:
   ```bash
   # only in a client that declares ssp-api
   npm update ssp-api
   ```

---

## 8. Related

- [Architecture](./architecture): full route table, mount prefixes, and which source file owns each path.
- [Auth & Security](./auth-and-security): JWT verification, the role cascade, `requireRoles`, and the two auth modes (JWT vs. shared secret).
- [Database Schema](./database-schema): the tables and columns the generated `Database` type is built from.
- [API Reference](./api-reference): per-resource endpoint details.

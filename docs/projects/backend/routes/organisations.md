---
title: Organisations API
description: Multi-tenant organisation management and metadata endpoints in SSP-API.
outline: deep
---

# Organisations API (Phase 1)

The Organisations API exposes top-level tenant boundaries (Clubs, Academies, National Teams, Universities). It is read-only: listing every organisation on the platform (super admins only) and fetching a single organisation's metadata (super admin or same-tenant member). See [Auth & Security](../auth-and-security) for the JWT verification and role-loading pipeline.

---

## 1. List Organisations (`GET /organisations`)

Lists all organisations across the entire platform. The handler runs `select('*')` against the `organisations` table with no filter, so every row is returned.

- **Path:** `/organisations`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** `ssp_super_admin` (enforced via `requireRoles`)
- **Tenant Scope:** Global cross-tenant
- **Source:** `src/routes/organisations.ts` (mounted at `/organisations` in `app.ts`)

### Response (`200 OK`)

```json
{
  "organisations": [
    {
      "id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
      "name": "Hollywoodbets Sharks Academy",
      "slug": "sharks-academy",
      "logo_url": "https://storage.ssp.izandla.co.za/logos/sharks.png",
      "timezone": "Africa/Johannesburg",
      "created_at": "2026-01-15T08:00:00.000Z",
      "updated_at": "2026-06-01T12:00:00.000Z"
    }
  ]
}
```

When the query returns no rows, `organisations` is an empty array (`data ?? []`).

---

## 2. Get Organisation Details (`GET /organisations/:id`)

Fetches metadata for a single organisation. Access is checked manually (no `requireRoles`): a `ssp_super_admin` may read any organisation, otherwise the caller's `primary_organisation_id` (loaded via `loadCallerContext`) must equal the requested `id`.

- **Path:** `/organisations/:id`
- **Method:** `GET`
- **Auth:** JWT
- **Required Roles:** none — manual access check (`ssp_super_admin` or `ctx.primaryOrganisationId === id`)
- **Tenant Scope:** Org
- **Source:** `src/routes/organisations.ts` (mounted at `/organisations` in `app.ts`)

### Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | `uuid` | Yes | Target organisation ID. |

### Response (`200 OK`)

```json
{
  "id": "8ef0f0e0-47b1-4f67-88eb-116f1997380c",
  "name": "Hollywoodbets Sharks Academy",
  "slug": "sharks-academy",
  "logo_url": "https://storage.ssp.izandla.co.za/logos/sharks.png",
  "timezone": "Africa/Johannesburg",
  "created_at": "2026-01-15T08:00:00.000Z",
  "updated_at": "2026-06-01T12:00:00.000Z"
}
```

The handler runs `select('*').eq('id', id).maybeSingle()` against the `organisations` table, so the response shape matches the row columns: `id`, `name`, `slug`, `logo_url`, `timezone`, `created_at`, `updated_at`.

### Errors

| Status | Body | When |
| :--- | :--- | :--- |
| `403` | `{ "error": "Forbidden" }` | Caller is not `ssp_super_admin` and `id` does not match `ctx.primaryOrganisationId`. |
| `404` | `{ "error": "Not found" }` | No organisation row exists with the specified `id`. |
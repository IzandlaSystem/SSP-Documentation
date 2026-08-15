# Stop-Slop Backend and Mobile Documentation Plan

Date: 2026-08-15
Workspace: `/Users/nduzi/Documents/IzandlaSystems/SSP-Docs`
Baseline commit: `df49efabfa895925daf831ff6cdce68177dd8086`
Upstream stop-slop revision audited: `8da1f030185bdfe8471220585162991eaeb970e9`

## Goal

Apply the stop-slop prose rules to the SSP backend and mobile documentation without changing technical facts, public contracts, navigation anchors, tables, diagrams, code, or identifiers.

The finished pass must produce direct technical prose and a valid VitePress site. Each phase ends with a reviewable checkpoint so work can resume without repeating earlier files.

## Source audit

- [x] Read the complete upstream `hardikpandya/stop-slop` repository at the revision above.
- [x] Read the local `.stop-slop/brief.md` calibration for SSP technical documentation.
- [x] Inventory the backend and mobile documentation surface.
- [x] Inspect the current worktree and prose-only diff.
- [x] Run the current VitePress build and record the baseline failure.

The upstream repository contains seven files and 496 lines:

| File | Purpose |
| :--- | :--- |
| `SKILL.md` | Eight core rules, delivery checks, and a five-part scoring rubric. |
| `references/phrases.md` | Throat-clearing, filler, jargon, adverbs, meta-commentary, and vague declarations to remove. |
| `references/structures.md` | Binary contrasts, negative listings, fragments, rhetorical setups, false agency, passive voice, sentence starters, and rhythm patterns. |
| `references/examples.md` | Five before-and-after examples. |
| `README.md` | Installation and usage summary. |
| `CHANGELOG.md` | Rule changes through 2026-01-13. |
| `LICENSE` | MIT license. |

## SSP calibration

The upstream rules target essays and general prose. SSP reference documentation needs narrower application:

- Remove filler adverbs, throat-clearing, business jargon, vague claims, meta-commentary, rhetorical contrasts, dramatic fragments, and prose em dashes.
- Preserve passive voice where the system behavior has no useful human actor, such as "Routes are mounted" or "The field is nullable."
- Preserve adverbs and qualifiers when they carry technical meaning.
- Preserve code, file paths, endpoints, methods, field names, types, versions, UUIDs, constants, byte offsets, status codes, and numeric values.
- Preserve table structure and values. Tighten prose inside table cells only when meaning stays unchanged.
- Do not edit Mermaid blocks.
- Preserve VitePress callouts and `<code v-pre>` escapes.
- Preserve genuine technical negations, including `does NOT cascade`, `is NOT admitted`, and statements about absent implementations.
- Do not rename headings. Sidebar and cross-page anchors depend on their generated IDs.
- Treat every prose edit as a surgical replacement. Do not rewrite a page whose sentences already meet the standard.

## Scope and current state

| Area | Pages | Lines | Current state |
| :--- | ---: | ---: | :--- |
| Backend foundations and flows | 8 | 3,178 | 7 edited; `api-reference.md` untouched |
| Backend route references | 15 | 3,115 | All 15 edited |
| Mobile platform and integrations | 7 | 2,075 | 5 edited; `api-client.md` and `tracker-and-sync.md` untouched |
| Mobile features and testing | 4 | 1,122 | All 4 edited |
| **Total** | **34** | **9,490** | **31 edited; 3 untouched** |

The existing user-owned worktree contains 365 additions and 365 deletions across the 31 edited pages. Preserve those changes and review them in place.

Baseline checks:

- `git diff --check -- docs/projects/backend docs/projects/mobile-app` passes.
- No headings have changed in the current backend/mobile diff.
- `npm run docs:build` fails while parsing YAML frontmatter.
- The first reported failure is `docs/projects/backend/firmware-ota.md:3`, where an unquoted replacement colon creates an invalid mapping.
- The same risk exists in `backend/ingestion-pipeline.md` and `mobile-app/testing.md`, which also have unquoted colons in `description` values.
- Raw em-dash searches include protected cases such as table placeholders, technical labels, headings, and Mermaid text. Review context before changing each match.

## Phase 0: Stabilize the editing baseline

- [x] Re-read the 31 existing page diffs before changing them.
- [x] Quote or safely repunctuate frontmatter descriptions that contain YAML-significant colons.
- [x] Record the current heading text and generated link targets for all 34 pages.
- [x] Separate prose from protected regions: frontmatter, fenced code, Mermaid, tables, callouts, headings, and literal identifiers.
- [x] Run `npm run docs:build` to expose the next pre-existing or edit-induced failure.
- [x] Record unrelated failures without expanding the prose task into technical-documentation repair.

Gate:

- [x] Frontmatter parses.
- [x] No current edit changes a heading, route, field, value, or code example.
- [x] The worktree remains intact apart from approved prose fixes and this plan.

## Phase 1: Backend foundations and end-to-end flows

Review these pages in dependency order:

1. `docs/projects/backend/index.md`
2. `docs/projects/backend/architecture.md`
3. `docs/projects/backend/auth-and-security.md`
4. `docs/projects/backend/client-contract.md`
5. `docs/projects/backend/database-schema.md`
6. `docs/projects/backend/api-reference.md`
7. `docs/projects/backend/ingestion-pipeline.md`
8. `docs/projects/backend/firmware-ota.md`

Work:

- [x] Remove filler and rhetorical punctuation from the seven existing diffs without changing claims.
- [x] Complete the untouched `api-reference.md` from top to bottom.
- [x] Keep role cascade, auth modes, tenant boundaries, error envelopes, route mount order, schema values, signed-upload flow, parser idempotency, and OTA selection rules verbatim in meaning.
- [x] Cross-check repeated facts across architecture, auth, client contract, API reference, ingestion, and OTA pages.
- [x] Re-read each edited page once after its last edit.

Gate:

- [x] All eight pages pass the calibrated phrase and structure review.
- [x] Backend route paths, auth modes, roles, status codes, field names, environment variables, and numeric limits match the pre-edit text.
- [x] Backend cross-links still resolve.
- [x] `git diff --check` passes for the phase.

## Phase 2: Backend route references

### Phase 2A: Identity and tenancy

- [x] `routes/users.md`
- [x] `routes/organisations.md`
- [x] `routes/teams.md`
- [x] `routes/athletes.md`
- [x] `routes/coaches.md`

Preserve manual access checks, organisation defaults, role requirements, membership joins, and response shapes.

### Phase 2B: Sessions and athlete performance

- [x] `routes/sessions.md`
- [x] `routes/metrics.md`
- [x] `routes/workload.md`
- [x] `routes/goals.md`
- [x] `routes/benchmarks.md`
- [x] `routes/notifications.md`
- [x] `routes/analytics.md`

Preserve lifecycle transitions, validation rules, query defaults, pagination limits, calculation semantics, and mock-versus-live distinctions.

### Phase 2C: Devices and internal operations

- [x] `routes/devices.md`
- [x] `routes/firmware-releases.md`
- [x] `routes/internal.md`

Preserve pairing behavior, assignment ownership, firmware compatibility, `version_code` ordering, shared-secret selection, parser behavior, and error responses.

Gate:

- [x] Each route page has a recorded edit count and short change summary.
- [x] Examples, JSON bodies, tables, paths, schemas, and status codes have no semantic changes.
- [x] The route pages agree with `api-reference.md`.
- [x] `git diff --check` passes for the phase.

## Phase 3: Mobile platform and integration contracts

Review these pages in dependency order:

1. `docs/projects/mobile-app/index.md`
2. `docs/projects/mobile-app/architecture.md`
3. `docs/projects/mobile-app/configuration.md`
4. `docs/projects/mobile-app/api-client.md`
5. `docs/projects/mobile-app/auth-and-onboarding.md`
6. `docs/projects/mobile-app/ble-protocol.md`
7. `docs/projects/mobile-app/tracker-and-sync.md`

Work:

- [x] Review the five existing diffs for technical drift.
- [x] Complete the untouched `api-client.md` and `tracker-and-sync.md` pages.
- [x] Preserve provider order, route groups, navigation fallbacks, environment-variable timing, authentication sequence, API paths, and error types.
- [x] Preserve every BLE UUID, opcode, byte width, offset, endianness rule, timeout, payload shape, parser limit, and firmware divergence.
- [x] Keep backend UUID session IDs separate from firmware numeric session IDs.
- [x] Keep implementation status precise: real, demo, mocked, fallback, source-verified, or hardware-unverified.

Gate:

- [x] Mobile API paths agree with backend route documentation.
- [x] BLE protocol and tracker pages agree on characteristics, commands, timeouts, and sync flow.
- [x] No edit upgrades demo, mocked, source-only, or unverified behavior into a readiness claim.
- [x] `git diff --check` passes for the phase.

## Phase 4: Mobile features, design, and test documentation

- [x] `docs/projects/mobile-app/devices.md`
- [x] `docs/projects/mobile-app/dashboard-and-analytics.md`
- [x] `docs/projects/mobile-app/design-system.md`
- [x] `docs/projects/mobile-app/testing.md`

Work:

- [x] Review the existing diffs for lost qualifiers and over-tightened sentences.
- [x] Preserve the Demo-only device boundary and the separation from real tracker BLE.
- [x] Preserve mock-versus-API-fed data labels.
- [x] Preserve brand colors, fonts, dimensions, accessibility behavior, test counts, test names, commands, and enforcement rules.
- [x] Fix frontmatter punctuation without changing the single-line descriptions.

Gate:

- [x] UI documentation remains truthful about wired actions and data sources.
- [x] Design and accessibility constraints retain every value.
- [x] Test commands and asserted source contracts retain their exact meaning.
- [x] `git diff --check` passes for the phase.

## Phase 5: Cross-document quality gate

- [x] Scan prose for `—` and `&mdash;`, then classify every match before editing it.
- [x] Scan for the calibrated banned phrase list and filler adverbs.
- [x] Review binary contrasts, negative listings, false agency, rhetorical setups, fragments, and repeated sentence rhythms by reading the affected paragraphs.
- [x] Compare all changed frontmatter, headings, tables, Mermaid blocks, fenced code, links, identifiers, and numeric literals against the baseline.
- [x] Check backend-to-mobile contract repetition for route, auth, session ID, telemetry, OTA, and BLE consistency.
- [x] Run `git diff --check -- docs/projects/backend docs/projects/mobile-app`.
- [x] Run `npm run docs:build`.
- [x] Preview representative backend and mobile pages if the build succeeds.
- [x] Score the worst-affected page for Directness, Rhythm, Trust, Authenticity, and Density. Repeat its pass if the total is below 35/50.

Acceptance criteria:

- [x] VitePress builds successfully, or any unrelated baseline failure is documented with evidence.
- [x] No changed heading or broken anchor.
- [x] No changed technical value, contract, status, or implementation-readiness claim.
- [x] No removable prose em dash or banned filler remains.
- [x] Protected technical constructs remain intact.

## Phase 6: Handoff

- [x] Report each of the 34 files with its edit count and a one- or two-line summary.
- [x] Mark files that needed no changes.
- [x] Report the final scoring result for the worst-affected page.
- [x] Report validation separately: prose scan, diff check, VitePress build, link/anchor review, and preview review.
- [x] List any unresolved technical-content questions without guessing.
- [x] Keep the stop-slop source under `.stop-slop/` separate from the prose changes in the final diff.

## Per-page workflow

Use the same loop for every page:

1. Read the page from top to bottom.
2. Mark protected regions before editing.
3. Apply small `old_string` to `new_string` replacements.
4. Compare technical nouns, literals, and claims before and after.
5. Re-read the edited page once.
6. Record its edit count and summary.
7. Run the phase checks before moving to the next phase.

## Approval gate

- [x] User approves this plan before prose implementation begins.

## Completion record

- Completed: 2026-08-15
- Pages reviewed: 34 of 34
- VitePress production build: passed
- Preview smoke tests: four representative pages returned HTTP 200
- Protected-content comparison: headings, fenced blocks, inline code literals, and link targets unchanged
- Intentional contract correction: mobile Architecture now reports the source-verified 28 API methods instead of 27
- Worst-affected page score (`backend/api-reference.md`): Directness 9, Rhythm 8, Trust 10, Authenticity 9, Density 9 (45/50)

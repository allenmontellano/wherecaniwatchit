# SP8 — Expanded Reporting Form — Design Spec

> Date: 2026-06-26. Status: approved design, pre-plan. Sub-project SP8 of the pre-launch roadmap.
> **No auth dependency** — independent of SP6; builds in its own branch (`feat/sp8-reporting`).

## 1. Goal

Replace the report modal's free-text `platform` + `notes` packing with **structured** `reported_platform` + `reported_watch_url` columns on the `flags` table, so the SP7 review queue can act on clean, machine-readable data. Keep an optional free-text "details" field for context.

## 2. Background & current state

- **`flags` table** (`supabase/migrations/20260602000001_initial_schema.sql` + `20260604000002_flags_title_region.sql`): `id, availability_id (nullable), title_id, region_code, issue_type, flag_type, status, user_id, ip_hash, notes, created_at, updated_at`.
- **`report-modal.tsx`** collects `issue_type` (select), a free-text `platform` (shown only for `wrong-platform` / `is-here`), and free-text `notes` (≤ 280 chars). On submit it POSTs to `/api/flags`.
- **`/api/flags` route** calls `composeNotes(issue, platform, notes)` (in `lib/flags.ts`) which packs `Platform: <x>\n<notes>` into the single `notes` column.
- **`platforms` table**: `id, name, slug, logo_url, supported_regions text[]`.
- **`lib/flags.ts`**: `ISSUE_TYPES = ['not-here','is-here','wrong-platform','wrong-season','other']`, `issueToFlagType`, `composeNotes`.
- Stack: Next.js 16.2.7 (App Router, Server Components), React 19, TypeScript strict, Vitest (node env, `globals: false`, `@/*` alias). Client components are not unit-tested (no jsdom/RTL).

## 3. Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Platform capture | **Dropdown** of the region's known platforms + an **"Other — specify"** free-text fallback. |
| Stored value | Platform **slug** when a known platform is chosen; sanitized free text when "Other". Single `reported_platform text` column. |
| Freeform field | **Keep** an optional "details" textarea (reuses the `notes` column). |
| Watch URL | **Optional**; **sanitized** (origin + pathname only) and validated as `http(s)`. |
| Platform required? | **Required** when its issue type (`is-here` / `wrong-platform`) is selected. |
| Historical data | **No backfill** — existing flags keep their packed `notes` text. |

## 4. Data model (migration, additive — staging-first)

`supabase/migrations/<timestamp>_flags_reported_columns.sql`:
```sql
alter table flags
  add column if not exists reported_platform text,
  add column if not exists reported_watch_url text;
```
Nullable + additive — safe. `notes` is retained for the optional details field. Applied to **staging first**, verified, then a **separate explicit approval** before production (Management API with explicit ref, per the migration-safety workflow).

## 5. Form fields per issue type (`components/report/report-modal.tsx`)

Reveal logic stays keyed off `issue_type` (matches today's `showPlatform`):

| Issue type | Platform | Watch URL | Details |
|---|---|---|---|
| `not-here` (not available here) | — | — | optional |
| `is-here` (IS available here) | **required** | optional | optional |
| `wrong-platform` (wrong platform listed) | **required** (the correct one) | optional | optional |
| `wrong-season` | — | — | optional |
| `other` | — | — | optional |

- **Platform** becomes a `<select>` populated from the region's platforms (`{slug, name}`), plus a final **"Other — specify"** option that reveals a text input (max 100 chars).
- **Watch URL** is a new optional `<input type="url">` shown alongside platform.
- **Details** is the existing optional textarea (≤ 280 chars in the UI), stored in `notes`.

## 6. Platforms data source

The title detail page (Server Component) fetches the region's platforms — `select slug, name from platforms where <region> = any(supported_regions)` — and passes `platforms: { slug: string; name: string }[]` to `ReportModal` as a prop. No new public endpoint; the data is ready at page load and the list is small. If the region has no platforms seeded, the dropdown shows only "Other — specify".

## 7. API (`/api/flags`) + validation

The route accepts (JSON): `title_id`, `region_code`, `issue_type`, `reported_platform?`, `reported_watch_url?`, `notes?` (details). It **no longer** uses `composeNotes` or the old `platform` field. Validation happens at the boundary via pure helpers in `lib/flags.ts`:

### 7a. `sanitizeWatchUrl(raw: string | undefined)`
- Trim. Empty/undefined → `{ ok: true, value: null }` (optional field).
- Parse with `new URL(raw)`. On throw → `{ ok: false, error: 'Invalid watch URL.' }`.
- Protocol must be `http:` or `https:`, else `{ ok: false, error: 'Invalid watch URL.' }`.
- **Sanitize: reconstruct as `url.origin + url.pathname`** — **drop the query string and fragment** (strips tracking params like `utm_*`, `?si=`, `#t=`).
- Enforce length ≤ 500 after sanitization (else invalid).
- Return `{ ok: true, value: <sanitized> }`.
- Example: `https://www.netflix.com/title/81234?utm_source=share#x` → `https://www.netflix.com/title/81234`.

### 7b. `sanitizePlatform(raw: string | undefined, knownSlugs: Set<string>)`
- Trim. Empty/undefined → `{ ok: true, value: null }`.
- If `raw` is in `knownSlugs` → `{ ok: true, value: raw }` (a known platform slug; stored as-is).
- Otherwise treat as an **"Other" free-text name**:
  - Length must be 1–**100** chars, else `{ ok: false, error: 'Platform name must be 1–100 characters.' }`.
  - Must match `^[A-Za-z0-9 +.\-&'()]+$` — letters, digits, spaces, and `+ . - & ' ( )` only. This **rejects URLs** (no `:`/`/`) and special characters (`<>{}[]@#$%…`), returning `{ ok: false, error: 'Platform name contains invalid characters.' }`.
  - On pass → `{ ok: true, value: <trimmed text> }`.
- `knownSlugs` is built from `select slug from platforms where <region> = any(supported_regions)`.

### 7c. Route behavior
- Validate `title_id`, `region_code`, `issue_type` as today (issue_type ∈ `ISSUE_TYPES`).
- Run `sanitizeWatchUrl` and `sanitizePlatform`; on any `{ ok: false }` → `400` with the error message.
- **Required-platform enforcement:** if `issue_type` is `is-here` or `wrong-platform` and the sanitized `reported_platform` is `null` → `400` (`'A platform is required for this report.'`). This mirrors the UI's required state so a direct API caller can't bypass it.
- `notes` (details): trim, cap to 500 chars (DB safety), store directly (no `composeNotes`).
- Insert into `flags`: `{ title_id, region_code, issue_type, flag_type: issueToFlagType(issue_type), reported_platform, reported_watch_url, notes, ip_hash, status: 'pending', availability_id: null }`.
- Errors never leak internals; rate limiting (`enforceRateLimit(req, 'flags')`) unchanged.

## 8. Testing (TDD, Vitest node env)

- `lib/flags.test.ts` — extend with:
  - `sanitizeWatchUrl`: strips query + fragment; keeps origin+pathname; accepts http+https; rejects non-http(s), garbage, and over-length; empty → null.
  - `sanitizePlatform`: known slug passes through; valid "Other" name passes; rejects > 100 chars, URLs, and special characters; empty → null.
- `app/api/flags/route.test.ts` — extend: valid structured submit inserts the right columns; invalid watch URL / invalid platform name → 400; details stored in `notes`; `composeNotes` no longer referenced.
- `report-modal.tsx` is a client component — verified in-browser (no unit test), consistent with the codebase.
- Migration verified on staging before prod.

## 9. Scope (YAGNI)

**IN:** the two columns + migration; platform dropdown (region platforms) + "Other" text with the 100-char/charset sanitization; optional sanitized watch URL; optional details; API validation; passing region platforms from the title page.

**OUT (→ SP7 or later):** backfill/migration of historical packed `notes`; a platform-management admin UI; rendering the new structured fields in the review queue; deprecating/removing the legacy `notes` packing for old rows.

## 10. Open risks / notes

- `report-modal.tsx`'s current `platform` free-text input is replaced by the select + conditional "Other" input; keep the existing visual tokens (rounded inputs, `#2B72E8` primary).
- If `platforms.supported_regions` is sparse pre-launch, dropdowns will be short — "Other" covers the gap (consistent with the known MOTN PH-platform gaps).
- `new URL()` is available in the Node/Edge runtime used by the route; no polyfill needed.
- The `reported_platform` single-column slug-or-text approach means a reviewer resolves a value by checking it against `platforms.slug` (a known slug) vs. treating it as a raw "Other" name — documented for SP7.

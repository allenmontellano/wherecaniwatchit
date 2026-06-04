# Frontend Screens — Design Spec

_Date: 2026-06-04 · Source: Claude Design handoff bundle (`landing-page-design`)_

## Goal

Port the five finalized Claude Design screens into the live Next.js app, matching the
prototype HTML/CSS pixel-for-pixel, and extend the backend where the designs surface data
the current backend doesn't yet provide.

Screens: **Homepage · Search Results · Title Detail · Empty States · Report Modal.**

## Confirmed decisions

| Topic | Decision |
|---|---|
| Country selector (SERP/Title/Empty) | Standalone selector on the right of the header (matches bundle); switching recomputes availability **instantly client-side** via React Context — no refetch. |
| Title-detail data gaps | **Extend the TMDB sync** to fetch network, cast, creators, origin country, episode count, status, original language, and content rating. New nullable columns + migration. |
| Report submission | **Wire for real.** Extend the `flags` schema so any report persists (incl. "not available"). |
| Empty-state scenario 2 | Build the rich "found · not in your region" screen as a **distinct screen**. |
| Per-platform season labels | **Omit.** Not available at the data source — `StreamingOption` carries no season field; only a single `seasonCount` total exists. |
| Homepage | Already built to this design. **Verify-only**; fix only real deltas against `Home.html`. |

## Design tokens (already in the app — reuse, don't re-add)

- Fonts: Space Grotesk (`--font-display`), DM Sans (`--font-sans`), JetBrains Mono (`--font-mono`) — wired in `app/layout.tsx`.
- Colors: blue `#2B72E8` (hover `#1d5fd1`, active `#1752be`), fg `#171717`, muted `#717177`, faint `#AEAEB8`, border `#E5E5E5`, green `#34C759`, red `#FF3B30`, tint `#F5F5F7`.
- Platform badges: `lib/platforms.ts` `platformLabel(slug)`.

---

## Shared architecture

### Header (new shared components)
All inner screens use one sticky grid header: `grid-template-columns: 1fr minmax(0,540px) 1fr`,
`rgba(255,255,255,0.82)` + `blur(16px)`, bottom hairline.

- **`components/layout/site-header.tsx`** — the grid shell: logo (left) · refine pill (center) · country selector (right). Client component.
- **`components/layout/refine-search-form.tsx`** — center pill (search input + blue submit button). Submit → `/search?q=…&country=<ctx country>`. Focus ring matches `.refine.focused`.
- **`components/layout/country-selector.tsx`** — standalone right-side dropdown (flag + full name + chevron). Reads/writes country context. Mobile: name hidden < 720px.

### Country context (new)
- **`components/country/country-context.tsx`** — `CountryProvider` (client) holding `country: CountryCode` + `setCountry`. Initialised from the server-resolved country. `setCountry` persists the cookie (`selected-country`, 1-yr) and updates the URL via `history.replaceState` (shareable, no refetch). Exposes `useCountry()`.
- Server pages fetch **all-region** data once; the provider wraps header + content so the selector and the cards share state and recompute together.
- `lib/country.ts` stays the source of truth for `SUPPORTED_COUNTRIES` / `resolveCountry`. Region display names live in one shared const (`REGIONS` in `lib/country.ts`) consumed everywhere (kills the 3 duplicated copies in compact-search-form, availability-tabs, sync).

### Shared UI primitives (new)
- **`components/ui/platform-badge.tsx`** — `<span>` styled from `platformLabel(slug)`; `size?: 'sm' | 'lg'`.
- **`components/ui/answer-box.tsx`** — the green/red "Available / Not available in {region}" block (flag + headline + detail). Used on SERP card, Title Detail, and Empty scenario 2 (size variants).
- **`components/report/report-modal.tsx`** — see Report Modal section.

---

## Backend changes

### Migration A — title metadata (`supabase/migrations/20260604000001_title_metadata_fields.sql`)
Add nullable columns to `titles`: `network text`, `cast text[]`, `creators text[]`,
`origin_country text`, `episode_count int`, `status text`, `original_language text`,
`content_rating text`.

- `types/database.ts` `Title` gains the same fields.
- `lib/tmdb/types.ts`: extend `TMDBMovieDetail` / `TMDBTVDetail` with `credits`, `release_dates`/`content_ratings`, `networks`, `created_by`, `origin_country`, `number_of_episodes`, `status`, `original_language`, `production_companies`, `production_countries`, `spoken_languages`.
- `lib/tmdb/client.ts`: add `append_to_response=credits,content_ratings` (TV) / `credits,release_dates` (movie).
- `lib/sync.ts`: map TMDB → new columns. Movie "creators" = directors (crew job `Director`); TV = `created_by`. `network` = TV `networks[0].name` / movie `production_companies[0].name`. `content_rating` = US certification (TV `content_ratings.results[US]`; movie `release_dates.results[US]…certification`). `cast` = top 6 `credits.cast` names. `origin_country` = TV `origin_country[0]` / movie `production_countries[0].iso_3166_1` → display name. `original_language` → English language name.
- Extraction helpers live in **`lib/tmdb/extract.ts`** (pure, unit-tested): `extractCertification`, `extractCreators`, `extractNetwork`, `extractCast`, `extractOriginCountry`, `extractLanguageName`.

### Migration B — flags for any report (`supabase/migrations/20260604000002_flags_title_region.sql`)
- `flags.availability_id` → **nullable**.
- Add `flags.title_id uuid references titles(id)`, `flags.region_code text`, `flags.issue_type text`.
- Keep existing `flag_type` (derive from `issue_type` for back-compat) — `notes`, `status`, `ip_hash` unchanged.
- `types/database.ts` `Flag` updated.

### `/api/flags` rewrite (`app/api/flags/route.ts`)
Accept `{ title_id, region_code, issue_type, platform?, notes? }`. Validate `issue_type ∈
{not-here, is-here, wrong-platform, wrong-season, other}`. Map → `flag_type`
(`not-here→incorrect`, `is-here→missing`, `wrong-platform→incorrect`, `wrong-season→outdated`,
`other→incorrect`). Fold `platform` into `notes`. Insert with `ip_hash`. Mapping in
**`lib/flags.ts`** (pure, unit-tested): `issueToFlagType`, `composeNotes`.

### API responses
- Search/title APIs already `select('*')`, so new title columns flow through automatically. Add the new fields to the `SyncedResult.title` / page interfaces.

---

## Screen specs

### 1. Homepage — verify-only
Diff `app/page.tsx` + `components/home/*` against `home/Home.html`. The app is the design's
source; expect ≤ cosmetic deltas. Fix only real mismatches.

### 2. Search Results (`app/search/page.tsx` + new client tree)
- Server: resolve country, fetch `/api/search?q=`. Render `CountryProvider` → `SiteHeader` + `ResultsList`.
- Layout: `max-width: 880px` single column, `result-summary` line, `gap: 20px` cards.
- **`components/search/result-card.tsx`** (rewrite): horizontal card — poster (real `poster_url`, else gradient placeholder w/ title text + "Poster" tag), info column (title 25px display, meta row `year · type · genre · extent · ★rating`, synopsis), `AnswerBox` for selected region, "Available in other regions" rows (each region: flag + name + badges / "Not available"), Report button.
- `extent`: TV → `{season_count} seasons`; movie → `formatRuntime`.
- Recompute on country change (context).
- Empty results → Empty scenario 1 (below).
- Entrance: framer-motion fade-up, `prefers-reduced-motion` respected.

### 3. Title Detail (`app/titles/[id]/page.tsx` rewrite)
Replace poster+tabs layout with the cinematic design:
- **Hero**: backdrop (real `backdrop_url` if added, else gradient) with the two-layer dark gradient fading to white; large poster; title (`clamp(36px,5vw,56px)`); meta row; synopsis; credits (Starring / Created by) from new fields.
- **Availability in your region**: prominent `AnswerBox` (lg) + freshness line (`last_verified` → "Today"/date, "across 5 regions").
- **Where else you can watch it**: `regions` table — flag + name / badges / season-completeness(omitted) ; Report button in footer.
- **Title details**: two-column grid from new fields — cast list, creators, genres (pills), year, network, origin, runtime/episodes, status, language, content rating. Omit any null field.
- Footer line.
- Country selector recomputes the answer + table client-side (context). Needs all-region availability — title API already returns all rows.
- Report modal triggered from the table footer.
- Keep `app/titles/[id]/loading.tsx` skeleton consistent with new layout.

### 4. Empty States
- **Scenario 1 — no results** (`components/search/empty-no-results.tsx`): cloud-with-`?` SVG, "We couldn't find that title", suggestion chips (chips re-run search). Rendered by `ResultsList` when `results.length === 0`.
- **Scenario 2 — found · not in your region** (`components/search/not-in-region.tsx`): condensed title card + `AnswerBox` (unavailable) + "Available in these regions" 2×2 grid of clickable region cards (switch country via context) + globe nudge. **Trigger:** SERP returns exactly one result and it has zero availability in the selected country → show this instead of the standard list. (Confirm trigger during review.)

### 5. Report Modal (`components/report/report-modal.tsx`)
Faithful port: header (region flag + "Report incorrect info" + sub w/ title + region), issue
`<select>` (5 options), conditional platform `<input>` (shown for `wrong-platform`/`is-here`),
notes `<textarea maxlength=280>` + live counter (warn ≥ 260), footer note, Cancel + Submit.
Submit → POST `/api/flags` → success state (animated check) → close. Close on Esc / backdrop /
X. Focus trap + `aria-modal`. Opened from SERP cards and Title Detail with `{ titleId, titleName, region }`.

---

## Data-gap handling (final)

| Field | Source | Handling |
|---|---|---|
| network, cast, creators, origin, episodes, status, language, content rating | TMDB (new sync) | Stored + shown; omit row when null |
| per-platform seasons | — (not in feed) | Omitted everywhere |
| poster / backdrop | `poster_url` (real) | Real image; gradient placeholder fallback |

## Testing (TDD)

Tests-first for pure logic; JSX verified in browser.
- `lib/title-utils.ts`: `formatExtent(title)` (new) — TV seasons / movie runtime / null.
- `lib/tmdb/extract.ts`: all extraction helpers (fixtures from TMDB shapes).
- `lib/flags.ts`: `issueToFlagType`, `composeNotes`.
- `lib/country.ts`: `REGIONS` shape / `resolveCountry` (extend existing).
- `app/api/flags/route.test.ts`: new body shape, validation, mapping.
- `lib/sync.test.ts`: extend for new column mapping (mock TMDB).
- `app/api/search` + `titles/[id]` tests: extend for new fields.

## Out of scope
- Real backdrop art pipeline (use gradient until `backdrop_url` exists; may add column if trivial).
- Auth / accounts (reports stay anonymous).
- Any screen not in the bundle.

## File-change map (high level)
- **New:** `components/layout/{site-header,refine-search-form,country-selector}.tsx`, `components/country/country-context.tsx`, `components/ui/{platform-badge,answer-box}.tsx`, `components/report/report-modal.tsx`, `components/search/{empty-no-results,not-in-region}.tsx`, `lib/tmdb/extract.ts`, `lib/flags.ts`, two migrations.
- **Rewrite:** `components/search/{result-card,results-section}.tsx`, `app/search/page.tsx`, `app/titles/[id]/page.tsx`, `app/titles/[id]/loading.tsx`, `app/api/flags/route.ts`.
- **Extend:** `lib/country.ts`, `lib/title-utils.ts`, `lib/sync.ts`, `lib/tmdb/{client,types}.ts`, `types/database.ts`, relevant tests.
- **Verify:** `app/page.tsx`, `components/home/*`.

## TODO checklist
- [ ] Migration A + `Title`/`Flag` type updates
- [ ] TMDB types/client extend + `lib/tmdb/extract.ts` (TDD)
- [ ] `lib/sync.ts` new-field mapping (TDD)
- [ ] Migration B + `/api/flags` rewrite + `lib/flags.ts` (TDD)
- [ ] `lib/country.ts` shared `REGIONS` + `lib/title-utils.ts` `formatExtent` (TDD)
- [ ] Country context + shared header components
- [ ] `AnswerBox` + `PlatformBadge` primitives
- [ ] Report modal
- [ ] Search Results rewrite (card + list + summary)
- [ ] Empty scenario 1 + scenario 2
- [ ] Title Detail rewrite + loading skeleton
- [ ] Homepage verify pass
- [ ] Full typecheck + test suite green; browser-verify each screen

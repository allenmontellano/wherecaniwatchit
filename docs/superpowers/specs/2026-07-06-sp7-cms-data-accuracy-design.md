# SP7 — Internal CMS & Data Accuracy Layer — Technical Spec

> Date: 2026-07-06. Status: **approved design** (Allen, in-session). Build tool: **Fable 5** (spec is Fable-ready — design tokens in §2).
> Scope decision (Allen): **Full CMS, all six modules, one spec, built together.** Risk of the all-at-once scope is mitigated by the phased build order in §13 — each phase ships a working, green-test, committed slice.

## 1. Goal

An internal, role-gated CMS at `/admin` that turns crowdsourced flags (SP8) and manual review into trustworthy availability data: a flag review queue, a direct availability editor, a confidence layer on `availability`, title/platform/user management, and a contribution counter with an admin dashboard.

## 2. Design system (Fable build tokens)

| Token | Value |
|---|---|
| Primary | `#2B72E8` (hover `#1d5fd1`) |
| Background | `#FFFFFF` |
| Text | `#171717` |
| Muted text | `#717177` |
| Success | `#34C759` |
| Error | `#FF3B30` |
| Display font | **Space Grotesk** (`var(--font-display)`) |
| Body font | **DM Sans** |
| Components | **shadcn/ui** |

Match the existing app's visual language: rounded-xl inputs, focus ring `0 0 0 3px rgba(43,114,232,0.12)`, mono uppercase field labels (see `components/report/report-modal.tsx` as the reference component).

## 3. Current state (verified on prod `ahgmszdrhndcycvairmn`, 2026-07-06)

- **Titles 3,494 · availability 9,120** (8,870 available=true). Sources: `api` 8,673 (MOTN bulk seed), `checker` 447, nothing else.
- **`source='motn'` does not exist.** MOTN seed writes `source='api'` (`lib/sync.ts:134`); the daily cron writes `source='cron'` (`app/api/cron/sync-availability/route.ts:94`, 0 rows so far).
- The only Disney platform slug is **`disney`** (no `disney-plus` row in `platforms`).
- **26 rows** match `source IN ('api','cron') AND region_code='PH' AND platform slug='disney'` — the known-unreliable MOTN Disney+ PH set (SP5). These require a **one-time backfill to `confidence='low'`** in the migration (§5) — the column default alone would leave them `medium`.
- Auth (SP6): `profiles.role` enum `contributor|reviewer|admin`; `requireUser()`/`requireRole()` in `lib/auth/guards.ts`; anti-escalation trigger blocks JWT-client role changes (service role exempt). All app writes already go through service-role API routes/actions (RLS blocks client writes).
- Flags (SP8): structured `reported_platform` (slug or free text), `reported_watch_url` (sanitized), `issue_type`, `title_id`, `region_code`, `notes`; `status IN ('pending','reviewed','resolved')`.
- `titles.status` already holds the TMDB production status string — reused in §9; `titles.seed_status` is separate (seed pipeline marker).
- `profiles.contribution_count` already exists (default 0).

## 4. Roles — trust ladder

| Capability | Contributor | Reviewer | Admin |
|---|:--:|:--:|:--:|
| View review queue | ✓ | ✓ | ✓ |
| Resolve flag (pre-filled confirm → availability write) | ✓ *(lands medium)* | ✓ *(lands high)* | ✓ *(high)* |
| Direct availability editor | ✓ *(lands medium)* | ✓ *(lands high)* | ✓ *(high)* |
| Approve contributor (medium) writes → high | — | ✓ | ✓ |
| Title management (§9) | — | — | ✓ |
| Platform CRUD (§10) | — | — | ✓ |
| User & invite management (§11) | — | — | ✓ |
| Admin dashboard (all users, stats) | — | — | ✓ |
| Own contribution count | ✓ | ✓ | ✓ |

Enforcement is server-side on every mutation: each server action calls `requireRole([...])` and uses the **service-role client** (existing pattern). The nav renders only the items the session role can use, but UI hiding is never the security boundary.

## 5. Data model (one migration, additive; staging-first, separate prod approval)

`supabase/migrations/<timestamp>_sp7_cms.sql`:

```sql
-- Confidence layer on availability
do $$ begin
  create type availability_confidence as enum ('high','medium','low');
exception when duplicate_object then null;
end $$;

alter table availability
  add column if not exists confidence availability_confidence not null default 'medium',
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- One-time backfill: known-unreliable MOTN Disney+ PH rows (26 on prod as of 2026-07-06)
update availability a
set confidence = 'low'
from platforms p
where a.platform_id = p.id
  and p.slug = 'disney'
  and a.region_code = 'PH'
  and a.source in ('api','cron');

-- Title overrides + local titles
alter table titles
  add column if not exists metadata_overrides jsonb not null default '{}'::jsonb;
alter table titles alter column tmdb_id drop not null;

-- Flag review provenance
alter table flags
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolution text check (resolution in ('accepted','rejected'));

create index if not exists idx_availability_confidence on availability(confidence);
```

Notes:
- `tmdb_id` becomes nullable for local PH titles (§9). The existing `UNIQUE` constraint still applies to non-null values (Postgres unique ignores NULLs) — no change needed.
- Backfill is idempotent (re-running re-sets the same rows to `low`).
- Migration applied via **Management API with explicit ref** per the standing workflow; **staging (`hunvbflchgjphnhdjmws`) first**, verify, then separate approval for prod.

### Source taxonomy (after SP7)

| `availability.source` | Meaning | Written by |
|---|---|---|
| `api` | MOTN bulk/on-demand seed | existing `lib/sync.ts` |
| `cron` | MOTN daily refresh | existing cron |
| `checker` | direct HTTP checker | existing checkers |
| `contributor` | CMS write by a contributor | **new** |
| `reviewer` | CMS write by a reviewer/admin | **new** |

## 6. Confidence rule engine — `lib/confidence.ts` (pure, unit-tested)

```ts
export type Confidence = 'high' | 'medium' | 'low'

export function computeConfidence(input: {
  source: string          // availability.source value being written
  platformSlug: string
  regionCode: string
}): Confidence
```

Precedence (first match wins):
1. `source ∈ {'reviewer'}` → **high** (human-confirmed always wins).
2. `source ∈ {'contributor'}` → **medium** (pending reviewer approval).
3. **Known-bad-source rule:** `source ∈ {'api','cron'}` AND `platformSlug === 'disney'` AND `regionCode === 'PH'` → **low**. *(Corrected SP5 rule — keys on the real aggregator sources; `source='motn'` never existed. Slug list is a named constant `LOW_CONFIDENCE_RULES` so SP11 can extend it.)*
4. Anything else (`api`, `cron`, `checker`, unknown) → **medium**.

Reviewer *approval* of an existing medium row sets `confidence='high'`, `reviewed_by`, `reviewed_at` directly (no recompute).

## 7. Module 1 — Review queue (`/admin/queue`) — **build priority 2 (after foundation)**

- Query: `flags WHERE status='pending'`, joined to `titles(title, poster_url)`; columns: title, region, issue type, reported platform (badge whether it's a known slug vs "Other" text — resolve against `platforms.slug`), reported watch URL, notes, age.
- Sort: rows whose target availability is `low` confidence first, then oldest first.
- **Accept — pre-filled confirm:** side panel opens an availability form pre-filled from the flag (`title_id`, `region_code`, platform resolved from `reported_platform` slug when known, `watch_url` from `reported_watch_url`). Actor confirms/tweaks → server action:
  1. `requireRole(['contributor','reviewer','admin'])`
  2. Upsert `availability` (`onConflict: title_id,platform_id,region_code`) with `source` = `'reviewer'` (reviewer/admin) or `'contributor'`, `confidence` via `computeConfidence`, `reviewed_by/reviewed_at` when reviewer/admin, `last_verified = now()`.
  3. Update flag: `status='resolved'`, `resolution='accepted'`, `reviewed_by/at`.
  4. Increment actor's `contribution_count` (+1).
  5. Drop the title's Redis detail cache (`delCached(titleCacheKey(title_id))` — existing helper).
- If `reported_platform` is "Other" free text (no slug match), the platform select opens unset with the text shown as a hint; the actor picks a real platform or rejects.
- **Reject:** `status='reviewed'`, `resolution='rejected'`, `reviewed_by/at`, +1 contribution, no data write.
- `not-here` flags accepted → set the matching availability row `available=false` (same confirm flow, pre-filled with the existing row).

## 8. Module 2 — Availability editor (`/admin/availability`) — **priority 3**

- Title search (reuse existing FTS search via server), pick a title → grid of availability rows across the 5 regions × that region's platforms: available toggle, watch URL, source, confidence badge, last_verified.
- Add / edit / soft-remove (`available=false`) rows. Every write: role gate → `source` per actor → `computeConfidence` → cache drop → +1 contribution.
- **Pending-approval filter:** list view of `confidence='medium' AND source='contributor'` rows; reviewer/admin **Confirm** → `confidence='high'`, `reviewed_by/at`, +1 contribution to the approver. No separate approval table — the filter IS the approval queue.

## 9. Module 4 — Title management (`/admin/titles`) — admin only — **priority 4**

- **Add by TMDB id:** calls the existing seed pipeline (`lib/seed.ts`) for one title.
- **Add local title:** manual entry of all metadata fields, `tmdb_id = null`, no warnings. Closes the Vivamax/iWantTFC local-content gap (feeds SP11).
- **Override editor:** edit title fields; changed keys stored in `metadata_overrides` jsonb (only the overridden fields). **Re-sync merge rule:** TMDB re-sync updates only keys **absent** from `metadata_overrides`; overridden keys persist. A "Reset override" per field deletes the key (next re-sync restores TMDB's value).
- **Status-aware warnings** (keyed off existing `titles.status`, case-insensitive):
  - `ended` / `released` / `canceled` → *"This title has ended/been released. TMDB metadata is unlikely to change — your edits will persist through re-syncs. Proceed?"*
  - `returning series` / `in production` / `planned` → *"This title is currently airing. TMDB may update this metadata on the next re-sync and could overwrite your changes. Only override if you're correcting a persistent TMDB error. Proceed?"* (Overrides persist through re-sync regardless — the warning is about expectation, not behavior.)
  - No `tmdb_id` (local title) → no warning; it's plain editing.
- **Re-sync button** per title (admin): re-fetch TMDB metadata, apply merge rule.

## 10. Module 3 — Platform CRUD (`/admin/platforms`) — admin only — **priority 5**

- Table of `platforms`: name, slug (immutable after create — it's a foreign key by convention in availability/report flows), logo_url, `supported_regions[]` (multi-select of the 5 launch regions). Create + edit; **no delete** (availability FK; deactivation is out of scope/YAGNI pre-launch).

## 11. Module 5 — User & invite management (`/admin/users`) — admin only — **priority 5**

- List `profiles` joined with auth email: username, role, region, contribution_count, joined_at.
- **Invite:** email + role → service-role `inviteUserByEmail` (email template already points at `/auth/confirm` token_hash flow, live since SP6) + stage role in `app_metadata` (same mechanism as `scripts/invite.ts`, which stays as a CLI fallback).
- **Change role:** service-role `admin.updateUserById({ app_metadata: { role } })` + update `profiles.role` (service role bypasses the anti-escalation trigger by design). Self-demotion of the last admin is blocked in the action.

## 12. Module 6 — Contribution counter + dashboard — **counter in priority 2, dashboard priority 5**

- **Counter rule:** +1 to the acting user per completed data action — flag accept, flag reject, availability create/edit, pending-approval confirm, title override/add. One action = one increment, incremented atomically in the same server action (`update profiles set contribution_count = contribution_count + 1`).
- Contributors/reviewers see their own count on `/account` (already displays profile data) and in the admin shell header.
- **Admin dashboard (`/admin`):** per-user contribution table (sortable), pending flag count, pending-approval count, confidence distribution (high/medium/low counts), and a **Disney+ PH low-confidence widget** (count of `low` rows — the SP11 workload meter). **Payment rate deferred** — counter only, no monetary display.

## 13. Build order & session-resilience protocol (Allen: Fable 5 access ends July 7; expect interruptions)

Build on `feat/sp7-cms` off `staging`. **Commit after every logically complete, tested unit — never batch a whole module.** Every commit leaves tests green (`npx vitest run`, `npx tsc --noEmit`).

| Phase | Contents | Value if we stop here |
|---|---|---|
| **1. Foundation** | `lib/confidence.ts` (TDD) · migration file (not applied) · `/admin` shell + role-gated layout + nav | Confidence engine + guarded shell exist |
| **2. Core loop** | Module 1 review queue + flag accept/reject actions + contribution counter hookup | The crowdsourcing accuracy loop works end-to-end |
| **3. Editor** | Module 2 availability editor + pending-approval filter | Manual PH seeding possible (MOTN can be paused) |
| **4. Titles** | Module 4 title mgmt (overrides, local titles, re-sync merge) | Disney+ PH / SP11 fix work unblocked |
| **5. Admin conveniences** | Module 3 platforms · Module 5 users/invites · Module 6 dashboard | Nice-to-have; CLI/dashboard fallbacks exist |

- **End of each phase:** update CLAUDE.md "Current state" with exactly what's done, what's next, and in-flight decisions, so any session/model can resume without rediscovery.
- **Pause gates unchanged and deadline-proof:** applying the migration (staging or prod) and any merge to `staging`/`master` require Allen's explicit go-ahead. If a gate is the next step when access is closing, **stop at the gate and leave it pending** — a pause gate is a good stopping point, not a missed one.
- UI can be built and unit/integration-tested against the un-applied migration's types before the DB migration lands (the migration is Phase-gate for *live* verification, not for code).

## 14. Testing

- `lib/confidence.test.ts` — full precedence table incl. the Disney+ PH rule and the constant-driven rule list.
- Override-merge logic (`lib/title-overrides.ts`, pure): re-sync respects overridden keys, updates the rest; reset-key behavior.
- Server actions integration-tested with a mocked service client (pattern from `app/api/flags/route.test.ts`): role rejection, flag accept writes + counter increment + cache drop, last-admin demotion block.
- CMS UI verified live in-browser (Playwright) at the staging gate, per SP6/SP8 practice.

## 15. Out of scope (YAGNI / later)

- Payment rate & payouts (operational, deferred).
- Platform equivalence mapping (Disney+ PH = Hulu PH, Viu×Max) — **SP11**, but `LOW_CONFIDENCE_RULES` and platform CRUD are its hooks.
- Public contributor signup / authenticated public flag attribution.
- Flag bulk actions, audit-log table, soft-delete/deactivation of platforms.
- Backfilling old packed-notes flags (SP8 decision stands).

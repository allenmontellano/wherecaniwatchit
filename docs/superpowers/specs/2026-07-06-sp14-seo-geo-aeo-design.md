# SP14 — SEO + GEO/AEO — Scope & Design Spec

> Date: 2026-07-06. Status: **scope/design doc for approval — no code yet.** Same gate flow as SP7/SP13 (approve this → plan → build). This is the **last technical sprint before SP10 (E2E gate) and launch**, so it is scoped and sequenced against that below.
> Author framing: I've split the work into "must-ship-before-launch," "worth-building-now," and "premature / defer," and flagged my own GEO/AEO judgment calls rather than treating the brief as exhaustive.

## 1. Goal

Make every public page discoverable and correctly represented by (a) classic search engines, (b) social/link unfurlers, and (c) generative/answer engines — grounded in the availability data we already have — and make **launch day a single deliberate flip** from `noindex` to indexable.

## 2. Context / current state

- **Stack:** Next.js 16.2.7 App Router (Server Components). Metadata should use the framework's Metadata APIs (`generateMetadata`, `MetadataRoute.sitemap`, `MetadataRoute.robots`). ⚠️ Next 16 differs from older docs — the implementer must confirm exact signatures against `node_modules/next/dist/docs/` before building (per AGENTS.md).
- **Indexing today:** production is pre-launch `noindex` via a `SITE_INDEXABLE` toggle; **staging is permanently `noindex`** (independent of the prod toggle). Launch = flip `SITE_INDEXABLE` → true on prod only.
- **Public routes:** `/` (home/search), `/search?q=…&country=…`, `/titles/[id]?country=…`, `/login`, `/privacy`, `/terms`. Title + availability data lives in Postgres (3,494 titles, 9,120 availability rows).
- **Data shape we can lean on:** `titles` (title, type, synopsis, genres, year, poster_url, imdb_rating, runtime, season_count, network, cast, creators, content_rating, status) and per-region `availability` (platform, available, watch_url). This is exactly the structured, factual data answer engines want.
- **Analytics:** Vercel Analytics + Speed Insights already wired (cookieless) — gives us the Core Web Vitals field data for §3.7.

## 3. Classic SEO (in scope)

### 3.1 Dynamic per-page metadata — **must-ship**
- `generateMetadata` on `/titles/[id]` producing a **title-specific** `<title>` and `description`. Template e.g. `Where to watch {title} ({year}) — streaming availability` / description built from synopsis + top availability ("Stream {title} on {platforms} in {region}…"). Region-aware where the URL carries `?country=`.
- Home + search pages get static, keyword-sensible defaults; search result pages should be **`noindex, follow`** (thin/infinite query space — don't let SERPs index arbitrary `?q=`).
- Decision to confirm: **canonical country.** A title page varies by `?country=`. Recommendation: canonical = the **country-less** title URL (or a default region), with region variants as either `noindex` or consolidated via canonical, to avoid duplicate-content dilution. (See §3.6.)

### 3.2 Open Graph + Twitter cards — **must-ship**
- OG/Twitter tags per title (title, description, `og:type=video.movie`/`video.tv_show`, `og:image`). Image options: (a) use the TMDB `poster_url` directly, or (b) a generated OG card (Next `ImageResponse` / `opengraph-image`) with poster + "Where to watch" + platform logos. **Recommendation:** start with the poster URL (zero infra), add a generated card later if share CTR matters. Flag: TMDB image host must be allowed in `next.config` images + CSP.

### 3.3 `sitemap.xml` from the DB — **must-ship**
- `app/sitemap.ts` (`MetadataRoute.sitemap`) enumerating all title URLs + static pages. At 3.5k titles this is one file; plan for **sitemap index + chunking at ~50k URLs** later. `lastModified` from `titles.updated_at`. Exclude `noindex` routes. Cache/revalidate sensibly (it hits the DB — reuse the service-role read + a cache TTL).

### 3.4 `robots.txt` + the launch flip — **must-ship**
- `app/robots.ts` (`MetadataRoute.robots`). **Behaviour keyed off `SITE_INDEXABLE`:** when false (pre-launch / staging) → `Disallow: /` for all; when true (prod launch) → allow crawl of public routes, disallow `/admin`, `/api`, `/login`, `/accept-invite`, `/auth`, point to the sitemap. This makes launch the same single toggle that already gates `noindex` — **no separate robots edit on launch day.** (GEO/AEO crawler allow-rules fold in here — §4.1.)

### 3.5 JSON-LD structured data — **must-ship (this is also the AEO backbone)**
- Emit `Movie` / `TVSeries` schema.org JSON-LD on each title page: name, description, image, datePublished/`dateCreated`, genre, actor, director/creator, aggregateRating (from `imdb_rating`), `contentRating`, `numberOfSeasons`.
- **Tie availability to the graph:** model watch options so both Google and answer engines can read "where to stream." Options to decide in planning: `Movie.potentialAction` / `WatchAction` with `target` = platform `watch_url`, or `offers`/`BroadcastService`. Recommendation: `WatchAction` per available platform in the user's region. This is the single highest-leverage item for both rich results **and** AEO extraction.

### 3.6 Canonical URLs — **must-ship**
- Canonical `<link>` per page. Resolve the `?country=` duplication decision from §3.1 here (recommend canonical → country-neutral title URL; treat region as a UI state, not a distinct indexable document — availability differences are expressed in JSON-LD/body, not separate URLs). Flag for approval: this is a real SEO architecture choice; the alternative (per-country indexable pages) multiplies URLs 5× and needs `hreflang`.

### 3.7 Core Web Vitals / speed audit — **worth-doing, light**
- Use the existing Speed Insights field data + a Lighthouse pass on home/search/title. Known good: co-located `sin1`, cached p95 32ms. Likely focus areas: poster image loading (`next/image`, sizing, `priority` on LCP poster), font loading (Space Grotesk/DM Sans — `next/font`), and any layout shift on the AnswerBox. Deliverable: an audit + a short punch-list, not a big rebuild.

## 4. GEO/AEO (generative + answer-engine optimization)

> This space is genuinely unsettled. Below is what I judge **worth building now** vs **premature**, with reasoning — treat these as recommendations, not received wisdom.

### 4.1 AI-crawler allow rules in `robots.txt` — **worth-doing (cheap, reversible)**
- Explicit `User-agent` groups for `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-SearchBot`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `Bytespider`, etc., under the same `SITE_INDEXABLE` gate.
- **Judgment call for you (Allen), not a default I'll silently pick:** allowing these bots trades *content leverage* (being cited/《surfaced》 in AI answers → referral + brand) against *content appropriation* (models trained on our aggregated data with no click-back). For a discovery product whose value is "answer where to watch X," **being in the answer engines is probably strategically good** (they'll answer the question anyway; better sourced from us). Recommendation: **allow the answer/search crawlers** (GPTBot/OAI-SearchBot, ClaudeBot, PerplexityBot, Applebot-Extended) and **decide separately on the pure-training crawlers** (`CCBot`, `Google-Extended` training use). I'll implement whatever split you choose; the mechanism is one robots file either way.

### 4.2 `llms.txt` at site root — **worth-doing (cheap), with a caveat**
- Add `/llms.txt` (Markdown) describing what the site is, the canonical URL patterns (`/titles/{id}`), the data model in plain language, regions covered, and attribution/usage notes. **Caveat / honesty:** `llms.txt` is a **proposed convention with limited confirmed adoption** by the major answer engines as of now — its upside is low-cost future-proofing and a clean human-readable index, not a proven ranking lever. I recommend shipping a small static one and not over-investing.
- Optionally `/llms-full.txt` later if we want to expose a fuller index — defer.

### 4.3 Answer-extraction readiness of title pages — **worth-doing (audit + targeted change)**
- Answer engines extract best from pages that state the factual answer **concisely, near the top, in text (not just an interactive widget), and backed by schema**. Our `AnswerBox` is the right instinct; the audit question is whether the "where to watch X in {region}" answer is present as **crawlable server-rendered text** (not only client-hydrated UI) and appears early in the DOM.
- Likely output: ensure the title page server-renders a one-sentence factual answer ("{Title} is available to stream on {platforms} in {region} as of {date}.") high in the document, mirrored by the §3.5 `WatchAction` JSON-LD. This doubles as a featured-snippet play for classic SEO. **This is the highest-value AEO item** — it's mostly "make sure the answer is server-rendered text + schema," not net-new surface.

### 4.4 My additional recommendations (flagged, not in the brief)
- **`dateModified` / freshness signals:** availability changes over time; surfacing "verified as of {date}" (from `last_verified`) in body + schema builds trust for both users and answer engines and hedges the SEC-09-adjacent "95% stale data" reality (see backlog). Worth including.
- **Breadcrumb JSON-LD** (`BreadcrumbList`) — cheap, helps SERP presentation. Optional.
- **Per-region answer honesty:** since availability is region-specific and some data is stale/low-confidence (SP7 confidence enum), avoid emitting confident schema for `low`-confidence rows — consider gating `WatchAction`/answer text on `confidence != 'low'`. Ties SP14 to SP7's confidence layer. **Recommend including** — emitting wrong "where to watch" data to answer engines is worse than emitting none.
- **OG image generation** (§3.2b) and **`hreflang`** (only if we choose per-country indexable pages) — defer unless the canonical decision goes that way.

## 5. Explicitly out of scope / premature (with reasoning)

- **Generated OG card infrastructure** — defer; poster URL covers launch.
- **`llms-full.txt` / a machine API for AI** — premature; `llms.txt` stub is enough to start.
- **Per-country indexable URL architecture + `hreflang`** — only if §3.6 canonical decision demands it; default recommendation avoids it.
- **Programmatic SEO landing pages** ("best way to watch X", genre/platform hubs) — a post-launch growth lever, not launch-blocking.
- **Bing/IndexNow, Google Search Console automation, sitemap ping** — nice post-launch ops, not blocking.
- **Chasing `llms.txt` as a ranking signal** — unproven; ship the stub, don't over-invest.

## 6. Sequencing vs SP10 / launch

SP14 must land **before SP10's E2E gate** so the E2E suite can assert the SEO surface (sitemap 200, robots reflects the toggle, title page has metadata + JSON-LD). Proposed order:

1. **Launch-gating core (build first):** robots.ts + sitemap.ts + `SITE_INDEXABLE` wiring (§3.4, 3.3) → per-title `generateMetadata` + canonical (§3.1, 3.6) → JSON-LD `Movie/TVSeries` + `WatchAction` (§3.5) → OG/Twitter via poster (§3.2a). These are the "must-ship."
2. **AEO layer (build second):** AI-crawler robots groups (§4.1, once you pick the split) + server-rendered concise answer + freshness/confidence gating (§4.3, 4.4) + `llms.txt` stub (§4.2).
3. **Audit + polish (build last):** Core Web Vitals punch-list (§3.7), breadcrumb JSON-LD.
4. **Hand to SP10:** E2E assertions for all of the above; launch day = flip `SITE_INDEXABLE`.

## 7. Open questions for approval

1. **Canonical/region architecture (§3.1/3.6):** country-neutral canonical (my recommendation) vs per-country indexable pages + `hreflang`?
2. **AI-crawler policy (§4.1):** allow answer/search crawlers; what about pure-training crawlers (`CCBot`, `Google-Extended`)? Your call — I'll implement the split.
3. **Confidence gating (§4.4):** OK to suppress `WatchAction`/answer text for `low`-confidence availability so we don't feed known-bad data to engines? (Recommend yes.)
4. **OG images:** poster URL now, generated card deferred — OK?
5. Anything in §5 you want pulled back into scope.

*No code has been written. Approve/adjust → I'll write the implementation plan.*

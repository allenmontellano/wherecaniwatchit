# SP9 — Terms of Service & Privacy Policy — Design

> Date: 2026-06-10. Status: **approved design, awaiting spec review**.
> Pre-launch (Phase 4). Individual operator, governed by Philippine law.

## Goal

Ship two plain-language legal pages — **Terms of Service** (`/terms`) and **Privacy Policy** (`/privacy`) — plus a **site-wide footer** that links to them, so the site has the legal disclosures required before public launch. Content must be **accurate to what the code actually does** (no boilerplate that misrepresents data handling).

## Non-goals

- No cookie-consent banner (analytics are cookieless; the only cookie is strictly functional). Disclosure lives in the Privacy Policy.
- No DMCA/takedown page or separate abuse contact — `privacy@wherecaniwatchit.info` covers inquiries under PH law for now.
- No account/login-specific terms (auth ships later in SP6); these pages describe the current anonymous, read-only product plus the report form.
- No lawyer review gate in this sub-project (plain-language, honest disclosures; user may seek review separately).

## Decisions (from brainstorming)

- **Operator / law:** individual operator; governed by the laws of the **Republic of the Philippines**; privacy aligned to the **Data Privacy Act of 2012 (RA 10173)** and the **National Privacy Commission (NPC)**.
- **Contact:** `privacy@wherecaniwatchit.info` (mailbox set up via Cloudflare Email Routing before launch).
- **Tone:** plain-language but complete.
- **Footer:** global, **site-wide including the home page**.
- **Both pages** include a one-sentence "independent project, not affiliated with any streaming service" note.

---

## Architecture

### Routes & components
| File | Responsibility |
|---|---|
| `app/terms/page.tsx` (new) | Terms of Service page + `metadata`. Static/prerendered. |
| `app/privacy/page.tsx` (new) | Privacy Policy page + `metadata`. Static/prerendered. |
| `components/legal/legal-shell.tsx` (new) | Shared layout for both pages: `<SiteHeader/>`, a centered max-width prose container styled to the site type system, an `<h1>` + "Last updated" line, and a slot for the body. |
| `components/layout/site-footer.tsx` (new) | Global footer: links to Terms & Privacy, `privacy@…` contact, `© 2026 Where Can I Watch It`, the independent-project note, and the **TMDB attribution** line. |
| `lib/legal/disclosures.ts` (new) | Single source of truth for reused legal constants (contact email, TMDB attribution text, analytics-disclosure sentence, NPC reference, independent-project sentence, "last updated" date). Imported by pages, footer, and tests. |
| `app/layout.tsx` (modify) | Render `<SiteFooter/>` in `<body>` after `{children}` (before the analytics components is fine; order with `<Analytics/>` doesn't matter). |

### Styling
Match the existing system: `font-display` (Space Grotesk) for headings, `font-sans` (DM Sans) for body, white background, the same container/spacing idiom as `components/title/title-detail.tsx`. The legal body is long-form text — use a constrained measure (`max-w-2xl`/`max-w-3xl`), comfortable line-height, clear `<h2>` section headers, and `<a>` links in the site accent color. No new design tokens.

### Footer on the home hero
The home page `<main>` is `min-h-dvh` centered. With a global footer in the root layout, the footer sits **just below the fold** on home (standard hero-then-footer pattern) and inline at the end of content on `/search`, `/titles/[id]`, `/terms`, `/privacy`. Accepted per design note (site-wide including home).

### Metadata & indexing
Each page sets its own `title`/`description`. They inherit the current `robots: noindex` pre-launch (via the root layout's `SITE_INDEXABLE` gate) and automatically become indexable at launch — no special handling.

---

## Privacy Policy — content outline (plain-language, RA 10173-aligned)

**Header:** "Privacy Policy", "Last updated 10 June 2026", one-line intro (who operates the site — an independent individual in the Philippines; contact `privacy@…`).

1. **Independent project note** — one sentence: this is an independent project and is not affiliated with, endorsed by, or sponsored by any streaming service.
2. **What we collect and why** — accurate to code:
   - **Search queries** — processed to return results; cached briefly (~1 hour) in Upstash Redis under environment-namespaced keys to speed up repeat searches; not linked to your identity.
   - **Region/country** — determined from Cloudflare's IP-based geolocation header and/or your saved region preference (the `selected-country` cookie), used to show availability for the right region.
   - **IP address — never stored in raw form.** Your IP is converted to a **one-way, non-reversible hash** (SHA-256 with a secret salt). This hash is used as a rate-limit key to prevent abuse, and is stored alongside **report submissions** for abuse prevention/de-duplication. The raw IP is never written to our database or logs.
   - **Report submissions** — when you submit a correction/report, we store only: the title, the region, the issue type, an optional platform name, optional notes (max 500 characters), the hashed IP above, and a status. No name, email, or account is collected.
   - **Error & diagnostic data** — we use Sentry to capture technical error events so we can keep the site working.
   - **Analytics** — `<analytics-disclosure sentence>`: we use Vercel Analytics, Vercel Speed Insights, and Cloudflare Web Analytics, which are **cookieless and aggregated and collect no personally identifying information**. This is privacy-friendly measurement — not "zero tracking."
3. **Cookies** — the only cookie is `selected-country`, which is **strictly functional** (remembers your region). No advertising or cross-site tracking cookies — which is why there is no cookie-consent banner.
4. **Third-party services & data sources** — TMDB and MOTN (streaming-availability data sources); Vercel (hosting + analytics), Cloudflare (DNS/CDN + analytics), Upstash (cache + rate limiting), Supabase (database), Sentry (error monitoring). Each processes data only to run the service.
5. **How long we keep data** — search cache ~1 hour; rate-limit counters roll off on a short sliding window; report submissions retained to improve data accuracy; error logs limited retention.
6. **Your rights (Data Privacy Act)** — access, correction, objection, erasure/blocking, and the right to complain to the **National Privacy Commission**. To exercise any right, email `privacy@…`.
7. **Children** — the service is not directed at children, and we do not knowingly collect their data.
8. **Security** — reasonable technical measures; the site is served over HTTPS with HSTS.
9. **Changes to this policy** — we'll update the "Last updated" date; material changes will be highlighted.
10. **Contact** — `privacy@wherecaniwatchit.info`.

---

## Terms of Service — content outline

**Header:** "Terms of Service", "Last updated 10 June 2026", one-line intro.

1. **Acceptance & about** — by using the site you agree to these terms; the service is operated by an independent individual under Philippine law.
2. **Independent project note** — one sentence (same as Privacy): independent project, not affiliated with/endorsed by any streaming service; all trademarks belong to their owners.
3. **What the service does / accuracy** — it's an informational search for where titles stream across supported regions; **availability data may be incomplete or out of date and changes frequently — always confirm on the streaming provider** before relying on it.
4. **Attribution** — TMDB attribution (required): "This product uses the TMDB API but is not endorsed or certified by TMDB." Streaming-availability data is provided via third-party sources.
5. **Acceptable use** — don't scrape, hammer, or attempt to bypass rate limits; don't use the service unlawfully or to infringe others' rights; don't submit unlawful or abusive report content.
6. **Your submissions** — by submitting a report you grant us permission to use it to improve the data; you confirm it isn't unlawful.
7. **"As-is" / no warranty** — the service is provided as-is with no warranty of accuracy or availability.
8. **Limitation of liability** — to the maximum extent permitted by Philippine law, we're not liable for losses arising from use of the site or reliance on its data.
9. **Changes** — we may change the service or these terms; continued use means acceptance.
10. **Governing law** — Republic of the Philippines.
11. **Contact** — `privacy@wherecaniwatchit.info`.

---

## `lib/legal/disclosures.ts` (shared constants)

Exports (single source of truth, imported by pages + footer + tests):
- `LEGAL_CONTACT_EMAIL = 'privacy@wherecaniwatchit.info'`
- `LEGAL_LAST_UPDATED = '10 June 2026'`
- `TMDB_ATTRIBUTION = 'This product uses the TMDB API but is not endorsed or certified by TMDB.'`
- `ANALYTICS_DISCLOSURE = 'We use cookieless, aggregated analytics (Vercel Analytics, Vercel Speed Insights, and Cloudflare Web Analytics) that collect no personally identifying information.'`
- `INDEPENDENT_PROJECT_NOTE = 'Where Can I Watch It is an independent project and is not affiliated with, endorsed by, or sponsored by any streaming service.'`
- `NPC_REFERENCE = 'National Privacy Commission'`

---

## Testing

Vitest runs node-env (no jsdom/RTL), so we avoid brittle RSC render tests. Instead:
- `lib/legal/disclosures.test.ts` — assert the constants exist and have the expected, non-empty, correct values (e.g., contact email matches the domain; TMDB attribution is the exact required string).
- A lightweight check that each page module **imports the required disclosures** (e.g., a string scan of `app/privacy/page.tsx` source asserting it references `ANALYTICS_DISCLOSURE`, `LEGAL_CONTACT_EMAIL`, `NPC_REFERENCE`, `INDEPENDENT_PROJECT_NOTE`; and `app/terms/page.tsx` references `TMDB_ATTRIBUTION` + `INDEPENDENT_PROJECT_NOTE`). This guarantees the required disclosures can't silently disappear.
- Final verification: `npm run build` succeeds and a quick visual pass of both pages + the footer (including on the home hero).

---

## File structure summary

```
app/terms/page.tsx               (new)
app/privacy/page.tsx             (new)
app/layout.tsx                   (modify: render <SiteFooter/>)
components/legal/legal-shell.tsx (new)
components/layout/site-footer.tsx(new)
lib/legal/disclosures.ts         (new)
lib/legal/disclosures.test.ts    (new)
```

## Risks / notes

- **TMDB attribution** wording is fixed to TMDB's required phrasing; if a logo is also required by their current terms, that's a footer image follow-up (text disclosure satisfies the minimum).
- **Footer on home** changes the home view (adds below-the-fold footer) — intended per design note; verify it doesn't disrupt the hero's full-screen feel.
- These are honest, plain-language disclosures, not a substitute for legal advice; the operator may seek review independently.
- Content is static; the main correctness risk is **drift between the policy and the code** — mitigated by sourcing factual claims (IP hashing, cookie name, report fields, analytics vendors) from the verified current implementation.

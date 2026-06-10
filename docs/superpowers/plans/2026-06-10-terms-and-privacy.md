# SP9 — Terms & Privacy Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/terms` and `/privacy` plain-language legal pages plus a site-wide footer linking to them, with disclosures that are accurate to the current code.

**Architecture:** Two static App Router pages built from a shared `LegalShell` (minimal logo-only header + prose container). A global `SiteFooter` rendered in the root layout. All reused legal strings live in one `lib/legal/disclosures.ts` module imported by pages, footer, and tests.

**Tech Stack:** Next.js 16 App Router (Server Components), TypeScript strict, Tailwind, Vitest (node env — no RTL).

**Spec:** `docs/superpowers/specs/2026-06-10-terms-and-privacy-design.md`

**Branch:** `feat/legal-pages` (already created off `master`; spec committed there).

**Deviation from spec (justified):** the spec said `LegalShell` renders `<SiteHeader/>`. Research shows `SiteHeader` is a client component requiring `initialQuery` and rendering `CountrySelector`, which calls `useCountry()` and **throws outside a `CountryProvider`** (mounted only per-page in `/search` and `/titles/[id]`). Putting it on legal pages would crash. The shell uses a **minimal logo-only header** instead.

**No DB changes / no migrations** in this sub-project — deploy needs no Supabase token.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `lib/legal/disclosures.ts` (new) | Single source of truth for reused legal strings | 1 |
| `lib/legal/disclosures.test.ts` (new) | Unit-tests the constants | 1 |
| `components/legal/legal-shell.tsx` (new) | `LegalShell` (header + prose) + `LegalSection` | 2 |
| `components/layout/site-footer.tsx` (new) | Global footer (links, contact, attribution) | 3 |
| `app/layout.tsx` (modify) | Render `<SiteFooter/>` site-wide | 3 |
| `app/privacy/page.tsx` (new) | Privacy Policy page | 4 |
| `app/terms/page.tsx` (new) | Terms of Service page | 4 |
| `lib/legal/pages-disclosures.test.ts` (new) | Asserts each page references its required disclosures | 4 |

**Prose convention:** use typographic apostrophes/quotes (’ “ ”) in JSX text to satisfy `react/no-unescaped-entities` (eslint-config-next). Do not use straight `'` inside JSX text.

---

### Task 1: Shared disclosures module (TDD)

**Files:**
- Create: `lib/legal/disclosures.ts`
- Test: `lib/legal/disclosures.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/legal/disclosures.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  TMDB_ATTRIBUTION,
  ANALYTICS_DISCLOSURE,
  INDEPENDENT_PROJECT_NOTE,
  NPC_REFERENCE,
} from './disclosures'

describe('legal disclosures', () => {
  it('contact email is on the site domain', () => {
    expect(LEGAL_CONTACT_EMAIL).toBe('privacy@wherecaniwatchit.info')
  })
  it('uses the exact required TMDB attribution', () => {
    expect(TMDB_ATTRIBUTION).toBe(
      'This product uses the TMDB API but is not endorsed or certified by TMDB.',
    )
  })
  it('analytics disclosure states cookieless and no PII', () => {
    expect(ANALYTICS_DISCLOSURE).toMatch(/cookieless/i)
    expect(ANALYTICS_DISCLOSURE).toMatch(/no personally identifying information/i)
  })
  it('independent-project note states not affiliated', () => {
    expect(INDEPENDENT_PROJECT_NOTE).toMatch(/not affiliated/i)
  })
  it('references the National Privacy Commission', () => {
    expect(NPC_REFERENCE).toBe('National Privacy Commission')
  })
  it('has a last-updated date in 2026', () => {
    expect(LEGAL_LAST_UPDATED).toMatch(/2026/)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run lib/legal/disclosures.test.ts`
Expected: FAIL — module `./disclosures` does not exist.

- [ ] **Step 3: Implement the module**

`lib/legal/disclosures.ts`:

```ts
export const LEGAL_CONTACT_EMAIL = 'privacy@wherecaniwatchit.info'
export const LEGAL_LAST_UPDATED = '10 June 2026'
export const TMDB_ATTRIBUTION =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.'
export const ANALYTICS_DISCLOSURE =
  'We use cookieless, aggregated analytics (Vercel Analytics, Vercel Speed Insights, and Cloudflare Web Analytics) that collect no personally identifying information.'
export const INDEPENDENT_PROJECT_NOTE =
  'Where Can I Watch It is an independent project and is not affiliated with, endorsed by, or sponsored by any streaming service.'
export const NPC_REFERENCE = 'National Privacy Commission'
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run lib/legal/disclosures.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/legal/disclosures.ts lib/legal/disclosures.test.ts
git commit -m "feat: add shared legal disclosure constants"
```

---

### Task 2: Legal shell component

**Files:**
- Create: `components/legal/legal-shell.tsx`

> Presentational Server Component; no unit test (node-env Vitest can't render RSC). Verified by `tsc` here and build in Task 5.

- [ ] **Step 1: Implement the shell**

`components/legal/legal-shell.tsx`:

```tsx
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/logo'

export function LegalShell({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-black/5 px-4 py-3 md:px-8">
        <Link
          href="/"
          aria-label="Where Can I Watch It — home"
          className="inline-flex items-center"
        >
          <Logo width={120} />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-12 md:py-16">
        <h1 className="font-display text-3xl font-semibold text-neutral-900 md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">Last updated {lastUpdated}</p>
        <div className="mt-8 space-y-8 leading-relaxed text-neutral-700">{children}</div>
      </main>
    </div>
  )
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-neutral-900">{heading}</h2>
      {children}
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (Confirm `Logo` accepts a `width` prop — it is used as `<Logo width={120} />` in `components/layout/site-header.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add components/legal/legal-shell.tsx
git commit -m "feat: add LegalShell + LegalSection for legal pages"
```

---

### Task 3: Site footer + layout integration

**Files:**
- Create: `components/layout/site-footer.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Implement the footer**

`components/layout/site-footer.tsx`:

```tsx
import Link from 'next/link'
import {
  LEGAL_CONTACT_EMAIL,
  TMDB_ATTRIBUTION,
  INDEPENDENT_PROJECT_NOTE,
} from '@/lib/legal/disclosures'

export function SiteFooter() {
  return (
    <footer className="border-t border-black/5 bg-white px-4 py-8 text-sm text-neutral-500 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-neutral-900">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-neutral-900">
            Privacy
          </Link>
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="hover:text-neutral-900">
            Contact
          </a>
        </nav>
        <p>© 2026 Where Can I Watch It</p>
      </div>
      <div className="mx-auto mt-4 w-full max-w-5xl space-y-1 text-xs text-neutral-400">
        <p>{INDEPENDENT_PROJECT_NOTE}</p>
        <p>{TMDB_ATTRIBUTION}</p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Render it site-wide in the root layout**

In `app/layout.tsx`, add the import near the other component imports:

```tsx
import { SiteFooter } from '@/components/layout/site-footer'
```

And update the `<body>` so the footer renders after `{children}` (keep the existing `StagingBanner` and analytics-gating lines):

```tsx
      <body className="font-sans antialiased">
        <StagingBanner />
        {children}
        <SiteFooter />
        {!isStaging() && <Analytics />}
        {!isStaging() && <SpeedInsights />}
      </body>
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add components/layout/site-footer.tsx app/layout.tsx
git commit -m "feat: add site-wide footer with legal links + attribution"
```

---

### Task 4: Privacy & Terms pages (+ disclosure-presence tests, TDD)

**Files:**
- Test: `lib/legal/pages-disclosures.test.ts`
- Create: `app/privacy/page.tsx`
- Create: `app/terms/page.tsx`

- [ ] **Step 1: Write the failing test**

`lib/legal/pages-disclosures.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('legal pages reference their required disclosures', () => {
  it('privacy page uses analytics, contact, NPC, and independent-project disclosures', () => {
    const src = read('app/privacy/page.tsx')
    expect(src).toMatch(/ANALYTICS_DISCLOSURE/)
    expect(src).toMatch(/LEGAL_CONTACT_EMAIL/)
    expect(src).toMatch(/NPC_REFERENCE/)
    expect(src).toMatch(/INDEPENDENT_PROJECT_NOTE/)
  })
  it('terms page uses TMDB attribution, independent-project note, and contact', () => {
    const src = read('app/terms/page.tsx')
    expect(src).toMatch(/TMDB_ATTRIBUTION/)
    expect(src).toMatch(/INDEPENDENT_PROJECT_NOTE/)
    expect(src).toMatch(/LEGAL_CONTACT_EMAIL/)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run lib/legal/pages-disclosures.test.ts`
Expected: FAIL — `app/privacy/page.tsx` / `app/terms/page.tsx` do not exist (readFileSync throws).

- [ ] **Step 3: Implement the Privacy page**

`app/privacy/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { LegalShell, LegalSection } from '@/components/legal/legal-shell'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  ANALYTICS_DISCLOSURE,
  INDEPENDENT_PROJECT_NOTE,
  NPC_REFERENCE,
} from '@/lib/legal/disclosures'

export const metadata: Metadata = {
  title: 'Privacy Policy — Where Can I Watch It?',
  description:
    'How Where Can I Watch It handles your data: cookieless analytics, hashed IPs, one functional cookie, and no personal accounts.',
}

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" lastUpdated={LEGAL_LAST_UPDATED}>
      <p>
        Where Can I Watch It is operated by an independent individual based in the Philippines.
        This policy explains what limited data the site handles and why. Questions? Email{' '}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline">
          {LEGAL_CONTACT_EMAIL}
        </a>
        .
      </p>
      <p>{INDEPENDENT_PROJECT_NOTE}</p>

      <LegalSection heading="What we collect and why">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Search queries</strong> — processed to return results and cached briefly
            (about an hour) to speed up repeat searches. They are not linked to your identity.
          </li>
          <li>
            <strong>Region</strong> — determined from Cloudflare’s IP-based geolocation and/or
            your saved region preference (the <code>selected-country</code> cookie), so we can
            show availability for the right region.
          </li>
          <li>
            <strong>IP address — never stored in raw form.</strong> Your IP is converted to a
            one-way, non-reversible hash (SHA-256 with a secret salt). That hash is used to
            rate-limit requests and is stored alongside report submissions to prevent abuse. The
            raw IP is never written to our database or logs.
          </li>
          <li>
            <strong>Report submissions</strong> — when you report a correction we store only the
            title, the region, the issue type, an optional platform name, optional notes (up to
            500 characters), the hashed IP above, and a status. No name, email, or account is
            collected.
          </li>
          <li>
            <strong>Error data</strong> — we use Sentry to capture technical errors so we can keep
            the site working.
          </li>
          <li>
            <strong>Analytics</strong> — {ANALYTICS_DISCLOSURE} This is privacy-friendly
            measurement, not “zero tracking.”
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Cookies">
        <p>
          The only cookie we use is <code>selected-country</code>, which simply remembers your
          chosen region. There are no advertising or cross-site tracking cookies, which is why you
          won’t see a cookie-consent banner.
        </p>
      </LegalSection>

      <LegalSection heading="Third-party services">
        <p>
          We rely on TMDB and MOTN for title and streaming-availability data, and on Vercel
          (hosting and analytics), Cloudflare (content delivery and analytics), Upstash (caching
          and rate limiting), Supabase (database), and Sentry (error monitoring). Each processes
          data only to operate the service.
        </p>
      </LegalSection>

      <LegalSection heading="How long we keep data">
        <p>
          Search caches expire within about an hour and rate-limit counters roll off on a short
          rolling window. Report submissions are kept to help us improve data accuracy. Error logs
          are kept for a limited time.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          Under the Philippine Data Privacy Act of 2012, you may request access to, correction of,
          or erasure of your personal data, object to its processing, and lodge a complaint with
          the {NPC_REFERENCE}. To exercise any of these, email{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline">
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          The service is not directed at children, and we do not knowingly collect their personal
          data.
        </p>
      </LegalSection>

      <LegalSection heading="Security">
        <p>
          We apply reasonable technical measures to protect the limited data we handle. The site
          is served over HTTPS with HSTS enabled.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          If we update this policy we’ll change the “Last updated” date above and highlight
          material changes.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Email{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline">
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  )
}
```

- [ ] **Step 4: Implement the Terms page**

`app/terms/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { LegalShell, LegalSection } from '@/components/legal/legal-shell'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  TMDB_ATTRIBUTION,
  INDEPENDENT_PROJECT_NOTE,
} from '@/lib/legal/disclosures'

export const metadata: Metadata = {
  title: 'Terms of Service — Where Can I Watch It?',
  description:
    'The terms for using Where Can I Watch It — an independent, informational streaming-availability search.',
}

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" lastUpdated={LEGAL_LAST_UPDATED}>
      <p>
        By using Where Can I Watch It you agree to these terms. The service is operated by an
        independent individual under the laws of the Republic of the Philippines.
      </p>
      <p>
        {INDEPENDENT_PROJECT_NOTE} All trademarks and brand names belong to their respective
        owners.
      </p>

      <LegalSection heading="What the service does">
        <p>
          Where Can I Watch It is an informational search for where movies and shows stream across
          supported regions. Availability data may be incomplete or out of date and changes
          frequently — always confirm on the streaming provider before relying on it.
        </p>
      </LegalSection>

      <LegalSection heading="Attribution">
        <p>{TMDB_ATTRIBUTION}</p>
        <p>Streaming-availability data is provided via third-party sources.</p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          Please don’t scrape the site, send automated or excessive requests, or attempt to bypass
          rate limits. Don’t use the service unlawfully or to infringe others’ rights, and don’t
          submit unlawful or abusive content in reports.
        </p>
      </LegalSection>

      <LegalSection heading="Your submissions">
        <p>
          When you submit a report you grant us permission to use it to improve the data, and you
          confirm it isn’t unlawful.
        </p>
      </LegalSection>

      <LegalSection heading="No warranty">
        <p>
          The service is provided “as is,” without warranty of any kind, including as to the
          accuracy or availability of its data.
        </p>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <p>
          To the maximum extent permitted by Philippine law, we are not liable for any loss
          arising from your use of the site or your reliance on its data.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          We may change the service or these terms. Continued use of the site means you accept the
          updated terms.
        </p>
      </LegalSection>

      <LegalSection heading="Governing law">
        <p>These terms are governed by the laws of the Republic of the Philippines.</p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Email{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline">
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  )
}
```

- [ ] **Step 5: Run the tests, verify they pass**

Run: `npx vitest run lib/legal/pages-disclosures.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add app/privacy/page.tsx app/terms/page.tsx lib/legal/pages-disclosures.test.ts
git commit -m "feat: add Privacy Policy and Terms of Service pages"
```

---

### Task 5: Full verification

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all green (existing 200 + 8 new).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed; `/terms` and `/privacy` appear as static routes in the build output.

- [ ] **Step 3: Visual pass (local dev or after staging deploy)**

Verify: `/privacy` and `/terms` render with header, headings, and readable prose; the footer appears site-wide including the home page (below the hero fold); footer links navigate correctly; the `mailto:` contact works. Confirm no `react/no-unescaped-entities` lint errors in the build.

---

## Deploy (post-build, approval-gated)

> No migrations / no Supabase token needed. Follows the standard staging-first flow.

- [ ] **Step 1:** Merge `feat/legal-pages` → `staging`; push; confirm staging deploy live.
- [ ] **Step 2:** Visual check `/privacy`, `/terms`, and the footer on `staging.wherecaniwatchit.info` (including the home page). Confirm the staging banner + footer coexist and pages are `noindex`.
- [ ] **Step 3: GATE — request production approval.** Report staging results; wait for explicit go-ahead.
- [ ] **Step 4:** Merge `staging` → `master`; push (Vercel auto-deploys); spot-check `/privacy`, `/terms`, footer on production.

---

## Self-review notes

- **Spec coverage:** routes (Task 4), legal shell (Task 2), global footer site-wide incl. home (Task 3), shared disclosures module (Task 1), both content outlines incl. independent-project note + code-accurate IP/cookie/report disclosures + analytics + TMDB attribution + NPC rights (Task 4), testing approach (Tasks 1 & 4). All mapped.
- **Type consistency:** `LegalShell`/`LegalSection` exported from `components/legal/legal-shell.tsx` and imported by both pages; disclosure constants named identically across module, pages, footer, and tests.
- **Placeholder scan:** none — full page copy included; constants concrete.
- **Deviation:** minimal header instead of `SiteHeader` (justified above; avoids `useCountry()` crash on legal pages).

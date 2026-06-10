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

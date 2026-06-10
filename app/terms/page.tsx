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

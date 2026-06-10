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

'use client'

import Link from 'next/link'
import { Logo } from '@/components/logo'
import { RefineSearchForm } from './refine-search-form'
import { CountrySelector } from './country-selector'

export function SiteHeader({ initialQuery }: { initialQuery: string }) {
  return (
    <header
      className="sticky top-0 z-40 grid items-center gap-3 min-[721px]:gap-6 px-4 min-[721px]:px-8 py-3 min-[721px]:py-3.5 grid-cols-[auto_1fr_auto] min-[721px]:grid-cols-[1fr_minmax(0,540px)_1fr]"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <Link href="/" aria-label="Where Can I Watch It — home" className="justify-self-start flex items-center">
        <Logo width={120} />
      </Link>
      <RefineSearchForm initialQuery={initialQuery} />
      <CountrySelector />
    </header>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useCountry } from '@/components/country/country-context'

const CHIPS = ['Severance', 'The Bear', 'Parasite']

export function EmptyNoResults({ query }: { query: string }) {
  const router = useRouter()
  const { country } = useCountry()

  function go(q: string) {
    router.push(`/search?q=${encodeURIComponent(q)}&country=${country}`)
  }

  return (
    <section className="flex flex-col items-center text-center pt-20 pb-16 px-6">
      <div className="mb-[26px]">
        <svg width="120" height="92" viewBox="0 0 120 92" fill="none" aria-hidden="true">
          <path
            d="M34 74C20.7 74 10 63.3 10 50C10 37.6 19.4 27.4 31.5 26.1C36 16.6 45.7 10 57 10C71.2 10 82.9 20.6 84.7 34.3C95.5 35.9 104 45.2 104 56.5C104 68.9 93.9 79 81.5 79H35"
            stroke="#C9D3E0"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="57"
            y="58"
            textAnchor="middle"
            fontFamily="Space Grotesk, sans-serif"
            fontSize="38"
            fontWeight="700"
            fill="#2B72E8"
          >
            ?
          </text>
        </svg>
      </div>
      <h1
        className="text-[27px] font-bold text-[#171717] mb-3"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
      >
        We couldn&apos;t find &ldquo;{query}&rdquo;
      </h1>
      <p className="text-[15.5px] text-[#717177] leading-[1.55] max-w-[46ch]">
        Try checking the spelling, or search for a similar title.
      </p>

      <div className="font-mono text-[10.5px] tracking-[0.12em] uppercase text-[#AEAEB8] mt-[30px] mb-3.5">
        Try searching for:
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => go(c)}
            className="flex items-center gap-2 px-[18px] py-2.5 rounded-full text-[14px] bg-white border border-[#E5E5E5] text-[#717177] hover:border-[#2B72E8] hover:text-[#2B72E8] hover:bg-[#2B72E8]/[0.04] transition-all duration-150 cursor-pointer"
          >
            <Search className="w-[13px] h-[13px] flex-shrink-0" strokeWidth={2.5} />
            <span>{c}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useCountry } from '@/components/country/country-context'

export function RefineSearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const { country } = useCountry()
  const [query, setQuery] = useState(initialQuery)
  const [focused, setFocused] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = query.trim()
    if (!t) return
    router.push(`/search?q=${encodeURIComponent(t)}&country=${country}`)
  }

  return (
    <form className="relative w-full" role="search" aria-label="Refine search" onSubmit={submit}>
      <div
        className="flex items-center rounded-full transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,0.92)',
          border: focused ? '1px solid rgba(43,114,232,0.5)' : '1px solid rgba(220,220,220,0.9)',
          boxShadow: focused
            ? '0 0 0 3px rgba(43,114,232,0.09), 0 6px 18px rgba(43,114,232,0.12)'
            : '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search movies & shows..."
          aria-label="Search query"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-0 border-none bg-transparent px-4 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none font-sans [&::-webkit-search-cancel-button]:appearance-none"
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex-shrink-0 my-1 mr-1 w-8 h-8 rounded-full bg-[#2B72E8] hover:bg-[#1d5fd1] active:bg-[#1752be] flex items-center justify-center transition-all duration-150 hover:shadow-[0_4px_14px_rgba(43,114,232,0.38)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] focus-visible:ring-offset-2"
        >
          <Search className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </button>
      </div>
    </form>
  )
}

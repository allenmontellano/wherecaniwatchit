'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const COUNTRIES = [
  { code: 'PH', name: 'Philippines' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
] as const

type CountryCode = (typeof COUNTRIES)[number]['code']

interface CompactSearchFormProps {
  initialQuery: string
  initialCountry: CountryCode
}

export function CompactSearchForm({ initialQuery, initialCountry }: CompactSearchFormProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [country, setCountry] = useState<CountryCode>(initialCountry)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selected = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0]

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const selectCountry = useCallback((code: CountryCode) => {
    setCountry(code)
    setDropdownOpen(false)
    document.cookie = `selected-country=${code}; path=/; max-age=31536000; SameSite=Lax`
  }, [])

  const doSearch = useCallback(
    (q: string) => {
      const t = q.trim()
      if (!t) return
      router.push(`/search?q=${encodeURIComponent(t)}&country=${country}`)
    },
    [router, country]
  )

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); doSearch(query) }}
      className="relative w-full"
      aria-label="Search for a movie or TV show"
    >
      {/* Outer glow */}
      <div
        aria-hidden="true"
        className="absolute rounded-full transition-all duration-300 ease-out pointer-events-none"
        style={{
          inset: '-8px 4px',
          background: 'rgba(43, 114, 232, 0.16)',
          filter: 'blur(22px)',
          opacity: focused ? 0.75 : 0.3,
          transform: focused ? 'scale(1.01)' : 'scale(1)',
        }}
      />

      {/* Pill */}
      <div
        className="relative flex items-center rounded-full transition-all duration-300 ease-out"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: focused
            ? '1px solid rgba(43, 114, 232, 0.5)'
            : '1px solid rgba(220, 220, 220, 0.8)',
          boxShadow: focused
            ? '0 0 0 3px rgba(43,114,232,0.09), 0 8px 24px rgba(43,114,232,0.14), 0 2px 6px rgba(0,0,0,0.05)'
            : '0 4px 16px rgba(43,114,232,0.07), 0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Country selector */}
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-1 pl-3 pr-2 py-2.5 rounded-l-full hover:bg-black/[0.03] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] focus-visible:ring-offset-1 cursor-pointer"
            aria-label={`Country: ${selected.name}. Click to change.`}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://flagcdn.com/24x18/${selected.code.toLowerCase()}.png`}
              alt={selected.name}
              width={20}
              height={15}
              className="rounded-[2px] object-cover flex-shrink-0"
            />
            <span className="text-xs font-semibold text-[#171717] tracking-wide leading-none">
              {selected.code}
            </span>
            <ChevronDown
              className={cn(
                'w-3 h-3 text-[#AEAEB8] transition-transform duration-200 flex-shrink-0',
                dropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {dropdownOpen && (
            <div
              className="absolute top-full left-0 mt-1.5 z-50 bg-white rounded-xl border border-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.10)] py-1 min-w-[180px] overflow-hidden"
              role="listbox"
              aria-label="Select country"
            >
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  role="option"
                  aria-selected={c.code === country}
                  onClick={() => selectCountry(c.code)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3.5 py-2 text-sm cursor-pointer transition-colors duration-100',
                    c.code === country
                      ? 'text-[#2B72E8] font-medium bg-[#2B72E8]/[0.05]'
                      : 'text-[#171717] font-normal hover:bg-[#2B72E8]/[0.04]',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://flagcdn.com/24x18/${c.code.toLowerCase()}.png`}
                    alt={c.name}
                    width={20}
                    height={15}
                    className="rounded-[2px] object-cover flex-shrink-0"
                  />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-black/[0.08] flex-shrink-0" aria-hidden="true" />

        {/* Input */}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search movies & shows..."
          className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none font-sans"
          aria-label="Search query"
          autoComplete="off"
          spellCheck={false}
        />

        {/* Submit */}
        <button
          type="submit"
          className="flex-shrink-0 mr-1 my-1 w-8 h-8 rounded-full bg-[#2B72E8] hover:bg-[#1d5fd1] active:bg-[#1752be] flex items-center justify-center transition-all duration-150 hover:shadow-[0_4px_14px_rgba(43,114,232,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] focus-visible:ring-offset-2 cursor-pointer"
          aria-label="Search"
        >
          <Search className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </button>
      </div>
    </form>
  )
}

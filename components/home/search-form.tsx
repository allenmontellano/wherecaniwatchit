'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const COUNTRIES = [
  { code: 'PH', name: 'Philippines',    flag: '🇵🇭' },
  { code: 'US', name: 'United States',  flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia',      flag: '🇦🇺' },
  { code: 'CA', name: 'Canada',         flag: '🇨🇦' },
] as const

const CHIPS = ['Severance', 'Parks and Recreation', 'Parasite']

type CountryCode = (typeof COUNTRIES)[number]['code']

interface SearchFormProps {
  initialCountry: CountryCode
  reduced: boolean
}

function fadeUp(index: number, reduced: boolean) {
  return {
    initial: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: {
      delay: reduced ? 0 : (index + 2) * 0.12,
      duration: 0.55,
      ease: 'easeOut' as const,
    },
  }
}

export function SearchForm({ initialCountry, reduced }: SearchFormProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState<CountryCode>(initialCountry)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
    inputRef.current?.focus()
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
    <div className="flex flex-col items-center gap-5 w-full">
      {/* ── Search bar ── */}
      <motion.form
        {...fadeUp(0, reduced)}
        onSubmit={(e) => { e.preventDefault(); doSearch(query) }}
        className="w-full max-w-[620px]"
        aria-label="Search for a movie or TV show"
      >
        <div
          className={cn(
            'flex items-center rounded-full transition-all duration-200',
            'bg-white/80 backdrop-blur-xl border',
            focused
              ? 'border-[#2B72E8] shadow-[0_0_0_4px_rgba(43,114,232,0.10),0_8px_32px_rgba(43,114,232,0.14),0_2px_8px_rgba(0,0,0,0.06)]'
              : 'border-white/80 shadow-[0_8px_32px_rgba(43,114,232,0.09),0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.95)]',
          )}
        >
          {/* Country selector */}
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-1.5 pl-4 pr-2.5 py-3.5 rounded-l-full hover:bg-black/[0.03] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] focus-visible:ring-offset-1 cursor-pointer"
              aria-label={`Country: ${selected.name}. Click to change.`}
              aria-expanded={dropdownOpen}
              aria-haspopup="listbox"
            >
              <span className="text-xl leading-none select-none">{selected.flag}</span>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-[#AEAEB8] transition-transform duration-200 flex-shrink-0',
                  dropdownOpen && 'rotate-180'
                )}
              />
            </button>

            {dropdownOpen && (
              <div
                className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl border border-black/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] py-1.5 min-w-[196px] overflow-hidden"
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
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors duration-100',
                      c.code === country
                        ? 'text-[#2B72E8] font-medium bg-[#2B72E8]/[0.05]'
                        : 'text-[#171717] font-normal hover:bg-[#2B72E8]/[0.05]',
                    )}
                  >
                    <span className="text-base select-none">{c.flag}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-black/[0.08] flex-shrink-0" aria-hidden="true" />

          {/* Text input */}
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search for a movie or TV show..."
            className="flex-1 min-w-0 bg-transparent px-4 py-3.5 text-[15px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none font-sans"
            aria-label="Search query"
            autoComplete="off"
            spellCheck={false}
          />

          {/* Search button */}
          <button
            type="submit"
            className="flex-shrink-0 mr-1.5 my-1.5 w-10 h-10 rounded-full bg-[#2B72E8] hover:bg-[#1d5fd1] active:bg-[#1752be] flex items-center justify-center transition-all duration-150 hover:shadow-[0_4px_18px_rgba(43,114,232,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] focus-visible:ring-offset-2 cursor-pointer"
            aria-label="Search"
          >
            <Search className="w-4 h-4 text-white" strokeWidth={2.5} />
          </button>
        </div>
      </motion.form>

      {/* ── Example chips ── */}
      <motion.div
        {...fadeUp(1, reduced)}
        className="flex flex-wrap items-center justify-center gap-2"
      >
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => doSearch(chip)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white border border-[#E5E5E5] text-[#717177] hover:border-[#2B72E8] hover:text-[#2B72E8] hover:bg-[#2B72E8]/[0.04] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] focus-visible:ring-offset-1"
            aria-label={`Search for ${chip}`}
          >
            <Search className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} />
            <span>{chip}</span>
          </button>
        ))}
      </motion.div>

      {/* ── Trust line ── */}
      <motion.div
        {...fadeUp(2, reduced)}
        className="flex items-center gap-2 font-mono text-[11px] text-[#AEAEB8] tracking-wide"
      >
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#34C759]" />
        </span>
        <span>Availability data verified daily across 140+ countries</span>
      </motion.div>
    </div>
  )
}

'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import type { CountryCode } from '@/lib/country'

interface CountryContextValue {
  country: CountryCode
  setCountry: (c: CountryCode) => void
}

const CountryContext = createContext<CountryContextValue | null>(null)

export function CountryProvider({
  initial,
  children,
}: {
  initial: CountryCode
  children: React.ReactNode
}) {
  const [country, setCountryState] = useState<CountryCode>(initial)

  const setCountry = useCallback((c: CountryCode) => {
    setCountryState(c)
    document.cookie = `selected-country=${c}; path=/; max-age=31536000; SameSite=Lax`
    const url = new URL(window.location.href)
    url.searchParams.set('country', c)
    window.history.replaceState(null, '', url.toString())
  }, [])

  return (
    <CountryContext.Provider value={{ country, setCountry }}>
      {children}
    </CountryContext.Provider>
  )
}

export function useCountry(): CountryContextValue {
  const ctx = useContext(CountryContext)
  if (!ctx) throw new Error('useCountry must be used within CountryProvider')
  return ctx
}

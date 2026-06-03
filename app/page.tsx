import { headers, cookies } from 'next/headers'
import { AnimatedBackground } from '@/components/home/animated-background'
import { HeroContent } from '@/components/home/hero-content'

const SUPPORTED = ['PH', 'US', 'GB', 'AU', 'CA'] as const
type CountryCode = (typeof SUPPORTED)[number]

export default async function HomePage() {
  const [headersList, cookieStore] = await Promise.all([headers(), cookies()])

  const saved = cookieStore.get('selected-country')?.value
  const cf = headersList.get('CF-IPCountry') ?? ''

  const country: CountryCode =
    saved && SUPPORTED.includes(saved as CountryCode)
      ? (saved as CountryCode)
      : SUPPORTED.includes(cf as CountryCode)
        ? (cf as CountryCode)
        : 'PH'

  return (
    <main
      className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <AnimatedBackground />
      <div className="relative z-10 flex flex-col items-center w-full max-w-3xl px-4 py-16">
        <HeroContent initialCountry={country} />
      </div>
    </main>
  )
}

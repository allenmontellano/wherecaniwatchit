import type { Metadata } from 'next'
import { Space_Grotesk, DM_Sans, JetBrains_Mono } from 'next/font/google'
import { cn } from '@/lib/utils'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

// Pre-launch toggle: keep false to block search engines (noindex, nofollow).
// Flip to true on launch day to allow indexing. This is the only line to change.
const SITE_INDEXABLE = false

export const metadata: Metadata = {
  robots: { index: SITE_INDEXABLE, follow: SITE_INDEXABLE },
  title: 'Where Can I Watch It? — Find streaming availability worldwide',
  description:
    "Search any movie or TV show and instantly see where it's streaming — Netflix, Disney+, Prime Video and more, across Philippines, US, UK, Australia, and Canada.",
  keywords: ['streaming', 'where to watch', 'Netflix', 'Disney+', 'streaming availability', 'movies', 'TV shows'],
  openGraph: {
    title: 'Where Can I Watch It?',
    description: 'Find where any movie or show is streaming worldwide.',
    url: 'https://wherecaniwatchit.info',
    siteName: 'Where Can I Watch It',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(spaceGrotesk.variable, dmSans.variable, jetbrainsMono.variable)}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}

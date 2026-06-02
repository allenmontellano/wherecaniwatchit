import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Where Can I Watch It?',
  description: 'Search streaming availability by country for any movie or TV show.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

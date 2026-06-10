import type { ReactNode } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/logo'

export function LegalShell({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-black/5 px-4 py-3 md:px-8">
        <Link
          href="/"
          aria-label="Where Can I Watch It — home"
          className="inline-flex items-center"
        >
          <Logo width={120} />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-12 md:py-16">
        <h1 className="font-display text-3xl font-semibold text-neutral-900 md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">Last updated {lastUpdated}</p>
        <div className="mt-8 space-y-8 leading-relaxed text-neutral-700">{children}</div>
      </main>
    </div>
  )
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-neutral-900">{heading}</h2>
      {children}
    </section>
  )
}

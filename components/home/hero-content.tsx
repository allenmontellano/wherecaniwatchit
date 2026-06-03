'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Logo } from '@/components/logo'
import { SearchForm } from './search-form'

interface HeroContentProps {
  initialCountry: 'PH' | 'US' | 'GB' | 'AU' | 'CA'
}

function fadeUp(index: number, reduced: boolean) {
  return {
    initial: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: {
      delay: reduced ? 0 : index * 0.12,
      duration: 0.55,
      ease: 'easeOut' as const,
    },
  }
}

export function HeroContent({ initialCountry }: HeroContentProps) {
  const reduced = useReducedMotion() ?? false

  return (
    <div className="flex flex-col items-center gap-7 w-full">
      {/* Logo lockup (icon + wordmark) */}
      <motion.div {...fadeUp(0, reduced)}>
        <Logo width={360} />
      </motion.div>

      {/* Tagline */}
      <motion.p
        {...fadeUp(1, reduced)}
        className="text-[#717177] text-[15px] sm:text-base text-center leading-relaxed sm:whitespace-nowrap"
      >
        Find out where any movie or show is streaming&nbsp;—&nbsp;anywhere in the world.
      </motion.p>

      {/* Search form + chips + trust line */}
      <SearchForm initialCountry={initialCountry} reduced={reduced} />
    </div>
  )
}

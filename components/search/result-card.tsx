'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Star, Tv, Film } from 'lucide-react'
import { platformLabel } from '@/lib/platforms'

interface ResultCardProps {
  title: {
    id: string
    title: string
    type: string
    release_year: number | null
    poster_url: string | null
    imdb_rating: number | null
    season_count: number | null
  }
  availabilityByRegion: Record<string, string[]>
  country: string
  index: number
}

export function ResultCard({ title, availabilityByRegion, country, index }: ResultCardProps) {
  const platforms = availabilityByRegion[country] ?? []
  const isTV = title.type === 'tv'

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
    >
      <Link
        href={`/titles/${title.id}`}
        className="group block rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(43,114,232,0.12),0_2px_8px_rgba(0,0,0,0.06)]"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(229, 229, 229, 0.7)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Poster */}
        <div className="relative aspect-[2/3] overflow-hidden bg-[#F5F5F7]">
          {title.poster_url ? (
            <Image
              src={title.poster_url}
              alt={title.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#AEAEB8]">
              {isTV ? <Tv className="w-10 h-10" /> : <Film className="w-10 h-10" />}
            </div>
          )}

          {/* Type badge */}
          <div className="absolute top-2 left-2">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase"
              style={{
                background: isTV ? 'rgba(43,114,232,0.88)' : 'rgba(23,23,23,0.82)',
                color: '#fff',
                backdropFilter: 'blur(6px)',
              }}
            >
              {isTV ? 'Series' : 'Movie'}
            </span>
          </div>

          {/* IMDb rating */}
          {title.imdb_rating && (
            <div
              className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)' }}
            >
              <Star className="w-2.5 h-2.5 fill-[#F5C518] stroke-none" />
              <span className="text-[10px] font-semibold text-white leading-none">
                {title.imdb_rating}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <h3
            className="text-[13px] font-semibold text-[#171717] leading-snug mb-1.5 line-clamp-2 group-hover:text-[#2B72E8] transition-colors duration-200"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title.title}
          </h3>

          <div className="flex items-center gap-1.5 mb-2.5">
            {title.release_year && (
              <span className="text-[11px] text-[#717177]">{title.release_year}</span>
            )}
            {isTV && title.season_count && (
              <>
                <span className="text-[11px] text-[#AEAEB8]">·</span>
                <span className="text-[11px] text-[#717177]">
                  {title.season_count} {title.season_count === 1 ? 'season' : 'seasons'}
                </span>
              </>
            )}
          </div>

          {/* Platform chips */}
          {platforms.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {platforms.slice(0, 3).map((slug) => {
                const p = platformLabel(slug)
                return (
                  <span
                    key={slug}
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none"
                    style={{ background: p.bg, color: p.text }}
                  >
                    {p.label}
                  </span>
                )
              })}
              {platforms.length > 3 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none bg-[#F1F5F9] text-[#64748B]">
                  +{platforms.length - 3}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-[#AEAEB8]">Not in {country}</span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

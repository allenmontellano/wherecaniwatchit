'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Star, ExternalLink, Flag, ShieldCheck } from 'lucide-react'
import type { Title, AvailabilityWithPlatform } from '@/types/database'
import { REGIONS, regionByCode } from '@/lib/country'
import { useCountry } from '@/components/country/country-context'
import { groupByRegion, formatExtent, formatRuntime } from '@/lib/title-utils'
import { posterGradient } from '@/lib/poster'
import { platformLabel } from '@/lib/platforms'
import { PlatformBadge } from '@/components/ui/platform-badge'
import { AnswerBox } from '@/components/ui/answer-box'
import { ReportModal } from '@/components/report/report-modal'

interface TitleDetailProps {
  title: Title
  availability: AvailabilityWithPlatform[]
  platformsByRegion: Record<string, { slug: string; name: string }[]>
}

function freshnessLabel(rows: AvailabilityWithPlatform[]): string {
  if (rows.length === 0) return '—'
  const latest = rows
    .map((r) => new Date(r.last_verified))
    .reduce((a, b) => (a > b ? a : b))
  const today = new Date()
  const sameDay =
    latest.getFullYear() === today.getFullYear() &&
    latest.getMonth() === today.getMonth() &&
    latest.getDate() === today.getDate()
  return sameDay
    ? 'Today'
    : latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function TitleDetail({ title, availability, platformsByRegion }: TitleDetailProps) {
  const { country } = useCountry()
  const region = regionByCode[country]
  const [reportOpen, setReportOpen] = useState(false)

  const byRegion = groupByRegion(availability)
  const here = byRegion[country] ?? []
  const available = here.length > 0

  const metaBits = [
    title.network,
    title.release_year,
    title.type === 'tv' ? 'Series' : 'Movie',
    title.genres[0],
    formatExtent(title),
  ].filter(Boolean) as (string | number)[]

  const runtimeLabel = title.runtime ? formatRuntime(title.runtime) : null

  const detailRows: Array<{ key: string; value: React.ReactNode }> = []
  if (title.genres.length > 0)
    detailRows.push({
      key: 'Genre',
      value: (
        <div className="flex flex-wrap gap-2">
          {title.genres.map((g) => (
            <span
              key={g}
              className="px-3 py-[5px] rounded-full text-[13px] font-medium bg-[#2B72E8]/[0.07] text-[#2B72E8]"
            >
              {g}
            </span>
          ))}
        </div>
      ),
    })
  if (title.release_year) detailRows.push({ key: 'Release year', value: title.release_year })
  if (title.network) detailRows.push({ key: 'Network', value: title.network })
  if (title.origin_country) detailRows.push({ key: 'Country of origin', value: title.origin_country })
  if (runtimeLabel)
    detailRows.push({
      key: title.type === 'tv' ? 'Runtime per episode' : 'Runtime',
      value: runtimeLabel,
    })
  if (title.episode_count) detailRows.push({ key: 'Total episodes', value: `${title.episode_count} episodes` })
  if (title.status) detailRows.push({ key: 'Status', value: title.status })
  if (title.original_language) detailRows.push({ key: 'Language', value: title.original_language })
  if (title.content_rating) detailRows.push({ key: 'Content rating', value: title.content_rating })

  // Split details into two cards (cast card + the rest).
  const hasCast = (title.cast?.length ?? 0) > 0 || (title.creators?.length ?? 0) > 0

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg,#1f2a44 0%,#2d3b5e 45%,#3a4a72 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(10,10,12,0.78) 0%, rgba(10,10,12,0.55) 42%, rgba(10,10,12,0.25) 100%), linear-gradient(180deg, rgba(10,10,12,0.30) 0%, rgba(10,10,12,0.10) 30%, rgba(255,255,255,0) 55%, rgba(255,255,255,0.85) 90%, #ffffff 100%)',
          }}
        />
        <div className="relative z-[1] max-w-[1080px] mx-auto px-4 min-[721px]:px-8 pt-10 min-[721px]:pt-14 pb-8 min-[721px]:pb-10 flex flex-col min-[721px]:flex-row gap-6 min-[721px]:gap-10 items-start min-[721px]:items-end">
          {/* Poster */}
          <div
            className="relative flex-shrink-0 w-[150px] min-[721px]:w-[230px] rounded-[16px] overflow-hidden flex flex-col items-center justify-center text-center"
            style={{
              aspectRatio: '2 / 3',
              background: title.poster_url ? '#1c2538' : posterGradient(title.id),
              boxShadow: '0 24px 60px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.18)',
            }}
          >
            {title.poster_url ? (
              <Image
                src={title.poster_url}
                alt={title.title}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 720px) 150px, 230px"
              />
            ) : (
              <div className="px-3.5 py-4.5">
                <span
                  className="block text-[20px] leading-tight text-[rgba(23,23,23,0.8)]"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 700, textWrap: 'balance' }}
                >
                  {title.title}
                </span>
                <span className="block mt-3 font-mono text-[9px] tracking-[0.14em] uppercase text-[rgba(23,23,23,0.34)]">
                  Poster
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pb-1.5">
            <h1
              className="text-white m-0 mb-4"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'clamp(32px, 5vw, 56px)',
                lineHeight: 1.02,
                letterSpacing: '-0.02em',
                textShadow: '0 2px 24px rgba(0,0,0,0.4)',
              }}
            >
              {title.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2.5 mb-[18px] text-[14.5px] text-white/[0.86]">
              {metaBits.map((b, i) => (
                <span key={i} className="flex items-center gap-2.5">
                  {i > 0 && <span className="text-white/[0.45]">·</span>}
                  <span>{b}</span>
                </span>
              ))}
              {title.imdb_rating != null && (
                <>
                  <span className="text-white/[0.45]">·</span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-white">
                    <Star className="w-[15px] h-[15px] fill-[#F5C518] stroke-none" />
                    {title.imdb_rating.toFixed(1)}
                  </span>
                </>
              )}
            </div>
            {title.synopsis && (
              <p
                className="text-[15.5px] leading-[1.6] text-white/90 max-w-[62ch] m-0"
                style={{ textWrap: 'pretty', textShadow: '0 1px 12px rgba(0,0,0,0.35)' }}
              >
                {title.synopsis}
              </p>
            )}
            {(title.cast?.length || title.creators?.length) && (
              <div className="mt-[18px] flex flex-wrap gap-6">
                {title.cast?.length ? (
                  <div>
                    <span className="block font-mono text-[10px] tracking-[0.1em] uppercase text-white/60 mb-[3px]">
                      Starring
                    </span>
                    <span className="text-[14px] text-white/95 font-medium">
                      {title.cast.slice(0, 3).join(' · ')}
                    </span>
                  </div>
                ) : null}
                {title.creators?.length ? (
                  <div>
                    <span className="block font-mono text-[10px] tracking-[0.1em] uppercase text-white/60 mb-[3px]">
                      Created by
                    </span>
                    <span className="text-[14px] text-white/95 font-medium">
                      {title.creators.join(' · ')}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-[1080px] mx-auto px-4 min-[721px]:px-8 pt-2 pb-16">
        {/* Availability in your region */}
        <div className="mt-10">
          <h2 className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#AEAEB8] m-0 mb-3.5">
            Availability in your region
          </h2>
          <AnswerBox available={available} region={region} size="lg">
            {available ? (
              <div className="flex flex-wrap items-center gap-3 mt-3.5">
                {here.map((a) => (
                  <span key={a.id} className="flex items-center gap-2">
                    <PlatformBadge slug={a.platform.slug} size="lg" />
                    {a.watch_url && (
                      <a
                        href={a.watch_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#2B72E8] hover:underline"
                      >
                        Watch on {platformLabel(a.platform.slug).label}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[14.5px] text-[#717177] mt-2">
                Not currently streaming on any service here.
              </p>
            )}
          </AnswerBox>
          <div className="flex items-center gap-2 mt-3.5 pl-1 font-mono text-[11px] text-[#AEAEB8]">
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Availability data last verified: <b className="text-[#717177] font-medium">{freshnessLabel(availability)}</b> · across 5 regions
            </span>
          </div>
        </div>

        {/* Where else */}
        <div className="mt-10">
          <h2 className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#AEAEB8] m-0 mb-3.5">
            Where else you can watch it
          </h2>
          <div
            className="bg-white rounded-[18px] px-6 py-2"
            style={{ border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 8px 30px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)' }}
          >
            {REGIONS.filter((r) => r.code !== country).map((r, i) => {
              const av = byRegion[r.code] ?? []
              return (
                <div
                  key={r.code}
                  className="flex items-center justify-between gap-4 py-4"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.06)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://flagcdn.com/24x18/${r.flag}.png`}
                      alt={r.name}
                      width={26}
                      height={19}
                      className="rounded-[3px] object-cover flex-shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
                    />
                    <span className="text-[15px] font-medium text-[#171717]">{r.name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {av.length > 0 ? (
                      av.map((a) => <PlatformBadge key={a.id} slug={a.platform.slug} />)
                    ) : (
                      <span className="text-[14px] text-[#AEAEB8]">Not available</span>
                    )}
                  </div>
                </div>
              )
            })}
            <div className="flex justify-end py-4 border-t border-black/[0.06]">
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="inline-flex items-center gap-1.5 text-[13px] text-[#AEAEB8] hover:text-[#2B72E8] transition-colors cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Report incorrect info</span>
              </button>
            </div>
          </div>
        </div>

        {/* Title details */}
        {detailRows.length > 0 && (
          <div className="mt-10">
            <h2 className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#AEAEB8] m-0 mb-3.5">
              Title details
            </h2>
            <div className="grid grid-cols-1 min-[861px]:grid-cols-2 gap-5">
              {hasCast && (
                <DetailCard>
                  <DetailRow first label="Cast">
                    <div className="flex flex-col gap-2.5">
                      {title.cast?.map((c) => (
                        <span key={c} className="text-[15px] text-[#171717]">
                          {c}
                        </span>
                      ))}
                      {title.creators?.map((c) => (
                        <span key={c} className="text-[14px] text-[#717177]">
                          {c} — Creator
                        </span>
                      ))}
                    </div>
                  </DetailRow>
                </DetailCard>
              )}
              <DetailCard>
                {detailRows.map((row, i) => (
                  <DetailRow key={row.key} first={i === 0} label={row.key}>
                    <div className="text-[15px] text-[#171717]">{row.value}</div>
                  </DetailRow>
                ))}
              </DetailCard>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-8 pb-11 text-[12.5px] text-[#AEAEB8] border-t border-black/[0.05]">
        wherecaniwatchit.info <span className="mx-2">·</span> Free to use <span className="mx-2">·</span> Data updated daily
      </footer>

      {reportOpen && (
        <ReportModal
          onClose={() => setReportOpen(false)}
          titleId={title.id}
          titleName={title.title}
          region={region}
          platforms={platformsByRegion[country] ?? []}
        />
      )}
    </>
  )
}

function DetailCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-white rounded-[18px] px-[30px] py-7"
      style={{ border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 8px 30px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)' }}
    >
      {children}
    </div>
  )
}

function DetailRow({
  label,
  first,
  children,
}: {
  label: string
  first?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="py-3"
      style={{ borderTop: first ? 'none' : '1px solid rgba(0,0,0,0.06)', paddingTop: first ? 2 : undefined }}
    >
      <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-[#AEAEB8] mb-1.5">{label}</div>
      {children}
    </div>
  )
}

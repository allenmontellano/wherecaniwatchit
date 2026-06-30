'use client'

import { useState } from 'react'
import type { Title } from '@/types/database'
import type { SyncedResult } from '@/types/search'
import { regionByCode } from '@/lib/country'
import { useCountry } from '@/components/country/country-context'
import { ResultCard } from './result-card'
import { EmptyNoResults } from './empty-no-results'
import { NotInRegion } from './not-in-region'
import { ReportModal } from '@/components/report/report-modal'

export function ResultsSection({
  results,
  query,
  platformsByRegion,
}: {
  results: SyncedResult[]
  query: string
  platformsByRegion: Record<string, { slug: string; name: string }[]>
}) {
  const { country } = useCountry()
  const region = regionByCode[country]
  const [reportTitle, setReportTitle] = useState<Title | null>(null)

  if (results.length === 0) {
    return <EmptyNoResults query={query} />
  }

  const single = results.length === 1 ? results[0] : null
  const singleUnavailable =
    single != null && (single.availabilityByRegion[country]?.length ?? 0) === 0

  return (
    <div>
      {singleUnavailable && single ? (
        <NotInRegion result={single} />
      ) : (
        <>
          <p className="text-[14px] text-[#717177] mb-5">
            <span className="font-semibold text-[#171717]">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>{' '}
            for &ldquo;{query}&rdquo; · streaming availability in{' '}
            <span className="font-semibold text-[#171717]">{region.name}</span>
          </p>
          <div className="flex flex-col gap-5">
            {results.map((r, i) => (
              <ResultCard
                key={r.title.id}
                title={r.title}
                availabilityByRegion={r.availabilityByRegion}
                index={i}
                onReport={setReportTitle}
              />
            ))}
          </div>
        </>
      )}

      {reportTitle && (
        <ReportModal
          onClose={() => setReportTitle(null)}
          titleId={reportTitle.id}
          titleName={reportTitle.title}
          region={region}
          platforms={platformsByRegion[country] ?? []}
        />
      )}
    </div>
  )
}

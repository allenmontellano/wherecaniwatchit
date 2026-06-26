'use client'

import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { RegionMeta } from '@/lib/country'
import { ISSUE_TYPES, type IssueType } from '@/lib/flags'

interface ReportModalProps {
  onClose: () => void
  titleId: string
  titleName: string
  region: RegionMeta
  platforms: { slug: string; name: string }[]
}

const ISSUE_LABELS: Record<IssueType, string> = {
  'not-here': 'This title is not available here',
  'is-here': 'This title IS available here',
  'wrong-platform': 'Wrong platform listed',
  'wrong-season': 'Wrong season information',
  other: 'Other',
}

export function ReportModal({ onClose, titleId, titleName, region, platforms }: ReportModalProps) {
  const [issue, setIssue] = useState<IssueType>('not-here')
  const [platformValue, setPlatformValue] = useState('')
  const [platformOther, setPlatformOther] = useState('')
  const [watchUrl, setWatchUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const showPlatform = issue === 'wrong-platform' || issue === 'is-here'
  const counterWarn = notes.length >= 260

  async function submit() {
    setSubmitting(true)
    try {
      await fetch('/api/flags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title_id: titleId,
          region_code: region.code,
          issue_type: issue,
          reported_platform: showPlatform
            ? platformValue === '__other__'
              ? platformOther.trim() || undefined
              : platformValue || undefined
            : undefined,
          reported_watch_url: showPlatform ? watchUrl.trim() || undefined : undefined,
          notes,
        }),
      })
    } catch {
      // Report submission is best-effort; still show confirmation.
    } finally {
      setDone(true)
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{
        background: 'rgba(23,23,23,0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div
        className="relative w-full max-w-[480px] bg-white rounded-[22px] px-7 pt-7 pb-[22px]"
        style={{ boxShadow: '0 40px 90px rgba(0,0,0,0.32)', animation: 'report-pop 0.22s ease-out' }}
      >
        <style>{`@keyframes report-pop{from{opacity:0;transform:translateY(12px) scale(0.98)}to{opacity:1;transform:none}}`}</style>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-[18px] right-[18px] w-8 h-8 rounded-full flex items-center justify-center text-[#AEAEB8] hover:bg-black/[0.05] hover:text-[#171717] transition-all duration-150 cursor-pointer"
        >
          <X className="w-[17px] h-[17px]" strokeWidth={2.2} />
        </button>

        {!done ? (
          <div>
            <div className="flex items-center gap-2.5 mb-1.5 pr-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://flagcdn.com/24x18/${region.flag}.png`}
                alt={region.name}
                width={26}
                height={19}
                className="rounded-[3px] object-cover flex-shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
              />
              <h3
                id="report-modal-title"
                className="text-[20px] font-bold text-[#171717] m-0"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Report incorrect info
              </h3>
            </div>
            <p className="text-[13.5px] text-[#717177] leading-normal mb-[22px]">
              &ldquo;{titleName}&rdquo; in {region.name} — reports are reviewed daily.
            </p>

            <Field label="What's incorrect?" required>
              <select
                value={issue}
                onChange={(e) => setIssue(e.target.value as IssueType)}
                className="w-full appearance-none cursor-pointer rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 pr-9 text-[14px] text-[#171717] font-sans focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23AEAEB8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 14px center',
                }}
              >
                {ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ISSUE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>

            <div
              className="overflow-hidden transition-all duration-200"
              style={{
                maxHeight: showPlatform ? 320 : 0,
                opacity: showPlatform ? 1 : 0,
                marginBottom: showPlatform ? 16 : 0,
              }}
            >
              <FieldLabel>Which platform?</FieldLabel>
              <select
                value={platformValue}
                onChange={(e) => setPlatformValue(e.target.value)}
                className="w-full appearance-none cursor-pointer rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 pr-9 text-[14px] text-[#171717] font-sans focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23AEAEB8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 14px center',
                }}
              >
                <option value="">Select a platform…</option>
                {platforms.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
                <option value="__other__">Other — specify</option>
              </select>

              {platformValue === '__other__' && (
                <input
                  type="text"
                  value={platformOther}
                  onChange={(e) => setPlatformOther(e.target.value)}
                  maxLength={100}
                  placeholder="Platform name"
                  className="mt-2 w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] font-sans focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
                />
              )}

              <div className="mt-3">
                <FieldLabel>Watch link (optional)</FieldLabel>
                <input
                  type="url"
                  value={watchUrl}
                  onChange={(e) => setWatchUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] font-sans focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
                />
              </div>
            </div>

            <Field label="Additional notes (optional)">
              <div className="relative">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={280}
                  placeholder="Any other details that might help..."
                  className="w-full resize-none min-h-[78px] leading-normal rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] font-sans focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
                />
                <span
                  className="absolute right-3 bottom-2.5 font-mono text-[10.5px] bg-white pl-1.5"
                  style={{ color: counterWarn ? '#FF3B30' : '#AEAEB8' }}
                >
                  {notes.length} / 280
                </span>
              </div>
            </Field>

            <div className="flex items-center gap-2.5 mt-[22px]">
              <span className="flex-1 text-[11.5px] text-[#AEAEB8] leading-tight">
                No account needed · Reports are anonymous
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-[11px] text-[14px] font-semibold text-[#717177] hover:bg-black/[0.05] hover:text-[#171717] transition-all duration-150 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="px-5 py-2.5 rounded-[11px] text-[14px] font-semibold text-white bg-[#2B72E8] hover:bg-[#1d5fd1] hover:shadow-[0_6px_18px_rgba(43,114,232,0.35)] transition-all duration-150 cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center px-2 pt-3.5 pb-2">
            <div
              className="w-[68px] h-[68px] rounded-full bg-[rgba(52,199,89,0.12)] flex items-center justify-center mx-auto mb-5"
              style={{ animation: 'report-checkpop 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}
            >
              <style>{`@keyframes report-checkpop{0%{transform:scale(0.5);opacity:0}100%{transform:scale(1);opacity:1}}`}</style>
              <Check className="w-[34px] h-[34px] text-[#34C759]" strokeWidth={3} />
            </div>
            <h3
              className="text-[20px] font-bold text-[#171717] m-0"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Report submitted
            </h3>
            <p className="text-[13.5px] text-[#717177] leading-normal mt-1.5">
              Thanks for helping keep our data accurate. We&apos;ll review this within 24 hours.
            </p>
            <div className="flex justify-center mt-[22px]">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-[11px] text-[14px] font-semibold text-[#717177] bg-black/[0.04] hover:bg-black/[0.08] hover:text-[#171717] transition-all duration-150 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block font-mono text-[10px] tracking-[0.1em] uppercase text-[#AEAEB8] mb-1.5">
      {children}
      {required && <span className="text-[#FF3B30] ml-[3px]">*</span>}
    </label>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <FieldLabel required={required}>{label}</FieldLabel>
      {children}
    </div>
  )
}

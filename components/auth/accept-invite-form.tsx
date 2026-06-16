'use client'

import { useState } from 'react'
import { acceptInvite } from '@/app/accept-invite/actions'

export function AcceptInviteForm() {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(formData: FormData) {
    setSubmitting(true)
    setError(null)
    const result = await acceptInvite(formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
  }

  return (
    <form action={onSubmit} className="w-full max-w-[360px] flex flex-col gap-4">
      <h1 className="text-[22px] font-bold text-[#171717]" style={{ fontFamily: 'var(--font-display)' }}>
        Set up your account
      </h1>
      <input
        name="username"
        required
        placeholder="Username"
        className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
      />
      <input
        name="password"
        type="password"
        required
        placeholder="Password (8+ characters)"
        className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
      />
      <input
        name="regionCode"
        placeholder="Region code (optional, e.g. PH)"
        className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
      />
      {error && <p className="text-[13px] text-[#FF3B30]">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="px-5 py-2.5 rounded-[11px] text-[14px] font-semibold text-white bg-[#2B72E8] hover:bg-[#1d5fd1] transition-all disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Create account'}
      </button>
    </form>
  )
}

import { createAdminClient } from '@/lib/supabase/admin'

export const DEFAULT_LIMIT = 25_000
export const DEFAULT_BUFFER = 500
const DEFAULT_SERVICE = 'motn'

export interface QuotaStatus {
  service: string
  month: string
  callsUsed: number
  callsLimit: number
  remaining: number
}

export function currentMonth(date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export async function getQuota(service = DEFAULT_SERVICE): Promise<QuotaStatus> {
  const supabase = createAdminClient()
  const month = currentMonth()

  const { data, error } = await supabase
    .from('api_quota')
    .select('calls_used, calls_limit')
    .eq('service', service)
    .eq('month', month)
    .maybeSingle()

  if (error) throw new Error(`Failed to read quota: ${error.message}`)

  const callsUsed = data?.calls_used ?? 0
  const callsLimit = data?.calls_limit ?? DEFAULT_LIMIT

  return { service, month, callsUsed, callsLimit, remaining: callsLimit - callsUsed }
}

export async function hasRemainingQuota(
  service = DEFAULT_SERVICE,
  buffer = DEFAULT_BUFFER
): Promise<boolean> {
  const { callsUsed, callsLimit } = await getQuota(service)
  return callsUsed < callsLimit - buffer
}

export async function incrementQuota(service = DEFAULT_SERVICE, n = 1): Promise<number> {
  const supabase = createAdminClient()
  const month = currentMonth()

  const { data, error } = await supabase.rpc('increment_quota', {
    p_service: service,
    p_month: month,
    p_n: n,
    p_limit: DEFAULT_LIMIT,
  })

  if (error) throw new Error(`Failed to increment quota: ${error.message}`)
  return data as number
}

export async function resetQuota(service = DEFAULT_SERVICE): Promise<void> {
  const supabase = createAdminClient()
  const month = currentMonth()

  const { error } = await supabase.from('api_quota').upsert(
    {
      service,
      month,
      calls_used: 0,
      calls_limit: DEFAULT_LIMIT,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'service,month' }
  )

  if (error) throw new Error(`Failed to reset quota: ${error.message}`)
}

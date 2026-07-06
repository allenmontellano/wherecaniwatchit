import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ISSUE_TYPES,
  issueToFlagType,
  sanitizeWatchUrl,
  sanitizePlatform,
  type IssueType,
} from '@/lib/flags'
import { getRegionPlatformSlugs } from '@/lib/platforms-data'
import { captureException } from '@/lib/observability'
import { clientIp, hashIp } from '@/lib/ip'
import { enforceRateLimit } from '@/lib/rate-limit'
import { withTimeout, DB_TIMEOUT_MS } from '@/lib/with-timeout'

interface FlagBody {
  title_id: string
  region_code: string
  issue_type: IssueType
  reported_platform?: string
  reported_watch_url?: string
  notes?: string
}

const PLATFORM_REQUIRED: IssueType[] = ['is-here', 'wrong-platform']

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'flags')
  if (limited) return limited

  let body: FlagBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title_id, region_code, issue_type, reported_platform, reported_watch_url, notes } = body

  if (!title_id || !region_code || !issue_type) {
    return NextResponse.json(
      { error: 'title_id, region_code and issue_type are required' },
      { status: 400 }
    )
  }
  if (!ISSUE_TYPES.includes(issue_type)) {
    return NextResponse.json({ error: 'Invalid issue_type' }, { status: 400 })
  }

  const url = sanitizeWatchUrl(reported_watch_url)
  if (!url.ok) return NextResponse.json({ error: url.error }, { status: 400 })

  const knownSlugs = await getRegionPlatformSlugs(region_code)
  const platform = sanitizePlatform(reported_platform, knownSlugs)
  if (!platform.ok) return NextResponse.json({ error: platform.error }, { status: 400 })

  if (PLATFORM_REQUIRED.includes(issue_type) && platform.value === null) {
    return NextResponse.json({ error: 'A platform is required for this report.' }, { status: 400 })
  }

  const details = notes?.trim() ? notes.trim().slice(0, 500) : null

  const supabase = createAdminClient()
  try {
    const { error } = await withTimeout(
      supabase.from('flags').insert({
        availability_id: null,
        title_id,
        region_code,
        issue_type,
        flag_type: issueToFlagType(issue_type),
        reported_platform: platform.value,
        reported_watch_url: url.value,
        notes: details,
        ip_hash: hashIp(clientIp(req)),
        status: 'pending',
      }),
      DB_TIMEOUT_MS,
      'flags.insert'
    )
    if (error) {
      captureException(error, { op: 'flags.insert', title_id, region_code, issue_type })
      return NextResponse.json({ error: 'Failed to submit flag' }, { status: 500 })
    }
  } catch (err) {
    captureException(err, { op: 'flags.insert', title_id, region_code, issue_type })
    return NextResponse.json({ error: 'Failed to submit flag' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createHash } from 'crypto'
import {
  ISSUE_TYPES,
  issueToFlagType,
  composeNotes,
  type IssueType,
} from '@/lib/flags'
import { captureException } from '@/lib/observability'

interface FlagBody {
  title_id: string
  region_code: string
  issue_type: IssueType
  platform?: string
  notes?: string
}

function hashIp(ip: string): string {
  return createHash('sha256')
    .update(ip + process.env.CRON_SECRET!)
    .digest('hex')
    .slice(0, 32)
}

export async function POST(req: NextRequest) {
  let body: FlagBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title_id, region_code, issue_type, platform, notes } = body

  if (!title_id || !region_code || !issue_type) {
    return NextResponse.json(
      { error: 'title_id, region_code and issue_type are required' },
      { status: 400 }
    )
  }

  if (!ISSUE_TYPES.includes(issue_type)) {
    return NextResponse.json({ error: 'Invalid issue_type' }, { status: 400 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const composed = composeNotes(issue_type, platform, notes)

  const supabase = createAdminClient()

  const { error } = await supabase.from('flags').insert({
    availability_id: null,
    title_id,
    region_code,
    issue_type,
    flag_type: issueToFlagType(issue_type),
    notes: composed ? composed.slice(0, 500) : null,
    ip_hash: hashIp(ip),
    status: 'pending',
  })

  if (error) {
    captureException(error, { op: 'flags.insert', title_id, region_code, issue_type })
    return NextResponse.json({ error: 'Failed to submit flag' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

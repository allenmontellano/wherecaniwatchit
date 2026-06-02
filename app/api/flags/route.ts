import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createHash } from 'crypto'

interface FlagBody {
  availability_id: string
  flag_type: 'incorrect' | 'outdated' | 'missing'
  notes?: string
}

const VALID_FLAG_TYPES = new Set(['incorrect', 'outdated', 'missing'])

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

  const { availability_id, flag_type, notes } = body

  if (!availability_id || !flag_type) {
    return NextResponse.json(
      { error: 'availability_id and flag_type are required' },
      { status: 400 }
    )
  }

  if (!VALID_FLAG_TYPES.has(flag_type)) {
    return NextResponse.json({ error: 'Invalid flag_type' }, { status: 400 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const supabase = createAdminClient()

  const { error } = await supabase.from('flags').insert({
    availability_id,
    flag_type,
    notes: notes ? notes.slice(0, 500) : null,
    ip_hash: hashIp(ip),
    status: 'pending',
  })

  if (error) {
    console.error('Flag insert error:', error)
    return NextResponse.json({ error: 'Failed to submit flag' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

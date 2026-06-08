import { NextRequest, NextResponse } from 'next/server'
import { getTitleDetail } from '@/lib/title-detail'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await enforceRateLimit(req, 'titles')
  if (limited) return limited

  const { id } = await params

  try {
    const detail = await getTitleDetail(id)
    if (!detail) {
      return NextResponse.json({ error: 'Title not found' }, { status: 404 })
    }
    return NextResponse.json(detail)
  } catch {
    return NextResponse.json({ error: 'Failed to load availability' }, { status: 500 })
  }
}

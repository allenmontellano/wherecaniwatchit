import { NextRequest, NextResponse } from 'next/server'
import { getTitleDetail } from '@/lib/title-detail'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

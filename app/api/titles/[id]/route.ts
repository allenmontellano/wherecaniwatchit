import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: title, error: titleError } = await supabase
    .from('titles')
    .select('*')
    .eq('id', id)
    .single()

  if (titleError || !title) {
    return NextResponse.json({ error: 'Title not found' }, { status: 404 })
  }

  const { data: availability, error: availError } = await supabase
    .from('availability')
    .select('*, platform:platforms(*)')
    .eq('title_id', id)
    .eq('available', true)
    .order('region_code')

  if (availError) {
    return NextResponse.json({ error: 'Failed to load availability' }, { status: 500 })
  }

  return NextResponse.json({ title, availability: availability ?? [] })
}

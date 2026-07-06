import { requireRole } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlatformsManager, type ManagedPlatform } from '@/components/admin/platforms-manager'

export const dynamic = 'force-dynamic'

export default async function PlatformsPage() {
  await requireRole('admin')
  const supabase = createAdminClient()
  const { data: platforms } = await supabase
    .from('platforms')
    .select('id, name, slug, logo_url, supported_regions')
    .order('name')

  return (
    <div className="max-w-[720px]">
      <h1
        className="text-[22px] font-bold text-[#171717]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Platforms
      </h1>
      <p className="text-[13.5px] text-[#717177] mt-1 mb-6">
        Streaming platforms and the regions they serve. Slugs are permanent once created.
      </p>
      <PlatformsManager platforms={(platforms ?? []) as ManagedPlatform[]} />
    </div>
  )
}

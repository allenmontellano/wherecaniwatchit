import { isStaging } from '@/lib/env'

export function StagingBanner() {
  if (!isStaging()) return null
  return (
    <div className="w-full bg-amber-500 py-1 text-center text-xs font-medium text-black">
      Staging Environment
    </div>
  )
}

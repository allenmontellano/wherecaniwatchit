import { Logo } from '@/components/logo'
import { ChevronLeft } from 'lucide-react'

export default function TitleLoading() {
  return (
    <main
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      {/* Header skeleton */}
      <header
        className="sticky top-0 z-50 flex items-center gap-3 px-4 sm:px-6 py-2.5"
        style={{
          background: 'rgba(255, 255, 255, 0.86)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(229, 229, 229, 0.55)',
        }}
      >
        <div className="flex items-center gap-1.5 text-sm text-[#AEAEB8]">
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </div>
        <div className="flex-1 flex justify-center">
          <Logo width={100} />
        </div>
        <div className="w-14" aria-hidden="true" />
      </header>

      <div className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-6 md:gap-10 mb-10">
          {/* Poster skeleton */}
          <div className="w-full max-w-[280px] mx-auto md:mx-0">
            <div
              className="w-full rounded-2xl bg-[#F0F0F2] animate-pulse"
              style={{ aspectRatio: '2/3' }}
            />
          </div>

          {/* Info skeleton */}
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex gap-2">
              <div className="h-5 w-14 bg-[#F0F0F2] rounded-full animate-pulse" />
              <div className="h-5 w-10 bg-[#F0F0F2] rounded-full animate-pulse" />
              <div className="h-5 w-16 bg-[#F0F0F2] rounded-full animate-pulse" />
            </div>
            <div className="h-9 w-3/4 bg-[#F0F0F2] rounded-lg animate-pulse" />
            <div className="flex gap-1.5">
              <div className="h-5 w-16 bg-[#F0F0F2] rounded-full animate-pulse" />
              <div className="h-5 w-20 bg-[#F0F0F2] rounded-full animate-pulse" />
            </div>
            <div className="space-y-2 mt-1">
              <div className="h-3.5 bg-[#F0F0F2] rounded-full animate-pulse" />
              <div className="h-3.5 bg-[#F0F0F2] rounded-full animate-pulse w-5/6" />
              <div className="h-3.5 bg-[#F0F0F2] rounded-full animate-pulse w-4/6" />
            </div>
            {/* Tab skeletons */}
            <div className="hidden md:flex gap-2 mt-4">
              {[60, 52, 64, 56, 52].map((w, i) => (
                <div key={i} className="h-8 bg-[#F0F0F2] rounded-full animate-pulse" style={{ width: w }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

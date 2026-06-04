import { Logo } from '@/components/logo'

export default function TitleLoading() {
  return (
    <main
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      {/* Header skeleton (matches SiteHeader) */}
      <header
        className="sticky top-0 z-40 grid items-center gap-3 min-[721px]:gap-6 px-4 min-[721px]:px-8 py-3 min-[721px]:py-3.5 grid-cols-[auto_1fr_auto] min-[721px]:grid-cols-[1fr_minmax(0,540px)_1fr]"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="justify-self-start">
          <Logo width={120} />
        </div>
        <div className="h-[42px] rounded-full bg-[#F0F0F2] animate-pulse" />
        <div className="justify-self-end h-9 w-[120px] rounded-full bg-[#F0F0F2] animate-pulse" />
      </header>

      {/* Hero skeleton */}
      <section
        className="relative"
        style={{ background: 'linear-gradient(135deg,#1f2a44 0%,#2d3b5e 45%,#3a4a72 100%)' }}
      >
        <div className="relative max-w-[1080px] mx-auto px-4 min-[721px]:px-8 pt-10 min-[721px]:pt-14 pb-8 min-[721px]:pb-10 flex flex-col min-[721px]:flex-row gap-6 min-[721px]:gap-10 items-start min-[721px]:items-end">
          <div
            className="flex-shrink-0 w-[150px] min-[721px]:w-[230px] rounded-[16px] bg-white/10 animate-pulse"
            style={{ aspectRatio: '2/3' }}
          />
          <div className="flex-1 w-full space-y-4 pb-1.5">
            <div className="h-12 w-2/3 bg-white/15 rounded-lg animate-pulse" />
            <div className="h-4 w-1/2 bg-white/10 rounded-full animate-pulse" />
            <div className="space-y-2">
              <div className="h-3.5 bg-white/10 rounded-full animate-pulse" />
              <div className="h-3.5 w-5/6 bg-white/10 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* Content skeletons */}
      <div className="max-w-[1080px] mx-auto w-full px-4 min-[721px]:px-8 pt-2 pb-16 space-y-10">
        <div className="mt-10 space-y-3.5">
          <div className="h-3 w-40 bg-[#F0F0F2] rounded-full animate-pulse" />
          <div className="h-24 bg-[#F0F0F2] rounded-[18px] animate-pulse" />
        </div>
        <div className="space-y-3.5">
          <div className="h-3 w-48 bg-[#F0F0F2] rounded-full animate-pulse" />
          <div className="h-56 bg-[#F0F0F2] rounded-[18px] animate-pulse" />
        </div>
        <div className="grid grid-cols-1 min-[861px]:grid-cols-2 gap-5">
          <div className="h-64 bg-[#F0F0F2] rounded-[18px] animate-pulse" />
          <div className="h-64 bg-[#F0F0F2] rounded-[18px] animate-pulse" />
        </div>
      </div>
    </main>
  )
}

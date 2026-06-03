import { Logo } from '@/components/logo'

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.88)',
        border: '1px solid rgba(229,229,229,0.7)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      <div className="aspect-[2/3] bg-[#F0F0F2] animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-[#F0F0F2] rounded-full animate-pulse w-3/4" />
        <div className="h-2.5 bg-[#F0F0F2] rounded-full animate-pulse w-1/2" />
        <div className="flex gap-1 pt-0.5">
          <div className="h-4 w-12 bg-[#F0F0F2] rounded-full animate-pulse" />
          <div className="h-4 w-10 bg-[#F0F0F2] rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export default function SearchLoading() {
  return (
    <main
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <header
        className="sticky top-0 z-50 flex items-center gap-3 px-4 sm:px-6 py-2.5"
        style={{
          background: 'rgba(255, 255, 255, 0.86)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(229, 229, 229, 0.55)',
        }}
      >
        <div className="flex-shrink-0">
          <Logo width={110} />
        </div>
        <div className="flex-1 max-w-lg">
          <div className="h-10 rounded-full bg-[#F0F0F2] animate-pulse" />
        </div>
      </header>

      <div className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-8 pb-16">
        <div className="h-4 w-40 bg-[#F0F0F2] rounded-full animate-pulse mb-5" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </main>
  )
}

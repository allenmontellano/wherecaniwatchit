import Link from 'next/link'
import { requireRole } from '@/lib/auth/guards'
import { AdminNav, type AdminNavItem } from '@/components/admin/admin-nav'

const NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin', label: 'Overview', roles: ['contributor', 'reviewer', 'admin'] },
  { href: '/admin/queue', label: 'Review queue', roles: ['contributor', 'reviewer', 'admin'] },
  { href: '/admin/availability', label: 'Availability', roles: ['contributor', 'reviewer', 'admin'] },
  { href: '/admin/pending', label: 'Pending approval', roles: ['reviewer', 'admin'] },
  { href: '/admin/titles', label: 'Titles', roles: ['admin'] },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(['contributor', 'reviewer', 'admin'])

  return (
    <div className="min-h-screen flex bg-[#FFFFFF]">
      <aside className="w-[220px] flex-shrink-0 border-r border-[#E5E5E5] px-4 py-6 flex flex-col gap-6">
        <div>
          <Link
            href="/admin"
            className="text-[16px] font-bold text-[#171717]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            WCIWI Admin
          </Link>
          <p className="text-[11.5px] text-[#717177] mt-0.5">
            {user.username} · <span className="capitalize">{user.role}</span>
          </p>
        </div>
        <AdminNav items={NAV_ITEMS} role={user.role} />
        <div className="mt-auto">
          <Link
            href="/account"
            className="text-[12.5px] text-[#717177] hover:text-[#171717] transition-colors"
          >
            ← Back to account
          </Link>
        </div>
      </aside>
      <main className="flex-1 px-8 py-7 min-w-0">{children}</main>
    </div>
  )
}

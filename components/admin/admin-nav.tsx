'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserRole } from '@/lib/auth/roles'

export interface AdminNavItem {
  href: string
  label: string
  roles: UserRole[]
}

export function AdminNav({ items, role }: { items: AdminNavItem[]; role: UserRole }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-0.5">
      {items
        .filter((item) => item.roles.includes(role))
        .map((item) => {
          const active =
            item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3.5 py-2 rounded-[10px] text-[14px] font-medium transition-all ${
                active
                  ? 'bg-[#2B72E8]/[0.08] text-[#2B72E8]'
                  : 'text-[#717177] hover:bg-black/[0.04] hover:text-[#171717]'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
    </nav>
  )
}

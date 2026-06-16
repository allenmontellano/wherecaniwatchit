import { requireUser } from '@/lib/auth/guards'
import { logout } from './actions'

export default async function AccountPage() {
  const user = await requireUser()
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-[#F7F7F8]">
      <div className="w-full max-w-[360px] flex flex-col gap-4">
        <h1 className="text-[22px] font-bold text-[#171717]" style={{ fontFamily: 'var(--font-display)' }}>
          Your account
        </h1>
        <dl className="text-[14px] text-[#171717] flex flex-col gap-1.5">
          <div className="flex justify-between"><dt className="text-[#717177]">Username</dt><dd>{user.username}</dd></div>
          <div className="flex justify-between"><dt className="text-[#717177]">Email</dt><dd>{user.email}</dd></div>
          <div className="flex justify-between"><dt className="text-[#717177]">Role</dt><dd className="capitalize">{user.role}</dd></div>
        </dl>
        <form action={logout}>
          <button
            type="submit"
            className="w-full px-5 py-2.5 rounded-[11px] text-[14px] font-semibold text-[#717177] bg-black/[0.04] hover:bg-black/[0.08] hover:text-[#171717] transition-all"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}

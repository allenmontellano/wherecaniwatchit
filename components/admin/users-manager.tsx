'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { changeUserRole, inviteUser } from '@/app/admin/users/actions'
import { USER_ROLES, type UserRole } from '@/lib/auth/roles'

export interface ManagedUser {
  user_id: string
  username: string
  role: UserRole
  region_code: string | null
  contribution_count: number
  joined_at: string
}

const inputCls =
  'rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 text-[13.5px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all'

export function UsersManager({ users, selfId }: { users: ManagedUser[]; selfId: string }) {
  return (
    <div className="flex flex-col gap-3">
      <InviteForm />
      <ul className="flex flex-col gap-2">
        {users.map((u) => (
          <UserRow key={u.user_id} user={u} isSelf={u.user_id === selfId} />
        ))}
      </ul>
    </div>
  )
}

function InviteForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('contributor')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await inviteUser(email, role)
      if (res.ok) {
        setNotice(`Invite sent to ${email}.`)
        setEmail('')
        router.refresh()
      } else setError(res.error)
    })
  }

  return (
    <div className="rounded-[16px] border border-[#E5E5E5] px-5 py-4 flex flex-col gap-3">
      <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-[#AEAEB8]">
        Invite user
      </span>
      <div className="flex items-center gap-2.5 flex-wrap">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className={`${inputCls} flex-1 min-w-[200px]`}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className={`${inputCls} appearance-none cursor-pointer capitalize`}
        >
          {USER_ROLES.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="px-4 py-2 rounded-[10px] text-[12.5px] font-semibold text-white bg-[#2B72E8] hover:bg-[#1d5fd1] transition-all cursor-pointer disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Send invite'}
        </button>
      </div>
      {error && (
        <p className="text-[12.5px] text-[#FF3B30]" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="text-[12.5px] text-[#34C759]">{notice}</p>}
    </div>
  )
}

function UserRow({ user, isSelf }: { user: ManagedUser; isSelf: boolean }) {
  const router = useRouter()
  const [role, setRole] = useState<UserRole>(user.role)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function change(next: UserRole) {
    setError(null)
    const previous = role
    setRole(next)
    startTransition(async () => {
      const res = await changeUserRole(user.user_id, next)
      if (!res.ok) {
        setRole(previous)
        setError(res.error)
      } else router.refresh()
    })
  }

  return (
    <li className="rounded-[14px] border border-[#E5E5E5] px-4 py-3 flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-[#171717] truncate">
          {user.username}
          {isSelf && <span className="text-[#717177] font-normal"> (you)</span>}
        </p>
        <p className="text-[12px] text-[#717177]">
          {user.region_code ?? '—'} · {user.contribution_count} contribution
          {user.contribution_count === 1 ? '' : 's'}
        </p>
        {error && (
          <p className="text-[12px] text-[#FF3B30]" role="alert">
            {error}
          </p>
        )}
      </div>
      <select
        value={role}
        onChange={(e) => change(e.target.value as UserRole)}
        disabled={pending}
        className={`${inputCls} appearance-none cursor-pointer capitalize disabled:opacity-60`}
      >
        {USER_ROLES.map((r) => (
          <option key={r} value={r} className="capitalize">
            {r}
          </option>
        ))}
      </select>
    </li>
  )
}

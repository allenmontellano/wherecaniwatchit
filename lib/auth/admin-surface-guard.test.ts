import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// SEC-02 CI guard: no file under app/admin/** may reach the RLS-bypassing
// service-role client without an authorization check, and every Server Action
// must route through the withRole() wrapper (never bare requireRole()).
const ADMIN_DIR = join(process.cwd(), 'app', 'admin')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

const files = walk(ADMIN_DIR).map((f) => ({ path: f, src: readFileSync(f, 'utf8') }))
const rel = (p: string) => p.slice(process.cwd().length + 1).replace(/\\/g, '/')

describe('admin surface authorization guard (SEC-02)', () => {
  it('finds admin files to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('every file using createAdminClient has an authorization guard', () => {
    const unguarded = files
      .filter((f) => f.src.includes('createAdminClient'))
      .filter((f) => !f.src.includes('withRole(') && !f.src.includes('requireRole('))
      .map((f) => rel(f.path))
    expect(unguarded, `service-role client without a guard: ${unguarded.join(', ')}`).toEqual([])
  })

  it('every Server Action file (actions.ts) routes through withRole, not bare requireRole', () => {
    const actionFiles = files.filter((f) => /(^|[\\/])actions\.ts$/.test(f.path))
    // must use the wrapper
    const notWrapped = actionFiles
      .filter((f) => !f.src.includes('withRole('))
      .map((f) => rel(f.path))
    expect(notWrapped, `action files not using withRole: ${notWrapped.join(', ')}`).toEqual([])
    // must not bypass it with an inline requireRole
    const bypassed = actionFiles
      .filter((f) => f.src.includes('requireRole('))
      .map((f) => rel(f.path))
    expect(bypassed, `action files still calling requireRole directly: ${bypassed.join(', ')}`).toEqual(
      []
    )
  })
})

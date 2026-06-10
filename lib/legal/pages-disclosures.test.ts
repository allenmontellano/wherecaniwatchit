import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('legal pages reference their required disclosures', () => {
  it('privacy page uses analytics, contact, NPC, and independent-project disclosures', () => {
    const src = read('app/privacy/page.tsx')
    expect(src).toMatch(/ANALYTICS_DISCLOSURE/)
    expect(src).toMatch(/LEGAL_CONTACT_EMAIL/)
    expect(src).toMatch(/NPC_REFERENCE/)
    expect(src).toMatch(/INDEPENDENT_PROJECT_NOTE/)
  })
  it('terms page uses TMDB attribution, independent-project note, and contact', () => {
    const src = read('app/terms/page.tsx')
    expect(src).toMatch(/TMDB_ATTRIBUTION/)
    expect(src).toMatch(/INDEPENDENT_PROJECT_NOTE/)
    expect(src).toMatch(/LEGAL_CONTACT_EMAIL/)
  })
})

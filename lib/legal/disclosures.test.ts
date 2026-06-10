import { describe, it, expect } from 'vitest'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  TMDB_ATTRIBUTION,
  ANALYTICS_DISCLOSURE,
  INDEPENDENT_PROJECT_NOTE,
  NPC_REFERENCE,
} from './disclosures'

describe('legal disclosures', () => {
  it('contact email is on the site domain', () => {
    expect(LEGAL_CONTACT_EMAIL).toBe('privacy@wherecaniwatchit.info')
  })
  it('uses the exact required TMDB attribution', () => {
    expect(TMDB_ATTRIBUTION).toBe(
      'This product uses the TMDB API but is not endorsed or certified by TMDB.',
    )
  })
  it('analytics disclosure states cookieless and no PII', () => {
    expect(ANALYTICS_DISCLOSURE).toMatch(/cookieless/i)
    expect(ANALYTICS_DISCLOSURE).toMatch(/no personally identifying information/i)
  })
  it('independent-project note states not affiliated', () => {
    expect(INDEPENDENT_PROJECT_NOTE).toMatch(/not affiliated/i)
  })
  it('references the National Privacy Commission', () => {
    expect(NPC_REFERENCE).toBe('National Privacy Commission')
  })
  it('has a last-updated date in 2026', () => {
    expect(LEGAL_LAST_UPDATED).toMatch(/2026/)
  })
})

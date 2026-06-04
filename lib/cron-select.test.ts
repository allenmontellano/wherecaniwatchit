import { describe, it, expect } from 'vitest'
import { selectTitlesToRefresh, type RefreshTitle } from './cron-select'

const t = (id: string): RefreshTitle => ({ id, tmdb_id: Number(id), type: 'movie' })

describe('selectTitlesToRefresh', () => {
  it('puts flagged titles before time-stale titles', () => {
    const out = selectTitlesToRefresh([t('1')], [t('2'), t('3')], 10)
    expect(out.map((x) => x.id)).toEqual(['1', '2', '3'])
  })

  it('deduplicates a title that is both flagged and stale, keeping it in the flagged position', () => {
    const out = selectTitlesToRefresh([t('2')], [t('1'), t('2'), t('3')], 10)
    expect(out.map((x) => x.id)).toEqual(['2', '1', '3'])
  })

  it('caps the result at the given limit', () => {
    const out = selectTitlesToRefresh([t('1'), t('2')], [t('3'), t('4'), t('5')], 3)
    expect(out.map((x) => x.id)).toEqual(['1', '2', '3'])
  })
})

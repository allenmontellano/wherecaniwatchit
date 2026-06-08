import { describe, expect, it } from 'vitest'
import { parseLimit } from './seed'

describe('parseLimit', () => {
  it('reads --limit=N', () => {
    expect(parseLimit(['node', 'seed.ts', '--limit=50'])).toBe(50)
  })

  it('returns undefined when absent', () => {
    expect(parseLimit(['node', 'seed.ts'])).toBeUndefined()
  })

  it('ignores a non-numeric limit', () => {
    expect(parseLimit(['node', 'seed.ts', '--limit=abc'])).toBeUndefined()
  })
})

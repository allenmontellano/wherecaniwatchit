import { describe, it, expect, vi } from 'vitest'
import { withTimeout, TimeoutError } from '@/lib/with-timeout'

describe('withTimeout', () => {
  it('resolves with the value when the promise settles before the timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000, 'test')
    expect(result).toBe('ok')
  })

  it('propagates the original rejection when it settles before the timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'test')).rejects.toThrow(
      'boom'
    )
  })

  it('rejects with a TimeoutError when the promise is too slow', async () => {
    vi.useFakeTimers()
    const slow = new Promise((resolve) => setTimeout(resolve, 10_000))
    const raced = withTimeout(slow, 5_000, 'db-op')
    const assertion = expect(raced).rejects.toBeInstanceOf(TimeoutError)
    await vi.advanceTimersByTimeAsync(5_000)
    await assertion
    vi.useRealTimers()
  })

  it('the TimeoutError message includes the label', async () => {
    vi.useFakeTimers()
    const slow = new Promise((resolve) => setTimeout(resolve, 10_000))
    const raced = withTimeout(slow, 5_000, 'get-title-detail')
    const assertion = expect(raced).rejects.toThrow(/get-title-detail/)
    await vi.advanceTimersByTimeAsync(5_000)
    await assertion
    vi.useRealTimers()
  })

  it('does not leave a dangling timer when the promise wins (real timers)', async () => {
    // If the timer were not cleared, vitest would warn about an open handle.
    const spy = vi.spyOn(globalThis, 'clearTimeout')
    await withTimeout(Promise.resolve(42), 1000, 'test')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

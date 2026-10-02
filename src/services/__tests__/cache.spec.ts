import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearCache,
  getCachedValue,
  getOrFetchCached,
  invalidateCacheKey,
  invalidateWealthViews,
  WEALTH_HISTORY_CACHE_KEY,
} from '@/services/cache'

const TTL = 60_000

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

describe('getOrFetchCached', () => {
  beforeEach(() => clearCache())

  it('never lets an answer read before a write overwrite the one read after it', async () => {
    const before = deferred<string>()
    const stale = getOrFetchCached('history', () => before.promise, TTL)

    invalidateCacheKey('history')
    const fresh = getOrFetchCached('history', async () => 'after', TTL, true)
    await fresh
    before.resolve('before')

    expect(await stale).toBe('after')
    expect(getCachedValue('history')).toBe('after')
  })

  it('hands a stale caller the newer request still in flight', async () => {
    const before = deferred<string>()
    const after = deferred<string>()
    const stale = getOrFetchCached('history', () => before.promise, TTL)

    invalidateCacheKey('history')
    const fresh = getOrFetchCached('history', () => after.promise, TTL, true)
    before.resolve('before')
    after.resolve('after')

    expect(await stale).toBe('after')
    expect(await fresh).toBe('after')
    expect(getCachedValue('history')).toBe('after')
  })

  it('does not cache an answer invalidated with nothing to replace it', async () => {
    const before = deferred<string>()
    const stale = getOrFetchCached('history', () => before.promise, TTL)

    invalidateCacheKey('history')
    before.resolve('before')

    expect(await stale).toBe('before')
    expect(getCachedValue('history')).toBeNull()
  })
})

describe('invalidateWealthViews', () => {
  beforeEach(() => clearCache())

  it('drops the dashboard curve and every analysis entry, and nothing else', async () => {
    await getOrFetchCached(WEALTH_HISTORY_CACHE_KEY, async () => 'wealth', TTL)
    await getOrFetchCached('analysis:investor', async () => 'investor', TTL)
    await getOrFetchCached('analysis:yearly', async () => 'yearly', TTL)
    await getOrFetchCached('crypto:history:global', async () => 'crypto', TTL)

    invalidateWealthViews()

    expect(getCachedValue(WEALTH_HISTORY_CACHE_KEY)).toBeNull()
    expect(getCachedValue('analysis:investor')).toBeNull()
    expect(getCachedValue('analysis:yearly')).toBeNull()
    expect(getCachedValue('crypto:history:global')).toBe('crypto')
  })
})

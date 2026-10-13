import { describe, expect, it } from 'vitest'

import { exploreQuery, withoutExploreQuery } from '@/composables/useExploreFilters'
import { DEFAULT_STATE, parseState } from '@/utils/ledger'

describe('exploreQuery', () => {
  it('leaves the URL alone when it already says the state', () => {
    expect(exploreQuery({ view: 'search', dir: 'out' }, parseState({ dir: 'out' }))).toBeNull()
    expect(exploreQuery({ view: 'search' }, DEFAULT_STATE)).toBeNull()
  })

  it('writes the state over its own keys and keeps the others', () => {
    const state = parseState({ dir: 'in', q: 'lidl' })
    expect(exploreQuery({ view: 'search', dir: 'out', by: 'month' }, state)).toEqual({ view: 'search', dir: 'in', q: 'lidl' })
  })

  it('drops the payment method an old link still carries', () => {
    const old = { view: 'search', means: 'CARD', by: 'means' }
    expect(exploreQuery(old, parseState(old))).toEqual({ view: 'search' })
  })

  it('reads a repeated key as its first value', () => {
    expect(exploreQuery({ dir: ['out', 'in'] }, parseState({ dir: 'out' }))).toBeNull()
  })
})

describe('withoutExploreQuery', () => {
  it('drops every search key and nothing else', () => {
    expect(withoutExploreQuery({ view: 'search', dir: 'out', q: 'lidl', cum: '1', tab: 'x' })).toEqual({ view: 'search', tab: 'x' })
  })
})

import { describe, expect, it } from 'vitest'

import { exploreQuery, withoutExploreQuery } from '@/composables/useExploreFilters'
import { DEFAULT_STATE, parseState } from '@/utils/ledger'

describe('exploreQuery', () => {
  it('leaves the URL alone when it already says the state', () => {
    expect(exploreQuery({ view: 'explore', dir: 'out' }, parseState({ dir: 'out' }))).toBeNull()
    expect(exploreQuery({ view: 'explore' }, DEFAULT_STATE)).toBeNull()
  })

  it('writes the state over its own keys and keeps the others', () => {
    const state = parseState({ dir: 'in', q: 'lidl' })
    expect(exploreQuery({ view: 'explore', dir: 'out', by: 'month' }, state)).toEqual({ view: 'explore', dir: 'in', q: 'lidl' })
  })

  it('reads a repeated key as its first value', () => {
    expect(exploreQuery({ dir: ['out', 'in'] }, parseState({ dir: 'out' }))).toBeNull()
  })
})

describe('withoutExploreQuery', () => {
  it('drops every Explorer key and nothing else', () => {
    expect(withoutExploreQuery({ view: 'explore', dir: 'out', q: 'lidl', cum: '1', tab: 'x' })).toEqual({ view: 'explore', tab: 'x' })
  })
})

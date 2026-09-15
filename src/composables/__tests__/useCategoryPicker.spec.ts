import { describe, expect, it } from 'vitest'

import { useCategoryPicker } from '@/composables/useCategoryPicker'

describe('useCategoryPicker', () => {
  it('applies to similar operations by default, with the proposed words', () => {
    const picker = useCategoryPicker()
    picker.setWords(['carrefour', 'annecy', 'carte', 'cb'], ['carrefour', 'annecy'])
    picker.categoryId.value = 'c-courses'

    expect(picker.applyToSimilar.value).toBe(true)
    expect(picker.payload()).toEqual({ category_id: 'c-courses', apply_to_similar: true, tokens: ['carrefour', 'annecy'] })
  })

  it('sends only the words left ticked, in the label\'s rarity order', () => {
    const picker = useCategoryPicker()
    picker.setWords(['carrefour', 'annecy', 'carte', 'cb'], ['carrefour', 'carte'])
    picker.categoryId.value = 'c-courses'

    picker.toggleWord('carte')
    picker.toggleWord('cb')
    picker.toggleWord('annecy')

    expect(picker.payload().tokens).toEqual(['carrefour', 'annecy', 'cb'])
  })

  it('files one operation alone once unticked', () => {
    const picker = useCategoryPicker()
    picker.setWords(['carrefour'], ['carrefour'])
    picker.categoryId.value = 'c-courses'
    picker.applyToSimilar.value = false

    expect(picker.payload()).toEqual({ category_id: 'c-courses', apply_to_similar: false })
  })

  it('never turns "no category" into a rule', () => {
    const picker = useCategoryPicker()
    picker.setWords(['carrefour'], ['carrefour'])

    expect(picker.payload()).toEqual({ category_id: null, apply_to_similar: false })
  })

  it('starts over, ticked by default, for the next operation', () => {
    const picker = useCategoryPicker()
    picker.setWords(['carrefour'], ['carrefour'])
    picker.applyToSimilar.value = false
    picker.reset()

    expect([picker.applyToSimilar.value, picker.words.value, picker.tokens.value]).toEqual([true, [], []])
  })
})

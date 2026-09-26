import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useCarousel } from '@/composables/useCarousel'

const total = { key: 'total', label: 'Total' } as const
const accounts = { key: 'accounts', label: 'Par compte' } as const
const month = { key: 'month', label: 'Mois' } as const

describe('useCarousel', () => {
  it('cycles through fixed slides', () => {
    const { current, next, prev } = useCarousel([total, accounts])
    expect(current.value).toBe('total')
    next()
    expect(current.value).toBe('accounts')
    next()
    expect(current.value).toBe('total')
    prev()
    expect(current.value).toBe('accounts')
  })

  it('shows the first slide while the preferred one is missing, then the preferred one', () => {
    const slides = ref<Array<{ key: 'total' | 'accounts' | 'month'; label: string }>>([total, accounts])
    const { current, currentLabel } = useCarousel(slides, 'month')
    expect(current.value).toBe('total')
    expect(currentLabel.value).toBe('Total')

    slides.value = [month, total, accounts]
    expect(current.value).toBe('month')
  })

  it('keeps the slide the user moved to when others appear', () => {
    const slides = ref<Array<{ key: 'total' | 'accounts' | 'month'; label: string }>>([total, accounts])
    const { current, next } = useCarousel(slides, 'month')
    next()
    expect(current.value).toBe('accounts')

    slides.value = [month, total, accounts]
    expect(current.value).toBe('accounts')
  })
})

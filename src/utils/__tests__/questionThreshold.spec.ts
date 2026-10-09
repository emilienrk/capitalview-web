import { describe, expect, it } from 'vitest'

import { THRESHOLD_STEPS, askedAt, nearestStep } from '@/utils/questionThreshold'

describe('askedAt', () => {
  const amounts = [19000, 900, 500, 499.99, 120]

  it('asks the expenses at or above the threshold', () => {
    expect(askedAt(amounts, 500)).toEqual({ count: 3, total: 20400 })
  })

  it('asks more as the threshold comes down', () => {
    expect(askedAt(amounts, 100).count).toBe(5)
    expect(askedAt(amounts, 10000)).toEqual({ count: 1, total: 19000 })
  })
})

describe('nearestStep', () => {
  it('lands on the default', () => {
    expect(THRESHOLD_STEPS[nearestStep(500)]).toBe(500)
  })

  it('rounds a stored value between two steps to the closest', () => {
    expect(THRESHOLD_STEPS[nearestStep(480)]).toBe(500)
    expect(THRESHOLD_STEPS[nearestStep(0)]).toBe(50)
  })
})

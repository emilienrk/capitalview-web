import { describe, expect, it } from 'vitest'

import { measureSpan, nearestDefinedIndex } from '@/utils/chartMeasure'

describe('nearestDefinedIndex', () => {
  it('snaps a gap to the closest point that has a value', () => {
    expect(nearestDefinedIndex([10, null, null, 40], 1)).toBe(0)
    expect(nearestDefinedIndex([10, null, null, 40], 2)).toBe(3)
  })

  it('stays inside the visible window', () => {
    expect(nearestDefinedIndex([10, 20, null, null, 50], 3, 2, 4)).toBe(4)
    expect(nearestDefinedIndex([10, null, null], 2, 1, 2)).toBeNull()
  })

  it('clamps an index past either end', () => {
    expect(nearestDefinedIndex([10, 20, 30], -5)).toBe(0)
    expect(nearestDefinedIndex([10, 20, 30], 9)).toBe(2)
  })
})

describe('measureSpan', () => {
  it('reads forward in time whichever end the gesture started from', () => {
    const forward = measureSpan([100, 120, 150], 0, 2)
    const backward = measureSpan([100, 120, 150], 2, 0)
    expect(forward).toEqual(backward)
    expect(forward).toMatchObject({ fromIndex: 0, toIndex: 2, diff: 50, percent: 50 })
  })

  it('reports a fall as negative', () => {
    expect(measureSpan([200, 150], 0, 1)).toMatchObject({ diff: -50, percent: -25 })
  })

  it('drops the ratio on a base too close to zero', () => {
    expect(measureSpan([0.4, 30], 0, 1)?.percent).toBeNull()
    expect(measureSpan([0, 30], 0, 1, 0)?.percent).toBeNull()
  })

  it('keeps the ratio on a small price when the chart allows it', () => {
    expect(measureSpan([0.5, 0.75], 0, 1, 0)?.percent).toBeCloseTo(50)
  })

  it('measures against a negative base by its size', () => {
    expect(measureSpan([-200, -100], 0, 1)?.percent).toBe(50)
  })
})

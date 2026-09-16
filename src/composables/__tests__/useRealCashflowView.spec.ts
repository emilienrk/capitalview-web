import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/api/client'
import { clearCache } from '@/services/cache'
import { useRealCashflowView } from '@/composables/useRealCashflowView'
import type { RealCashflowMonthDetail } from '@/types'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const get = vi.mocked(apiClient.get)

function aMonth(period: string, previous: string | null, next: string | null): RealCashflowMonthDetail {
  return {
    period, currency: 'EUR', operation_count: 3, open_questions: 0, previous_period: previous, next_period: next,
    other_currencies: [], totals: { income: 0, expenses: 0, saving: 0, investment: 0, neutral: 0, net: 0 },
  }
}

describe('useRealCashflowView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    clearCache()
    vi.clearAllMocks()
  })

  it('opens on the previous year in January', async () => {
    get.mockResolvedValue({})
    const view = useRealCashflowView(new Date(2026, 0, 12))

    await view.openYear()

    expect(view.selectedYear.value).toBe(2025)
    expect(get).toHaveBeenCalledWith('/banking/real-cashflow?year=2025')
  })

  it('moves between months only towards those the API names', async () => {
    get.mockImplementation(async (endpoint: string) =>
      endpoint.endsWith('2026-02') ? aMonth('2026-02', '2025-12', null) : aMonth('2025-12', null, '2026-02'),
    )
    const view = useRealCashflowView(new Date(2026, 3, 1))

    await view.openMonth('2026-02')
    await view.nextMonth()
    expect(get).toHaveBeenCalledTimes(1)

    await view.previousMonth()
    expect(view.store.month?.period).toBe('2025-12')

    await view.previousMonth()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('goes back to the year of the month shown', async () => {
    get.mockImplementation(async (endpoint: string) =>
      endpoint.includes('/months/') ? aMonth('2025-12', null, null) : {},
    )
    const view = useRealCashflowView(new Date(2026, 3, 1))
    await view.openMonth('2025-12')

    await view.backToYear()

    expect(view.mode.value).toBe('year')
    expect(get).toHaveBeenLastCalledWith('/banking/real-cashflow?year=2025')
  })
})

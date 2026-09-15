import { ref } from 'vue'

import { useRealCashflowStore } from '@/stores/realCashflow'
import { defaultYear, type MonthlyStatistic } from '@/utils/realCashflow'

/** The real view's navigation: a year by default, a completed month on demand. */
export function useRealCashflowView(today: Date = new Date()) {
  const store = useRealCashflowStore()
  const mode = ref<'year' | 'month'>('year')
  const selectedYear = ref(defaultYear(today))
  const statistic = ref<MonthlyStatistic>('mean')

  function openYear(year: number = selectedYear.value): Promise<void> {
    selectedYear.value = year
    mode.value = 'year'
    return store.fetchYear(year)
  }

  function openMonth(period: string): Promise<void> {
    mode.value = 'month'
    return store.fetchMonth(period)
  }

  /** Only ever towards a completed month holding data: the API names them. */
  async function previousMonth(): Promise<void> {
    const period = store.month?.previous_period
    if (period) await openMonth(period)
  }

  async function nextMonth(): Promise<void> {
    const period = store.month?.next_period
    if (period) await openMonth(period)
  }

  function backToYear(): Promise<void> {
    const period = store.month?.period
    return openYear(period ? Number(period.slice(0, 4)) : selectedYear.value)
  }

  return { store, mode, selectedYear, statistic, openYear, openMonth, previousMonth, nextMonth, backToYear }
}

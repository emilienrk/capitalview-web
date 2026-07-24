import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

export interface SummaryStatItem {
  key: string
  label: string
  value: string
  valueClass?: string
  /** When set, the stat card is a button that cycles through views on click. */
  onSelect?: () => void
}

export interface UseStatsPagerReturn {
  page: Ref<number>
  pages: ComputedRef<SummaryStatItem[][]>
  activeStats: ComputedRef<SummaryStatItem[]>
  resetPage: () => void
}

/**
 * Paginates summary stat cards (4 per page by default), clamping the
 * current page when the stat list shrinks. Shared by Crypto and Stock.
 */
export function useStatsPager(
  stats: ComputedRef<SummaryStatItem[]>,
  perPage = 4,
): UseStatsPagerReturn {
  const page = ref(0)

  const pages = computed<SummaryStatItem[][]>(() => {
    const items = stats.value
    if (!items.length) return []

    const chunks: SummaryStatItem[][] = []
    for (let i = 0; i < items.length; i += perPage) {
      chunks.push(items.slice(i, i + perPage))
    }
    return chunks
  })

  const activeStats = computed<SummaryStatItem[]>(() => {
    const allPages = pages.value
    if (!allPages.length) return []
    return allPages[page.value] ?? allPages[0] ?? []
  })

  watch(pages, (allPages) => {
    if (!allPages.length || page.value >= allPages.length) {
      page.value = 0
    }
  }, { immediate: true })

  function resetPage(): void {
    page.value = 0
  }

  return { page, pages, activeStats, resetPage }
}

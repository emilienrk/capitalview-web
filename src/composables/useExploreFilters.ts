import { ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'

import { DEFAULT_STATE, parseState, serializeState, type ExploreState } from '@/utils/ledger'

/** The query keys the Explorer owns, so leaving it clears them and nothing else. */
export const EXPLORE_QUERY_KEYS = [
  'p', 'from', 'to', 'acc', 'dir', 'types', 'means', 'min', 'max', 'q', 'groups', 'open', 'pending', 'all', 'by', 'stack', 'cum',
]

function flat(query: LocationQuery): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, Array.isArray(value) ? (value[0] ?? undefined) : (value ?? undefined)]),
  )
}

/**
 * The query a state should leave in the URL, the keys the Explorer does not
 * own kept as they were; null when the URL already says it.
 */
export function exploreQuery(current: LocationQuery, state: ExploreState): LocationQuery | null {
  const wanted = serializeState(state)
  const flatCurrent = flat(current)
  if (EXPLORE_QUERY_KEYS.every((key) => flatCurrent[key] === wanted[key])) return null
  const kept = Object.fromEntries(Object.entries(current).filter(([key]) => !EXPLORE_QUERY_KEYS.includes(key)))
  return { ...kept, ...wanted } as LocationQuery
}

/** The query without any of the Explorer's keys. */
export function withoutExploreQuery(current: LocationQuery): LocationQuery {
  return Object.fromEntries(Object.entries(current).filter(([key]) => !EXPLORE_QUERY_KEYS.includes(key)))
}

/**
 * The Explorer's filters, kept in the URL both ways: a link from the Réel view
 * opens it filtered, the back button undoes a filter, and a copied address
 * reopens the same selection. Written with `replace`, so typing a search does
 * not stack a history entry per keystroke.
 */
export function useExploreFilters() {
  const route = useRoute()
  const router = useRouter()
  const state = ref<ExploreState>(parseState(flat(route.query)))

  watch(state, (value) => {
    const query = exploreQuery(route.query, value)
    if (query) void router.replace({ query })
  }, { deep: true })

  watch(() => route.query, (query) => {
    if (exploreQuery(query, state.value) === null) return
    state.value = parseState(flat(query))
  })

  function reset(): void {
    state.value = structuredClone(DEFAULT_STATE)
  }

  return { state, reset }
}

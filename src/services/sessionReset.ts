import { clearCache } from '@/services/cache'

/**
 * Wipe every piece of user-scoped state kept in memory: the module-level
 * request cache and all Pinia data stores. Called on logout / session
 * expiry AND right before a new session starts, so a user logging in
 * after another one (same tab, no reload) never sees stale data.
 *
 * Stores are imported lazily inside the function to avoid circular
 * imports (auth store → sessionReset → other stores → apiClient).
 */
export async function resetAllSessionState(): Promise<void> {
  clearCache()

  const [
    { useDashboardStore },
    { useWealthHistoryStore },
    { useBankStore },
    { useStocksStore },
    { useCryptoStore },
    { useCashflowStore },
    { useAssetStore },
    { useNotesStore },
    { useCommunityStore },
    { useSettingsStore },
    { useImportsStore },
  ] = await Promise.all([
    import('@/stores/dashboard'),
    import('@/stores/wealthHistory'),
    import('@/stores/bank'),
    import('@/stores/stocks'),
    import('@/stores/crypto'),
    import('@/stores/cashflow'),
    import('@/stores/asset'),
    import('@/stores/notes'),
    import('@/stores/community'),
    import('@/stores/settings'),
    import('@/stores/imports'),
  ])

  useDashboardStore().reset()
  useWealthHistoryStore().reset()
  useBankStore().reset()
  useStocksStore().reset()
  useCryptoStore().reset()
  useCashflowStore().reset()
  useAssetStore().reset()
  useNotesStore().reset()
  useCommunityStore().reset()
  useSettingsStore().reset()
  useImportsStore().reset()
}

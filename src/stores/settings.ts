import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/client'
import { useDisplayTimezone } from '@/composables/useDisplayTimezone'
import { useDisplayLocale } from '@/composables/useDisplayLocale'
import { applyServerTheme } from '@/composables/useDarkMode'
import type {
  BankConfigCheck,
  BankConnectionStatus,
  BankConnectionUpdate,
  BankSessionSummary,
  UserSettingsResponse,
  UserSettingsUpdate,
} from '@/types'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UserSettingsResponse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const bankingStatus = ref<BankConnectionStatus | null>(null)
  const bankingCheck = ref<BankConfigCheck | null>(null)
  const bankingSessions = ref<BankSessionSummary[] | null>(null)
  const { applyServerTimezone } = useDisplayTimezone()
  const { applyServerLocale } = useDisplayLocale()

  async function fetchSettings(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      settings.value = await apiClient.get<UserSettingsResponse>('/settings')
      applyServerTimezone(settings.value.display_timezone)
      applyServerLocale(settings.value.display_locale)
      applyServerTheme(settings.value.theme)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Impossible de charger les paramètres'
    } finally {
      isLoading.value = false
    }
  }

  async function updateSettings(data: UserSettingsUpdate): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      settings.value = await apiClient.put<UserSettingsResponse>('/settings', data)
      applyServerTimezone(settings.value.display_timezone)
      applyServerLocale(settings.value.display_locale)
      applyServerTheme(settings.value.theme)
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Impossible de sauvegarder'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function fetchBankingStatus(): Promise<void> {
    bankingStatus.value = await apiClient.get<BankConnectionStatus>('/banking/status')
  }

  /**
   * Enable Banking credentials. The private key travels one way only: the API
   * answers with a presence boolean, never with key material.
   */
  async function updateBankingCredentials(data: BankConnectionUpdate): Promise<void> {
    bankingStatus.value = await apiClient.put<BankConnectionStatus>('/banking/credentials', data)
  }

  /** Pre-flight diagnostic. Also carries the callback URL to declare in the portal. */
  async function fetchBankingCheck(): Promise<void> {
    bankingCheck.value = await apiClient.get<BankConfigCheck>('/banking/check')
  }

  /**
   * The bank connections opened so far. Readable even with the feature turned
   * off, so someone who opts back out can still see what stayed attached.
   */
  async function fetchBankingSessions(): Promise<void> {
    bankingSessions.value = await apiClient.get<BankSessionSummary[]>('/banking/sessions')
  }

  function reset(): void {
    settings.value = null
    bankingStatus.value = null
    bankingCheck.value = null
    bankingSessions.value = null
    error.value = null
  }

  return {
    settings,
    isLoading,
    error,
    bankingStatus,
    bankingCheck,
    bankingSessions,
    fetchSettings,
    updateSettings,
    fetchBankingStatus,
    updateBankingCredentials,
    fetchBankingCheck,
    fetchBankingSessions,
    reset,
  }
})

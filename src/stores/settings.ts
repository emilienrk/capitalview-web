import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/client'
import { useDisplayTimezone } from '@/composables/useDisplayTimezone'
import { useDisplayLocale } from '@/composables/useDisplayLocale'
import type { UserSettingsResponse, UserSettingsUpdate } from '@/types'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UserSettingsResponse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const { applyServerTimezone } = useDisplayTimezone()
  const { applyServerLocale } = useDisplayLocale()

  async function fetchSettings(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      settings.value = await apiClient.get<UserSettingsResponse>('/settings')
      applyServerTimezone(settings.value.display_timezone)
      applyServerLocale(settings.value.display_locale)
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
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Impossible de sauvegarder'
      return false
    } finally {
      isLoading.value = false
    }
  }

  function reset(): void {
    settings.value = null
    error.value = null
  }

  return {
    settings,
    isLoading,
    error,
    fetchSettings,
    updateSettings,
    reset,
  }
})

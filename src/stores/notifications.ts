import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiClient } from '@/api/client'
import type { NotificationListResponse, NotificationResponse } from '@/types'

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<NotificationResponse[]>([])
  const unreadCount = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /** The floating indicator only exists while there is something unseen. */
  const hasUnread = computed(() => unreadCount.value > 0)

  function _apply(response: NotificationListResponse): void {
    notifications.value = response.notifications
    unreadCount.value = response.unread_count
  }

  async function fetchNotifications(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      _apply(await apiClient.get<NotificationListResponse>('/notifications'))
    } catch (e) {
      // Silent by design: notifications are ambient, and a red banner over the
      // whole app because a secondary call failed would be worse than nothing.
      error.value = e instanceof Error ? e.message : 'Impossible de charger les notifications'
    } finally {
      isLoading.value = false
    }
  }

  async function markAllRead(): Promise<void> {
    try {
      _apply(await apiClient.post<NotificationListResponse>('/notifications/read'))
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Impossible de marquer comme lu'
    }
  }

  function reset(): void {
    notifications.value = []
    unreadCount.value = 0
    isLoading.value = false
    error.value = null
  }

  return { notifications, unreadCount, hasUnread, isLoading, error, fetchNotifications, markAllRead, reset }
})

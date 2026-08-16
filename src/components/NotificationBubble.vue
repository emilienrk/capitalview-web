<script setup lang="ts">
/**
 * Floating notification indicator.
 *
 * Renders nothing at all while there is nothing unread — the app should look
 * exactly as it does today until something actually happened.
 */
import { Bell, UserPlus, Target, Users, X } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useFormatters } from '@/composables/useFormatters'

const router = useRouter()
const authStore = useAuthStore()
const store = useNotificationsStore()
const { formatDateTime } = useFormatters()

const isOpen = ref(false)

const iconFor = {
  new_follower: UserPlus,
  mutual_follow: Users,
  pick_target_reached: Target,
} as const

const visible = computed(() => authStore.isAuthenticated && (store.hasUnread || isOpen.value))

onMounted(() => {
  if (authStore.isAuthenticated) void store.fetchNotifications()
})

// A session change must not leave the previous user's badge on screen.
watch(() => authStore.isAuthenticated, (loggedIn) => {
  isOpen.value = false
  if (loggedIn) void store.fetchNotifications()
})

async function togglePanel(): Promise<void> {
  isOpen.value = !isOpen.value
  if (isOpen.value && store.hasUnread) {
    await store.markAllRead()
  }
}

function goToCommunity(): void {
  isOpen.value = false
  router.push({ name: 'community', query: { tab: 'activite' } })
}
</script>

<template>
  <div v-if="visible" class="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
    <!-- Panel -->
    <div
      v-if="isOpen"
      class="w-[min(22rem,calc(100vw-3rem))] max-h-[60vh] overflow-y-auto rounded-card bg-surface dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border shadow-modal animate-slide-up"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-surface-border dark:border-surface-dark-border sticky top-0 bg-surface dark:bg-surface-dark">
        <h3 class="text-sm font-semibold text-text-main dark:text-text-dark-main">Notifications</h3>
        <button
          class="text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main"
          aria-label="Fermer les notifications"
          @click="isOpen = false"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <p v-if="!store.notifications.length" class="px-4 py-6 text-sm text-text-muted dark:text-text-dark-muted text-center">
        Rien de neuf pour l'instant.
      </p>

      <ul v-else class="divide-y divide-surface-border dark:divide-surface-dark-border">
        <li
          v-for="n in store.notifications"
          :key="n.id"
          class="flex gap-3 px-4 py-3 hover:bg-background-subtle dark:hover:bg-background-dark-subtle cursor-pointer"
          @click="goToCommunity"
        >
          <span class="flex items-center justify-center w-8 h-8 rounded-secondary bg-primary/10 text-primary shrink-0">
            <component :is="iconFor[n.type] ?? Bell" class="w-4 h-4" :stroke-width="1.75" />
          </span>
          <div class="min-w-0">
            <p class="text-sm text-text-body dark:text-text-dark-body">{{ n.message }}</p>
            <p class="text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
              {{ formatDateTime(n.created_at) }}
            </p>
          </div>
        </li>
      </ul>
    </div>

    <!-- Bubble -->
    <button
      class="relative flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-content shadow-modal hover:bg-primary-hover transition-colors"
      :aria-label="`Notifications${store.unreadCount ? ` (${store.unreadCount} non lues)` : ''}`"
      @click="togglePanel"
    >
      <Bell class="w-5 h-5" :stroke-width="2" />
      <span
        v-if="store.unreadCount"
        class="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-danger text-danger-content text-[11px] font-semibold flex items-center justify-center"
      >
        {{ store.unreadCount > 9 ? '9+' : store.unreadCount }}
      </span>
    </button>
  </div>
</template>

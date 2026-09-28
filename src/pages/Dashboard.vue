<script setup lang="ts">
/**
 * Loads the dashboard once, then hands the same figures to the layout that
 * fits the screen. The phone and the desktop are two arrangements, not two
 * sources: both read `useDashboardOverview`.
 */
import { onMounted, ref } from 'vue'
import { Eye, EyeOff, RefreshCw } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import { BaseAlert } from '@/components'
import DashboardDesktop from '@/components/dashboard/DashboardDesktop.vue'
import DashboardMobile from '@/components/dashboard/DashboardMobile.vue'
import { useDashboardOverview } from '@/composables/useDashboardOverview'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'

const auth = useAuthStore()
const dashboard = useDashboardStore()
const overview = useDashboardOverview()
const { privacyMode, togglePrivacyMode } = usePrivacyMode()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const refreshing = ref(false)

async function refresh(): Promise<void> {
  refreshing.value = true
  try {
    await overview.load(true)
  } finally {
    refreshing.value = false
  }
}

onMounted(() => {
  if (auth.isAuthenticated) void overview.load()
})
</script>

<template>
  <div>
    <PageHeader
      title="Tableau de bord"
      :description="auth.user?.username ? `Bonjour ${auth.user.username}` : undefined"
      inline-actions
    >
      <template #actions>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-button border border-surface-border bg-surface text-text-muted transition-colors hover:text-primary disabled:opacity-60 sm:h-9 sm:w-9 dark:border-surface-dark-border dark:bg-surface-dark dark:text-text-dark-muted dark:hover:text-primary"
          aria-label="Actualiser les chiffres"
          title="Actualiser les chiffres"
          :disabled="refreshing"
          @click="refresh"
        >
          <RefreshCw class="h-5 w-5" :class="refreshing ? 'animate-spin' : ''" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-button border border-surface-border bg-surface text-text-muted transition-colors hover:text-primary sm:h-9 sm:w-9 dark:border-surface-dark-border dark:bg-surface-dark dark:text-text-dark-muted dark:hover:text-primary"
          :aria-pressed="privacyMode"
          aria-label="Masquer les montants"
          :title="privacyMode ? 'Afficher les montants' : 'Masquer les montants'"
          @click="togglePrivacyMode"
        >
          <EyeOff v-if="privacyMode" class="h-5 w-5" aria-hidden="true" />
          <Eye v-else class="h-5 w-5" aria-hidden="true" />
        </button>
      </template>
    </PageHeader>

    <BaseAlert v-if="dashboard.error" variant="danger" dismissible class="mb-6" @dismiss="dashboard.error = null">
      {{ dashboard.error }}
      <button type="button" class="ml-2 font-medium underline underline-offset-2" @click="refresh">Réessayer</button>
    </BaseAlert>

    <DashboardDesktop v-if="isDesktop" :overview="overview" />
    <DashboardMobile v-else :overview="overview" />
  </div>
</template>

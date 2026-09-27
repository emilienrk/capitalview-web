<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDarkMode } from '@/composables/useDarkMode'
import CvLogo from '@/components/CvLogo.vue'
import { useAuthStore } from '@/stores/auth'
import { focusRing } from './publicStyles'

const route = useRoute()
const auth = useAuthStore()
const { isDark, setTheme } = useDarkMode()

// The landing offers both ways in; each auth page offers the other one.
// The legal pages are also read from inside the app, so they lead back to it.
const onLanding = computed(() => route.name === 'landing')
const backToApp = computed(() => route.meta.legal === true && auth.isAuthenticated)
const showLogin = computed(() => !backToApp.value && route.name !== 'login')
const showRegister = computed(() => !backToApp.value && route.name !== 'register' && route.name !== 'recover')
// Both links don't fit next to the wordmark on a phone.
const compact = computed(() => showLogin.value && showRegister.value)

function toggleDarkMode() {
  setTheme(isDark.value ? 'light' : 'dark')
}
</script>

<template>
  <nav
    class="sticky top-0 z-50 bg-background dark:bg-background-dark border-b border-surface-border dark:border-surface-dark-border"
    style="padding-top: env(safe-area-inset-top);"
  >
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
      <router-link to="/" aria-label="CapitalView, accueil" :class="['min-h-11 flex items-center gap-2 rounded-button', focusRing]">
        <CvLogo class="w-6 h-6 text-primary" />
        <span
          class="font-display text-lg font-semibold text-text-main dark:text-text-dark-main"
          :class="compact && 'hidden sm:inline'"
        >CapitalView</span>
      </router-link>
      <div class="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          :aria-label="isDark ? 'Passer en thème clair' : 'Passer en thème sombre'"
          :class="['size-11 inline-flex items-center justify-center rounded-button text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main', focusRing]"
          @click="toggleDarkMode"
        >
          <Sun v-if="isDark" class="w-5 h-5" />
          <Moon v-else class="w-5 h-5" />
        </button>
        <router-link
          v-if="backToApp"
          to="/dashboard"
          :class="['min-h-11 inline-flex items-center px-3 rounded-button text-sm font-semibold text-text-main dark:text-text-dark-main hover:text-primary transition-colors', focusRing]"
        >
          Retour à l'application
        </router-link>
        <router-link
          v-if="showLogin"
          to="/login"
          :class="['min-h-11 inline-flex items-center px-3 rounded-button text-sm font-semibold text-text-main dark:text-text-dark-main hover:text-primary transition-colors', focusRing]"
        >
          Connexion
        </router-link>
        <router-link
          v-if="showRegister"
          to="/register"
          :class="onLanding
            ? ['min-h-11 inline-flex items-center px-4 rounded-button bg-primary hover:bg-primary-hover text-primary-content text-sm font-semibold transition-colors', focusRing]
            : ['min-h-11 inline-flex items-center px-3 rounded-button text-sm font-semibold text-text-main dark:text-text-dark-main hover:text-primary transition-colors', focusRing]"
        >
          <span v-if="compact" class="sm:hidden">S'inscrire</span>
          <span :class="compact && 'hidden sm:inline'">Créer un compte</span>
        </router-link>
      </div>
    </div>
  </nav>
</template>

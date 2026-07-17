<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FileText, User, Sun, Moon, Monitor, Globe } from 'lucide-vue-next'

import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useDarkMode } from '@/composables/useDarkMode'
import { useFormatters } from '@/composables/useFormatters'
import { useDisplayTimezone, utcOffsetLabel } from '@/composables/useDisplayTimezone'
import { BaseCard, BaseAutocomplete } from '@/components'

const auth = useAuthStore()
const settingsStore = useSettingsStore()
const { themePreference, setTheme } = useDarkMode()
const { formatDateTime, formatDate } = useFormatters()
const { displayTimezone, setDisplayTimezone, browserTimezone } = useDisplayTimezone()

// ── Display timezone selector ────────────────────────────────────────────────

interface TimezoneOption {
  tz: string // IANA name, or '' for "browser default"
  label: string
}

// Intl.supportedValuesOf is ES2022; fall back to a short list on older engines.
const intlWithValues = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }
const supportedTimezones: string[] = intlWithValues.supportedValuesOf?.('timeZone')
  ?? ['UTC', 'Europe/Paris', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo']

function timezoneLabel(tz: string): string {
  const offset = utcOffsetLabel(tz)
  const name = tz.split('_').join(' ')
  return offset ? `(${offset}) ${name}` : name
}

const autoOption: TimezoneOption = {
  tz: '',
  label: `Automatique — ${timezoneLabel(browserTimezone)}`,
}

const timezoneOptions: TimezoneOption[] = [
  autoOption,
  ...supportedTimezones
    .map(tz => ({ tz, label: timezoneLabel(tz) }))
    .sort((a, b) => a.label.localeCompare(b.label)),
]

function currentTimezoneLabel(): string {
  if (!displayTimezone.value) return autoOption.label
  return timezoneLabel(displayTimezone.value)
}

const timezoneQuery = ref(currentTimezoneLabel())
const timezoneSaveError = ref<string | null>(null)

// Keep the input in sync if the preference changes elsewhere (e.g. settings load).
watch(displayTimezone, () => {
  timezoneQuery.value = currentTimezoneLabel()
})

async function selectTimezone(option: TimezoneOption): Promise<void> {
  timezoneSaveError.value = null
  const previous = displayTimezone.value
  setDisplayTimezone(option.tz)
  const saved = await settingsStore.updateSettings({ display_timezone: option.tz || null })
  if (!saved) {
    setDisplayTimezone(previous)
    timezoneQuery.value = currentTimezoneLabel()
    timezoneSaveError.value = settingsStore.error ?? 'Impossible de sauvegarder le fuseau horaire.'
  }
}

/** Live preview of how dates will be rendered with the current preference. */
const timezonePreview = computed(() => formatDateTime(new Date().toISOString()))
</script>

<template>
  <div class="space-y-6">
    <!-- Profile -->
    <BaseCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
            <User class="w-4 h-4 text-primary" stroke-width="2" />
          </div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Compte</h3>
        </div>
      </template>
      <div class="space-y-4">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <span class="text-primary text-2xl font-bold">
              {{ auth.user?.username?.charAt(0).toUpperCase() ?? '?' }}
            </span>
          </div>
          <div>
            <p class="text-lg font-semibold text-text-main dark:text-text-dark-main">
              {{ auth.user?.username }}
            </p>
            <p class="text-sm text-text-muted dark:text-text-dark-muted">
              {{ auth.user?.email }}
            </p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4 pt-4 border-t border-surface-border dark:border-surface-dark-border">
          <div>
            <p class="text-xs text-text-muted dark:text-text-dark-muted">Dernière connexion</p>
            <p class="text-sm font-medium text-text-main dark:text-text-dark-main">
              {{ formatDateTime(auth.user?.last_login) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-text-muted dark:text-text-dark-muted">Membre depuis</p>
            <p class="text-sm font-medium text-text-main dark:text-text-dark-main">
              {{ formatDate(auth.user?.created_at) }}
            </p>
          </div>
        </div>
      </div>
    </BaseCard>

    <!-- Appearance -->
    <BaseCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
            <FileText class="w-4 h-4 text-primary" stroke-width="2" />
          </div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Apparence</h3>
        </div>
      </template>
      <div class="flex flex-col gap-4">
        <div>
          <p class="font-medium text-text-main dark:text-text-dark-main">Thème de l'application</p>
          <p class="text-sm text-text-muted dark:text-text-dark-muted">
            Choisissez le thème ou suivez les paramètres de votre système
          </p>
        </div>
        
        <div class="grid grid-cols-3 gap-3">
          <button
            @click="setTheme('light')"
            :class="[
              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
              themePreference === 'light' 
                ? 'border-primary bg-primary/5 text-primary' 
                : 'border-surface-border dark:border-surface-dark-border hover:border-primary/50 text-text-muted dark:text-text-dark-muted'
            ]"
          >
            <Sun class="w-6 h-6" />
            <span class="text-sm font-medium">Clair</span>
          </button>
          
          <button
            @click="setTheme('dark')"
            :class="[
              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
              themePreference === 'dark' 
                ? 'border-primary bg-primary/5 text-primary' 
                : 'border-surface-border dark:border-surface-dark-border hover:border-primary/50 text-text-muted dark:text-text-dark-muted'
            ]"
          >
            <Moon class="w-6 h-6" />
            <span class="text-sm font-medium">Sombre</span>
          </button>
          
          <button
            @click="setTheme('system')"
            :class="[
              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
              themePreference === 'system' 
                ? 'border-primary bg-primary/5 text-primary' 
                : 'border-surface-border dark:border-surface-dark-border hover:border-primary/50 text-text-muted dark:text-text-dark-muted'
            ]"
          >
            <Monitor class="w-6 h-6" />
            <span class="text-sm font-medium">Système</span>
          </button>
        </div>
      </div>
    </BaseCard>

    <!-- Dates & timezone -->
    <BaseCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
            <Globe class="w-4 h-4 text-primary" stroke-width="2" />
          </div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Dates et fuseau horaire</h3>
        </div>
      </template>
      <div class="flex flex-col gap-4">
        <div>
          <p class="font-medium text-text-main dark:text-text-dark-main">Fuseau horaire d'affichage</p>
          <p class="text-sm text-text-muted dark:text-text-dark-muted">
            Les dates sont enregistrées en UTC ; ce réglage n'affecte que leur affichage.
            Il est sauvegardé sur votre compte et suivi sur tous vos appareils.
          </p>
        </div>
        <BaseAutocomplete
          v-model="timezoneQuery"
          :options="timezoneOptions"
          :display-value="(opt: TimezoneOption) => opt.label"
          :show-all-on-focus="true"
          :error="timezoneSaveError ?? undefined"
          placeholder="Rechercher un fuseau (ex. Paris, UTC, New York)…"
          @select="selectTimezone"
        />
        <p class="text-sm text-text-muted dark:text-text-dark-muted">
          Exemple d'affichage : <span class="font-medium text-text-main dark:text-text-dark-main">{{ timezonePreview }}</span>
        </p>
      </div>
    </BaseCard>

  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileText, User, Sun, Moon, Monitor, Globe } from 'lucide-vue-next'

import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useDarkMode } from '@/composables/useDarkMode'
import { useFormatters } from '@/composables/useFormatters'
import { useDisplayTimezone, utcOffsetLabel } from '@/composables/useDisplayTimezone'
import { useDisplayLocale, DEFAULT_DISPLAY_LOCALE, SUPPORTED_DISPLAY_LOCALES } from '@/composables/useDisplayLocale'
import { BaseCard, BaseSelect } from '@/components'
import type { SelectOption } from '@/components/base/BaseSelect.vue'

const auth = useAuthStore()
const settingsStore = useSettingsStore()
const { themePreference, setTheme } = useDarkMode()
const { formatDateTime, formatDate, formatCurrency } = useFormatters()
const { displayTimezone, setDisplayTimezone, browserTimezone } = useDisplayTimezone()
const { displayLocale, setDisplayLocale, effectiveLocale } = useDisplayLocale()

const dateSettingsError = ref<string | null>(null)

// ── Display timezone: curated list of major cities ──────────────────────────

const CITY_TIMEZONES: { tz: string; city: string }[] = [
  { tz: 'UTC', city: 'UTC' },
  { tz: 'Europe/Paris', city: 'Paris' },
  { tz: 'Europe/London', city: 'Londres' },
  { tz: 'Europe/Berlin', city: 'Berlin' },
  { tz: 'Europe/Madrid', city: 'Madrid' },
  { tz: 'Europe/Lisbon', city: 'Lisbonne' },
  { tz: 'Europe/Zurich', city: 'Zurich' },
  { tz: 'Europe/Athens', city: 'Athènes' },
  { tz: 'Europe/Istanbul', city: 'Istanbul' },
  { tz: 'Europe/Moscow', city: 'Moscou' },
  { tz: 'Africa/Casablanca', city: 'Casablanca' },
  { tz: 'Africa/Cairo', city: 'Le Caire' },
  { tz: 'Africa/Johannesburg', city: 'Johannesburg' },
  { tz: 'America/New_York', city: 'New York' },
  { tz: 'America/Chicago', city: 'Chicago' },
  { tz: 'America/Denver', city: 'Denver' },
  { tz: 'America/Los_Angeles', city: 'Los Angeles' },
  { tz: 'America/Toronto', city: 'Toronto' },
  { tz: 'America/Mexico_City', city: 'Mexico' },
  { tz: 'America/Sao_Paulo', city: 'São Paulo' },
  { tz: 'America/Argentina/Buenos_Aires', city: 'Buenos Aires' },
  { tz: 'Asia/Dubai', city: 'Dubaï' },
  { tz: 'Asia/Kolkata', city: 'New Delhi' },
  { tz: 'Asia/Bangkok', city: 'Bangkok' },
  { tz: 'Asia/Singapore', city: 'Singapour' },
  { tz: 'Asia/Hong_Kong', city: 'Hong Kong' },
  { tz: 'Asia/Shanghai', city: 'Shanghai' },
  { tz: 'Asia/Tokyo', city: 'Tokyo' },
  { tz: 'Asia/Seoul', city: 'Séoul' },
  { tz: 'Australia/Sydney', city: 'Sydney' },
  { tz: 'Pacific/Auckland', city: 'Auckland' },
]

/** Offset in minutes, for sorting cities from west to east. */
function offsetMinutes(tz: string): number {
  const label = utcOffsetLabel(tz) // "UTC+05:30"
  const match = label.match(/UTC([+-])(\d{2}):(\d{2})/)
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3]))
}

const timezoneOptions = computed<SelectOption[]>(() => {
  const cities = [...CITY_TIMEZONES]
  // A timezone picked outside this list (older UI, other client) must stay visible.
  if (displayTimezone.value && !cities.some(c => c.tz === displayTimezone.value)) {
    cities.push({ tz: displayTimezone.value, city: displayTimezone.value.split('/').pop()?.split('_').join(' ') ?? displayTimezone.value })
  }
  return [
    { label: `Automatique — ${browserTimezone.split('_').join(' ')} (${utcOffsetLabel(browserTimezone)})`, value: 'auto' },
    ...cities
      .map(({ tz, city }) => ({ label: `(${utcOffsetLabel(tz)}) ${city}`, value: tz, minutes: offsetMinutes(tz) }))
      .sort((a, b) => a.minutes - b.minutes || a.label.localeCompare(b.label))
      .map(({ label, value }) => ({ label, value })),
  ]
})

const selectedTimezone = computed<string>({
  get: () => displayTimezone.value || 'auto',
  set: (value) => { void saveTimezone(!value || value === 'auto' ? '' : value) },
})

async function saveTimezone(tz: string): Promise<void> {
  dateSettingsError.value = null
  const previous = displayTimezone.value
  setDisplayTimezone(tz)
  const saved = await settingsStore.updateSettings({ display_timezone: tz || null })
  if (!saved) {
    setDisplayTimezone(previous)
    dateSettingsError.value = settingsStore.error ?? 'Impossible de sauvegarder le fuseau horaire.'
  }
}

// ── Date format (locale) ─────────────────────────────────────────────────────

/** Fixed sample instant so every option shows the same date. */
const SAMPLE_DATE = new Date(Date.UTC(2026, 6, 17, 15, 30))

function sampleFormat(locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(SAMPLE_DATE)
}

const localeOptions: SelectOption[] = SUPPORTED_DISPLAY_LOCALES.map(({ locale, label }) => ({
  value: locale,
  label: `${label} — ${sampleFormat(locale)}`,
}))

const selectedLocale = computed<string>({
  get: () => effectiveLocale.value,
  set: (value) => { void saveLocale(value || DEFAULT_DISPLAY_LOCALE) },
})

async function saveLocale(locale: string): Promise<void> {
  dateSettingsError.value = null
  const previous = displayLocale.value
  setDisplayLocale(locale)
  const saved = await settingsStore.updateSettings({ display_locale: locale })
  if (!saved) {
    setDisplayLocale(previous)
    dateSettingsError.value = settingsStore.error ?? 'Impossible de sauvegarder le format de date.'
  }
}

/** Live preview of how dates and amounts render with the current preferences. */
const displayPreview = computed(() => `${formatDateTime(new Date().toISOString())} · ${formatCurrency(1234.56)}`)
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
          <p class="font-medium text-text-main dark:text-text-dark-main">Affichage des dates</p>
          <p class="text-sm text-text-muted dark:text-text-dark-muted">
            Les dates sont enregistrées en UTC ; ces réglages n'affectent que leur affichage.
            Ils sont sauvegardés sur votre compte et suivis sur tous vos appareils.
          </p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseSelect
            v-model="selectedLocale"
            label="Format de date"
            :options="localeOptions"
          />
          <BaseSelect
            v-model="selectedTimezone"
            label="Fuseau horaire"
            :options="timezoneOptions"
          />
        </div>
        <p v-if="dateSettingsError" class="text-sm text-danger">{{ dateSettingsError }}</p>
        <p class="text-sm text-text-muted dark:text-text-dark-muted">
          Exemple d'affichage : <span class="font-medium text-text-main dark:text-text-dark-main">{{ displayPreview }}</span>
        </p>
      </div>
    </BaseCard>

  </div>
</template>

import { computed, ref, type ComputedRef, type Ref } from 'vue'

const STORAGE_KEY = 'capitalview:display-locale'

/** App default: French formatting (24h clock, day/month/year). */
export const DEFAULT_DISPLAY_LOCALE = 'fr-FR'

/** Locales offered in the settings; must stay in sync with the backend whitelist. */
export const SUPPORTED_DISPLAY_LOCALES = [
  { locale: 'fr-FR', label: 'Français' },
  { locale: 'en-GB', label: 'English (UK)' },
  { locale: 'en-US', label: 'English (US)' },
  { locale: 'de-DE', label: 'Deutsch' },
  { locale: 'es-ES', label: 'Español' },
  { locale: 'it-IT', label: 'Italiano' },
] as const

const storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage

/**
 * User-chosen locale for date/number formatting. Empty string = app default
 * (fr-FR) — deliberately NOT the device locale, so a French user with an
 * English phone still gets 24h/DD-MM dates. Server settings are the source
 * of truth; localStorage is only a boot cache.
 */
const displayLocale = ref<string>(storage?.getItem(STORAGE_KEY) ?? '')

function persistLocally(locale: string): void {
  if (locale) storage?.setItem(STORAGE_KEY, locale)
  else storage?.removeItem(STORAGE_KEY)
}

export function useDisplayLocale(): {
  displayLocale: Ref<string>
  effectiveLocale: ComputedRef<string>
  setDisplayLocale: (locale: string) => void
  applyServerLocale: (locale: string | null | undefined) => void
} {
  const effectiveLocale = computed(() => displayLocale.value || DEFAULT_DISPLAY_LOCALE)

  /** Set the preference locally (the caller is responsible for saving it server-side). */
  function setDisplayLocale(locale: string): void {
    displayLocale.value = locale
    persistLocally(locale)
  }

  /** Align the local preference with the server value (server wins). */
  function applyServerLocale(locale: string | null | undefined): void {
    const value = locale ?? ''
    if (value !== displayLocale.value) displayLocale.value = value
    persistLocally(value)
  }

  return { displayLocale, effectiveLocale, setDisplayLocale, applyServerLocale }
}

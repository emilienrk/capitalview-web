import { ref, onMounted } from 'vue'

export type ThemePreference = 'light' | 'dark' | 'system'

/**
 * The server-side user settings are the source of truth (synced by the settings
 * store via applyServerTheme). localStorage is only a boot cache so the first
 * render uses the right theme before /settings loads.
 */
const themePreference = ref<ThemePreference>('system')
const isDark = ref(false)
let isInitialized = false

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

function applyToDocument(): void {
  if (themePreference.value === 'dark') {
    isDark.value = true
  } else if (themePreference.value === 'light') {
    isDark.value = false
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  document.documentElement.classList.toggle('dark', isDark.value)
}

/** Set the preference locally (the caller is responsible for saving it server-side). */
function setTheme(theme: ThemePreference): void {
  themePreference.value = theme
  if (theme === 'system') {
    localStorage.removeItem('theme')
  } else {
    localStorage.setItem('theme', theme)
  }
  applyToDocument()
}

/**
 * Align the local preference with the server value (server wins).
 * Module-level so the settings store can call it outside of a component.
 */
export function applyServerTheme(theme: string | null | undefined): void {
  if (!isThemePreference(theme) || theme === themePreference.value) return
  setTheme(theme)
}

function initDarkMode(): void {
  if (isInitialized) return
  isInitialized = true

  const savedTheme = localStorage.getItem('theme')
  themePreference.value = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'system'

  applyToDocument()

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themePreference.value === 'system') applyToDocument()
  })
}

export function useDarkMode() {
  onMounted(() => {
    initDarkMode()
  })

  return {
    isDark,
    themePreference,
    setTheme,
    initDarkMode,
  }
}

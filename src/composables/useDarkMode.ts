import { ref, onMounted } from 'vue'

export type ThemePreference = 'light' | 'dark' | 'system'

const themePreference = ref<ThemePreference>('system')
const isDark = ref(false)
let isInitialized = false

export function useDarkMode() {
  function updateTheme() {
    if (themePreference.value === 'dark') {
      isDark.value = true
    } else if (themePreference.value === 'light') {
      isDark.value = false
    } else {
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }

    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function setTheme(theme: ThemePreference) {
    themePreference.value = theme
    if (theme === 'system') {
      localStorage.removeItem('theme')
    } else {
      localStorage.setItem('theme', theme)
    }
    updateTheme()
  }

  function initDarkMode(): void {
    if (isInitialized) return
    isInitialized = true

    const savedTheme = localStorage.getItem('theme') as ThemePreference | null
    if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
      themePreference.value = savedTheme
    } else {
      themePreference.value = 'system'
    }
    
    updateTheme()

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (themePreference.value === 'system') {
        isDark.value = e.matches
        if (isDark.value) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    })
  }

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

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Palette, X } from 'lucide-vue-next'
import { useDarkMode } from '@/composables/useDarkMode'
import {
  STYLE_OPTIONS,
  PALETTE_OPTIONS,
  activeStyle,
  activePalette,
  setThemeLab,
} from '@/theme/themeLab'

const open = ref(false)
const { isDark, setTheme } = useDarkMode()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    class="fixed left-4 lg:left-[calc(16rem+1rem)] z-50 flex flex-col items-start gap-2"
    style="bottom: calc(1rem + env(safe-area-inset-bottom, 0px));"
  >
    <div
      v-if="open"
      class="w-72 max-h-[70dvh] overflow-y-auto rounded-card border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark shadow-modal"
      role="dialog"
      aria-label="Comparer les thèmes"
    >
      <div class="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 class="text-sm font-semibold text-text-main dark:text-text-dark-main">Thème</h2>
        <button
          type="button"
          class="p-1 -mr-1 rounded-secondary text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main"
          aria-label="Fermer"
          @click="open = false"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <fieldset class="px-2 pb-2">
        <legend class="px-2 pb-1 text-xs font-medium text-text-muted dark:text-text-dark-muted">Style</legend>
        <button
          v-for="style in STYLE_OPTIONS"
          :key="style.id"
          type="button"
          :aria-pressed="activeStyle === style.id"
          :class="[
            'w-full text-left px-2 py-1.5 rounded-secondary transition-colors',
            activeStyle === style.id
              ? 'bg-primary-light dark:bg-primary/15'
              : 'hover:bg-surface-hover dark:hover:bg-surface-dark-hover',
          ]"
          @click="setThemeLab(style.id, activePalette)"
        >
          <span
            :class="[
              'block text-sm',
              activeStyle === style.id ? 'font-semibold text-primary' : 'text-text-main dark:text-text-dark-main',
            ]"
          >{{ style.label }}</span>
          <span class="block text-xs text-text-muted dark:text-text-dark-muted">{{ style.hint }}</span>
        </button>
      </fieldset>

      <fieldset class="px-2 pb-2 border-t border-surface-border dark:border-surface-dark-border pt-2">
        <legend class="sr-only">Palette</legend>
        <p class="px-2 pb-1 text-xs font-medium text-text-muted dark:text-text-dark-muted">Palette</p>
        <button
          v-for="palette in PALETTE_OPTIONS"
          :key="palette.id"
          type="button"
          :aria-pressed="activePalette === palette.id"
          :class="[
            'w-full flex items-center gap-3 px-2 py-1.5 rounded-secondary transition-colors',
            activePalette === palette.id
              ? 'bg-primary-light dark:bg-primary/15'
              : 'hover:bg-surface-hover dark:hover:bg-surface-dark-hover',
          ]"
          @click="setThemeLab(activeStyle, palette.id)"
        >
          <span class="flex shrink-0" aria-hidden="true">
            <span
              v-for="(swatch, index) in palette.swatches"
              :key="index"
              class="w-4 h-4 rounded-full border border-black/10 -ml-1 first:ml-0"
              :style="{ backgroundColor: swatch }"
            />
          </span>
          <span
            :class="[
              'text-sm',
              activePalette === palette.id ? 'font-semibold text-primary' : 'text-text-main dark:text-text-dark-main',
            ]"
          >{{ palette.label }}</span>
        </button>
      </fieldset>

      <div class="flex gap-1 px-4 py-3 border-t border-surface-border dark:border-surface-dark-border">
        <button
          v-for="mode in [{ id: 'light', label: 'Clair' }, { id: 'dark', label: 'Sombre' }] as const"
          :key="mode.id"
          type="button"
          :aria-pressed="(mode.id === 'dark') === isDark"
          :class="[
            'flex-1 py-1.5 text-sm rounded-button border transition-colors',
            (mode.id === 'dark') === isDark
              ? 'border-primary text-primary font-semibold'
              : 'border-surface-border dark:border-surface-dark-border text-text-body dark:text-text-dark-body hover:bg-surface-hover dark:hover:bg-surface-dark-hover',
          ]"
          @click="setTheme(mode.id)"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <button
      type="button"
      class="w-11 h-11 flex items-center justify-center rounded-full border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main shadow-lg hover:text-primary transition-colors"
      :aria-expanded="open"
      aria-label="Comparer les thèmes"
      @click="open = !open"
    >
      <Palette class="w-5 h-5" />
    </button>
  </div>
</template>

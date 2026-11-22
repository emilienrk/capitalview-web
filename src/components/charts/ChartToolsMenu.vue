<script setup lang="ts">
import { ref } from 'vue'
import { Download, Maximize2, Minimize2, Settings } from 'lucide-vue-next'
import BaseToggle from '@/components/base/BaseToggle.vue'

const props = defineProps<{
  fullscreen: boolean
  /** Only a chart that has trades to draw offers the switch. */
  hasTrades?: boolean
  showTrades?: boolean
}>()

const emit = defineEmits<{
  'update:showTrades': [value: boolean]
  'toggle-fullscreen': []
  download: []
}>()

const open = ref(false)

function run(action: () => void): void {
  open.value = false
  action()
}
</script>

<template>
  <div class="relative shrink-0">
    <button
      type="button"
      aria-label="Options de la courbe"
      :aria-expanded="open"
      class="p-1.5 rounded-full text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main hover:bg-surface-border/60 dark:hover:bg-surface-dark-border/40 transition duration-150"
      @click.stop="open = !open"
    >
      <Settings class="w-4 h-4" />
    </button>

    <div v-if="open" class="fixed inset-0 z-40" @click="open = false" />

    <Transition name="cv-pop">
      <div
        v-if="open"
        class="absolute right-0 top-full mt-1 z-50 origin-top-right bg-surface dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border rounded-primary shadow-card min-w-56 overflow-hidden"
      >
        <label
          v-if="props.hasTrades"
          class="w-full flex items-center justify-between gap-4 px-4 py-2.5 text-sm text-text-body dark:text-text-dark-body cursor-pointer"
        >
          Achats et ventes
          <BaseToggle
            :model-value="props.showTrades"
            aria-label="Afficher les achats et ventes"
            @update:model-value="emit('update:showTrades', $event)"
          />
        </label>
        <button
          type="button"
          class="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-text-body dark:text-text-dark-body hover:bg-background-subtle dark:hover:bg-background-dark-subtle transition-colors"
          @click.stop="run(() => emit('toggle-fullscreen'))"
        >
          <component :is="props.fullscreen ? Minimize2 : Maximize2" class="w-4 h-4 text-text-muted dark:text-text-dark-muted" />
          {{ props.fullscreen ? 'Quitter le plein écran' : 'Plein écran' }}
        </button>
        <button
          type="button"
          class="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-text-body dark:text-text-dark-body hover:bg-background-subtle dark:hover:bg-background-dark-subtle transition-colors"
          @click.stop="run(() => emit('download'))"
        >
          <Download class="w-4 h-4 text-text-muted dark:text-text-dark-muted" />
          Télécharger l'image
        </button>
      </div>
    </Transition>
  </div>
</template>

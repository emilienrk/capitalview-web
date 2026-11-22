<script setup lang="ts">
import { ref } from 'vue'
import { Download, Maximize2, Minimize2, Settings } from 'lucide-vue-next'
import BaseToggle from '@/components/base/BaseToggle.vue'
import BaseSegmentedControl from '@/components/base/BaseSegmentedControl.vue'
import type { AxisMode } from '@/composables/useChartTools'

const props = defineProps<{
  fullscreen: boolean
  /** Only a chart that has trades to draw offers the switch. */
  hasTrades?: boolean
  showTrades?: boolean
  /** Only a chart that draws a legend offers to hide it. */
  hasLegend?: boolean
  showLegend?: boolean
  /** The axis modes this chart can draw; fewer than two, and the choice is not offered. */
  axisModes?: AxisMode[]
  axisMode?: AxisMode
}>()

const emit = defineEmits<{
  'update:showTrades': [value: boolean]
  'update:showLegend': [value: boolean]
  'update:axisMode': [value: AxisMode]
  'toggle-fullscreen': []
  download: []
}>()

const AXIS_LABELS: Record<AxisMode, string> = { fit: 'Ajusté', zero: 'Zéro', log: 'Log' }

const open = ref(false)

function run(action: () => void): void {
  open.value = false
  action()
}

const rowClass = 'w-full flex items-center justify-between gap-4 px-4 py-2.5 text-sm text-text-body dark:text-text-dark-body'
const actionClass = 'w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-text-body dark:text-text-dark-body hover:bg-background-subtle dark:hover:bg-background-dark-subtle transition-colors'
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
        class="absolute right-0 top-full mt-1 z-50 origin-top-right bg-surface dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border rounded-primary shadow-card min-w-60 overflow-hidden"
      >
        <div v-if="props.axisModes && props.axisModes.length > 1 && props.axisMode" :class="rowClass">
          Axe
          <BaseSegmentedControl
            :model-value="props.axisMode"
            :options="props.axisModes.map((mode) => ({ label: AXIS_LABELS[mode], value: mode }))"
            size="sm"
            @update:model-value="emit('update:axisMode', $event as AxisMode)"
          />
        </div>
        <label v-if="props.hasTrades" :class="[rowClass, 'cursor-pointer']">
          Achats et ventes
          <BaseToggle
            :model-value="!!props.showTrades"
            aria-label="Afficher les achats et ventes"
            @update:model-value="emit('update:showTrades', $event)"
          />
        </label>
        <label v-if="props.hasLegend" :class="[rowClass, 'cursor-pointer']">
          Légende
          <BaseToggle
            :model-value="!!props.showLegend"
            aria-label="Afficher la légende"
            @update:model-value="emit('update:showLegend', $event)"
          />
        </label>
        <button type="button" :class="actionClass" @click.stop="run(() => emit('toggle-fullscreen'))">
          <component :is="props.fullscreen ? Minimize2 : Maximize2" class="w-4 h-4 text-text-muted dark:text-text-dark-muted" />
          {{ props.fullscreen ? 'Quitter le plein écran' : 'Plein écran' }}
        </button>
        <button type="button" :class="actionClass" @click.stop="run(() => emit('download'))">
          <Download class="w-4 h-4 text-text-muted dark:text-text-dark-muted" />
          Télécharger l'image
        </button>
      </div>
    </Transition>
  </div>
</template>

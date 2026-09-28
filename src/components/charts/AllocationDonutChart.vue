<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart } from 'echarts/charts'
import {
  TooltipComponent,
  LegendComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { useChartResize } from '@/composables/useChartResize'
import { chartAnimation, useChartTheme } from '@/composables/useChartTheme'
import { usePrivacyMode } from '@/composables/usePrivacyMode'

use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent])

interface AllocationSlice {
  name: string
  value: number
}

const props = defineProps<{
  segments: AllocationSlice[]
  isDark?: boolean
  reserveTopSpace?: boolean
}>()

const { chartRef, containerRef, canRenderChart } = useChartResize()
const legendSelection = ref<Record<string, boolean>>({})
const updateOptions = {
  replaceMerge: ['legend', 'series'],
}

const chartTheme = useChartTheme()
const { privacyMode } = usePrivacyMode()

const sortedSegments = computed(() => {
  return [...props.segments].sort((a, b) => b.value - a.value)
})

watch(sortedSegments, (segments) => {
  const nextSelection: Record<string, boolean> = {}
  for (const segment of segments) {
    nextSelection[segment.name] = legendSelection.value[segment.name] ?? true
  }
  legendSelection.value = nextSelection
}, { immediate: true })

const option = computed(() => {
  // Read here, not only inside the formatters: ECharts calls those later, so
  // toggling privacy would otherwise leave the drawn axis unmasked.
  const hidden = privacyMode.value
  const theme = chartTheme.value
  const textColor = theme.text

  return {
    ...chartAnimation(),
    backgroundColor: 'transparent',
    textStyle: { fontFamily: theme.fontFamily },
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      textStyle: { color: theme.tooltipText, fontSize: 12, fontFamily: theme.fontFamily },
      formatter: (params: any) => {
        const value = Number(params.value || 0)
        const pct = Number(params.percent || 0)
        return `<div style="font-weight:600;margin-bottom:4px">${params.name}</div>
<div>${hidden ? '•••' : `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`} (${pct.toFixed(1)}%)</div>`
      },
    },
    legend: {
      bottom: 0,
      type: 'scroll',
      selectedMode: true,
      selected: legendSelection.value,
      textStyle: { color: textColor, fontSize: 11 },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      pageIconColor: textColor,
      pageTextStyle: { color: textColor },
    },
    series: [
      {
        name: 'Répartition',
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['50%', '42%'],
        hoverAnimation: false,
        selectedOffset: 0,
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: theme.surface,
          borderWidth: 2,
        },
        emphasis: {
          scale: false,
          focus: 'none',
        },
        label: {
          show: false,
        },
        labelLine: {
          show: false,
        },
        color: theme.categorical,
        data: sortedSegments.value,
      },
    ],
  }
})

function handleLegendSelectChanged(event: { selected?: Record<string, boolean> }): void {
  if (!event?.selected) return
  legendSelection.value = {
    ...legendSelection.value,
    ...event.selected,
  }
}
</script>

<template>
  <div :class="props.reserveTopSpace ? 'space-y-2' : ''">
    <div v-if="props.reserveTopSpace" class="h-8" aria-hidden="true" />

    <div ref="containerRef" class="w-full h-72" style="touch-action: pan-y;">
      <VChart
        v-if="canRenderChart"
        ref="chartRef"
        :option="option"
        :update-options="updateOptions"
        autoresize
        class="w-full h-full"
        @legendselectchanged="handleLegendSelectChanged"
      />
    </div>
  </div>
</template>

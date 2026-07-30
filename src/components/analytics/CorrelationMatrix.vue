<script setup lang="ts">
/**
 * How much the lines move together. Not a look-through: the composition of an
 * ETF is unknown, so this shows redundancy of behaviour, not overlapping
 * holdings.
 */
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { HeatmapChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useChartResize } from '@/composables/useChartResize'
import type { CorrelationOut } from '@/types'

use([CanvasRenderer, HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent])

const props = defineProps<{ correlations: CorrelationOut[]; isDark?: boolean }>()

const { chartRef, containerRef, canRenderChart } = useChartResize()
const updateOptions = { replaceMerge: ['xAxis', 'yAxis', 'series', 'visualMap'] }

const keys = computed(() =>
  [...new Set(props.correlations.flatMap((pair) => [pair.left, pair.right]))].sort(),
)

const cells = computed(() => {
  const out: [number, number, number][] = []
  keys.value.forEach((key, index) => out.push([index, index, 1]))
  props.correlations.forEach((pair) => {
    const x = keys.value.indexOf(pair.left)
    const y = keys.value.indexOf(pair.right)
    const value = Number(pair.value)
    out.push([x, y, value], [y, x, value])
  })
  return out
})

const option = computed(() => {
  const textColor = props.isDark ? '#94a3b8' : '#6b7280'
  const tooltipBg = props.isDark ? '#0f172a' : '#ffffff'
  const tooltipBorder = props.isDark ? '#334155' : '#e5e7eb'
  const tooltipText = props.isDark ? '#f1f5f9' : '#111827'

  return {
    backgroundColor: 'transparent',
    grid: { top: 8, left: 110, right: 12, bottom: 60 },
    xAxis: {
      type: 'category',
      data: keys.value,
      axisLabel: { color: textColor, fontSize: 10, rotate: 40 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: keys.value,
      axisLabel: { color: textColor, fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitArea: { show: true },
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      itemWidth: 10,
      itemHeight: 60,
      textStyle: { color: textColor, fontSize: 10 },
      inRange: { color: ['#22c55e', '#f3f4f6', '#ef4444'] },
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipText, fontSize: 12 },
      formatter: (params: { data: [number, number, number] }) => {
        const [x, y, value] = params.data
        return `${keys.value[x]} / ${keys.value[y]}<br/>Corrélation ${value.toFixed(2)}`
      },
    },
    series: [
      {
        type: 'heatmap',
        data: cells.value,
        label: {
          show: keys.value.length <= 6,
          fontSize: 10,
          formatter: (params: { data: [number, number, number] }) => params.data[2].toFixed(2),
        },
        itemStyle: { borderWidth: 2, borderColor: 'transparent' },
      },
    ],
  }
})
</script>

<template>
  <div ref="containerRef" class="h-64 w-full" style="touch-action: pan-y;">
    <VChart
      v-if="canRenderChart"
      ref="chartRef"
      :option="option"
      :update-options="updateOptions"
      autoresize
      class="h-full w-full"
    />
  </div>
</template>

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

const { chartRef, containerRef, canRenderChart, containerWidth } = useChartResize()
const updateOptions = { replaceMerge: ['xAxis', 'yAxis', 'series', 'visualMap'] }

const keys = computed(() =>
  [...new Set(props.correlations.flatMap((pair) => [pair.left, pair.right]))].sort(),
)

/**
 * Axes carry the name, truncated to fit; the tooltip carries it in full with the
 * ticker beside it.
 *
 * A ticker on the axis was only trading one code for another: IWDA.AS is no more
 * a name than IE00B4L5Y983 is. The ISIN stays the technical key and never leaves
 * the payload — it is simply not what a reader is shown.
 *
 * On a phone the gutter that holds those names is the whole budget: 150px of a
 * 375px screen leaves 5 columns fighting over the rest. So the narrow layout
 * truncates harder and takes back the room — the full name is one tap away in
 * the tooltip either way.
 */
const AXIS_MAX = 22
const AXIS_MAX_SMALL = 10
const SMALL_WIDTH = 640

const labels = computed(() => {
  const symbol: Record<string, string> = {}
  const full: Record<string, string> = {}
  props.correlations.forEach((pair) => {
    symbol[pair.left] = pair.left_symbol
    symbol[pair.right] = pair.right_symbol
    full[pair.left] = pair.left_name
    full[pair.right] = pair.right_name
  })
  return { symbol, full }
})

const isSmall = computed(() => containerWidth.value > 0 && containerWidth.value < SMALL_WIDTH)

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value
}

const axisLabels = computed(() => {
  const max = isSmall.value ? AXIS_MAX_SMALL : AXIS_MAX
  return keys.value.map((key) => truncate(labels.value.full[key] ?? key, max))
})

function describe(key: string): string {
  const name = labels.value.full[key] ?? key
  const ticker = labels.value.symbol[key]
  return ticker && ticker !== name ? `${name} (${ticker})` : name
}

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
    // The gutter tracks the truncation: ~6px a character at fontSize 10, and the
    // rotated x labels need roughly their own length again below the plot.
    grid: {
      top: 8,
      left: isSmall.value ? 74 : 150,
      right: 12,
      bottom: isSmall.value ? 62 : 90,
    },
    xAxis: {
      type: 'category',
      data: axisLabels.value,
      axisLabel: { color: textColor, fontSize: 10, rotate: 35 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: axisLabels.value,
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
        const left = describe(keys.value[x] ?? '')
        const right = describe(keys.value[y] ?? '')
        return `${left}<br/>${right}<br/>Corrélation ${value.toFixed(2)}`
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
  <div ref="containerRef" class="h-80 w-full" style="touch-action: pan-y;">
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

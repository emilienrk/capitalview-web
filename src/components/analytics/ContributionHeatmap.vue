<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { HeatmapChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useChartResize } from '@/composables/useChartResize'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { MonthlyAmountOut } from '@/types'

use([CanvasRenderer, HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent])

const props = defineProps<{ monthly: MonthlyAmountOut[]; isDark?: boolean }>()

const { chartRef, containerRef, canRenderChart } = useChartResize()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()
const updateOptions = { replaceMerge: ['xAxis', 'yAxis', 'series', 'visualMap'] }

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

const years = computed(() => [...new Set(props.monthly.map((point) => point.year))].sort())

/** ECharts heatmap wants [xIndex, yIndex, value] triplets. */
const cells = computed(() =>
  props.monthly.map((point) => [
    point.month - 1,
    years.value.indexOf(point.year),
    Number(point.amount),
  ]),
)

const maxAmount = computed(() =>
  props.monthly.reduce((top, point) => Math.max(top, Number(point.amount)), 0),
)

const option = computed(() => {
  const textColor = props.isDark ? '#94a3b8' : '#6b7280'
  const tooltipBg = props.isDark ? '#0f172a' : '#ffffff'
  const tooltipBorder = props.isDark ? '#334155' : '#e5e7eb'
  const tooltipText = props.isDark ? '#f1f5f9' : '#111827'
  const emptyCell = props.isDark ? '#1e293b' : '#f3f4f6'

  return {
    backgroundColor: 'transparent',
    grid: { top: 8, left: 48, right: 12, bottom: 48 },
    xAxis: {
      type: 'category',
      data: MONTH_LABELS,
      axisLabel: { color: textColor, fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: years.value.map(String),
      axisLabel: { color: textColor, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitArea: { show: true },
    },
    visualMap: {
      min: 0,
      max: maxAmount.value || 1,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      itemWidth: 10,
      itemHeight: 60,
      textStyle: { color: textColor, fontSize: 10 },
      inRange: { color: [emptyCell, '#c7d2fe', '#6366f1', '#4338ca'] },
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipText, fontSize: 12 },
      formatter: (params: { data: [number, number, number] }) => {
        const [monthIndex, yearIndex, amount] = params.data
        const label = `${MONTH_LABELS[monthIndex]} ${years.value[yearIndex]}`
        if (!amount) return `${label}<br/>Aucun achat`
        return `${label}<br/>${maskValue(formatCurrency(amount))} investis`
      },
    },
    series: [
      {
        type: 'heatmap',
        data: cells.value,
        itemStyle: { borderWidth: 2, borderColor: 'transparent' },
      },
    ],
  }
})
</script>

<template>
  <div ref="containerRef" class="h-56 w-full" style="touch-action: pan-y;">
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

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import type { AccountHistorySnapshotResponse } from '@/types'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent])

const props = defineProps<{
  series: Array<{ name: string; history: AccountHistorySnapshotResponse[] }>
  isDark?: boolean
  granularity?: 'daily' | 'weekly' | 'monthly' | 'yearly'
}>()

const updateOptions = {
  replaceMerge: ['xAxis', 'series', 'dataZoom'],
}

type Granularity = 'daily' | 'weekly' | 'monthly' | 'yearly'
type RangeOption = { label: string; months: number }

const granularityDefaults: Record<Granularity, number> = {
  daily: 3,
  weekly: 12,
  monthly: 60,
  yearly: 120,
}

const granularityRangeOptions: Record<Granularity, RangeOption[]> = {
  daily: [
    { label: '1 mois', months: 1 },
    { label: '3 mois', months: 3 },
    { label: '6 mois', months: 6 },
    { label: '12 mois', months: 12 },
    { label: 'Tout', months: 0 },
  ],
  weekly: [
    { label: '3 mois', months: 3 },
    { label: '6 mois', months: 6 },
    { label: '1 an', months: 12 },
    { label: '2 ans', months: 24 },
    { label: 'Tout', months: 0 },
  ],
  monthly: [
    { label: '1 an', months: 12 },
    { label: '2 ans', months: 24 },
    { label: '3 ans', months: 36 },
    { label: '5 ans', months: 60 },
    { label: 'Tout', months: 0 },
  ],
  yearly: [
    { label: '5 ans', months: 60 },
    { label: '10 ans', months: 120 },
    { label: 'Tout', months: 0 },
  ],
}

const chartRef = ref<InstanceType<typeof VChart> | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const canRenderChart = ref(false)
let resizeObserver: ResizeObserver | null = null
const legendSelection = ref<Record<string, boolean>>({})
const selectedRangeMonths = ref<number>(granularityDefaults.daily)
const zoomStartIndex = ref<number>(0)
const zoomEndIndex = ref<number>(0)

const effectiveGranularity = computed<Granularity>(() => props.granularity ?? 'daily')

const rangeOptions = computed<RangeOption[]>(() => granularityRangeOptions[effectiveGranularity.value])

const allDates = computed<string[]>(() => {
  return Array.from(new Set(
    props.series.flatMap((line) => line.history.map((point) => point.snapshot_date)),
  )).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
})

function shiftMonths(date: Date, months: number): Date {
  const shifted = new Date(date)
  shifted.setMonth(shifted.getMonth() - months)
  return shifted
}

function applyRangeWindow(): void {
  const dates = allDates.value
  if (!dates.length) {
    zoomStartIndex.value = 0
    zoomEndIndex.value = 0
    return
  }

  const lastIndex = dates.length - 1
  zoomEndIndex.value = lastIndex

  if (selectedRangeMonths.value <= 0) {
    zoomStartIndex.value = 0
    return
  }

  const latestDate = new Date(dates[lastIndex]!)
  if (Number.isNaN(latestDate.getTime())) {
    zoomStartIndex.value = Math.max(0, lastIndex - 30)
    return
  }

  const threshold = shiftMonths(latestDate, selectedRangeMonths.value)
  const firstVisibleIndex = dates.findIndex((date) => {
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) return false
    return parsed.getTime() >= threshold.getTime()
  })

  zoomStartIndex.value = firstVisibleIndex >= 0 ? firstVisibleIndex : 0
}

function formatTooltipDate(val: string): string {
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return val

  if (effectiveGranularity.value === 'daily') {
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  if (effectiveGranularity.value === 'weekly') {
    return `Semaine du ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`
  }
  if (effectiveGranularity.value === 'monthly') {
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }
  return d.toLocaleDateString('fr-FR', { year: 'numeric' })
}

watch(effectiveGranularity, (granularity) => {
  selectedRangeMonths.value = granularityDefaults[granularity]
})

watch([allDates, selectedRangeMonths], () => {
  applyRangeWindow()
}, { immediate: true })

watch(
  () => props.series.map((line) => line.name),
  (names) => {
    const nextSelection: Record<string, boolean> = {}
    for (const name of names) {
      nextSelection[name] = legendSelection.value[name] ?? true
    }
    legendSelection.value = nextSelection
  },
  { immediate: true },
)

function syncChartVisibilityAndSize(): void {
  const container = containerRef.value
  if (!container) return

  const hasSize = container.clientWidth > 0 && container.clientHeight > 0
  if (!hasSize) return

  canRenderChart.value = true
  nextTick(() => {
    chartRef.value?.resize()
  })
}

onMounted(() => {
  syncChartVisibilityAndSize()

  resizeObserver = new ResizeObserver(() => {
    syncChartVisibilityAndSize()
  })

  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

const SERIES_COLORS = [
  '#3b82f6', // info
  '#10b981', // success
  '#f59e0b', // warning
  '#6366f1', // primary-ish
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
]

const option = computed(() => {
  const dates = allDates.value

  const isDaily = props.granularity === 'daily'
  const showDailyPoints = false

  const textColor = props.isDark ? '#94a3b8' : '#6b7280' // slate-400 / gray-500
  const gridColor = props.isDark ? '#1e293b' : '#f3f4f6' // slate-800 / gray-100
  const bgColor = 'transparent'

  const series = props.series.map((line, index) => {
    const byDate = new Map(line.history.map((point) => [point.snapshot_date, point.total_value]))
    return {
      name: line.name,
      type: 'line',
      smooth: !isDaily,
      symbol: showDailyPoints ? 'circle' : 'none',
      showSymbol: showDailyPoints,
      symbolSize: 4,
      lineStyle: { width: line.name === 'Solde total' ? 2.5 : (isDaily ? 1 : 2) },
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      data: dates.map((date) => byDate.get(date) ?? null),
      z: line.name === 'Solde total' ? 10 : 5,
    }
  })

  const xAxisInterval =
    props.granularity === 'daily'
      ? (dates.length <= 40 ? 0 : Math.max(0, Math.floor(dates.length / 14) - 1))
      : Math.max(0, Math.floor(dates.length / 12) - 1)

  const formatXAxisLabel = (val: string): string => {
    const d = new Date(val)
    if (Number.isNaN(d.getTime())) return val

    if (props.granularity === 'daily') {
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    }
    if (props.granularity === 'weekly') {
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    }
    if (props.granularity === 'monthly') {
      return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    }
    if (props.granularity === 'yearly') {
      return d.toLocaleDateString('fr-FR', { year: 'numeric' })
    }
    return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
  }

  const formatZoomLabel = (raw: number | string): string => {
    const dateValue = typeof raw === 'number'
      ? (dates[Math.max(0, Math.min(dates.length - 1, Math.floor(raw)))] ?? '')
      : String(raw)

    const d = new Date(dateValue)
    if (Number.isNaN(d.getTime())) return String(raw)

    if (effectiveGranularity.value === 'daily') {
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    if (effectiveGranularity.value === 'weekly') {
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    if (effectiveGranularity.value === 'monthly') {
      return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    }
    return d.toLocaleDateString('fr-FR', { year: 'numeric' })
  }

  return {
    backgroundColor: bgColor,
    legend: {
      bottom: 0,
      type: 'scroll',
      selected: legendSelection.value,
      textStyle: { color: textColor, fontSize: 11 },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      pageIconColor: textColor,
      pageTextStyle: { color: textColor },
    },
    grid: {
      top: 16,
      left: 8,
      right: 8,
      bottom: 64,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        interval: xAxisInterval,
        formatter: formatXAxisLabel,
        color: textColor,
        fontSize: 10,
        rotate: isDaily ? 35 : 0,
        hideOverlap: true,
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: textColor, fontSize: 10 },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: gridColor } },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: props.isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      borderColor: props.isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: props.isDark ? '#e2e8f0' : '#1e293b' },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return ''

        const date = formatTooltipDate(String(params[0].axisValue ?? ''))
        let tooltip = `<div style="font-weight: 600;">${date}</div>`

        for (const param of params) {
          if (param.seriesName && param.value != null) {
            const value = param.value
            const color = param.color || '#000'
            tooltip += `<div style="color: ${color}; margin-top: 4px;">${param.seriesName}: <strong>${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €</strong></div>`
          }
        }

        return tooltip
      },
    },
    dataZoom: dates.length > 10
      ? [
          {
            id: 'insideZoom',
            type: 'inside',
            startValue: zoomStartIndex.value,
            endValue: zoomEndIndex.value,
          },
          {
            id: 'sliderZoom',
            type: 'slider',
            bottom: 32,
            height: 10,
            showDetail: false,
            show: true,
            borderColor: 'transparent',
            backgroundColor: props.isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.6)',
            fillerColor: props.isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.3)',
            handleIcon: 'none',
            handleSize: 0,
            handleStyle: {
              color: 'transparent',
              borderColor: 'transparent',
              borderWidth: 0,
            },
            dataBackground: {
              areaStyle: { opacity: 0 },
              lineStyle: { opacity: 0 },
            },
            textStyle: { color: textColor, fontSize: 10 },
            startValue: zoomStartIndex.value,
            endValue: zoomEndIndex.value,
            moveHandle: true,
            moveHandleSize: 0,
            throttle: 100,
          },
        ]
      : undefined,
    series,
  }
})

function handleChartReady(): void {
  syncChartVisibilityAndSize()
}

function handleLegendSelectChanged(event: { selected?: Record<string, boolean> }): void {
  if (!event?.selected) return
  legendSelection.value = {
    ...legendSelection.value,
    ...event.selected,
  }
}

function handleDataZoom(event: {
  startValue?: number
  endValue?: number
  batch?: Array<{ startValue?: number; endValue?: number }>
}): void {
  const payload = event.batch?.[0] ?? event
  if (typeof payload.startValue === 'number') {
    zoomStartIndex.value = Math.max(0, Math.floor(payload.startValue))
  }
  if (typeof payload.endValue === 'number') {
    zoomEndIndex.value = Math.max(0, Math.floor(payload.endValue))
  }
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex justify-end">
      <div class="relative">
        <select
          :value="selectedRangeMonths"
          @change="(e) => selectedRangeMonths = Number((e.target as HTMLSelectElement).value)"
          class="no-native-arrow appearance-none bg-none pl-3 pr-9 py-1.5 text-xs sm:text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          style="appearance: none; -webkit-appearance: none; -moz-appearance: none;"
        >
          <option v-for="opt in rangeOptions" :key="opt.label" :value="opt.months">
            {{ opt.label }}
          </option>
        </select>
        <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted dark:text-text-dark-muted">
          <svg viewBox="0 0 20 20" fill="none" class="h-3.5 w-3.5" aria-hidden="true">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </div>
    </div>

    <div ref="containerRef" class="w-full h-72">
      <VChart
        v-if="canRenderChart"
        ref="chartRef"
        :option="option"
        :update-options="updateOptions"
        autoresize
        @finished="handleChartReady"
        @legendselectchanged="handleLegendSelectChanged"
        @datazoom="handleDataZoom"
      />
    </div>
  </div>
</template>

<style scoped>
.no-native-arrow::-ms-expand {
  display: none;
}
</style>

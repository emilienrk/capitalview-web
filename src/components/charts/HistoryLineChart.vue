<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import { useChartResize } from '@/composables/useChartResize'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent])

const props = defineProps<{
  series: Array<{ name: string; history: AccountHistorySnapshotResponse[] }>
  isDark?: boolean
  granularity?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  hideControls?: boolean
  showPerformance?: boolean
  // For P/L series (cumulative P/L): a percentage relative to the window's first
  // point is meaningless (the line crosses zero). Show only the € change instead.
  absolutePerformance?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:performance', val: { diff: number; percent: number | null } | null): void
}>()

const updateOptions = {
  replaceMerge: ['legend', 'xAxis', 'series', 'dataZoom'],
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

const { chartRef, containerRef, canRenderChart, containerWidth, syncChartVisibilityAndSize } = useChartResize()
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

  if (props.hideControls || selectedRangeMonths.value <= 0) {
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

const isMobile = computed(() => containerWidth.value < 640)

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

  const isSmall = isMobile.value
  const labelDivisor = isSmall ? 6 : 14
  const xAxisInterval =
    props.granularity === 'daily'
      ? (dates.length <= (isSmall ? 15 : 40) ? 0 : Math.max(0, Math.floor(dates.length / labelDivisor) - 1))
      : Math.max(0, Math.floor(dates.length / (isSmall ? 5 : 12)) - 1)

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
      bottom: 28,
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
    grid: {
      top: 16,
      left: isSmall ? 32 : 38,
      right: isSmall ? 4 : 12,
      bottom: 72,
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { show: false },
      axisLabel: {
        interval: xAxisInterval,
        formatter: formatXAxisLabel,
        color: textColor,
        fontSize: 10,
        hideOverlap: true,
      },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: { show: false },
      axisLabel: {
        color: textColor,
        fontSize: 10,
        formatter: (val: number) =>
          Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k€` : `${Math.round(val)}€`,
      },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: gridColor } },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: props.isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      borderColor: props.isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: props.isDark ? '#e2e8f0' : '#1e293b', fontSize: 12 },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return ''

        const date = formatTooltipDate(String(params[0].axisValue ?? ''))
        let tooltip = `<div style="font-weight: 600; margin-bottom: 4px;">${date}</div>`

        for (const param of params) {
          if (param.seriesName && param.value != null) {
            const value = param.value
            const color = param.color || '#000'
            tooltip += `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:3px"><span style="color:${color}">● ${param.seriesName}</span><strong>${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</strong></div>`
          }
        }

        return tooltip
      },
    },
    dataZoom: (!props.hideControls && dates.length > 10)
      ? [
          {
            type: 'slider',
            bottom: 2,
            left: '3%',
            right: '3%',
            height: 22,
            zoomLock: true,
            showDetail: false,
            show: true,
            borderColor: 'transparent',
            borderRadius: 11,
            backgroundColor: props.isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(209, 213, 219, 0.7)',
            fillerColor: props.isDark ? 'rgba(59, 130, 246, 0.45)' : 'rgba(99, 102, 241, 0.3)',
            // No resize handles — just the move handle in the center
            handleSize: 0,
            handleStyle: { opacity: 0 },
            dataBackground: {
              areaStyle: { opacity: 0 },
              lineStyle: { opacity: 0 },
            },
            moveHandleSize: 20,
            moveHandleStyle: {
              color: props.isDark ? '#6366f1' : '#6366f1',
              opacity: 0.85,
              borderWidth: 0,
              shadowBlur: 4,
              shadowColor: 'rgba(99,102,241,0.35)',
            },
            textStyle: { color: 'transparent', fontSize: 0 },
            startValue: zoomStartIndex.value,
            endValue: zoomEndIndex.value,
            throttle: 50,
          },
        ]
      : undefined,
    series,
  }
})

function handleChartReady(): void {
  // Only update container dimensions — autoresize on VChart handles actual resize
  const container = containerRef.value
  if (!container) return
  const hasSize = container.clientWidth > 0 && container.clientHeight > 0
  if (hasSize) containerWidth.value = container.clientWidth
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

const visiblePerformance = computed(() => {
  if (!props.showPerformance || props.series.length === 0 || allDates.value.length === 0) return null

  const mainSeriesIndex = props.series.findIndex(s => s.name === 'Solde total' || s.name === 'Portefeuille')
  const index = mainSeriesIndex !== -1 ? mainSeriesIndex : 0
  const line = props.series[index]
  if (!line) return null

  const byDate = new Map(line.history.map((point) => [point.snapshot_date, point.total_value]))
  const data = allDates.value.map((date) => byDate.get(date) ?? null)

  let startVal = null
  for (let i = zoomStartIndex.value; i <= zoomEndIndex.value; i++) {
    if (data[i] != null) {
      startVal = data[i]
      break
    }
  }

  let endVal = null
  for (let i = zoomEndIndex.value; i >= zoomStartIndex.value; i--) {
    if (data[i] != null) {
      endVal = data[i]
      break
    }
  }

  if (startVal == null || endVal == null) return null

  const diff = endVal - startVal
  if (props.absolutePerformance) return { diff, percent: null }
  if (startVal === 0) return null
  const percent = (diff / Math.abs(startVal)) * 100

  return { diff, percent }
})

watch(visiblePerformance, (newVal) => {
  emit('update:performance', newVal)
}, { immediate: true })
</script>

<template>
  <div class="space-y-2">
    <!-- Controls row: slot for parent (granularity) + range pills -->
    <div v-if="!hideControls" class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <!-- Left slot: parent can inject granularity selector here -->
      <div class="flex items-center gap-2 shrink-0">
        <slot name="leading" />
      </div>
      <!-- Range pills (right-aligned) -->
      <div class="flex items-center gap-1 overflow-x-auto hide-scrollbar">
        <button
          v-for="opt in rangeOptions"
          :key="opt.label"
          type="button"
          :class="[
            'px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-150 select-none',
            selectedRangeMonths === opt.months
              ? 'bg-primary text-primary-content shadow-sm'
              : 'text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main hover:bg-surface-border/60 dark:hover:bg-surface-dark-border/40',
          ]"
          @click="selectedRangeMonths = opt.months"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div ref="containerRef" class="w-full h-72" style="touch-action: none;">
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

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
import type { GlobalHistorySnapshotResponse } from '@/types'
import { useChartResize } from '@/composables/useChartResize'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent])

const props = defineProps<{
  history: GlobalHistorySnapshotResponse[]
  isDark?: boolean
  bankEnabled?: boolean
  wealthEnabled?: boolean
  granularity?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  showPerformance?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:performance', val: { diff: number; percent: number } | null): void
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

const { chartRef, containerRef, canRenderChart, containerWidth } = useChartResize()
const legendSelection = ref<Record<string, boolean>>({})
const selectedRangeMonths = ref<number>(granularityDefaults.daily)
const zoomStartIndex = ref<number>(0)
const zoomEndIndex = ref<number>(0)

const effectiveGranularity = computed<Granularity>(() => props.granularity ?? 'daily')

const rangeOptions = computed<RangeOption[]>(() => granularityRangeOptions[effectiveGranularity.value])

const allDates = computed<string[]>(() => props.history.map(s => s.snapshot_date))

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
  () => {
    const names = ['Bourse', 'Crypto', 'Patrimoine total']
    if (props.bankEnabled !== false) names.unshift('Cash')
    if (props.wealthEnabled !== false) names.push('Patrimoine matériel')
    return names
  },
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

const COLORS = {
  total:   '#4f46e5', // primary (indigo-600)
  stock:   '#059669', // success (emerald-600)
  crypto:  '#f59e0b', // warning (amber-500)
  bank:    '#3b82f6', // info (blue-500)
  assets:  '#475569', // secondary (slate-600)
}

const option = computed(() => {
  const dates = allDates.value
  const isDaily = props.granularity === 'daily'
  const showDailyPoints = false

  const textColor  = props.isDark ? '#94a3b8' : '#6b7280' // slate-400 / gray-500
  const gridColor  = props.isDark ? '#1e293b' : '#f3f4f6' // slate-800 / gray-100
  const bgColor    = 'transparent'

  const series = []

  if (props.bankEnabled !== false) {
    series.push({
      name: 'Cash',
      type: 'line',
      stack: 'wealth',
      areaStyle: { opacity: 0.4 },
      smooth: !isDaily,
      symbol: showDailyPoints ? 'circle' : 'none',
      showSymbol: showDailyPoints,
      symbolSize: 4,
      lineStyle: { width: isDaily ? 1 : 0 },
      color: COLORS.bank,
      data: props.history.map(s => s.bank_value),
    })
  }

  series.push({
    name: 'Bourse',
    type: 'line',
    stack: 'wealth',
    areaStyle: { opacity: 0.4 },
    smooth: !isDaily,
    symbol: showDailyPoints ? 'circle' : 'none',
    showSymbol: showDailyPoints,
    symbolSize: 4,
    lineStyle: { width: isDaily ? 1 : 0 },
    color: COLORS.stock,
    data: props.history.map(s => s.stock_value),
  })

  series.push({
    name: 'Crypto',
    type: 'line',
    stack: 'wealth',
    areaStyle: { opacity: 0.4 },
    smooth: !isDaily,
    symbol: showDailyPoints ? 'circle' : 'none',
    showSymbol: showDailyPoints,
    symbolSize: 4,
    lineStyle: { width: isDaily ? 1 : 0 },
    color: COLORS.crypto,
    data: props.history.map(s => s.crypto_value),
  })

  if (props.wealthEnabled !== false) {
    series.push({
      name: 'Patrimoine matériel',
      type: 'line',
      stack: 'wealth',
      areaStyle: { opacity: 0.4 },
      smooth: !isDaily,
      symbol: showDailyPoints ? 'circle' : 'none',
      showSymbol: showDailyPoints,
      symbolSize: 4,
      lineStyle: { width: isDaily ? 1 : 0 },
      color: COLORS.assets,
      data: props.history.map(s => s.assets_value),
    })
  }

  // Total wealth as a standalone line on top
  series.push({
    name: 'Patrimoine total',
    type: 'line',
    smooth: !isDaily,
    symbol: showDailyPoints ? 'circle' : 'none',
    showSymbol: showDailyPoints,
    symbolSize: 5,
    lineStyle: { width: 2.5, color: COLORS.total },
    color: COLORS.total,
    data: props.history.map(s => s.total_wealth),
    z: 10,
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
      type: 'scroll',  // scrollable on mobile when items overflow
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
      axisTick: { show: false },
      axisLabel: {
        color: textColor,
        fontSize: 10,
        formatter: (val: string) => formatXAxisLabel(val),
        // Keep labels readable for dense daily history.
        interval: xAxisInterval,
        hideOverlap: true,
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: textColor,
        fontSize: 11,
        formatter: (val: number) =>
          val >= 1000 ? `${(val / 1000).toFixed(0)}k €` : `${val} €`,
      },
      splitLine: { lineStyle: { color: gridColor } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,  // keeps tooltip inside chart bounds on mobile
      backgroundColor: props.isDark ? '#0f172a' : '#ffffff',
      borderColor: props.isDark ? '#334155' : '#e5e7eb',
      textStyle: { color: props.isDark ? '#f1f5f9' : '#111827', fontSize: 12 },
      formatter: (params: any[]) => {
        if (!Array.isArray(params) || params.length === 0) return ''
        const date = formatTooltipDate(String(params[0].axisValue ?? ''))
        const rows = params
          .map((p: any) => {
            const val = Number(p.value).toLocaleString('fr-FR', {
              minimumFractionDigits: 0, maximumFractionDigits: 0,
            })
            return `<div style="display:flex;justify-content:space-between;gap:16px">
              <span style="color:${p.color}">● ${p.seriesName}</span>
              <span style="font-weight:600">${val} €</span>
            </div>`
          })
          .join('')
        return `<div style="font-weight:600;margin-bottom:6px">${date}</div>${rows}`
      },
    },
    dataZoom: dates.length > 30
      ? [
          {
            type: 'slider',
            bottom: 2,
            left: '2%',
            right: '2%',
            height: 22,
            zoomLock: true,
            showDetail: false,
            show: true,
            borderColor: 'transparent',
            borderRadius: 11,
            backgroundColor: props.isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(209, 213, 219, 0.7)',
            fillerColor: props.isDark ? 'rgba(59, 130, 246, 0.45)' : 'rgba(99, 102, 241, 0.3)',
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

function handleLegendSelectChanged(event: { selected?: Record<string, boolean> }): void {
  if (!event?.selected) return
  legendSelection.value = {
    ...legendSelection.value,
    ...event.selected,
  }
}

const visiblePerformance = computed(() => {
  if (!props.showPerformance || allDates.value.length === 0) return null

  // The 'history' prop array length should match dates.value
  const data = props.history

  let startVal = null
  for (let i = zoomStartIndex.value; i <= zoomEndIndex.value; i++) {
    const item = data[i]
    if (item != null && item.total_wealth != null) {
      startVal = Number(item.total_wealth)
      break
    }
  }

  let endVal = null
  for (let i = zoomEndIndex.value; i >= zoomStartIndex.value; i--) {
    const item = data[i]
    if (item != null && item.total_wealth != null) {
      endVal = Number(item.total_wealth)
      break
    }
  }

  if (startVal == null || endVal == null || startVal === 0) return null

  const diff = endVal - startVal
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
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
        class="w-full h-full"
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

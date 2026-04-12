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
import type { GlobalHistorySnapshotResponse } from '@/types'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent])

const props = defineProps<{
  history: GlobalHistorySnapshotResponse[]
  isDark?: boolean
  bankEnabled?: boolean
  wealthEnabled?: boolean
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
      type: 'scroll',  // scrollable on mobile when items overflow
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
        color: textColor,
        fontSize: 11,
        formatter: (val: string) => formatXAxisLabel(val),
        // Keep labels readable for dense daily history.
        interval: xAxisInterval,
        rotate: isDaily ? 35 : 0,
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
            type: 'inside',
            startValue: zoomStartIndex.value,
            endValue: zoomEndIndex.value,
          },
          {
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
        class="w-full h-full"
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

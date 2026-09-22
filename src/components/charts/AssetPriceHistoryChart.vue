<script setup lang="ts">
import { computed, watch } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import type { AssetPriceTimelineResponse, AssetTimelineEvent } from '@/types'
import { useChartResize } from '@/composables/useChartResize'
import {
  buildCostBasisSeries,
  buildTimelineDates,
  largestTradeTotal,
  markerSize,
} from '@/utils/assetPriceTimeline'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'

use([CanvasRenderer, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent])

const props = defineProps<{
  timeline: AssetPriceTimelineResponse
  isDark?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:performance', val: { diff: number; percent: number | null } | null): void
}>()

const { formatNumber } = useFormatters()
const { maskValue } = usePrivacyMode()
const { chartRef, containerRef, canRenderChart, containerWidth } = useChartResize()

const updateOptions = { replaceMerge: ['legend', 'xAxis', 'series', 'dataZoom'] }

/**
 * Both sets were validated with the dataviz palette checker against their own
 * surface rather than flipped from one another: on the dark surface the red and
 * the violet each move a step, while the green holds in both.
 */
const PALETTE = {
  light: { price: '#3b82f6', buy: '#059669', sell: '#dc2626', income: '#7c3aed', costBasis: '#94a3b8', ring: '#ffffff' },
  dark: { price: '#3b82f6', buy: '#059669', sell: '#ef4444', income: '#8b5cf6', costBasis: '#64748b', ring: '#0f172a' },
}

const EVENT_LABELS: Record<AssetTimelineEvent['type'], string> = {
  BUY: 'Achat',
  SELL: 'Vente',
  INCOME: 'Revenu',
}

// Markers differ by shape as well as by hue, so the three kinds stay apart for a
// colourblind reader and against the price line they sit on.
const EVENT_SYMBOLS: Record<AssetTimelineEvent['type'], string> = {
  BUY: 'circle',
  SELL: 'diamond',
  INCOME: 'triangle',
}

const colors = computed(() => (props.isDark ? PALETTE.dark : PALETTE.light))
const isSmall = computed(() => containerWidth.value < 640)

const events = computed(() => props.timeline.events ?? [])
const points = computed(() => props.timeline.points ?? [])

const dates = computed<string[]>(() => buildTimelineDates(points.value, events.value))

const priceByDate = computed(() => {
  const map = new Map<string, number>()
  for (const point of points.value) map.set(point.date, Number(point.price))
  return map
})

const largestTrade = computed(() => largestTradeTotal(events.value))

function eventSeriesData(type: AssetTimelineEvent['type']) {
  return events.value
    .filter((event) => event.type === type && event.price != null)
    .map((event) => ({
      value: [event.date, Number(event.price)],
      symbolSize: markerSize(Number(event.total ?? 0), largestTrade.value),
      quantity: Number(event.quantity ?? 0),
      total: Number(event.total ?? 0),
    }))
}

const costBasisByDate = computed<Array<number | null>>(() =>
  buildCostBasisSeries(dates.value, events.value),
)

const hasCostBasis = computed(() => costBasisByDate.value.some((value) => value != null))

const option = computed(() => {
  const palette = colors.value
  const textColor = props.isDark ? '#94a3b8' : '#6b7280'
  const gridColor = props.isDark ? '#1e293b' : '#f3f4f6'
  const axisDates = dates.value

  const scatterSeries = (['BUY', 'SELL', 'INCOME'] as const)
    .map((type) => ({ type, data: eventSeriesData(type) }))
    .filter((series) => series.data.length > 0)
    .map(({ type, data }) => ({
      name: EVENT_LABELS[type],
      type: 'scatter',
      symbol: EVENT_SYMBOLS[type],
      data,
      // A ring in the surface colour keeps overlapping trades readable when a
      // run of buys lands on nearly the same price.
      itemStyle: {
        color: palette[type === 'BUY' ? 'buy' : type === 'SELL' ? 'sell' : 'income'],
        borderColor: palette.ring,
        borderWidth: 2,
      },
      z: 20,
    }))

  const series: Record<string, unknown>[] = [
    {
      name: 'Cours',
      type: 'line',
      data: axisDates.map((date) => priceByDate.value.get(date) ?? null),
      symbol: 'none',
      showSymbol: false,
      // Gaps are quoteless days, not missing money: bridging them keeps one
      // continuous curve for the markers to sit on.
      connectNulls: true,
      lineStyle: { width: 2, color: palette.price },
      itemStyle: { color: palette.price },
      z: 5,
    },
  ]

  if (hasCostBasis.value) {
    series.push({
      name: 'Prix de revient',
      type: 'line',
      data: costBasisByDate.value,
      symbol: 'none',
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 1.5, type: 'dashed', color: palette.costBasis },
      itemStyle: { color: palette.costBasis },
      z: 8,
    })
  }

  series.push(...scatterSeries)

  return {
    backgroundColor: 'transparent',
    legend: {
      show: true,
      bottom: 0,
      type: 'scroll',
      textStyle: { color: textColor, fontSize: 11 },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      pageIconColor: textColor,
      pageTextStyle: { color: textColor },
    },
    grid: {
      top: 16,
      left: isSmall.value ? 52 : 58,
      right: isSmall.value ? 8 : 16,
      bottom: 46,
    },
    xAxis: {
      type: 'category',
      data: axisDates,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        formatter: formatAxisDate,
        color: textColor,
        fontSize: 10,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      // Framed on the data with a little air, never anchored at zero: a price
      // chart's information is the shape of the move, and a zero baseline
      // flattens it into a band at the top of an empty plot.
      scale: true,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor, fontSize: 10, formatter: formatAxisPrice },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'line' },
      backgroundColor: props.isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.92)',
      borderColor: props.isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: props.isDark ? '#e2e8f0' : '#1e293b', fontSize: 12 },
      formatter: formatTooltip,
    },
    // Zoom in place rather than a range slider: the whole point of this chart is
    // the span since the first trade, so it opens on all of it, and a slider
    // pinned at 100% is a full-width bar that only reads as decoration.
    dataZoom: axisDates.length > 10
      ? [{ type: 'inside', throttle: 50, zoomOnMouseWheel: true, moveOnMouseMove: true }]
      : undefined,
    series,
  }
})

function formatAxisDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

/**
 * Prices span cents (a meme coin) to thousands (a share), so the tick keeps
 * significant digits rather than a fixed two decimals that would print 0,00 €
 * down a whole axis.
 */
function formatAxisPrice(value: number): string {
  const magnitude = Math.abs(value)
  if (magnitude >= 1000) return `${(value / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}k€`
  if (magnitude >= 1) return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}€`
  return `${value.toLocaleString('fr-FR', { maximumSignificantDigits: 3 })}€`
}

function formatPrice(value: number): string {
  const magnitude = Math.abs(value)
  const decimals = magnitude >= 1 ? 2 : 6
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: decimals })} €`
}

function formatTooltip(params: unknown): string {
  if (!Array.isArray(params) || params.length === 0) return ''

  const head = params[0] as { axisValue?: string }
  const parsed = new Date(String(head.axisValue ?? ''))
  const date = Number.isNaN(parsed.getTime())
    ? String(head.axisValue ?? '')
    : parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  let tooltip = `<div style="font-weight:600;margin-bottom:4px">${date}</div>`

  for (const raw of params as Array<Record<string, any>>) {
    const seriesName = String(raw.seriesName ?? '')
    const color = String(raw.color ?? '#000')

    if (raw.seriesType === 'scatter') {
      const item = raw.data as { quantity?: number; total?: number; value?: [string, number] }
      const unitPrice = item?.value?.[1]
      const quantity = maskValue(formatNumber(item?.quantity ?? 0, 6))
      const total = maskValue(formatPrice(Math.abs(Number(item?.total ?? 0))))
      tooltip += `<div style="margin-top:3px"><span style="color:${color}">◆</span> <strong>${seriesName}</strong>`
      tooltip += `<div style="padding-left:12px">${quantity} × ${unitPrice != null ? formatPrice(Number(unitPrice)) : '—'} = ${total}</div></div>`
      continue
    }

    if (raw.value == null) continue
    tooltip += `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:3px">`
    tooltip += `<span style="color:${color}">● ${seriesName}</span><strong>${formatPrice(Number(raw.value))}</strong></div>`
  }

  return tooltip
}

/** Price move over the whole curve, for the header badge. */
const performance = computed(() => {
  const series = points.value
  if (series.length < 2) return null

  const first = Number(series[0]?.price ?? 0)
  const last = Number(series[series.length - 1]?.price ?? 0)
  const diff = last - first
  if (Math.abs(first) < 1e-9) return { diff, percent: null }
  return { diff, percent: (diff / Math.abs(first)) * 100 }
})

watch(performance, (value) => emit('update:performance', value), { immediate: true })
</script>

<template>
  <div ref="containerRef" class="w-full h-80" style="touch-action: none;">
    <VChart
      v-if="canRenderChart"
      ref="chartRef"
      :option="option"
      :update-options="updateOptions"
      autoresize
    />
  </div>
</template>

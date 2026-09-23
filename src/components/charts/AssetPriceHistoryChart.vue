<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, TriangleAlert, X } from 'lucide-vue-next'
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
  MARKER_SIZE_RANGE,
  SMALL_SCREEN_MARKER_SIZE_RANGE,
  buildCostBasisSeries,
  buildMarkers,
  buildTimelineDates,
  closeLookup,
  largestTradeTotal,
  markerSize,
  nearestMarker,
  type PlottedMarker,
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

const { formatNumber, formatPercent } = useFormatters()
const { maskValue } = usePrivacyMode()
const { chartRef, containerRef, canRenderChart, containerWidth } = useChartResize()

/**
 * Every component below carries a stable id, so a replaceMerge update is matched
 * to what is already on screen and applied as a change. Without ids ECharts sees
 * brand-new series on each update: selecting a trade redrew the whole curve from
 * the left, and the zoom snapped back to the full range.
 */
const updateOptions = { replaceMerge: ['legend', 'xAxis', 'series', 'dataZoom'] }

/**
 * Both sets were validated with the dataviz palette checker against their own
 * surface rather than flipped from one another: on the dark surface the red and
 * the violet each move a step, while the green holds in both. The cost-basis
 * line is the same slate in both — one step darker read as absent on a phone.
 */
const PALETTE = {
  light: {
    price: '#3b82f6', buy: '#059669', sell: '#dc2626', income: '#7c3aed',
    costBasis: '#94a3b8', ring: '#ffffff', selection: '#0f172a',
  },
  dark: {
    price: '#3b82f6', buy: '#059669', sell: '#ef4444', income: '#8b5cf6',
    costBasis: '#94a3b8', ring: '#0f172a', selection: '#e2e8f0',
  },
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

/** How far from a marker a tap still selects it, in CSS pixels — about a fingertip. */
const TAP_RADIUS_TOUCH = 28
const TAP_RADIUS_POINTER = 16

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

const markers = computed<PlottedMarker[]>(() =>
  buildMarkers(events.value, closeLookup(points.value)),
)

const largestTrade = computed(() => largestTradeTotal(events.value))
const markerRange = computed(() =>
  isSmall.value ? SMALL_SCREEN_MARKER_SIZE_RANGE : MARKER_SIZE_RANGE,
)

function sizeOf(marker: PlottedMarker): number {
  return markerSize(Number(marker.event.total ?? 0), largestTrade.value, markerRange.value)
}

function colorOf(type: AssetTimelineEvent['type']): string {
  const palette = colors.value
  return type === 'BUY' ? palette.buy : type === 'SELL' ? palette.sell : palette.income
}

const costBasisByDate = computed<Array<number | null>>(() =>
  buildCostBasisSeries(dates.value, events.value),
)

const hasCostBasis = computed(() => costBasisByDate.value.some((value) => value != null))

// ── Selection ───────────────────────────────────────────────────────────────

/** Index into `markers`, or -1. The detail card below the chart reads it. */
const selectedIndex = ref(-1)
const selected = computed<PlottedMarker | null>(() => markers.value[selectedIndex.value] ?? null)

const isZoomed = ref(false)

watch(
  () => props.timeline,
  () => {
    selectedIndex.value = -1
    isZoomed.value = false
  },
)

function select(index: number): void {
  selectedIndex.value = index >= 0 && index < markers.value.length ? index : -1
}

const cardRef = ref<HTMLElement | null>(null)

/** Below this, what is left under the card is padding, not content worth a fade. */
const SCROLL_SNAP_TAIL = 32

function scrollParentOf(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
    node = node.parentElement
  }
  return null
}

/**
 * Bring the detail card fully into view once it has opened, scrolling only as
 * far as needed — where it already shows, stepping with the arrows moves nothing.
 *
 * Worked out by hand rather than with scrollIntoView: Chromium treats a card
 * whose box is visible as done even when its scroll margin is not, which left
 * the container's bottom padding unscrolled and its fade lying over the card.
 * When only that padding would remain below, the scroll runs to the end.
 */
watch(selectedIndex, async (index) => {
  if (index < 0) return
  await nextTick()
  const card = cardRef.value
  const scroller = card ? scrollParentOf(card) : null
  if (!card || !scroller) return

  const cardBox = card.getBoundingClientRect()
  const view = scroller.getBoundingClientRect()
  const remaining = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop

  let delta = 0
  if (cardBox.top < view.top) {
    delta = cardBox.top - view.top
  } else if (cardBox.bottom > view.bottom || remaining > 0) {
    const needed = Math.max(0, cardBox.bottom - view.bottom)
    delta = remaining - needed <= SCROLL_SNAP_TAIL ? remaining : needed
  }
  if (Math.abs(delta) < 1) return

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  scroller.scrollBy({ top: delta, behavior: reduceMotion ? 'auto' : 'smooth' })
})

function step(delta: number): void {
  const count = markers.value.length
  if (count === 0) return
  const from = selectedIndex.value < 0 ? (delta > 0 ? -1 : count) : selectedIndex.value
  select(Math.min(Math.max(from + delta, 0), count - 1))
}

/**
 * Pick the trade nearest to where the canvas was tapped or clicked.
 *
 * Done by distance on the whole canvas rather than by ECharts' own item click:
 * a hit on the drawn disc alone leaves an 8 px marker all but untappable, and in
 * a cluster it picks whichever disc happens to be on top. A tap on empty plot
 * clears the selection.
 */
function onCanvasClick(event: { offsetX?: number; offsetY?: number }): void {
  const chart = chartRef.value
  if (!chart || event.offsetX == null || event.offsetY == null) return

  const positions = markers.value.map((marker) => {
    const pixel = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [marker.event.date, marker.y])
    if (!Array.isArray(pixel)) return null
    const [x, y] = pixel as [number, number]
    // A marker scrolled out of a zoomed window still converts to a pixel, just
    // outside the plot; it must not be selectable through the axis labels.
    return chart.containPixel({ gridIndex: 0 }, [x, y]) ? { x, y } : null
  })

  const radius = isSmall.value ? TAP_RADIUS_TOUCH : TAP_RADIUS_POINTER
  select(nearestMarker(positions, { x: event.offsetX, y: event.offsetY }, radius))
}

function onDataZoom(event: { start?: number; end?: number; batch?: Array<{ start?: number; end?: number }> }): void {
  const payload = event.batch?.[0] ?? event
  const start = payload.start ?? 0
  const end = payload.end ?? 100
  isZoomed.value = start > 0.01 || end < 99.99
}

function resetZoom(): void {
  chartRef.value?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })
  isZoomed.value = false
}

// ── Chart option ────────────────────────────────────────────────────────────

const option = computed(() => {
  const palette = colors.value
  const textColor = props.isDark ? '#94a3b8' : '#6b7280'
  const gridColor = props.isDark ? '#1e293b' : '#f3f4f6'
  const axisDates = dates.value

  const scatterSeries = (['BUY', 'SELL', 'INCOME'] as const)
    .map((type) => ({
      type,
      data: markers.value
        .map((marker, index) => ({ marker, index }))
        .filter(({ marker }) => marker.event.type === type)
        .map(({ marker, index }) => ({
          value: [marker.event.date, marker.y],
          symbolSize: sizeOf(marker),
          markerIndex: index,
          price: Number(marker.event.price),
          quantity: Number(marker.event.quantity ?? 0),
          total: Number(marker.event.total ?? 0),
          // An off-market trade rides the curve hollow: visible, but plainly
          // not placed at the price it claims.
          ...(marker.offMarket
            ? { itemStyle: { color: palette.ring, borderColor: colorOf(type), borderWidth: 2, borderType: 'dashed' } }
            : {}),
        })),
    }))
    .filter((series) => series.data.length > 0)
    .map(({ type, data }) => ({
      id: `marker-${type}`,
      name: EVENT_LABELS[type],
      type: 'scatter',
      symbol: EVENT_SYMBOLS[type],
      data,
      // Not clipped to the plot: the first trade sits on the very first date,
      // which is the y-axis itself, and clipping halved its marker.
      clip: false,
      // A ring in the surface colour keeps overlapping trades readable when a
      // run of buys lands on nearly the same price.
      itemStyle: { color: colorOf(type), borderColor: palette.ring, borderWidth: 2 },
      z: 20,
    }))

  const series: Record<string, unknown>[] = [
    {
      id: 'price',
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
      id: 'cost-basis',
      name: 'Prix de revient',
      type: 'line',
      data: costBasisByDate.value,
      symbol: 'none',
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 1.75, type: 'dashed', color: palette.costBasis },
      itemStyle: { color: palette.costBasis },
      z: 8,
    })
  }

  series.push(...scatterSeries)

  const current = selected.value
  if (current) {
    series.push({
      // Unnamed in the legend below, and silent so it never swallows the tap
      // meant for the marker it circles.
      id: 'selection',
      name: '__selection__',
      type: 'scatter',
      silent: true,
      clip: false,
      symbol: EVENT_SYMBOLS[current.event.type],
      symbolSize: sizeOf(current) + 10,
      data: [[current.event.date, current.y]],
      itemStyle: { color: 'transparent', borderColor: palette.selection, borderWidth: 2 },
      tooltip: { show: false },
      z: 30,
    })
  }

  return {
    backgroundColor: 'transparent',
    legend: {
      id: 'legend',
      show: true,
      bottom: 0,
      type: 'scroll',
      data: series
        .map((entry) => String(entry.name))
        .filter((name) => name !== '__selection__'),
      textStyle: { color: textColor, fontSize: 11 },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      pageIconColor: textColor,
      pageTextStyle: { color: textColor },
    },
    // The left edge is kept tight on purpose: ECharts 6 fits the axis labels
    // inside the canvas on its own, so the gutter now hugs "4k€" instead of
    // reserving room for the widest label any asset could need. The right edge
    // leaves room for the radius of a marker on the latest date.
    grid: {
      top: 18,
      left: isSmall.value ? 4 : 8,
      right: isSmall.value ? 14 : 18,
      bottom: 46,
    },
    xAxis: {
      id: 'dates',
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
      scale: true,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor, fontSize: 10, formatter: formatAxisPrice },
    },
    tooltip: {
      // On a phone the detail card below is the reading surface: a floating
      // tooltip there lands under the finger, covers the curve, and repeats
      // what the card already says.
      show: !isSmall.value,
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
      ? [{ id: 'zoom', type: 'inside', throttle: 50, zoomOnMouseWheel: true, moveOnMouseMove: true }]
      : undefined,
    series,
  }
})

// ── Formatting ──────────────────────────────────────────────────────────────

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

function formatPrice(value: number | null | undefined): string {
  const numeric = Number(value)
  if (value == null || !Number.isFinite(numeric)) return '—'
  const decimals = Math.abs(numeric) >= 1 ? 2 : 6
  return `${numeric.toLocaleString('fr-FR', { maximumFractionDigits: decimals })} €`
}

function formatLongDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTooltip(params: unknown): string {
  if (!Array.isArray(params) || params.length === 0) return ''

  const head = params[0] as { axisValue?: string }
  let tooltip = `<div style="font-weight:600;margin-bottom:4px">${formatLongDate(String(head.axisValue ?? ''))}</div>`

  for (const raw of params as Array<Record<string, any>>) {
    const seriesName = String(raw.seriesName ?? '')
    const color = String(raw.color ?? '#000')

    if (raw.seriesType === 'scatter') {
      // The executed price, not the drawn height: an off-market trade is drawn
      // on the curve but must still say what it was booked at.
      const item = raw.data as { quantity?: number; total?: number; price?: number }
      const quantity = maskValue(formatNumber(item?.quantity ?? 0, 6))
      const total = maskValue(formatPrice(Math.abs(Number(item?.total ?? 0))))
      tooltip += `<div style="margin-top:3px"><span style="color:${color}">◆</span> <strong>${seriesName}</strong>`
      tooltip += `<div style="padding-left:12px">${quantity} × ${formatPrice(item?.price)} = ${total}</div></div>`
      continue
    }

    if (raw.value == null) continue
    tooltip += `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:3px">`
    tooltip += `<span style="color:${color}">● ${seriesName}</span><strong>${formatPrice(Number(raw.value))}</strong></div>`
  }

  return tooltip
}

// ── Detail card ─────────────────────────────────────────────────────────────

const AMOUNT_LABELS: Record<AssetTimelineEvent['type'], string> = {
  BUY: 'Montant investi',
  SELL: 'Montant reçu',
  INCOME: 'Montant reçu',
}

const SINCE_LABELS: Record<AssetTimelineEvent['type'], string> = {
  BUY: 'Depuis cet achat',
  SELL: 'Depuis cette vente',
  INCOME: '',
}

/** How far the price has moved since the trade, against its executed price. */
const sinceTrade = computed<number | null>(() => {
  const current = selected.value
  const now = Number(props.timeline.current_price)
  if (!current || current.event.type === 'INCOME' || current.offMarket) return null
  const price = Number(current.event.price)
  if (!Number.isFinite(now) || !Number.isFinite(price) || price <= 0) return null
  return ((now - price) / price) * 100
})

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
  <div class="space-y-3">
    <!-- pan-y hands vertical swipes back to the page, so the modal still
         scrolls over the chart on a phone; horizontal drags and pinches stay
         with the chart for panning and zooming. -->
    <div ref="containerRef" class="price-chart-canvas w-full" style="touch-action: pan-y;">
      <VChart
        v-if="canRenderChart"
        ref="chartRef"
        :option="option"
        :update-options="updateOptions"
        autoresize
        @zr:click="onCanvasClick"
        @datazoom="onDataZoom"
      />
    </div>

    <div v-if="isZoomed" class="flex justify-end">
      <button
        type="button"
        class="text-xs font-medium text-primary hover:underline"
        @click="resetZoom"
      >
        Voir toute la période
      </button>
    </div>

    <!-- Detail of the selected trade. Lives under the chart rather than in a
         floating tooltip: on a phone the finger covers a tooltip, and it
         vanishes on the next touch. -->
    <div
      ref="cardRef"
      class="rounded-secondary border border-surface-border dark:border-surface-dark-border p-3 sm:p-4"
      aria-live="polite"
    >
      <template v-if="selected">
        <!-- The date gets its own line: beside the type, the arrows and the
             close button left it truncated on a phone. -->
        <div class="flex items-start justify-between gap-2 mb-3">
          <div class="flex items-start gap-2 min-w-0">
            <svg class="w-3.5 h-3.5 mt-0.5 shrink-0" viewBox="0 0 14 14" aria-hidden="true">
              <circle v-if="selected.event.type === 'BUY'" cx="7" cy="7" r="6" :fill="colorOf('BUY')" />
              <rect
                v-else-if="selected.event.type === 'SELL'"
                x="2.5" y="2.5" width="9" height="9"
                transform="rotate(45 7 7)" :fill="colorOf('SELL')"
              />
              <polygon v-else points="7,1 13,13 1,13" :fill="colorOf('INCOME')" />
            </svg>
            <div class="min-w-0">
              <p class="text-sm font-semibold leading-tight text-text-main dark:text-text-dark-main">
                {{ EVENT_LABELS[selected.event.type] }}
              </p>
              <p class="text-xs text-text-muted dark:text-text-dark-muted">
                {{ formatLongDate(selected.event.date) }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              class="p-1.5 rounded-secondary text-text-muted dark:text-text-dark-muted hover:bg-surface-active dark:hover:bg-surface-dark-hover disabled:opacity-30"
              :disabled="selectedIndex <= 0"
              aria-label="Opération précédente"
              @click="step(-1)"
            >
              <ChevronLeft class="w-4 h-4" />
            </button>
            <span class="text-xs tabular-nums text-text-muted dark:text-text-dark-muted">
              {{ selectedIndex + 1 }} / {{ markers.length }}
            </span>
            <button
              type="button"
              class="p-1.5 rounded-secondary text-text-muted dark:text-text-dark-muted hover:bg-surface-active dark:hover:bg-surface-dark-hover disabled:opacity-30"
              :disabled="selectedIndex >= markers.length - 1"
              aria-label="Opération suivante"
              @click="step(1)"
            >
              <ChevronRight class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded-secondary text-text-muted dark:text-text-dark-muted hover:bg-surface-active dark:hover:bg-surface-dark-hover"
              aria-label="Fermer le détail"
              @click="select(-1)"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Three columns once the modal is wide: two rows instead of three is
             what lets the whole modal fit a desktop screen without scrolling. -->
        <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 text-xs">
          <div>
            <dt class="text-text-muted dark:text-text-dark-muted">Quantité</dt>
            <dd class="font-mono font-medium text-text-main dark:text-text-dark-main">
              {{ maskValue(formatNumber(selected.event.quantity, 8)) }}
            </dd>
          </div>
          <div>
            <dt class="text-text-muted dark:text-text-dark-muted">{{ AMOUNT_LABELS[selected.event.type] }}</dt>
            <dd class="font-medium text-text-main dark:text-text-dark-main">
              {{ maskValue(formatPrice(Math.abs(Number(selected.event.total ?? 0)))) }}
            </dd>
          </div>
          <div v-if="selected.event.type !== 'INCOME'">
            <dt class="text-text-muted dark:text-text-dark-muted">Prix d'exécution</dt>
            <dd :class="['font-medium', selected.offMarket ? 'text-warning' : 'text-text-main dark:text-text-dark-main']">
              {{ formatPrice(selected.event.price) }}
            </dd>
          </div>
          <div>
            <dt class="text-text-muted dark:text-text-dark-muted">Cours ce jour-là</dt>
            <dd class="font-medium text-text-main dark:text-text-dark-main">{{ formatPrice(selected.close) }}</dd>
          </div>
          <div>
            <dt class="text-text-muted dark:text-text-dark-muted">PRU après</dt>
            <dd class="font-medium text-text-main dark:text-text-dark-main">
              {{ formatPrice(selected.event.cost_basis_after) }}
            </dd>
          </div>
          <div v-if="sinceTrade !== null">
            <dt class="text-text-muted dark:text-text-dark-muted">{{ SINCE_LABELS[selected.event.type] }}</dt>
            <dd :class="['font-semibold', sinceTrade >= 0 ? 'text-success' : 'text-danger']">
              {{ formatPercent(sinceTrade) }}
            </dd>
          </div>
        </dl>

        <p
          v-if="selected.offMarket"
          class="mt-3 flex items-start gap-1.5 text-xs text-warning"
        >
          <TriangleAlert class="w-3.5 h-3.5 mt-px shrink-0" />
          <span>
            Prix d'exécution très éloigné du cours du jour : l'opération est sans doute mal saisie.
            Le point est affiché sur la courbe, en creux.
          </span>
        </p>
      </template>

      <div v-else class="flex items-center justify-between gap-3">
        <p class="text-xs text-text-muted dark:text-text-dark-muted">
          Sélectionnez un point pour voir le détail de l'opération.
        </p>
        <button
          v-if="markers.length"
          type="button"
          class="text-xs font-medium text-primary hover:underline shrink-0"
          @click="select(markers.length - 1)"
        >
          Dernière opération
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * On a phone the chart is sized so that it and an open detail card fit on
 * screen together: tapping a point then scrolls the stats away once, and every
 * later tap reads without scrolling. dvh follows the visible area as Safari's
 * toolbars come and go; 20rem caps it on tall phones.
 */
.price-chart-canvas {
  height: min(20rem, 43dvh);
}

@media (min-width: 640px) {
  .price-chart-canvas {
    height: 20rem;
  }
}
</style>

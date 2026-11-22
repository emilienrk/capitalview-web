import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type VChart from 'vue-echarts'
import { measureSpan, nearestDefinedIndex, type MeasureSpan } from '@/utils/chartMeasure'

type Chart = InstanceType<typeof VChart>

interface PlotRect {
  left: number
  right: number
  top: number
  bottom: number
}

export interface ChartMeasure extends MeasureSpan {
  fromDate: string
  toDate: string
  plot: PlotRect
  fromX: number
  toX: number
  fromY: number
  toY: number
}

/** Below this, a press is a click (a trade marker, the legend) rather than a measure. */
const DRAG_THRESHOLD_PX = 4

/**
 * Change between two dates of a line chart, read by pressing and dragging with
 * the mouse or by laying two fingers on the plot.
 *
 * One finger is left alone on purpose: on a phone it reads the value under it,
 * which is how every history chart already works.
 *
 * Only public ECharts calls are used. The plot rectangle is found by probing
 * `containPixel` outwards from a data point rather than read from the grid
 * model, because the grid's left edge depends on the label width ECharts fits
 * at render time.
 */
export function useChartMeasure(options: {
  chartRef: Ref<Chart | null>
  containerRef: Ref<HTMLElement | null>
  values: () => ReadonlyArray<number | null>
  dates: () => ReadonlyArray<string>
  minBase?: number
}) {
  const plot = ref<PlotRect | null>(null)
  const anchorIndex = ref<number | null>(null)
  const pointerIndex = ref<number | null>(null)
  let pressX = 0
  let dragging = false
  let swallowClick = false

  function insideGrid(chart: Chart, x: number, y: number): boolean {
    return chart.containPixel({ gridIndex: 0 }, [x, y])
  }

  /** Last pixel still inside the plot, walking from `inside` towards `outside`. */
  function edge(test: (pixel: number) => boolean, inside: number, outside: number): number {
    let a = inside
    let b = outside
    for (let i = 0; i < 16 && Math.abs(b - a) > 0.5; i++) {
      const mid = (a + b) / 2
      if (test(mid)) a = mid
      else b = mid
    }
    return a
  }

  function measurePlot(chart: Chart, container: HTMLElement): PlotRect | null {
    const values = options.values()
    const width = container.clientWidth
    const height = container.clientHeight
    const middle = chart.convertFromPixel({ xAxisIndex: 0 }, width / 2)
    if (typeof middle !== 'number' || !Number.isFinite(middle)) return null
    const index = nearestDefinedIndex(values, middle)
    if (index == null) return null
    const seed = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [index, values[index] as number])
    if (!Array.isArray(seed)) return null
    const [sx, sy] = seed as [number, number]
    if (!insideGrid(chart, sx, sy)) return null

    return {
      left: edge((x) => insideGrid(chart, x, sy), sx, 0),
      right: edge((x) => insideGrid(chart, x, sy), sx, width),
      top: edge((y) => insideGrid(chart, sx, y), sy, 0),
      bottom: edge((y) => insideGrid(chart, sx, y), sy, height),
    }
  }

  function indexAt(chart: Chart, rect: PlotRect, x: number): number | null {
    const clamped = Math.min(rect.right, Math.max(rect.left, x))
    const raw = chart.convertFromPixel({ xAxisIndex: 0 }, clamped)
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
    // The window's own ends, so a zoomed chart never snaps to a hidden date.
    const first = chart.convertFromPixel({ xAxisIndex: 0 }, rect.left)
    const last = chart.convertFromPixel({ xAxisIndex: 0 }, rect.right)
    return nearestDefinedIndex(options.values(), raw, Math.ceil(first), Math.floor(last))
  }

  function localPoint(container: HTMLElement, clientX: number, clientY: number): [number, number] {
    const box = container.getBoundingClientRect()
    return [clientX - box.left, clientY - box.top]
  }

  function begin(chart: Chart, container: HTMLElement, x: number, y: number): boolean {
    const rect = measurePlot(chart, container)
    if (!rect || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return false
    plot.value = rect
    return true
  }

  function reset(): void {
    plot.value = null
    anchorIndex.value = null
    pointerIndex.value = null
    dragging = false
    document.body.style.removeProperty('user-select')
  }

  // ── Mouse: press, drag, release ────────────────────────────────────────────

  function onPointerDown(event: PointerEvent): void {
    swallowClick = false
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    const chart = options.chartRef.value
    const container = options.containerRef.value
    if (!chart || !container) return
    const [x, y] = localPoint(container, event.clientX, event.clientY)
    if (!begin(chart, container, x, y)) return
    anchorIndex.value = indexAt(chart, plot.value!, x)
    pressX = x
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(event: PointerEvent): void {
    const chart = options.chartRef.value
    const container = options.containerRef.value
    if (!chart || !container || !plot.value) return
    const [x] = localPoint(container, event.clientX, event.clientY)
    if (!dragging) {
      if (Math.abs(x - pressX) < DRAG_THRESHOLD_PX) return
      dragging = true
      // The drag may leave the chart and sweep over the page's text.
      document.body.style.userSelect = 'none'
    }
    pointerIndex.value = indexAt(chart, plot.value, x)
  }

  function onPointerUp(): void {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    swallowClick = dragging
    reset()
  }

  // ── Touch: two fingers ─────────────────────────────────────────────────────

  function onTouch(event: TouchEvent): void {
    const chart = options.chartRef.value
    const container = options.containerRef.value
    if (!chart || !container) return
    if (event.touches.length !== 2) {
      if (plot.value) reset()
      return
    }
    const [a, b] = [event.touches[0]!, event.touches[1]!]
    const [ax, ay] = localPoint(container, a.clientX, a.clientY)
    const [bx, by] = localPoint(container, b.clientX, b.clientY)
    if (!plot.value && !begin(chart, container, (ax + bx) / 2, (ay + by) / 2)) return
    anchorIndex.value = indexAt(chart, plot.value!, ax)
    pointerIndex.value = indexAt(chart, plot.value!, bx)
  }

  function attach(container: HTMLElement): void {
    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('touchstart', onTouch, { passive: true })
    container.addEventListener('touchmove', onTouch, { passive: true })
    container.addEventListener('touchend', onTouch, { passive: true })
    container.addEventListener('touchcancel', onTouch, { passive: true })
  }

  function detach(container: HTMLElement): void {
    container.removeEventListener('pointerdown', onPointerDown)
    container.removeEventListener('touchstart', onTouch)
    container.removeEventListener('touchmove', onTouch)
    container.removeEventListener('touchend', onTouch)
    container.removeEventListener('touchcancel', onTouch)
  }

  watch(options.containerRef, (next, previous) => {
    if (previous) detach(previous)
    if (next) attach(next)
  }, { immediate: true })

  onBeforeUnmount(() => {
    if (options.containerRef.value) detach(options.containerRef.value)
    onPointerUp()
  })

  const measure = computed<ChartMeasure | null>(() => {
    const chart = options.chartRef.value
    const rect = plot.value
    const a = anchorIndex.value
    const b = pointerIndex.value
    if (!chart || !rect || a == null || b == null || a === b) return null

    const values = options.values()
    const span = measureSpan(values, a, b, options.minBase)
    if (!span) return null

    const dates = options.dates()
    const from = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [span.fromIndex, span.fromValue])
    const to = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [span.toIndex, span.toValue])
    if (!Array.isArray(from) || !Array.isArray(to)) return null

    return {
      ...span,
      fromDate: dates[span.fromIndex] ?? '',
      toDate: dates[span.toIndex] ?? '',
      plot: rect,
      fromX: from[0]!,
      fromY: from[1]!,
      toX: to[0]!,
      toY: to[1]!,
    }
  })

  /**
   * True once for the click the browser fires at the end of a measuring drag,
   * so a chart that selects on click does not also treat the release as a tap.
   */
  function takeClick(): boolean {
    const swallowed = swallowClick
    swallowClick = false
    return swallowed
  }

  return { measure, takeClick }
}

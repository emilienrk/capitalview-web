import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type VChart from 'vue-echarts'

/**
 * Handles the ResizeObserver lifecycle and the `canRenderChart` guard
 * that prevents ECharts from rendering inside a zero-dimension container.
 *
 * Also tracks `containerWidth` (in px) so computed chart options can
 * apply responsive tweaks (e.g. grid margins).
 *
 * @example
 * ```ts
 * const { containerRef, chartRef, canRenderChart, containerWidth } = useChartResize()
 * ```
 */
export function useChartResize() {
  const chartRef = ref<InstanceType<typeof VChart> | null>(null)
  const containerRef = ref<HTMLElement | null>(null)
  const canRenderChart = ref(false)
  const containerWidth = ref(0)

  let resizeObserver: ResizeObserver | null = null

  function syncChartVisibilityAndSize(): void {
    const container = containerRef.value
    if (!container) return

    const hasSize = container.clientWidth > 0 && container.clientHeight > 0
    if (!hasSize) return

    containerWidth.value = container.clientWidth
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

  return { chartRef, containerRef, canRenderChart, containerWidth, syncChartVisibilityAndSize }
}

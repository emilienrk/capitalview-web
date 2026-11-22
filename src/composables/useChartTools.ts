import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type VChart from 'vue-echarts'

const TRADES_KEY = 'chart_show_trades'

// Module-level, like the privacy mode: one switch for every chart of the app.
const showTrades = ref<boolean>(localStorage.getItem(TRADES_KEY) !== 'false')

watch(showTrades, (value) => localStorage.setItem(TRADES_KEY, String(value)))

/**
 * What the gear menu of a history chart drives: the trade lines, a full-screen
 * view and a PNG of the curve.
 *
 * Full screen is a fixed overlay rather than the Fullscreen API, which iPhone
 * Safari only grants to videos.
 */
export function useChartTools(chartRef: Ref<InstanceType<typeof VChart> | null>) {
  const fullscreen = ref(false)

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') fullscreen.value = false
  }

  watch(fullscreen, (on) => {
    document.body.style.overflow = on ? 'hidden' : ''
    if (on) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    if (fullscreen.value) document.body.style.overflow = ''
    window.removeEventListener('keydown', onKeydown)
  })

  function downloadPng(backgroundColor: string): void {
    // The range slider is a control, not part of the curve.
    const url = chartRef.value?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor, excludeComponents: ['dataZoom'] })
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = `capitalview-courbe-${new Date().toISOString().slice(0, 10)}.png`
    link.click()
  }

  return { showTrades, fullscreen, downloadPng }
}

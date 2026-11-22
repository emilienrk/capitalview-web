import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type VChart from 'vue-echarts'

/** `fit` hugs the data, `zero` starts the axis at 0 €, `log` gives equal heights to equal percentages. */
export type AxisMode = 'fit' | 'zero' | 'log'

function stored<T extends string>(key: string, fallback: T, allowed: readonly T[]): Ref<T> {
  const saved = localStorage.getItem(key) as T | null
  const value = ref(saved && allowed.includes(saved) ? saved : fallback) as Ref<T>
  watch(value, (next) => localStorage.setItem(key, next))
  return value
}

// Module-level, like the privacy mode: one setting for every chart of the app.
const tradesSetting = stored('chart_show_trades', 'true', ['true', 'false'] as const)
const legendSetting = stored('chart_show_legend', 'true', ['true', 'false'] as const)
const axisMode = stored<AxisMode>('chart_axis_mode', 'fit', ['fit', 'zero', 'log'])

function flag(setting: Ref<'true' | 'false'>) {
  return computed({
    get: () => setting.value === 'true',
    set: (on: boolean) => { setting.value = on ? 'true' : 'false' },
  })
}

/**
 * What the gear menu of a history chart drives: trade lines, the value axis,
 * the legend, a full-screen view and a PNG of the curve.
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

  return {
    showTrades: flag(tradesSetting),
    showLegend: flag(legendSetting),
    axisMode,
    fullscreen,
    downloadPng,
  }
}

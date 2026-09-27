import { computed } from 'vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { appearanceRevision } from '@/theme/appearance'

export interface ChartTheme {
  fontFamily: string
  barRadius: number
  text: string
  grid: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
  surface: string
  zoomTrack: string
  zoomFill: string
  zoomHandle: string
  label: string
  accent: string
  neutral: string
  reference: string
  positive: string
  negative: string
  warning: string
  roles: {
    total: string
    bank: string
    stock: string
    crypto: string
    placements: string
    assets: string
  }
  categorical: string[]
}

let probe: CanvasRenderingContext2D | null = null

// ECharts parses neither oklch() nor color-mix(); let the browser resolve the
// token by painting one pixel and read it back as rgba().
function resolveColor(value: string): string {
  if (!probe) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    probe = canvas.getContext('2d', { willReadFrequently: true })
  }
  if (!probe || !value) return value
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = value
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a! / 255).toFixed(3)})`
}

/** `weight`% of `color` over `base`, for tints and ramps drawn from a theme color. */
export function mixColor(color: string, base: string, weight: number): string {
  return resolveColor(`color-mix(in oklab, ${color} ${weight}%, ${base})`)
}

function readTheme(): ChartTheme {
  const styles = getComputedStyle(document.documentElement)
  const raw = (name: string) => styles.getPropertyValue(name).trim()
  const color = (name: string) => resolveColor(raw(name))

  return {
    fontFamily: raw('--cv-font-sans'),
    barRadius: Number(raw('--cv-chart-bar-radius')) || 0,
    text: color('--cv-chart-text'),
    grid: color('--cv-chart-grid'),
    tooltipBg: color('--cv-chart-tooltip-bg'),
    tooltipBorder: color('--cv-chart-tooltip-border'),
    tooltipText: color('--cv-chart-tooltip-text'),
    surface: color('--cv-chart-surface'),
    zoomTrack: color('--cv-chart-zoom-track'),
    zoomFill: color('--cv-chart-zoom-fill'),
    zoomHandle: color('--cv-chart-zoom-handle'),
    label: color('--cv-chart-label'),
    accent: color('--cv-chart-accent'),
    neutral: color('--cv-chart-neutral'),
    reference: color('--cv-chart-reference'),
    positive: color('--cv-chart-positive'),
    negative: color('--cv-chart-negative'),
    warning: color('--cv-chart-warning'),
    roles: {
      total: color('--cv-chart-total'),
      bank: color('--cv-chart-bank'),
      stock: color('--cv-chart-stock'),
      crypto: color('--cv-chart-crypto'),
      placements: color('--cv-chart-placements'),
      assets: color('--cv-chart-assets'),
    },
    categorical: Array.from({ length: 8 }, (_, i) => color(`--cv-chart-${i + 1}`)),
  }
}

/** Chart colors and type from the active theme tokens, refreshed on dark-mode or appearance switches. */
export function useChartTheme() {
  const { isDark } = useDarkMode()
  return computed<ChartTheme>(() => {
    void isDark.value
    void appearanceRevision.value
    return readTheme()
  })
}

/**
 * Entrance shared by every chart. ECharts' default is a one-second draw that
 * replays on each mount, and these charts are opened daily to read a figure.
 */
export function chartAnimation() {
  const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return reduce
    ? { animation: false }
    : { animationDuration: 300, animationEasing: 'cubicOut' as const }
}

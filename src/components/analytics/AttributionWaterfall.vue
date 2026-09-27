<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useChartResize } from '@/composables/useChartResize'
import { chartAnimation, useChartTheme } from '@/composables/useChartTheme'
import type { CounterfactualResponse } from '@/types'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent])

const props = defineProps<{ bridge: CounterfactualResponse; isDark?: boolean }>()

const { chartRef, containerRef, canRenderChart, containerWidth } = useChartResize()
const chartTheme = useChartTheme()
const updateOptions = { replaceMerge: ['xAxis', 'yAxis', 'series'] }

interface Bar {
  label: string
  base: number
  delta: number
  total: number
  isTotal: boolean
}

/**
 * Bars are the decision terms cumulated from zero, not absolute portfolio values.
 *
 * Anchoring on the baseline would be unreadable: a few hundred euros of timing
 * next to a six-figure portfolio renders as a hairline, and a chart nobody can
 * read is worse than no chart. The absolute endpoints are stated as text beside
 * it, so nothing is hidden — only rescaled to the quantity in question.
 */
const bars = computed<Bar[]>(() => {
  const out: Bar[] = []
  let running = 0

  for (const step of props.bridge.steps) {
    const delta = Number(step.amount)
    out.push({
      label: step.label,
      base: delta >= 0 ? running : running + delta,
      delta: Math.abs(delta),
      total: delta,
      isTotal: false,
    })
    running += delta
  }

  // The residual is only drawn when something is genuinely unexplained; hiding a
  // non-zero one would make the chart tidier than the numbers deserve.
  const residual = Number(props.bridge.residual)
  if (Math.abs(residual) >= 0.01) {
    out.push({
      label: 'Non expliqué',
      base: residual >= 0 ? running : running + residual,
      delta: Math.abs(residual),
      total: residual,
      isTotal: false,
    })
    running += residual
  }

  out.push({ label: 'Total', base: running >= 0 ? 0 : running, delta: Math.abs(running), total: running, isTotal: true })
  return out
})

function formatEur(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} €`
}

const option = computed(() => {
  const theme = chartTheme.value
  const textColor = theme.text
  const gridColor = theme.grid
  const neutral = theme.neutral
  const isSmall = containerWidth.value < 640

  return {
    ...chartAnimation(),
    backgroundColor: 'transparent',
    textStyle: { fontFamily: theme.fontFamily },
    grid: { top: 16, left: isSmall ? 46 : 60, right: 12, bottom: isSmall ? 76 : 60 },
    xAxis: {
      type: 'category',
      data: bars.value.map((b) => b.label),
      axisLabel: {
        color: textColor,
        fontSize: 10,
        interval: 0,
        rotate: isSmall ? 45 : 24,
        width: 90,
        overflow: 'truncate',
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: textColor, fontSize: 11, formatter: formatEur },
      splitLine: { lineStyle: { color: gridColor } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      confine: true,
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      textStyle: { color: theme.tooltipText, fontSize: 12, fontFamily: theme.fontFamily },
      formatter: (params: any[]) => {
        const index = params?.[0]?.dataIndex ?? 0
        const bar = bars.value[index]
        if (!bar) return ''
        const sign = !bar.isTotal && bar.total > 0 ? '+' : ''
        return `<div style="font-weight:600">${bar.label}</div>${sign}${formatEur(bar.total)}`
      },
    },
    series: [
      {
        type: 'bar',
        stack: 'bridge',
        itemStyle: { color: 'transparent' },
        emphasis: { itemStyle: { color: 'transparent' } },
        silent: true,
        data: bars.value.map((b) => b.base),
      },
      {
        type: 'bar',
        stack: 'bridge',
        barMaxWidth: 44,
        itemStyle: {
          // Capped: the default style's 6px rounds these narrow bars off.
          borderRadius: [Math.min(theme.barRadius, 3), Math.min(theme.barRadius, 3), 0, 0],
          color: (params: any) => {
            const bar = bars.value[params.dataIndex]
            if (!bar) return neutral
            if (bar.isTotal) return neutral
            return bar.total >= 0 ? theme.positive : theme.negative
          },
        },
        data: bars.value.map((b) => b.delta),
      },
    ],
  }
})
</script>

<template>
  <div ref="containerRef" class="w-full h-80" style="touch-action: pan-y;">
    <VChart
      v-if="canRenderChart"
      ref="chartRef"
      :option="option"
      :update-options="updateOptions"
      autoresize
      class="w-full h-full"
    />
  </div>
</template>

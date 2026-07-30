<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useChartResize } from '@/composables/useChartResize'
import type { CounterfactualResponse } from '@/types'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent])

const props = defineProps<{ bridge: CounterfactualResponse; isDark?: boolean }>()

const { chartRef, containerRef, canRenderChart, containerWidth } = useChartResize()
const updateOptions = { replaceMerge: ['xAxis', 'yAxis', 'series'] }

interface Bar {
  label: string
  base: number
  delta: number
  total: number
  isTotal: boolean
}

/** Stack an invisible base under each floating bar to draw a waterfall. */
const bars = computed<Bar[]>(() => {
  const baseline = Number(props.bridge.baseline)
  const out: Bar[] = [
    { label: 'Robot', base: 0, delta: baseline, total: baseline, isTotal: true },
  ]

  let running = baseline
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

  out.push({ label: 'Ton portefeuille', base: 0, delta: running, total: running, isTotal: true })
  return out
})

function formatEur(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} €`
}

const option = computed(() => {
  const textColor = props.isDark ? '#94a3b8' : '#6b7280'
  const gridColor = props.isDark ? '#1e293b' : '#f3f4f6'
  const tooltipBg = props.isDark ? '#0f172a' : '#ffffff'
  const tooltipBorder = props.isDark ? '#334155' : '#e5e7eb'
  const tooltipText = props.isDark ? '#f1f5f9' : '#111827'
  const neutral = props.isDark ? '#475569' : '#94a3b8'
  const isSmall = containerWidth.value < 640

  return {
    backgroundColor: 'transparent',
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
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipText, fontSize: 12 },
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
          borderRadius: [3, 3, 0, 0],
          color: (params: any) => {
            const bar = bars.value[params.dataIndex]
            if (!bar) return neutral
            if (bar.isTotal) return neutral
            return bar.total >= 0 ? '#16a34a' : '#dc2626'
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

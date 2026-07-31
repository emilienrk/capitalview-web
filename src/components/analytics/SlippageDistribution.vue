<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BoxplotChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useChartResize } from '@/composables/useChartResize'
import type { SlippageDistributionOut } from '@/types'

use([CanvasRenderer, BoxplotChart, GridComponent, TooltipComponent])

const props = defineProps<{ distribution: SlippageDistributionOut; isDark?: boolean }>()

const { chartRef, containerRef, canRenderChart } = useChartResize()
const updateOptions = { replaceMerge: ['xAxis', 'yAxis', 'series'] }

/** ECharts boxplot order: min, Q1, median, Q3, max. */
const box = computed<[number, number, number, number, number]>(() => [
  Number(props.distribution.minimum),
  Number(props.distribution.q1),
  Number(props.distribution.median),
  Number(props.distribution.q3),
  Number(props.distribution.maximum),
])

function formatBps(value: number): string {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded} bps`
}

const option = computed(() => {
  const textColor = props.isDark ? '#94a3b8' : '#6b7280'
  const gridColor = props.isDark ? '#1e293b' : '#f3f4f6'
  const tooltipBg = props.isDark ? '#0f172a' : '#ffffff'
  const tooltipBorder = props.isDark ? '#334155' : '#e5e7eb'
  const tooltipText = props.isDark ? '#f1f5f9' : '#111827'

  return {
    backgroundColor: 'transparent',
    grid: { top: 16, left: 64, right: 16, bottom: 28 },
    xAxis: {
      type: 'value',
      axisLabel: { color: textColor, fontSize: 11, formatter: formatBps },
      splitLine: { lineStyle: { color: gridColor } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      data: ['Par ordre'],
      axisLabel: { color: textColor, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipText, fontSize: 12 },
      formatter: () => {
        const [min, q1, median, q3, max] = box.value
        return [
          `<div style="font-weight:600">Écart au prix moyen du mois</div>`,
          `Maximum : ${formatBps(max)}`,
          `Q3 : ${formatBps(q3)}`,
          `Médiane : ${formatBps(median)}`,
          `Q1 : ${formatBps(q1)}`,
          `Minimum : ${formatBps(min)}`,
        ].join('<br/>')
      },
    },
    series: [
      {
        type: 'boxplot',
        data: [box.value],
        boxWidth: [20, 48],
        itemStyle: {
          color: props.isDark ? '#1e293b' : '#eef2ff',
          borderColor: '#6366f1',
        },
      },
    ],
  }
})
</script>

<template>
  <div ref="containerRef" class="w-full h-40" style="touch-action: pan-y;">
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

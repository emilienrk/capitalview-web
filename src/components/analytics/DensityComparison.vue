<script setup lang="ts">
/**
 * Where the euros land versus where the days sit.
 *
 * Both series are shares, not counts: forty purchases next to seven hundred
 * sessions would otherwise draw as a flat line beside a mountain, and the whole
 * point is the shift between the two shapes.
 */
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useChartResize } from '@/composables/useChartResize'
import type { DensityBinOut } from '@/types'

use([CanvasRenderer, BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent])

const props = defineProps<{ density: DensityBinOut[]; isDark?: boolean }>()

const { chartRef, containerRef, canRenderChart } = useChartResize()
const updateOptions = { replaceMerge: ['xAxis', 'yAxis', 'series'] }

const labels = computed(() =>
  props.density.map((bin) => `${(Number(bin.centre) * 100).toFixed(1)} %`),
)

const option = computed(() => {
  const textColor = props.isDark ? '#94a3b8' : '#6b7280'
  const gridColor = props.isDark ? '#1e293b' : '#f3f4f6'
  const tooltipBg = props.isDark ? '#0f172a' : '#ffffff'
  const tooltipBorder = props.isDark ? '#334155' : '#e5e7eb'
  const tooltipText = props.isDark ? '#f1f5f9' : '#111827'

  return {
    backgroundColor: 'transparent',
    grid: { top: 32, left: 48, right: 16, bottom: 40 },
    legend: {
      top: 0,
      textStyle: { color: textColor, fontSize: 11 },
      data: ['Tes euros', "Un jour au hasard"],
    },
    xAxis: {
      type: 'category',
      data: labels.value,
      name: 'Écart au plus haut',
      nameLocation: 'middle',
      nameGap: 26,
      nameTextStyle: { color: textColor, fontSize: 10 },
      axisLabel: { color: textColor, fontSize: 10, rotate: 40 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: textColor,
        fontSize: 10,
        formatter: (value: number) => `${Math.round(value * 100)} %`,
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipText, fontSize: 12 },
    },
    series: [
      {
        name: 'Tes euros',
        type: 'bar',
        data: props.density.map((bin) => Number(bin.purchase_share)),
        itemStyle: { color: '#6366f1' },
      },
      {
        name: "Un jour au hasard",
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: props.density.map((bin) => Number(bin.session_share)),
        lineStyle: { color: '#94a3b8', width: 2 },
      },
    ],
  }
})
</script>

<template>
  <div ref="containerRef" class="h-56 w-full" style="touch-action: pan-y;">
    <VChart
      v-if="canRenderChart"
      ref="chartRef"
      :option="option"
      :update-options="updateOptions"
      autoresize
      class="h-full w-full"
    />
  </div>
</template>

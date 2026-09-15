<script setup lang="ts">
/** Income against expenses, one pair of bars per completed month; a click opens the month. */
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useChartResize } from '@/composables/useChartResize'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps<{
  months: Array<{ period: string; income: number; expenses: number }>
  /** Formats an amount for the axis and the tooltip, privacy mode included. */
  format: (value: number) => string
  isDark?: boolean
}>()

const emit = defineEmits<{ select: [period: string] }>()

const { chartRef, containerRef, canRenderChart, containerWidth } = useChartResize()
const updateOptions = { replaceMerge: ['xAxis', 'yAxis', 'series'] }

function monthLabel(period: string): string {
  const [year, month] = period.split('-').map(Number)
  return new Date(year!, month! - 1, 1).toLocaleDateString('fr-FR', { month: 'short' })
}

const option = computed(() => {
  const textColor = props.isDark ? '#94a3b8' : '#6b7280'
  const gridColor = props.isDark ? '#1e293b' : '#f3f4f6'
  const tooltipBg = props.isDark ? '#0f172a' : '#ffffff'
  const tooltipBorder = props.isDark ? '#334155' : '#e5e7eb'
  const tooltipText = props.isDark ? '#f1f5f9' : '#111827'
  const isSmall = containerWidth.value < 640

  return {
    backgroundColor: 'transparent',
    legend: {
      top: 0,
      textStyle: { color: textColor, fontSize: 11 },
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 6,
    },
    grid: { top: 36, left: isSmall ? 44 : 64, right: isSmall ? 4 : 12, bottom: 8, containLabel: false },
    xAxis: {
      type: 'category',
      data: props.months.map((m) => monthLabel(m.period)),
      axisLabel: { color: textColor, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: textColor, fontSize: 11, formatter: (value: number) => props.format(value) },
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
      formatter: (params: Array<{ dataIndex: number }>) => {
        const month = props.months[params[0]?.dataIndex ?? -1]
        if (!month) return ''
        return `<div style="font-weight:600;margin-bottom:6px;text-transform:capitalize">${monthLabel(month.period)} ${month.period.slice(0, 4)}</div>
<div>Entrées : <strong>${props.format(month.income)}</strong></div>
<div>Dépenses : <strong>${props.format(month.expenses)}</strong></div>`
      },
    },
    series: [
      {
        name: 'Entrées',
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
        data: props.months.map((m) => Number(m.income)),
      },
      {
        name: 'Dépenses',
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] },
        data: props.months.map((m) => Number(m.expenses)),
      },
    ],
  }
})

function handleClick(event: { dataIndex?: number }): void {
  const month = event.dataIndex !== undefined ? props.months[event.dataIndex] : undefined
  if (month) emit('select', month.period)
}
</script>

<template>
  <div ref="containerRef" class="w-full h-72 cursor-pointer" style="touch-action: pan-y;">
    <VChart
      v-if="canRenderChart"
      ref="chartRef"
      :option="option"
      :update-options="updateOptions"
      autoresize
      class="w-full h-full"
      @click="handleClick"
    />
  </div>
</template>

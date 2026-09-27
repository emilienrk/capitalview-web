<script setup lang="ts">
/** Income against expenses, one pair of bars per completed month; a click opens the month. */
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useChartResize } from '@/composables/useChartResize'
import { chartAnimation, useChartTheme } from '@/composables/useChartTheme'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps<{
  months: Array<{ period: string; income: number; expenses: number; atypical?: boolean }>
  /** Formats an amount for the axis and the tooltip, privacy mode included. */
  format: (value: number) => string
  isDark?: boolean
}>()

const emit = defineEmits<{ select: [period: string] }>()

const { chartRef, containerRef, canRenderChart, containerWidth } = useChartResize()
const chartTheme = useChartTheme()
const updateOptions = { replaceMerge: ['xAxis', 'yAxis', 'series'] }

function monthLabel(period: string): string {
  const [year, month] = period.split('-').map(Number)
  return new Date(year!, month! - 1, 1).toLocaleDateString('fr-FR', { month: 'short' })
}

const option = computed(() => {
  const theme = chartTheme.value
  const textColor = theme.text
  const gridColor = theme.grid
  // Capped: the default style's 6px rounds these narrow bars off.
  const barRadius = [Math.min(theme.barRadius, 4), Math.min(theme.barRadius, 4), 0, 0]
  const isSmall = containerWidth.value < 640

  return {
    ...chartAnimation(),
    backgroundColor: 'transparent',
    textStyle: { fontFamily: theme.fontFamily },
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
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      textStyle: { color: theme.tooltipText, fontSize: 12, fontFamily: theme.fontFamily },
      formatter: (params: Array<{ dataIndex: number }>) => {
        const month = props.months[params[0]?.dataIndex ?? -1]
        if (!month) return ''
        return `<div style="font-weight:600;margin-bottom:6px;text-transform:capitalize">${monthLabel(month.period)} ${month.period.slice(0, 4)}</div>
<div>Entrées : <strong>${props.format(month.income)}</strong></div>
<div>Dépenses : <strong>${props.format(month.expenses)}</strong></div>${month.atypical ? '<div style="margin-top:4px;color:${theme.warning}">Mois inhabituel</div>' : ''}`
      },
    },
    series: [
      {
        name: 'Entrées',
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: { color: theme.positive, borderRadius: barRadius },
        data: props.months.map((m) => Number(m.income)),
      },
      {
        name: 'Dépenses',
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: { color: theme.negative, borderRadius: barRadius },
        // An unusual month stands out in amber, the tooltip says why.
        data: props.months.map((m) => (m.atypical
          ? { value: Number(m.expenses), itemStyle: { color: theme.warning } }
          : Number(m.expenses))),
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

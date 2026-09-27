<script setup lang="ts">
/**
 * The selection over time: bars stacked by type or by the heaviest
 * counterparts, or the period added up month after month against the same
 * months a year earlier. A click on a month narrows the period to it.
 */
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'

import { useChartResize } from '@/composables/useChartResize'
import { mixColor, useChartTheme } from '@/composables/useChartTheme'
import { OTHERS, monthLabel, type TimeSeries } from '@/utils/ledger'

use([CanvasRenderer, BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps<{
  series: TimeSeries | null
  cumulative: { periods: string[]; current: number[]; lastYear: number[] } | null
  format: (value: number) => string
  isDark?: boolean
}>()

const emit = defineEmits<{ 'select-month': [period: string] }>()

const { chartRef, containerRef, canRenderChart, containerWidth } = useChartResize()
const chartTheme = useChartTheme()
const updateOptions = { replaceMerge: ['xAxis', 'yAxis', 'series', 'legend'] }


function bucketLabel(bucket: string, granularity: 'week' | 'month'): string {
  if (granularity === 'month') return monthLabel(bucket).replace('.', '')
  const [year, month, day] = bucket.split('-').map(Number)
  return new Date(year!, month! - 1, day!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const option = computed(() => {
  const theme = chartTheme.value
  const textColor = theme.text
  const gridColor = theme.grid
  const typeColors: Record<string, string> = {
    INCOME: theme.positive,
    EXPENSE: theme.negative,
    SAVING: theme.accent,
    // The blue of the set: the teal next to it reads as the income green.
    INVESTMENT: theme.roles.bank,
  }
  // Counterparts are not gains or losses: they take the categorical set, past
  // the lead hue that SAVING already holds.
  const groupColors = theme.categorical.slice(1)
  const isSmall = containerWidth.value < 640
  const base = {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: theme.fontFamily },
    legend: { top: 0, type: 'scroll', textStyle: { color: textColor, fontSize: 11 }, icon: 'roundRect', itemWidth: 10, itemHeight: 6 },
    grid: { top: 36, left: isSmall ? 48 : 72, right: 8, bottom: 8, containLabel: false },
    yAxis: {
      type: 'value',
      axisLabel: { color: textColor, fontSize: 11, formatter: (value: number) => props.format(value) },
      splitLine: { lineStyle: { color: gridColor } },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      textStyle: { color: theme.tooltipText, fontSize: 12, fontFamily: theme.fontFamily },
      valueFormatter: (value: number) => props.format(Number(value)),
    },
  }

  if (props.cumulative) {
    const labels = props.cumulative.periods.map((p) => monthLabel(p).replace('.', ''))
    return {
      ...base,
      xAxis: { type: 'category', data: labels, axisLabel: { color: textColor, fontSize: 11 }, axisTick: { show: false }, axisLine: { show: false } },
      series: [
        // itemStyle colours the legend, lineStyle only the line.
        { name: 'Un an avant', type: 'line', smooth: true, showSymbol: false, itemStyle: { color: textColor }, lineStyle: { type: 'dashed', width: 2, color: textColor }, data: props.cumulative.lastYear },
        { name: 'Période', type: 'line', smooth: true, showSymbol: false, itemStyle: { color: theme.accent }, lineStyle: { width: 3, color: theme.accent }, areaStyle: { color: mixColor(theme.accent, 'transparent', 12) }, data: props.cumulative.current },
      ],
    }
  }

  const series = props.series
  if (!series) return base
  let groupIndex = 0
  return {
    ...base,
    xAxis: {
      type: 'category',
      data: series.buckets.map((bucket) => bucketLabel(bucket, series.granularity)),
      axisLabel: { color: textColor, fontSize: 11, hideOverlap: true },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: series.series.map((s) => ({
      name: s.label,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 28,
      itemStyle: {
        color: typeColors[s.key] ?? (s.key === OTHERS ? theme.neutral : groupColors[groupIndex++ % groupColors.length]),
      },
      emphasis: { focus: 'series' },
      data: s.values.map((value) => Math.round(value * 100) / 100),
    })),
  }
})

function handleClick(event: { dataIndex?: number }): void {
  const series = props.series
  if (props.cumulative || !series || series.granularity !== 'month' || event.dataIndex === undefined) return
  const period = series.buckets[event.dataIndex]
  if (period) emit('select-month', period)
}
</script>

<template>
  <div ref="containerRef" class="w-full h-72 sm:h-80" style="touch-action: pan-y;">
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

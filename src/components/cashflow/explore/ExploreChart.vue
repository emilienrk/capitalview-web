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
const updateOptions = { replaceMerge: ['xAxis', 'yAxis', 'series', 'legend'] }

const TYPE_COLORS: Record<string, string> = {
  INCOME: '#10b981',
  EXPENSE: '#ef4444',
  SAVING: '#6366f1',
  INVESTMENT: '#0ea5e9',
}
const GROUP_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#0ea5e9']

function bucketLabel(bucket: string, granularity: 'week' | 'month'): string {
  if (granularity === 'month') return monthLabel(bucket).replace('.', '')
  const [year, month, day] = bucket.split('-').map(Number)
  return new Date(year!, month! - 1, day!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const option = computed(() => {
  const textColor = props.isDark ? '#94a3b8' : '#6b7280'
  const gridColor = props.isDark ? '#1e293b' : '#f3f4f6'
  const isSmall = containerWidth.value < 640
  const base = {
    backgroundColor: 'transparent',
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
      backgroundColor: props.isDark ? '#0f172a' : '#ffffff',
      borderColor: props.isDark ? '#334155' : '#e5e7eb',
      textStyle: { color: props.isDark ? '#f1f5f9' : '#111827', fontSize: 12 },
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
        { name: 'Période', type: 'line', smooth: true, showSymbol: false, itemStyle: { color: '#6366f1' }, lineStyle: { width: 3, color: '#6366f1' }, areaStyle: { color: 'rgba(99,102,241,0.12)' }, data: props.cumulative.current },
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
        color: TYPE_COLORS[s.key] ?? (s.key === OTHERS ? (props.isDark ? '#475569' : '#cbd5e1') : GROUP_COLORS[groupIndex++ % GROUP_COLORS.length]),
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

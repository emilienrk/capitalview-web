<script setup lang="ts">
/**
 * What recurring payments or income weighed, month by month: one stacked bar
 * a month, one colour per recurring, so a rent that moved from one landlord to
 * the next reads as one run changing colour. Compact, it is one recurring's
 * history inside its row: a price change or a pause shows without a sentence.
 */
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
  /** In a fixed order: a recurring keeps its colour whatever else is shown. */
  series: Array<{ name: string; months: Array<{ month: string; amount: number }> }>
  /** Formats an amount for the axis and the tooltip, privacy mode included. */
  format: (value: number) => string
  /** The axis' rounder figures; `format` when none. */
  axisFormat?: (value: number) => string
  /** No axis figures at all: the tooltip says each month. */
  compact?: boolean
}>()

const { chartRef, containerRef, canRenderChart, containerWidth } = useChartResize()
const chartTheme = useChartTheme()
const updateOptions = { replaceMerge: ['xAxis', 'yAxis', 'series'] }

// Every month from the first to the last, the empty ones included: a gap
// between two leases is a gap on the axis too.
const months = computed(() => {
  const seen = props.series.flatMap((s) => s.months.map((m) => m.month)).sort()
  if (!seen.length) return []
  const all: string[] = []
  let [year, month] = seen[0]!.split('-').map(Number) as [number, number]
  const last = seen[seen.length - 1]!
  for (;;) {
    const period = `${year}-${String(month).padStart(2, '0')}`
    all.push(period)
    if (period >= last) break
    month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  return all
})

function monthLabel(period: string, withYear: boolean): string {
  const [year, month] = period.split('-').map(Number)
  return new Date(year!, month! - 1, 1).toLocaleDateString('fr-FR', withYear ? { month: 'short', year: '2-digit' } : { month: 'short' })
}

const option = computed(() => {
  const theme = chartTheme.value
  const isSmall = containerWidth.value < 640
  const values = props.series.map((s) => {
    const byMonth = new Map(s.months.map((m) => [m.month, Number(m.amount)]))
    return months.value.map((period) => byMonth.get(period) ?? 0)
  })

  return {
    ...chartAnimation(),
    backgroundColor: 'transparent',
    textStyle: { fontFamily: theme.fontFamily },
    legend: {
      show: props.series.length > 1,
      top: 0,
      type: 'scroll',
      textStyle: { color: theme.text, fontSize: 11 },
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 6,
    },
    // Room on the right for the last month's label, centred under its bar.
    grid: {
      top: props.series.length > 1 ? 36 : 12, left: props.compact ? 4 : isSmall ? 44 : 64, right: 20, bottom: 8,
      containLabel: false,
    },
    xAxis: {
      type: 'category',
      data: months.value.map((period) => monthLabel(period, true)),
      axisLabel: { color: theme.text, fontSize: 11, hideOverlap: true },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitNumber: props.compact ? 2 : 4,
      axisLabel: {
        show: !props.compact, color: theme.text, fontSize: 11,
        formatter: (value: number) => (props.axisFormat ?? props.format)(value),
      },
      splitLine: { lineStyle: { color: theme.grid } },
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
        const index = params[0]?.dataIndex ?? -1
        const period = months.value[index]
        if (!period) return ''
        const lines = props.series
          .map((s, i) => ({ name: s.name, value: values[i]![index]!, color: theme.categorical[i] }))
          .filter((line) => line.value)
        const total = lines.reduce((sum, line) => sum + line.value, 0)
        const title = `<div style="font-weight:600;margin-bottom:6px;text-transform:capitalize">${monthLabel(period, false)} ${period.slice(0, 4)}</div>`
        if (!lines.length) return `${title}<div>Rien ce mois-ci</div>`
        const rows = lines.map((line) => `<div style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:2px;background:${line.color}"></span>${line.name} : <strong>${props.format(line.value)}</strong></div>`)
        return title + rows.join('') + (lines.length > 1 ? `<div style="margin-top:4px">Total : <strong>${props.format(total)}</strong></div>` : '')
      },
    },
    series: props.series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      stack: 'category',
      barMaxWidth: 18,
      // A thin surface edge keeps two recurrings of one month apart.
      itemStyle: { color: theme.categorical[i], borderColor: theme.surface, borderWidth: 1 },
      data: values[i],
    })),
  }
})
</script>

<template>
  <div ref="containerRef" :class="['w-full', compact ? 'h-32' : 'h-64']" style="touch-action: pan-y;">
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

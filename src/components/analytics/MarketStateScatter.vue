<script setup lang="ts">
/**
 * Every purchase placed where the market stood that day: date on x, distance to
 * the trailing high on y, euros as the dot size.
 */
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useChartResize } from '@/composables/useChartResize'
import { chartAnimation, useChartTheme } from '@/composables/useChartTheme'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { MarketPointOut } from '@/types'

use([CanvasRenderer, ScatterChart, GridComponent, TooltipComponent])

const props = defineProps<{ points: MarketPointOut[]; isDark?: boolean }>()

const { chartRef, containerRef, canRenderChart } = useChartResize()
const chartTheme = useChartTheme()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()
const updateOptions = { replaceMerge: ['xAxis', 'yAxis', 'series'] }

const maxAmount = computed(() =>
  props.points.reduce((top, point) => Math.max(top, Number(point.amount)), 0),
)

const data = computed(() =>
  props.points.map((point) => ({
    value: [point.day, Number(point.drawdown), Number(point.amount)],
    symbolSize: maxAmount.value
      ? 6 + 18 * Math.sqrt(Number(point.amount) / maxAmount.value)
      : 10,
  })),
)

const option = computed(() => {
  const theme = chartTheme.value
  const textColor = theme.text
  const gridColor = theme.grid

  return {
    ...chartAnimation(),
    backgroundColor: 'transparent',
    textStyle: { fontFamily: theme.fontFamily },
    grid: { top: 16, left: 56, right: 16, bottom: 32 },
    xAxis: {
      type: 'time',
      axisLabel: { color: textColor, fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: textColor,
        fontSize: 10,
        formatter: (value: number) => `${(value * 100).toFixed(0)} %`,
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      textStyle: { color: theme.tooltipText, fontSize: 12, fontFamily: theme.fontFamily },
      formatter: (params: { value: [string, number, number] }) => {
        const [day, drawdown, amount] = params.value
        return [
          day,
          `${maskValue(formatCurrency(amount))} investis`,
          `Marché à ${(drawdown * 100).toFixed(1)} % de son plus haut`,
        ].join('<br/>')
      },
    },
    series: [
      {
        type: 'scatter',
        data: data.value,
        itemStyle: { color: theme.accent, opacity: 0.7 },
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

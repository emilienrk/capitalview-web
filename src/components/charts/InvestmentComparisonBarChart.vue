<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps<{
  stockInvested: number
  stockCurrentValue: number | null
  cryptoInvested: number
  cryptoCurrentValue: number | null
  isDark?: boolean
}>()

const chartRef = ref<InstanceType<typeof VChart> | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const canRenderChart = ref(false)
const legendSelection = ref<Record<string, boolean>>({
  Investi: true,
  'Investi + P/L': true,
})
const updateOptions = {
  replaceMerge: ['legend', 'xAxis', 'yAxis', 'series'],
}
let resizeObserver: ResizeObserver | null = null

const rows = computed(() => {
  const stockInvested = Number(props.stockInvested ?? 0)
  const cryptoInvested = Number(props.cryptoInvested ?? 0)
  const stockInvestedWithPnl = props.stockCurrentValue == null ? stockInvested : Number(props.stockCurrentValue)
  const cryptoInvestedWithPnl = props.cryptoCurrentValue == null ? cryptoInvested : Number(props.cryptoCurrentValue)

  return [
    {
      label: 'Bourse',
      invested: stockInvested,
      investedWithPnl: stockInvestedWithPnl,
      pnl: stockInvestedWithPnl - stockInvested,
    },
    {
      label: 'Crypto',
      invested: cryptoInvested,
      investedWithPnl: cryptoInvestedWithPnl,
      pnl: cryptoInvestedWithPnl - cryptoInvested,
    },
  ]
})

function syncChartVisibilityAndSize(): void {
  const container = containerRef.value
  if (!container) return

  const hasSize = container.clientWidth > 0 && container.clientHeight > 0
  if (!hasSize) return

  canRenderChart.value = true
  nextTick(() => {
    chartRef.value?.resize()
  })
}

onMounted(() => {
  syncChartVisibilityAndSize()

  resizeObserver = new ResizeObserver(() => {
    syncChartVisibilityAndSize()
  })

  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

function formatCurrencyValue(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} €`
}

const option = computed(() => {
  const textColor = props.isDark ? '#94a3b8' : '#6b7280'
  const gridColor = props.isDark ? '#1e293b' : '#f3f4f6'
  const tooltipBg = props.isDark ? '#0f172a' : '#ffffff'
  const tooltipBorder = props.isDark ? '#334155' : '#e5e7eb'
  const tooltipText = props.isDark ? '#f1f5f9' : '#111827'

  return {
    backgroundColor: 'transparent',
    legend: {
      top: 0,
      selectedMode: true,
      selected: legendSelection.value,
      textStyle: { color: textColor, fontSize: 11 },
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 6,
    },
    grid: {
      top: 36,
      left: 8,
      right: 8,
      bottom: 8,
      outerBoundsMode: 'same',
      outerBoundsContain: 'axisLabel',
    },
    xAxis: {
      type: 'category',
      data: rows.value.map((row) => row.label),
      axisLabel: {
        color: textColor,
        fontSize: 12,
        fontWeight: 600,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: textColor,
        fontSize: 11,
        formatter: (value: number) => formatCurrencyValue(value),
      },
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
        if (!Array.isArray(params) || params.length === 0) return ''

        const category = String(params[0]?.axisValue ?? '')
        const investedValue = Number(params.find((p) => p.seriesName === 'Investi')?.value ?? 0)
        const investedWithPnlValue = Number(params.find((p) => p.seriesName === 'Investi + P/L')?.value ?? 0)
        const pnlValue = investedWithPnlValue - investedValue
        const ratio = investedValue > 0 ? (pnlValue / investedValue) * 100 : null

        return `<div style="font-weight:600;margin-bottom:6px">${category}</div>
<div>Investi: <strong>${formatCurrencyValue(investedValue)}</strong></div>
<div>Investi + P/L: <strong>${formatCurrencyValue(investedWithPnlValue)}</strong></div>
<div>P/L: <strong>${formatCurrencyValue(pnlValue)} (${ratio == null ? '—' : `${ratio.toFixed(2)} %`})</strong></div>`
      },
    },
    series: [
      {
        name: 'Investi',
        type: 'bar',
        barMaxWidth: 32,
        itemStyle: {
          color: '#4f46e5',
          borderRadius: [6, 6, 0, 0],
        },
        emphasis: { focus: 'series' },
        data: rows.value.map((row) => row.invested),
      },
      {
        name: 'Investi + P/L',
        type: 'bar',
        barMaxWidth: 32,
        itemStyle: {
          color: '#10b981',
          borderRadius: [6, 6, 0, 0],
        },
        emphasis: { focus: 'series' },
        data: rows.value.map((row) => row.investedWithPnl),
      },
    ],
  }
})

function handleLegendSelectChanged(event: { selected?: Record<string, boolean> }): void {
  if (!event?.selected) return
  legendSelection.value = {
    ...legendSelection.value,
    ...event.selected,
  }
}
</script>

<template>
  <div ref="containerRef" class="w-full h-72">
    <VChart
      v-if="canRenderChart"
      ref="chartRef"
      :option="option"
      :update-options="updateOptions"
      autoresize
      class="w-full h-full"
      @legendselectchanged="handleLegendSelectChanged"
    />
  </div>
</template>

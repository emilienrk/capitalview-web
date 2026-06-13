<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { AssetHistorySnapshotResponse } from '@/types'
import { useDarkMode } from '@/composables/useDarkMode'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const { isDark } = useDarkMode()

const props = defineProps<{
  history: AssetHistorySnapshotResponse[]
}>()

const chartRef = ref<InstanceType<typeof VChart> | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const canRenderChart = ref(false)
let resizeObserver: ResizeObserver | null = null

const containerWidth = ref(0)

function syncChartVisibilityAndSize(): void {
  const container = containerRef.value
  if (!container) return

  const hasSize = container.clientWidth > 0 && container.clientHeight > 0
  if (!hasSize) return

  containerWidth.value = container.clientWidth
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

const sortedHistory = computed<AssetHistorySnapshotResponse[]>(() => {
  return [...props.history].sort((a, b) =>
    new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  )
})

const option = computed(() => {
  const textColor = isDark.value ? '#94a3b8' : '#6b7280'
  const gridColor = isDark.value ? '#1e293b' : '#f3f4f6'
  const lineColor = '#0ea5e9'

  const dates = sortedHistory.value.map((row) => row.snapshot_date)
  const values = sortedHistory.value.map((row) => Number(row.total_value))

  const isSmall = containerWidth.value < 640
  const labelDivisor = isSmall ? 6 : 12
  const xAxisInterval = dates.length <= (isSmall ? 15 : 40) ? 0 : Math.max(0, Math.floor(dates.length / labelDivisor) - 1)

  return {
    backgroundColor: 'transparent',
    grid: {
      top: 14,
      left: isSmall ? 32 : 38,
      right: isSmall ? 4 : 12,
      bottom: 22,
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: textColor,
        fontSize: 11,
        interval: xAxisInterval,
        hideOverlap: true,
        formatter: (val: string) => {
          const d = new Date(val)
          if (Number.isNaN(d.getTime())) return val
          return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
        },
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: textColor,
        fontSize: 11,
        formatter: (val: number) =>
          Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k €` : `${Math.round(val)} €`,
      },
      splitLine: { lineStyle: { color: gridColor } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: isDark.value ? '#0f172a' : '#ffffff',
      borderColor: isDark.value ? '#334155' : '#e5e7eb',
      textStyle: { color: isDark.value ? '#f1f5f9' : '#111827', fontSize: 12 },
      formatter: (params: Array<{ axisValue: string; value: number }>) => {
        const p = params[0]
        if (!p) return ''

        const date = new Date(p.axisValue).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })

        const value = Number(p.value).toLocaleString('fr-FR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })

        return `<div style="font-weight:600;margin-bottom:6px">${date}</div><div>Assets: <span style="font-weight:700">${value} €</span></div>`
      },
    },
    series: [
      {
        name: 'Assets',
        type: 'line',
        data: values,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5, color: lineColor },
        itemStyle: { color: lineColor },
        areaStyle: { opacity: 0.12, color: lineColor },
      },
    ],
  }
})
</script>

<template>
  <div ref="containerRef" class="w-full h-64" style="touch-action: pan-y;">
    <VChart
      v-if="canRenderChart"
      ref="chartRef"
      :option="option"
      autoresize
      class="w-full h-full"
    />
  </div>
</template>
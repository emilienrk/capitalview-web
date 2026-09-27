<script setup lang="ts">
/**
 * The month in progress against the recent months, day by day: what has gone
 * out so far, what the median month had spent by the same day, and where the
 * month is heading. The one figure worth reading before the month is over.
 */
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'

import { useChartResize } from '@/composables/useChartResize'
import { chartAnimation, mixColor, useChartTheme } from '@/composables/useChartTheme'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { exploreLink } from '@/utils/ledger'
import type { RealCashflowCurrent, RealCashflowUpcoming } from '@/types'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const props = defineProps<{ data: RealCashflowCurrent; isDark?: boolean }>()

const { formatCurrency } = useFormatters()
const { maskValue, privacyMode } = usePrivacyMode()
const { chartRef, containerRef, canRenderChart } = useChartResize()
const chartTheme = useChartTheme()

// An API older than recurring payments, or income, sends no due dates: nothing to come, not a crash.
const upcoming = computed(() => props.data.upcoming ?? [])
const upcomingIncome = computed(() => props.data.upcoming_income ?? [])

function dueList(dues: RealCashflowUpcoming[]): string {
  return dues.map((due) => `${due.name} le ${Number(due.date.slice(8))} : ${amount(due.amount)}`).join('\n')
}

function amount(value: number | null): string {
  return value === null ? '—' : maskValue(formatCurrency(Number(value), props.data.currency))
}

/** Positive when ahead of the median month at this day. */
const gap = computed(() =>
  props.data.median_to_date === null ? null : Number(props.data.spent_to_date) - Number(props.data.median_to_date),
)

const option = computed(() => {
  const theme = chartTheme.value
  const textColor = theme.text
  const gridColor = theme.grid
  const format = (value: number) => (privacyMode.value ? '•••' : formatCurrency(value, props.data.currency))
  return {
    ...chartAnimation(),
    backgroundColor: 'transparent',
    textStyle: { fontFamily: theme.fontFamily },
    grid: { top: 12, left: 8, right: 8, bottom: 20, containLabel: false },
    xAxis: {
      type: 'category',
      data: props.data.curve.map((point) => point.day),
      axisLabel: { color: textColor, fontSize: 10, interval: 4 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: { type: 'value', show: false, splitLine: { lineStyle: { color: gridColor } } },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      textStyle: { color: theme.tooltipText, fontSize: 12, fontFamily: theme.fontFamily },
      formatter: (params: Array<{ dataIndex: number }>) => {
        const point = props.data.curve[params[0]?.dataIndex ?? -1]
        if (!point) return ''
        const spent = point.spent === null ? '' : `<div>Ce mois : <strong>${format(Number(point.spent))}</strong></div>`
        const typical = point.median === null ? '' : `<div>Mois médian : <strong>${format(Number(point.median))}</strong></div>`
        return `<div style="font-weight:600;margin-bottom:4px">Au ${point.day}</div>${spent}${typical}`
      },
    },
    series: [
      {
        name: 'Mois médian',
        type: 'line',
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 1.5, type: 'dashed', color: textColor },
        areaStyle: { color: mixColor(theme.neutral, 'transparent', 12) },
        data: props.data.curve.map((point) => (point.median === null ? null : Number(point.median))),
      },
      {
        name: 'Ce mois',
        type: 'line',
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 2.5, color: theme.negative },
        data: props.data.curve.map((point) => (point.spent === null ? null : Number(point.spent))),
      },
    ],
  }
})
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
    <div class="lg:col-span-2 space-y-2">
      <p class="text-2xl font-bold tabular-nums text-text-main dark:text-text-dark-main">
        {{ amount(data.spent_to_date) }}
        <span class="text-sm font-medium text-text-muted dark:text-text-dark-muted">dépensés au {{ data.day }}</span>
      </p>
      <!-- The median's own amount is the dashed curve: only the gap is spelled out. -->
      <p v-if="gap !== null" class="text-sm text-text-muted dark:text-text-dark-muted">
        <span class="font-semibold tabular-nums">{{ gap > 0 ? '+' : '−' }}{{ amount(Math.abs(gap)) }}</span>
        face à un mois médian au même jour
      </p>
      <p v-if="data.projection !== null" class="text-sm text-text-main dark:text-text-dark-main">
        Fin de mois estimée : <strong class="tabular-nums">{{ amount(data.projection) }}</strong>
        <span v-if="data.median_month !== null" class="text-text-muted dark:text-text-dark-muted">
          · médian {{ amount(data.median_month) }}
        </span>
      </p>
      <!-- An income still to come lowers nothing above: it only shares the footnote line. -->
      <p
        v-if="Number(data.pending_to_date) || upcoming.length || upcomingIncome.length"
        class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted dark:text-text-dark-muted"
      >
        <span v-if="Number(data.pending_to_date)">dont {{ amount(data.pending_to_date) }} en attente</span>
        <span v-if="upcoming.length" :title="dueList(upcoming)">
          {{ upcoming.length }} prélèvement{{ upcoming.length > 1 ? 's' : '' }} à venir, {{ amount(data.upcoming_amount) }}
        </span>
        <span v-if="upcomingIncome.length" :title="dueList(upcomingIncome)">
          {{ upcomingIncome.length }} revenu{{ upcomingIncome.length > 1 ? 's' : '' }} à recevoir, {{ amount(data.upcoming_income_amount) }}
        </span>
      </p>
      <router-link
        :to="{ name: 'cashflow', query: exploreLink({ preset: 'month', direction: 'out', types: ['EXPENSE'], includePending: true }) }"
        class="inline-block text-sm font-medium text-primary hover:underline"
      >
        Explorer ce mois
      </router-link>
    </div>
    <div ref="containerRef" class="lg:col-span-3 h-36 w-full">
      <VChart v-if="canRenderChart" ref="chartRef" :option="option" autoresize class="w-full h-full" />
    </div>
  </div>
</template>

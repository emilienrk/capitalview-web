<script setup lang="ts">
/**
 * The month in progress against the recent months, day by day: what has gone
 * out so far, what the median month had spent by the same day, and where the
 * month is heading. The one figure worth reading before the month is over.
 */
import { computed } from 'vue'
import { Gauge } from 'lucide-vue-next'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'

import { BaseCard } from '@/components'
import { useChartResize } from '@/composables/useChartResize'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { exploreLink } from '@/utils/ledger'
import type { RealCashflowCurrent } from '@/types'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const props = defineProps<{ data: RealCashflowCurrent; isDark?: boolean }>()

const { formatCurrency } = useFormatters()
const { maskValue, privacyMode } = usePrivacyMode()
const { chartRef, containerRef, canRenderChart } = useChartResize()

// An API older than recurring payments sends no due dates: nothing to come, not a crash.
const upcoming = computed(() => props.data.upcoming ?? [])

function amount(value: number | null): string {
  return value === null ? '—' : maskValue(formatCurrency(Number(value), props.data.currency))
}

const monthName = computed(() => {
  const [year, month] = props.data.period.split('-').map(Number)
  const name = new Date(year!, month! - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })
  return name.charAt(0).toUpperCase() + name.slice(1)
})

/** Positive when ahead of the median month at this day. */
const gap = computed(() =>
  props.data.median_to_date === null ? null : Number(props.data.spent_to_date) - Number(props.data.median_to_date),
)

const option = computed(() => {
  const textColor = props.isDark ? '#94a3b8' : '#6b7280'
  const gridColor = props.isDark ? '#1e293b' : '#f3f4f6'
  const format = (value: number) => (privacyMode.value ? '•••' : formatCurrency(value, props.data.currency))
  return {
    backgroundColor: 'transparent',
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
      backgroundColor: props.isDark ? '#0f172a' : '#ffffff',
      borderColor: props.isDark ? '#334155' : '#e5e7eb',
      textStyle: { color: props.isDark ? '#f1f5f9' : '#111827', fontSize: 12 },
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
        areaStyle: { color: props.isDark ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.12)' },
        data: props.data.curve.map((point) => (point.median === null ? null : Number(point.median))),
      },
      {
        name: 'Ce mois',
        type: 'line',
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 2.5, color: '#ef4444' },
        data: props.data.curve.map((point) => (point.spent === null ? null : Number(point.spent))),
      },
    ],
  }
})
</script>

<template>
  <BaseCard>
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
      <div class="lg:col-span-2 space-y-2">
        <p class="flex items-center gap-2 text-sm font-medium text-text-muted dark:text-text-dark-muted">
          <Gauge class="w-4 h-4" /> {{ monthName }} en cours
        </p>
        <p class="text-2xl font-bold tabular-nums text-text-main dark:text-text-dark-main">
          {{ amount(data.spent_to_date) }}
          <span class="text-sm font-medium text-text-muted dark:text-text-dark-muted">dépensés au {{ data.day }}</span>
        </p>
        <p v-if="data.median_to_date !== null" class="text-sm text-text-muted dark:text-text-dark-muted">
          Un mois médian en était à {{ amount(data.median_to_date) }}
          <span v-if="gap !== null" class="font-semibold tabular-nums">
            ({{ gap > 0 ? '+' : '−' }}{{ amount(Math.abs(gap)) }})
          </span>
        </p>
        <p v-if="data.projection !== null" class="text-sm text-text-main dark:text-text-dark-main">
          Fin de mois estimée : <strong class="tabular-nums">{{ amount(data.projection) }}</strong>
          <span class="text-text-muted dark:text-text-dark-muted"> pour {{ amount(data.median_month) }} un mois médian</span>
        </p>
        <p v-if="Number(data.pending_to_date)" class="text-xs text-text-muted dark:text-text-dark-muted">
          Dont {{ amount(data.pending_to_date) }} de paiements encore en attente.
        </p>
        <!-- The due dates still to come: what the rest of the month already owes. -->
        <p
          v-if="upcoming.length"
          class="text-xs text-text-muted dark:text-text-dark-muted"
          :title="upcoming.map((due) => `${due.name} le ${Number(due.date.slice(8))} : ${amount(due.amount)}`).join('\n')"
        >
          À venir ce mois : {{ upcoming.length }} prélèvement{{ upcoming.length > 1 ? 's' : '' }},
          {{ amount(data.upcoming_amount) }}
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
  </BaseCard>
</template>

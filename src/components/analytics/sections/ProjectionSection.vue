<script setup lang="ts">
/**
 * Ten years ahead at the measured pace, and beneath the projected curve what
 * would actually have been paid in: the gap between the two is the return,
 * readable at any point of the horizon rather than only at its end.
 *
 * A review-session tool, which is why it lives here and not on the dashboard.
 */
import { computed, onMounted, ref } from 'vue'
import { BaseAlert, BaseCard, BaseEmptyState, BaseSegmentedControl, BaseSkeleton } from '@/components'
import HistoryLineChart from '@/components/charts/HistoryLineChart.vue'
import ProjectionAssumptions from '@/components/charts/ProjectionAssumptions.vue'
import { useDashboardStore } from '@/stores/dashboard'
import type { AccountHistorySnapshotResponse, ProjectionAssetParameters, ProjectionCategory } from '@/types'

defineProps<{ isDark?: boolean }>()

const dashboard = useDashboardStore()

const PROJECTION_MONTHS = 120

type View = 'total' | 'stock' | 'crypto'
const views: Array<{ value: View; label: string }> = [
  { value: 'total', label: 'Tout' },
  { value: 'stock', label: 'Actions' },
  { value: 'crypto', label: 'Crypto' },
]
const view = ref<View>('total')

const SERIES_NAMES: Record<View, string> = {
  total: 'Patrimoine total projeté',
  stock: 'Valeur actions projetée',
  crypto: 'Valeur crypto projetée',
}

/** Which pockets the visible curve is made of — the assumptions panel shows those. */
const categories = computed<ProjectionCategory[]>(() =>
  view.value === 'total' ? ['STOCK', 'CRYPTO', 'BANK', 'PLACEMENT'] : [view.value.toUpperCase() as ProjectionCategory],
)

function point(date: string, value: number): AccountHistorySnapshotResponse {
  return {
    snapshot_date: date,
    total_value: value,
    total_invested: 0,
    total_deposits: 0,
    total_withdrawals: 0,
    daily_pnl: null,
    cumulative_pnl: value,
    total_fees: null,
    total_dividends: null,
    positions: null,
  }
}

/** Whole months between two ISO dates — the points are thinned, so their index is not the month. */
function monthsBetween(from: string, to: string): number {
  const start = new Date(from)
  const end = new Date(to)
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
}

const series = computed(() => {
  const data = dashboard.projection?.data ?? []
  const first = data[0]
  if (!first) return []

  // Monthly points on a yearly axis print each year a dozen times: keep the
  // starting point and each year's last one.
  const kept = data.filter((p, i) => i === 0 || i === data.length - 1 || p.date.slice(0, 4) !== data[i + 1]?.date.slice(0, 4))
  const values = kept.map((p) => ({
    date: p.date,
    value: view.value === 'total' ? Number(p.total_value) : Number(p.asset_values?.[view.value.toUpperCase() as ProjectionCategory] ?? 0),
  }))

  const assets = dashboard.projection?.parameters_used.assets
  const monthly = categories.value.reduce((sum, category) => sum + (assets?.[category]?.monthly_injection ?? 0), 0)
  const start = values[0]?.value ?? 0

  return [
    { name: SERIES_NAMES[view.value], history: values.map((v) => point(v.date, v.value)) },
    {
      name: 'Capital investi',
      history: values.map((v) => point(v.date, start + monthly * monthsBetween(first.date, v.date))),
    },
  ]
})

function recalculate(assets: Partial<Record<ProjectionCategory, ProjectionAssetParameters>>): void {
  dashboard.fetchProjection({ months_to_project: PROJECTION_MONTHS, assets })
}

function reset(): void {
  dashboard.fetchProjection({ months_to_project: PROJECTION_MONTHS })
}

onMounted(() => {
  if (!dashboard.projection && !dashboard.projectionLoading) reset()
})
</script>

<template>
  <section class="mt-8">
    <h2 class="mb-3 text-base font-semibold text-text-main dark:text-text-dark-main">Projection à 10 ans</h2>
    <BaseCard>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <ProjectionAssumptions
            :parameters-used="dashboard.projection?.parameters_used ?? null"
            :categories="categories"
            :loading="dashboard.projectionLoading"
            @apply="recalculate"
            @reset="reset"
          />
          <p class="text-sm text-text-muted dark:text-text-dark-muted">Au rythme mesuré, à hypothèses modifiables</p>
        </div>
        <BaseSegmentedControl v-model="view" :options="views" size="sm" />
      </div>

      <BaseSkeleton v-if="dashboard.projectionLoading" variant="rect" width="100%" height="18rem" />
      <BaseAlert v-else-if="dashboard.projectionError" variant="danger">{{ dashboard.projectionError }}</BaseAlert>
      <HistoryLineChart
        v-else-if="series.length"
        :series="series"
        :is-dark="isDark"
        granularity="yearly"
        hide-controls
      />
      <BaseEmptyState
        v-else
        title="Projection impossible"
        description="Aux hypothèses retenues, la valeur dans 10 ans resterait sous le total versé, ou il manque des données d'investissement."
      />
    </BaseCard>
  </section>
</template>

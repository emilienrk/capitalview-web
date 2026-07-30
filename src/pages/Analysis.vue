<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import PageHeader from '@/components/PageHeader.vue'
import { BaseCard, BaseAlert, BaseSpinner, BaseEmptyState } from '@/components'
import ReliabilityBadge from '@/components/analytics/ReliabilityBadge.vue'
import type { MetricOut } from '@/types'

const analysis = useAnalysisStore()
const { formatCurrency, formatPercent, profitLossClass } = useFormatters()
const { maskValue } = usePrivacyMode()

const gap = computed(() => analysis.data?.investor_gap ?? null)

const cards = computed(() => {
  const g = gap.value
  if (!g) return []
  return [
    { key: 'twr', label: 'Performance de ta stratégie', metric: g.twr_annualised, kind: 'pct' as const },
    { key: 'benchmark', label: 'MSCI World sur la même période', metric: g.benchmark_annualised, kind: 'pct' as const },
    { key: 'mwr', label: 'Performance réelle de tes euros', metric: g.mwr, kind: 'pct' as const },
    { key: 'gap', label: 'Écart investisseur', metric: g.gap, kind: 'pct' as const, signed: true },
    { key: 'gap_eur', label: 'Ce que cet écart représente', metric: g.gap_eur, kind: 'eur' as const, signed: true },
  ]
})

function display(metric: MetricOut, kind: 'pct' | 'eur'): string {
  if (metric.value === null) return '—'
  const n = Number(metric.value)
  return kind === 'pct' ? formatPercent(n * 100) : maskValue(formatCurrency(n))
}

onMounted(() => analysis.fetchAnalytics())
</script>

<template>
  <div>
    <PageHeader
      title="Analyse"
      description="Ce que tes données disent de ton comportement d'investisseur"
    />

    <div v-if="analysis.isLoading && !analysis.data" class="flex justify-center py-20">
      <BaseSpinner size="lg" label="Analyse en cours..." />
    </div>

    <BaseAlert v-else-if="analysis.error" variant="danger" class="mb-6">
      {{ analysis.error }}
    </BaseAlert>

    <BaseEmptyState
      v-else-if="!gap"
      title="Pas encore assez d'historique"
      description="L'analyse comportementale demande plusieurs mois de transactions pour dire quoi que ce soit d'utile."
    />

    <template v-else>
      <BaseCard class="mb-6">
        <p class="text-sm leading-relaxed text-text-main dark:text-text-dark-main">{{ gap.verdict }}</p>
      </BaseCard>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BaseCard v-for="card in cards" :key="card.key">
          <p class="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted">
            {{ card.label }}
          </p>
          <p
            :class="[
              'mb-2 text-2xl font-bold tabular-nums',
              card.signed && card.metric.value !== null
                ? profitLossClass(Number(card.metric.value))
                : 'text-text-main dark:text-text-dark-main',
            ]"
          >
            {{ display(card.metric, card.kind) }}
          </p>
          <ReliabilityBadge :reliability="card.metric.reliability" :caveat="card.metric.caveat" />
        </BaseCard>
      </div>
    </template>
  </div>
</template>

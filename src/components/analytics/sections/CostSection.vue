<script setup lang="ts">
/**
 * Block 2 of the design — "what it costs me": the investor gap, the
 * counterfactual bridge and the price paid on each order.
 */
import { computed } from 'vue'
import { BaseCard } from '@/components'
import CollapsibleBlock from '@/components/analytics/CollapsibleBlock.vue'
import MetricTile from '@/components/analytics/MetricTile.vue'
import AttributionWaterfall from '@/components/analytics/AttributionWaterfall.vue'
import SlippageDistribution from '@/components/analytics/SlippageDistribution.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { CounterfactualResponse, ExecutionResponse, InvestorGapResponse } from '@/types'

const props = defineProps<{
  gap: InvestorGapResponse | null
  bridge: CounterfactualResponse | null
  execution: ExecutionResponse | null
  isDark?: boolean
}>()

const { formatCurrency, profitLossClass } = useFormatters()
const { maskValue } = usePrivacyMode()

const cards = computed(() => {
  const g = props.gap
  if (!g) return []
  return [
    { key: 'twr', label: 'Performance de la stratégie', metric: g.twr_annualised },
    { key: 'benchmark', label: 'Indice de référence sur la même période', metric: g.benchmark_annualised },
    { key: 'mwr', label: 'Performance réelle des euros investis', metric: g.mwr },
    { key: 'gap', label: 'Écart investisseur', metric: g.gap, signed: true },
  ]
})

function eur(value: number | string): string {
  return maskValue(formatCurrency(Number(value)))
}
</script>

<template>
  <section v-if="gap || bridge || execution" class="mt-8">
    <h2 class="mb-3 text-base font-semibold text-text-main dark:text-text-dark-main">
      Ce que ça coûte
    </h2>

    <CollapsibleBlock
      v-if="gap"
      title="La performance de l'investisseur contre celle de la stratégie"
      :measurable="gap.gap.value !== null"
      :summary="gap.gap.caveat"
    >
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          v-for="card in cards"
          :key="card.key"
          :label="card.label"
          :metric="card.metric"
          kind="pct"
          :signed="card.signed"
        />
      </div>
      <div class="mt-4">
        <MetricTile
          label="Ce que cet écart représente"
          :metric="gap.gap_eur"
          kind="eur"
          signed
        />
      </div>
      <p class="mt-3 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ gap.verdict }}
      </p>
    </CollapsibleBlock>

    <BaseCard v-if="bridge" class="mb-4">
      <h3 class="mb-1 text-sm font-semibold text-text-main dark:text-text-dark-main">
        Le portefeuille contre un robot
      </h3>
      <p
        class="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
      >
        Écart au robot, décision par décision
      </p>
      <AttributionWaterfall :bridge="bridge" :is-dark="isDark" />

      <div
        class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted dark:text-text-dark-muted"
      >
        <span>Robot : {{ eur(bridge.baseline) }}</span>
        <span>Réel : {{ eur(bridge.final) }}</span>
        <span :class="profitLossClass(Number(bridge.behaviour_cost))">
          Écart : {{ eur(bridge.behaviour_cost) }}
        </span>
        <span v-if="Number(bridge.idle_cash) > 0">
          Liquidités non investies : {{ eur(bridge.idle_cash) }}
        </span>
      </div>

      <p class="mt-3 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ bridge.verdict }}
      </p>
    </BaseCard>

    <CollapsibleBlock
      v-if="execution"
      title="Le prix payé sur chaque achat"
      :measurable="execution.slippage_bps.value !== null"
      :summary="execution.slippage_bps.caveat"
    >
      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricTile
          label="Écart moyen au prix du mois"
          :metric="execution.slippage_bps"
          kind="bps"
          signed
          invert
        />
        <MetricTile
          :label="`Sur ${execution.order_count} achats`"
          :metric="execution.cost_eur"
          kind="eur"
          signed
          invert
        />
      </div>

      <SlippageDistribution
        v-if="execution.distribution"
        :distribution="execution.distribution"
        :is-dark="isDark"
      />

      <p class="mt-3 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ execution.verdict }}
      </p>

      <p
        v-if="execution.p_value !== null"
        class="mt-2 text-xs text-text-muted dark:text-text-dark-muted"
      >
        Test de permutation : p = {{ Number(execution.p_value).toFixed(3) }}
        <template v-if="!execution.is_detectable"> — indistinguable du hasard.</template>
      </p>
    </CollapsibleBlock>
  </section>
</template>

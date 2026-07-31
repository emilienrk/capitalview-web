<script setup lang="ts">
/**
 * Block 1 of the design — "what I actually do": purchase rhythm, the wait
 * between depositing and investing, and where in the market cycle the money
 * lands.
 */
import { BaseCard } from '@/components'
import MetricTile from '@/components/analytics/MetricTile.vue'
import ContributionHeatmap from '@/components/analytics/ContributionHeatmap.vue'
import DensityComparison from '@/components/analytics/DensityComparison.vue'
import MarketStateScatter from '@/components/analytics/MarketStateScatter.vue'
import ReliabilityBadge from '@/components/analytics/ReliabilityBadge.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type {
  DepositLagResponse,
  MarketConditioningResponse,
  RegularityResponse,
} from '@/types'

defineProps<{
  regularity: RegularityResponse | null
  depositLag: DepositLagResponse | null
  conditioning: MarketConditioningResponse | null
  isDark?: boolean
}>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

function eur(value: number | string | null): string {
  return value === null ? '—' : maskValue(formatCurrency(Number(value)))
}
</script>

<template>
  <section v-if="regularity || depositLag || conditioning" class="mt-8">
    <h2 class="mb-3 text-base font-semibold text-text-main dark:text-text-dark-main">
      Ce que tu fais vraiment
    </h2>

    <!-- ── 2.1 · purchase rhythm ─────────────────────────────────── -->
    <BaseCard v-if="regularity" class="mb-4">
      <p class="mb-4 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ regularity.verdict }}
      </p>

      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <!-- The measure that judges regularity: distance to a straight-line
             deployment, which has no notion of a calendar month and so cannot be
             fooled by one. -->
        <MetricTile
          label="Écart à un déploiement linéaire"
          :metric="regularity.deployment_gap"
          kind="pct"
          invert
        />
        <MetricTile
          label="Achats mensuels égaux équivalents"
          :metric="regularity.equivalent_monthly_purchases"
          kind="count"
        />
        <MetricTile
          label="Mois avec au moins un achat"
          :metric="regularity.invested_share"
          kind="pct"
        />
        <MetricTile
          label="Plus longue interruption"
          :metric="regularity.longest_gap_months"
          kind="months"
        />
      </div>

      <p
        v-if="regularity.cadence_label"
        class="mb-3 text-xs text-text-muted dark:text-text-dark-muted"
      >
        Cadence détectée : {{ regularity.cadence_label }}. Elle est lue sur les ordres, jamais
        déclarée.
      </p>

      <!-- The heatmap is the same numbers in another shape: when the gate
           withheld them, the API sends an empty series and nothing is drawn. -->
      <ContributionHeatmap
        v-if="regularity.monthly.length"
        :monthly="regularity.monthly"
        :is-dark="isDark"
      />

      <p class="mt-2 text-xs italic text-text-muted dark:text-text-dark-muted">
        Les chiffres mensuels ci-dessus illustrent, ils ne jugent pas : un rythme de 30 jours
        dérive d'un mois sur l'autre sans que la discipline change.
      </p>
    </BaseCard>

    <!-- ── 2.4 · deposit to purchase lag ─────────────────────────── -->
    <BaseCard v-if="depositLag" class="mb-4">
      <h3 class="mb-1 text-sm font-semibold text-text-main dark:text-text-dark-main">
        Entre le virement et l'investissement
      </h3>
      <p class="mb-4 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ depositLag.verdict }}
      </p>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Délai médian" :metric="depositLag.median_days" kind="days" />
        <MetricTile label="Délai au 9ᵉ décile" :metric="depositLag.p90_days" kind="days" />
        <MetricTile
          label="Régularité des dépôts"
          :metric="depositLag.deposit_variation"
          kind="ratio"
        />
        <MetricTile
          label="Régularité des achats"
          :metric="depositLag.purchase_variation"
          kind="ratio"
        />
      </div>

      <p
        v-if="Number(depositLag.unmatched_share) > 0"
        class="mt-3 text-xs text-text-muted dark:text-text-dark-muted"
      >
        {{ Math.round(Number(depositLag.unmatched_share) * 100) }} % de tes achats sont financés
        par des provisions automatiques : l'app crée le dépôt au moment de l'achat, donc leur
        délai réel est inconnu et ils sont exclus du calcul plutôt qu'appariés de force.
      </p>
      <p
        v-if="Number(depositLag.never_invested_eur) > 0"
        class="mt-1 text-xs text-text-muted dark:text-text-dark-muted"
      >
        {{ eur(depositLag.never_invested_eur) }} déposés n'ont jamais été investis.
      </p>
    </BaseCard>

    <!-- ── 2.2 · market conditioning ─────────────────────────────── -->
    <BaseCard v-if="conditioning">
      <h3 class="mb-1 text-sm font-semibold text-text-main dark:text-text-dark-main">
        Contrarian ou suiveur ?
      </h3>
      <p class="mb-4 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ conditioning.verdict }}
      </p>

      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Ton euro moyen entre à"
          :metric="conditioning.weighted_drawdown"
          kind="pct"
        />
        <MetricTile
          label="Un jour au hasard"
          :metric="conditioning.unconditional_drawdown"
          kind="pct"
        />
        <MetricTile
          label="Élan du marché à tes achats"
          :metric="conditioning.weighted_momentum"
          kind="pct"
        />
        <MetricTile
          label="Élan un jour au hasard"
          :metric="conditioning.unconditional_momentum"
          kind="pct"
        />
      </div>

      <template v-if="conditioning.density.length">
        <DensityComparison :density="conditioning.density" :is-dark="isDark" />
        <MarketStateScatter
          v-if="conditioning.points.length"
          :points="conditioning.points"
          :is-dark="isDark"
        />
      </template>
      <ReliabilityBadge
        v-else
        :reliability="conditioning.weighted_drawdown.reliability"
        :caveat="conditioning.weighted_drawdown.caveat"
      />

      <div
        v-if="conditioning.yearly.length"
        class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted dark:text-text-dark-muted"
      >
        <span v-for="bucket in conditioning.yearly" :key="bucket.label">
          {{ bucket.label }} : {{ (Number(bucket.drawdown) * 100).toFixed(1) }} %
        </span>
        <span class="italic">— tendance, pas preuve : 12 mois par période.</span>
      </div>

      <p
        v-if="conditioning.p_value !== null"
        class="mt-2 text-xs text-text-muted dark:text-text-dark-muted"
      >
        Test de permutation : p = {{ Number(conditioning.p_value).toFixed(3) }}
        <template v-if="!conditioning.is_detectable"> — indistinguable du hasard.</template>
      </p>
    </BaseCard>
  </section>
</template>

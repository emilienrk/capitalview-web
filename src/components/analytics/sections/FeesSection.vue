<script setup lang="ts">
/**
 * Blocks 4 and 3.2 — fees, and what happens on the way out.
 */
import { BaseCard } from '@/components'
import MetricTile from '@/components/analytics/MetricTile.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { ExitsResponse, FeesResponse } from '@/types'

defineProps<{ fees: FeesResponse | null; exits: ExitsResponse | null }>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

function eur(value: number | string | null): string {
  return value === null ? '—' : maskValue(formatCurrency(Number(value)))
}
</script>

<template>
  <section v-if="fees || exits" class="mt-8">
    <h2 class="mb-3 text-base font-semibold text-text-main dark:text-text-dark-main">
      Frais et sorties
    </h2>

    <BaseCard v-if="fees" class="mb-4">
      <p class="mb-4 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ fees.verdict }}
      </p>

      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Frais payés" :metric="fees.total_fees" kind="eur" />
        <MetricTile label="Part du capital déployé" :metric="fees.fee_share" kind="pct" />
        <MetricTile label="Coût annuel" :metric="fees.annual_bps" kind="bps" />
        <MetricTile label="Seuil de calibrage par ordre" :metric="fees.threshold_order_size" kind="eur" />
      </div>

      <!-- The threshold is calibration, the annual charge is the verdict. Saying
           "group your orders" while the annual load is already under the target
           contradicts the tile right above it. -->
      <p
        v-if="fees.orders_below_threshold"
        class="mb-2 text-xs text-text-muted dark:text-text-dark-muted"
      >
        {{ fees.orders_below_threshold }} ordres sur {{ fees.order_count }} sont sous le seuil :
        {{ eur(fees.cost_below_threshold) }} de frais pour
        {{ eur(fees.invested_below_threshold) }} investis.
        <template v-if="!fees.avoidable">
          La charge annuelle reste sous la cible : le seuil est ici une information de calibrage,
          pas un problème à corriger.
        </template>
      </p>

      <p
        v-if="fees.projection_eur !== null"
        class="mb-2 text-xs text-text-muted dark:text-text-dark-muted"
      >
        Sur vingt ans, ce rythme de frais représente {{ eur(fees.projection_eur) }}.
        {{ fees.projection_note }}
      </p>

      <!-- Not conditional: the fee that matters most is the one not visible here. -->
      <p class="mt-3 rounded-md bg-surface-active px-3 py-2 text-xs italic text-text-muted dark:bg-surface-dark-active dark:text-text-dark-muted">
        {{ fees.ter_note }}
      </p>
    </BaseCard>

    <BaseCard v-if="exits">
      <h3 class="mb-1 text-sm font-semibold text-text-main dark:text-text-dark-main">
        Ce que deviennent les sorties
      </h3>
      <p class="mb-4 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ exits.verdict }}
      </p>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Gains coupés / pertes coupées"
          :metric="exits.ratio"
          kind="count"
        />
        <MetricTile label="Ce que sortir a coûté" :metric="exits.cost_eur" kind="eur" signed invert />
        <MetricTile label="Taux de réussite" :metric="exits.hit_rate" kind="pct" />
        <MetricTile label="Gain moyen / perte moyenne" :metric="exits.payoff_ratio" kind="count" />
      </div>

      <p class="mt-3 text-xs text-text-muted dark:text-text-dark-muted">
        Le coût des sorties compare, sur {{ exits.horizon_days }} jours après chaque vente, ce que
        la ligne vendue a fait contre l'indice.
        <template v-if="exits.recent_sales">
          {{ exits.recent_sales }} vente{{ exits.recent_sales > 1 ? 's' : '' }} trop récente{{ exits.recent_sales > 1 ? 's' : '' }} pour cet horizon :
          exclue{{ exits.recent_sales > 1 ? 's' : '' }} du calcul plutôt que mesurée sur quelques semaines.
        </template>
      </p>
    </BaseCard>
  </section>
</template>

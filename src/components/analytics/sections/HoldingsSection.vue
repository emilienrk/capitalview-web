<script setup lang="ts">
/**
 * Block 3 of the design — "what I actually hold": how many lines, how many
 * effective positions, how many genuinely independent bets.
 */
import { BaseCard } from '@/components'
import MetricTile from '@/components/analytics/MetricTile.vue'
import CorrelationMatrix from '@/components/analytics/CorrelationMatrix.vue'
import ReliabilityBadge from '@/components/analytics/ReliabilityBadge.vue'
import type { ConcentrationResponse, TurnoverOut } from '@/types'

defineProps<{
  concentration: ConcentrationResponse | null
  turnover: TurnoverOut | null
  isDark?: boolean
}>()
</script>

<template>
  <section v-if="concentration || turnover" class="mt-8">
    <h2 class="mb-3 text-base font-semibold text-text-main dark:text-text-dark-main">
      Ce que tu détiens vraiment
    </h2>

    <BaseCard v-if="concentration" class="mb-4">
      <p class="mb-4 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ concentration.verdict }}
      </p>

      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p
            class="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
          >
            Lignes détenues
          </p>
          <p class="text-2xl font-bold tabular-nums text-text-main dark:text-text-dark-main">
            {{ concentration.lines }}
          </p>
        </div>
        <MetricTile
          label="Positions effectives"
          :metric="concentration.effective_positions"
          kind="count"
        />
        <MetricTile
          label="Paris indépendants"
          :metric="concentration.independent_bets"
          kind="count"
        />
      </div>

      <CorrelationMatrix
        v-if="concentration.correlations.length"
        :correlations="concentration.correlations"
        :is-dark="isDark"
      />
      <ReliabilityBadge
        v-else
        :reliability="concentration.independent_bets.reliability"
        :caveat="concentration.independent_bets.caveat"
      />

      <p
        v-if="concentration.dropped.length"
        class="mt-3 text-xs text-text-muted dark:text-text-dark-muted"
      >
        Écartées faute d'historique suffisant : {{ concentration.dropped.join(', ') }}.
      </p>
      <p class="mt-2 text-xs italic text-text-muted dark:text-text-dark-muted">
        Ce n'est pas une analyse de la composition de tes ETF — elle n'est pas stockée. On mesure
        la redondance de comportement : à quel point tes lignes bougent ensemble.
      </p>
    </BaseCard>

    <BaseCard v-if="turnover">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricTile label="Taux de rotation annuel" :metric="turnover.annual_rate" kind="pct" />
        <div>
          <p
            class="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
          >
            Acheté / vendu sur la période
          </p>
          <p class="text-sm text-text-main dark:text-text-dark-main">
            {{ Math.round(Number(turnover.purchases_eur)) }} € achetés,
            {{ Math.round(Number(turnover.sales_eur)) }} € vendus
          </p>
        </div>
      </div>
      <p class="mt-3 text-xs text-text-muted dark:text-text-dark-muted">
        La rotation prend le plus petit des deux côtés : accumuler n'est pas tourner son
        portefeuille. C'est la variable que Barber &amp; Odean (2000) trouvent corrélée à la
        sous-performance.
      </p>
    </BaseCard>
  </section>
</template>

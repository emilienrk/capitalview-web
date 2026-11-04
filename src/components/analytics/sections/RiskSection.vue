<script setup lang="ts">
/**
 * "How much risk, and is the gap to the index real" — the one block that
 * judges the return rather than the behaviour, and does it with its own
 * uncertainty attached: a sign alone would crown or blame a streak.
 */
import { computed } from 'vue'
import CollapsibleBlock from '@/components/analytics/CollapsibleBlock.vue'
import ComparisonBars from '@/components/analytics/ComparisonBars.vue'
import FigureTile from '@/components/analytics/FigureTile.vue'
import MetricTile from '@/components/analytics/MetricTile.vue'
import SignificancePill from '@/components/analytics/SignificancePill.vue'
import { useFormatters } from '@/composables/useFormatters'
import type { DrawdownOut, RiskResponse } from '@/types'

const props = defineProps<{ risk: RiskResponse | null }>()

const { formatDate, formatPercent } = useFormatters()

function depth(drawdown: DrawdownOut | null): string {
  if (!drawdown) return '—'
  return formatPercent(Number(drawdown.depth) * 100)
}

/** "du 5 janv. 2022 au 12 oct. 2022, rattrapée le …" */
function span(drawdown: DrawdownOut | null): string {
  if (!drawdown || Number(drawdown.depth) >= 0) return ''
  const healed = drawdown.recovered
    ? `rattrapée le ${formatDate(drawdown.recovered)}`
    : 'pas encore rattrapée'
  return `du ${formatDate(drawdown.peak)} au ${formatDate(drawdown.trough)}, ${healed}`
}

const years = computed(() => {
  const value = props.risk?.years_to_conclude
  if (value === null || value === undefined) return null
  return Number(value)
})
</script>

<template>
  <section v-if="risk" class="mt-8">
    <h2 class="mb-3 text-base font-semibold text-text-main dark:text-text-dark-main">
      Risque et écart à l'indice
    </h2>

    <CollapsibleBlock
      id="analyse-risk"
      class="scroll-mt-20"
      title="Ce que le rendement a coûté en risque"
      :measurable="risk.volatility_ratio.value !== null"
      :summary="risk.volatility_ratio.caveat"
    >
      <template #badge>
        <SignificancePill :detectable="risk.is_detectable" :p-value="risk.p_value" />
      </template>
      <template #help>
        <li>
          <strong>Volatilité</strong> : de combien le portefeuille bouge d'une séance à l'autre,
          annualisé. Mesurée sur les <strong>séances de l'indice</strong>, pas sur les jours
          calendaires : un samedi ne bouge pas, et le compter diviserait le chiffre par 1,2. Les
          versements sont neutralisés comme dans le rendement pondéré par le temps.
        </li>
        <li>
          <strong>Bêta</strong> : de combien le portefeuille bouge quand l'indice bouge de 1.
          <strong>Écart de suivi</strong> : à quel point il s'en éloigne, dans un sens ou l'autre.
        </li>
        <li>
          <strong>Pire chute</strong> : la plus forte baisse depuis un sommet, et le temps mis à
          revenir au sommet. Celle de l'indice est mesurée sur les mêmes séances.
        </li>
        <li>
          <strong>Écart à l'indice</strong> : la moyenne de ce que vous faites de plus ou de moins
          que lui, par an. Un test de Student dit s'il se distingue du hasard ; s'il ne le fait pas,
          la page dit combien d'années il faudrait à ce rythme pour conclure — presque toujours
          des décennies, et c'est la réponse honnête.
        </li>
        <li>
          <strong>Rendement par unité de risque</strong> : un ratio de Sharpe sans taux sans risque,
          le même des deux côtés — il ne sert qu'à comparer.
        </li>
      </template>

      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricTile
          label="Amplitude face à l'indice"
          :metric="risk.volatility_ratio"
          :reading="risk.reading"
          kind="times"
        />
        <MetricTile label="Volatilité" :metric="risk.volatility" kind="pct" />
        <MetricTile label="Volatilité de l'indice" :metric="risk.benchmark_volatility" kind="pct" />
      </div>

      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricTile label="Bêta" :metric="risk.beta" kind="count" />
        <MetricTile label="Corrélation" :metric="risk.correlation" kind="count" />
        <MetricTile label="Écart de suivi" :metric="risk.tracking_error" kind="pct" />
      </div>

      <div v-if="risk.max_drawdown" class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FigureTile label="Pire chute depuis un sommet">
          <span class="text-danger">{{ depth(risk.max_drawdown) }}</span>
          <span class="ml-2 text-xs font-normal text-text-muted dark:text-text-dark-muted">
            {{ span(risk.max_drawdown) }}
          </span>
        </FigureTile>
        <FigureTile label="Celle de l'indice, mêmes séances">
          {{ depth(risk.benchmark_max_drawdown) }}
          <span class="ml-2 text-xs font-normal text-text-muted dark:text-text-dark-muted">
            {{ span(risk.benchmark_max_drawdown) }}
          </span>
        </FigureTile>
      </div>

      <p
        class="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
      >
        Rendement par unité de risque
      </p>
      <ComparisonBars
        format="decimal"
        :items="[
          { label: 'Indice', value: risk.benchmark_return_per_risk.value },
          { label: 'Vous', value: risk.return_per_risk.value, emphasis: true },
        ]"
      />

      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricTile label="Écart à l'indice, par an" :metric="risk.excess_return" kind="pct" signed />
        <FigureTile v-if="years !== null && !risk.is_detectable" label="Pour conclure, il faudrait">
          {{ years >= 100 ? 'plus d’un siècle' : `≈ ${Math.round(years)} ans` }}
        </FigureTile>
      </div>

      <p class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">
        {{ risk.verdict }}
      </p>
    </CollapsibleBlock>
  </section>
</template>

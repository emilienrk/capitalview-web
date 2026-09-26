<script setup lang="ts">
/**
 * Block 3 of the design — "what I actually hold": how many lines, how many
 * effective positions, how many genuinely independent bets.
 */
import CollapsibleBlock from '@/components/analytics/CollapsibleBlock.vue'
import FigureTile from '@/components/analytics/FigureTile.vue'
import MetricTile from '@/components/analytics/MetricTile.vue'
import NoteChip from '@/components/analytics/NoteChip.vue'
import CorrelationMatrix from '@/components/analytics/CorrelationMatrix.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { ConcentrationResponse, TurnoverOut } from '@/types'

defineProps<{
  concentration: ConcentrationResponse | null
  turnover: TurnoverOut | null
  isDark?: boolean
}>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

function eur(value: number | string): string {
  return maskValue(formatCurrency(Number(value)))
}
</script>

<template>
  <section v-if="concentration || turnover" class="mt-8">
    <h2 class="mb-3 text-base font-semibold text-text-main dark:text-text-dark-main">
      Ce qui est réellement détenu
    </h2>

    <CollapsibleBlock
      v-if="concentration"
      id="analyse-concentration"
      class="scroll-mt-20"
      title="Paris réellement indépendants"
      :measurable="concentration.effective_positions.value !== null"
      :summary="concentration.effective_positions.caveat"
    >
      <template v-if="concentration.dropped.length" #badge>
        <NoteChip
          :label="`Hors calcul : ${concentration.dropped.map((line) => line.name).join(', ')}`"
        >
          Ces lignes n'ont pas assez d'historique de cours pour entrer dans les corrélations.
        </NoteChip>
      </template>
      <template #help>
        <li>
          <strong>Comment le lire.</strong> On décompose la variance du portefeuille en
          composantes indépendantes, puis on compte combien pèsent réellement. Deux lignes qui
          corrèlent au-delà de 0,9 sont pratiquement les mêmes.
        </li>
        <li>
          <strong>La mesure discrimine peu</strong> entre deux portefeuilles actions long-only : la
          première composante y porte 98 à 99 % de la variance, et elle sort presque toujours entre
          1 et 1,5. C'est une propriété de la mesure de Meucci, pas un défaut du portefeuille.
        </li>
        <li>
          Ce n'est pas une analyse de la composition des ETF — elle n'est pas stockée. La mesure
          porte sur la redondance de comportement : à quel point les lignes bougent ensemble.
        </li>
      </template>
      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FigureTile label="Lignes détenues">{{ concentration.lines }}</FigureTile>
        <MetricTile
          label="Positions effectives"
          :metric="concentration.effective_positions"
          kind="count"
        />
        <MetricTile
          label="Paris indépendants"
          :metric="concentration.independent_bets"
          :reading="concentration.reading"
          kind="count"
        />
      </div>

      <CorrelationMatrix
        v-if="concentration.correlations.length"
        :correlations="concentration.correlations"
        :is-dark="isDark"
      />

      <p class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">
        {{ concentration.verdict }}
      </p>
    </CollapsibleBlock>

    <CollapsibleBlock
      v-if="turnover"
      class="scroll-mt-20"
      title="Rotation du portefeuille"
      :measurable="turnover.annual_rate.value !== null"
      :summary="turnover.annual_rate.caveat"
    >
      <template #help>
        <li>
          Le <strong>taux de rotation</strong> retient le plus petit des deux côtés, achats ou
          ventes : accumuler n'est pas tourner son portefeuille. C'est la variable que Barber &amp;
          Odean (2000) trouvent corrélée à la sous-performance.
        </li>
      </template>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricTile label="Rotation annuelle" :metric="turnover.annual_rate" kind="pct" />
        <FigureTile label="Acheté">{{ eur(turnover.purchases_eur) }}</FigureTile>
        <FigureTile label="Vendu">{{ eur(turnover.sales_eur) }}</FigureTile>
      </div>
    </CollapsibleBlock>
  </section>
</template>

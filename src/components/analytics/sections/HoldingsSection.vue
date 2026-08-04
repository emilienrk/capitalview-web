<script setup lang="ts">
/**
 * Block 3 of the design — "what I actually hold": how many lines, how many
 * effective positions, how many genuinely independent bets.
 */
import { BaseCard } from '@/components'
import CollapsibleBlock from '@/components/analytics/CollapsibleBlock.vue'
import MetricTile from '@/components/analytics/MetricTile.vue'
import ReadingScale from '@/components/analytics/ReadingScale.vue'
import CorrelationMatrix from '@/components/analytics/CorrelationMatrix.vue'
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
      Ce qui est réellement détenu
    </h2>

    <CollapsibleBlock
      v-if="concentration"
      title="Paris réellement indépendants"
      :measurable="concentration.effective_positions.value !== null"
      :summary="concentration.effective_positions.caveat"
    >
      <template #help>
        <li>
          <strong>Les paris indépendants ne discriminent presque pas</strong> entre deux
          portefeuilles actions long-only : la première composante principale y porte 98 à 99 % de
          la variance, et la mesure sort presque toujours entre 1 et 1,5. Elle répond « un seul
          pari : les actions », ce qui est exact et peu actionnable — c'est une propriété de la
          mesure de Meucci, pas un défaut du portefeuille.
        </li>
        <li>
          <strong>Comment le lire.</strong> On décompose la variance du portefeuille en
          composantes indépendantes, puis on compte combien pèsent réellement. En dessous de 1,5
          pari pour plusieurs lignes, l'app parle d'illusion de comptage. Deux lignes qui
          corrèlent au-delà de 0,9 sont signalées à part : ce sont pratiquement les mêmes.
          <ReadingScale
            :value="concentration.independent_bets.value"
            :bands="[
              { upTo: 1.5, label: 'un seul pari', tone: 'bad' },
              { upTo: 2.5, label: 'deux directions', tone: 'watch' },
              { label: 'réellement réparti', tone: 'good' },
            ]"
            :format="(n) => n.toFixed(1)"
          />
        </li>
        <li>
          Ce n'est pas une analyse de la composition des ETF — elle n'est pas stockée. La mesure
          porte sur la redondance de comportement : à quel point les lignes bougent ensemble.
        </li>
        <li>
          Le <strong>taux de rotation</strong> retient le plus petit des deux côtés, achats ou
          ventes : accumuler n'est pas tourner son portefeuille.
        </li>
      </template>
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

      <p class="mt-3 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ concentration.verdict }}
      </p>

      <p
        v-if="concentration.dropped.length"
        class="mt-3 text-xs text-text-muted dark:text-text-dark-muted"
      >
        Écartées faute d'historique suffisant :
        {{ concentration.dropped.map((line) => line.name).join(', ') }}.
      </p>
      <p class="mt-2 text-xs italic text-text-muted dark:text-text-dark-muted">
        Ce n'est pas une analyse de la composition des ETF — elle n'est pas stockée. La mesure
        porte sur la redondance de comportement : à quel point les lignes bougent ensemble. Sur un
        portefeuille actions long-only, elle sort presque toujours entre 1 et 1,5 : c'est une
        propriété de la mesure, pas un défaut du portefeuille.
      </p>
    </CollapsibleBlock>

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
        La rotation prend le plus petit des deux côtés : accumuler n'est pas tourner un
        portefeuille. C'est la variable que Barber &amp; Odean (2000) trouvent corrélée à la
        sous-performance.
      </p>
    </BaseCard>
  </section>
</template>

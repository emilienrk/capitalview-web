<script setup lang="ts">
/**
 * Block 2 of the design — "what it costs me": the investor gap, the
 * counterfactual bridge and the price paid on each order.
 */
import { BaseCard } from '@/components'
import BlockHelp from '@/components/analytics/BlockHelp.vue'
import CollapsibleBlock from '@/components/analytics/CollapsibleBlock.vue'
import ComparisonBars from '@/components/analytics/ComparisonBars.vue'
import MetricTile from '@/components/analytics/MetricTile.vue'
import NoteChip from '@/components/analytics/NoteChip.vue'
import SignificancePill from '@/components/analytics/SignificancePill.vue'
import AttributionWaterfall from '@/components/analytics/AttributionWaterfall.vue'
import SlippageDistribution from '@/components/analytics/SlippageDistribution.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { CounterfactualResponse, ExecutionResponse, InvestorGapResponse } from '@/types'

defineProps<{
  gap: InvestorGapResponse | null
  bridge: CounterfactualResponse | null
  execution: ExecutionResponse | null
  isDark?: boolean
}>()

const { formatCurrency, profitLossClass } = useFormatters()
const { maskValue } = usePrivacyMode()

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
      id="analyse-investor_gap"
      class="scroll-mt-20"
      title="Tes euros contre ta stratégie"
      :measurable="gap.gap.value !== null"
      :summary="gap.gap.caveat"
    >
      <template #help>
        <li>
          <strong>Stratégie</strong> : la performance pondérée par le temps (TWR), qui ignore le
          moment où l'argent entre. <strong>Tes euros</strong> : la performance pondérée par les
          flux (MWR), celle que ton argent a réellement obtenue. L'écart entre les deux ne vient
          que du moment des versements.
        </li>
        <li>
          <strong>Indice</strong> : l'indice de référence sur exactement la même période,
          dividendes compris.
        </li>
      </template>
      <p
        class="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
      >
        Rendement annuel
      </p>
      <ComparisonBars
        format="pct"
        :items="[
          { label: 'Stratégie', value: gap.twr_annualised.value },
          { label: 'Indice', value: gap.benchmark_annualised.value },
          { label: 'Tes euros', value: gap.mwr.value, emphasis: true },
        ]"
      />
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricTile label="Écart dû au timing" :metric="gap.gap" kind="pct" signed />
        <MetricTile label="En euros" :metric="gap.gap_eur" kind="eur" signed />
      </div>
      <p class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">
        {{ gap.verdict }}
      </p>
    </CollapsibleBlock>

    <BaseCard v-if="bridge" id="analyse-counterfactual" class="mb-4 scroll-mt-20">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-text-main dark:text-text-dark-main">
          Le portefeuille contre un robot
        </h3>
        <!-- The close of the current day does not exist yet: these figures are
             yesterday's, and a live statement will differ. -->
        <div class="flex items-center gap-2">
          <NoteChip :label="`au ${new Date(bridge.valued_at).toLocaleDateString('fr-FR')}`">
            Valorisé à la clôture de la veille : un relevé consulté aujourd'hui affichera une
            journée de marché de plus.
          </NoteChip>
          <BlockHelp>
            <li>
              Le robot part du <strong>même capital effectivement investi que toi</strong>, et se
              voit attribuer les mêmes liquidités non investies. Sans ça, un gros dépôt laissé
              dormant se lirait comme du talent d'investisseur.
            </li>
            <li>
              Le pont est <strong>dépendant du chemin</strong> : l'ordre des substitutions est un
              choix, et le réordonner déplacerait quelques euros entre termes voisins. La somme des
              termes réconcilie exactement avec ton portefeuille ; tout reliquat apparaît comme
              « non expliqué ».
            </li>
          </BlockHelp>
        </div>
      </div>
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

      <p class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">
        {{ bridge.verdict }}
      </p>
    </BaseCard>

    <CollapsibleBlock
      v-if="execution"
      id="analyse-execution"
      class="scroll-mt-20"
      title="Le prix payé sur chaque achat"
      :measurable="execution.slippage_bps.value !== null"
      :summary="execution.slippage_bps.caveat"
    >
      <template #badge>
        <SignificancePill :detectable="execution.is_detectable" :p-value="execution.p_value" />
      </template>
      <template #help>
        <li>
          Le prix de référence d'un achat est la <strong>moyenne des clôtures journalières</strong>
          de son mois calendaire (TWAP). Ce n'est pas un VWAP : les volumes intra-journaliers ne
          sont pas stockés. Le véritable <em>implementation shortfall</em> demanderait un
          horodatage de décision qui n'est pas collecté — il n'est ni calculé ni prétendu.
        </li>
        <li>
          Les tests de permutation re-tirent tes achats au hasard (5 000 fois) en gelant tout le
          reste, à graine fixe. Au-delà de p = 0,10, la page dit « hasard » — jamais « tu es bon ».
        </li>
      </template>
      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricTile
          label="Écart au prix moyen du mois"
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

      <p class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">
        {{ execution.verdict }}
      </p>
    </CollapsibleBlock>
  </section>
</template>

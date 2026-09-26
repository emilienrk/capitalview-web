<script setup lang="ts">
/**
 * Block 1 of the design — "what I actually do": purchase rhythm, the wait
 * between depositing and investing, and where in the market cycle the money
 * lands.
 *
 * Each card folds itself away when its gate withheld the headline number. The
 * headline carries its scale, so whether it is good or bad is read off the
 * colour; the one sentence under the figures only states them.
 */
import CollapsibleBlock from '@/components/analytics/CollapsibleBlock.vue'
import ComparisonBars from '@/components/analytics/ComparisonBars.vue'
import FigureTile from '@/components/analytics/FigureTile.vue'
import MetricTile from '@/components/analytics/MetricTile.vue'
import NoteChip from '@/components/analytics/NoteChip.vue'
import ReliabilityBadge from '@/components/analytics/ReliabilityBadge.vue'
import SignificancePill from '@/components/analytics/SignificancePill.vue'
import ContributionHeatmap from '@/components/analytics/ContributionHeatmap.vue'
import DensityComparison from '@/components/analytics/DensityComparison.vue'
import MarketStateScatter from '@/components/analytics/MarketStateScatter.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useReadingFormat } from '@/composables/useReadingFormat'
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
const { formatReading } = useReadingFormat()

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
    <CollapsibleBlock
      v-if="regularity"
      id="analyse-regularity"
      class="scroll-mt-20"
      title="Rythme réel des achats"
      :measurable="regularity.deployment_gap.value !== null"
      :summary="regularity.deployment_gap.caveat"
    >
      <template v-if="regularity.cadence_label" #badge>
        <NoteChip :label="regularity.cadence_label">
          Cadence lue sur tes ordres — soit un jour du mois, soit un intervalle médian — jamais
          déclarée.
        </NoteChip>
      </template>
      <template #help>
        <li>
          <strong>La régularité se mesure sur la courbe de capital cumulé</strong>, pas sur les
          mois calendaires : on regarde l'écart moyen à la droite qui joindrait le premier au
          dernier jour de la fenêtre, rapporté au capital total. Un rythme strict de 30 jours
          dérive d'un mois sur l'autre sans que la discipline change ; jugé au mois, il était
          sanctionné à tort. Les indicateurs mensuels restent affichés à titre d'illustration.
        </li>
        <li>
          <strong>Le repère dépend du nombre d'ordres</strong> : avec
          {{ regularity.purchase_count }} achats, des versements parfaitement réguliers donneraient
          déjà environ {{ (100 / (2 * regularity.purchase_count)).toFixed(1) }} % — c'est le
          plancher, pas un défaut. La droite est tenue jusqu'au double de ce plancher. À l'autre
          bout, 50 % correspond à tout verser en une seule fois le premier jour.
        </li>
        <li>
          Les <strong>mois « pleins » équivalents</strong> sont l'inverse d'un indice de
          concentration (HHI) porté sur l'axe du temps : combien d'achats mensuels égaux ta
          répartition représente.
        </li>
      </template>
      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Écart à un rythme régulier"
          :metric="regularity.deployment_gap"
          :reading="regularity.reading"
          kind="pct"
        />
        <MetricTile
          label="Mois « pleins » équivalents"
          :metric="regularity.equivalent_monthly_purchases"
          kind="count"
        />
        <MetricTile
          label="Mois avec un achat"
          :metric="regularity.invested_share"
          kind="pct"
        />
        <MetricTile
          label="Plus longue pause"
          :metric="regularity.longest_gap_months"
          kind="months"
        />
      </div>

      <!-- The heatmap is the same numbers in another shape: when the gate
           withheld them, the API sends an empty series and nothing is drawn. -->
      <ContributionHeatmap
        v-if="regularity.monthly.length"
        :monthly="regularity.monthly"
        :is-dark="isDark"
      />

      <p class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">
        {{ regularity.verdict }}
      </p>
    </CollapsibleBlock>

    <!-- ── 2.4 · deposit to purchase lag ─────────────────────────── -->
    <CollapsibleBlock
      v-if="depositLag"
      id="analyse-deposit_lag"
      class="scroll-mt-20"
      title="Entre le virement et l'investissement"
      :measurable="depositLag.median_days.value !== null"
      :summary="depositLag.median_days.caveat"
    >
      <template v-if="Number(depositLag.unmatched_share) > 0" #badge>
        <NoteChip
          :label="`${Math.round(Number(depositLag.unmatched_share) * 100)} % via provisions auto`"
        >
          Ces achats sont financés par des provisions automatiques : l'app crée le dépôt au moment
          de l'achat, donc leur délai réel est inconnu et ils sont exclus du calcul.
        </NoteChip>
      </template>
      <template #help>
        <li>
          <strong>Comment le lire.</strong> Chaque euro déposé est suivi jusqu'à l'achat qui le
          consomme (FIFO sur les liquidités), et le délai médian est celui de la moitié de tes
          euros.
        </li>
        <li>
          <strong>Deux conventions de coût coexistent</strong>, pour deux objets différents : ce
          délai suit un FIFO sur les liquidités, là où les plus-values réalisées de l'app utilisent
          le coût moyen pondéré. Ce n'est pas une incohérence.
        </li>
        <li>
          <strong>Déposé, jamais investi</strong> : dépôts moins achats, le chiffre que ton relevé
          confirme.
          <template
            v-if="Number(depositLag.unpaired_deposits_eur) > Number(depositLag.never_invested_eur)"
          >
            L'appariement FIFO en laisse {{ eur(depositLag.unpaired_deposits_eur) }} sans achat en
            face : les achats financés par une provision automatique ne consomment rien de la file.
          </template>
        </li>
        <li>
          <strong>Variabilité des montants</strong> : écart-type rapporté à la moyenne, mois par
          mois. Plus la barre est courte, plus le rythme est régulier.
        </li>
      </template>
      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricTile
          label="Délai médian"
          :metric="depositLag.median_days"
          :reading="depositLag.reading"
          kind="days"
        />
        <MetricTile label="9 fois sur 10, moins de" :metric="depositLag.p90_days" kind="days" />
        <FigureTile label="Déposé, jamais investi">
          {{ eur(depositLag.never_invested_eur) }}
        </FigureTile>
      </div>

      <div
        v-if="
          depositLag.deposit_variation.value !== null &&
          depositLag.purchase_variation.value !== null
        "
      >
        <p class="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted">
          Variabilité des montants
        </p>
        <ComparisonBars
          format="decimal"
          :items="[
            { label: 'Dépôts', value: depositLag.deposit_variation.value },
            { label: 'Achats', value: depositLag.purchase_variation.value, emphasis: true },
          ]"
        />
      </div>

      <p class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">
        {{ depositLag.verdict }}
      </p>
    </CollapsibleBlock>

    <!-- ── 2.2 · market conditioning ─────────────────────────────── -->
    <CollapsibleBlock
      v-if="conditioning"
      id="analyse-market_conditioning"
      class="scroll-mt-20"
      title="Contrarian ou suiveur ?"
      :measurable="conditioning.weighted_drawdown.value !== null"
      :summary="conditioning.weighted_drawdown.caveat"
    >
      <template #badge>
        <SignificancePill
          :detectable="conditioning.is_detectable"
          :p-value="conditioning.p_value"
        />
      </template>
      <template #help>
        <li>
          <strong>Distance au plus haut</strong> : où en est l'indice par rapport à son plus haut
          des douze derniers mois, le jour de l'achat, pondéré par les euros investis.
          <strong>Hausse du mois d'avant</strong> : sa variation sur les 21 séances précédentes.
        </li>
        <li>
          L'état du marché est mesuré en <strong>séances</strong>, jamais en jours calendaires, et
          un jour dont l'année glissante précédente n'est pas complète est écarté.
        </li>
        <li>
          Les tests de permutation re-tirent tes achats au hasard (5 000 fois) en gelant tout le
          reste, à graine fixe. Au-delà de p = 0,10, la page dit « hasard » — jamais « tu es bon ».
        </li>
        <li>Le découpage par année est une tendance, pas une preuve : 12 mois par période.</li>
      </template>
      <div class="mb-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p
            class="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
          >
            Distance au plus haut
            <ReliabilityBadge
              :reliability="conditioning.weighted_drawdown.reliability"
              :caveat="conditioning.weighted_drawdown.caveat"
            />
          </p>
          <ComparisonBars
            format="pct"
            :items="[
              { label: 'Tes achats', value: conditioning.weighted_drawdown.value, emphasis: true },
              { label: 'Un jour au hasard', value: conditioning.unconditional_drawdown.value },
            ]"
          />
        </div>
        <div>
          <p
            class="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
          >
            Hausse du mois d'avant
          </p>
          <ComparisonBars
            format="pct"
            :items="[
              { label: 'Tes achats', value: conditioning.weighted_momentum.value, emphasis: true },
              { label: 'Un jour au hasard', value: conditioning.unconditional_momentum.value },
            ]"
          />
        </div>
      </div>

      <template v-if="conditioning.density.length">
        <DensityComparison :density="conditioning.density" :is-dark="isDark" />
        <MarketStateScatter
          v-if="conditioning.points.length"
          :points="conditioning.points"
          :is-dark="isDark"
        />
      </template>

      <p class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">
        {{ conditioning.verdict }}
      </p>

      <div
        v-if="conditioning.yearly.length"
        class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted dark:text-text-dark-muted"
      >
        <span v-for="bucket in conditioning.yearly" :key="bucket.label">
          {{ bucket.label }} :
          <span class="tabular-nums">{{ formatReading(bucket.drawdown, 'pct') }}</span>
        </span>
      </div>
    </CollapsibleBlock>
  </section>
</template>

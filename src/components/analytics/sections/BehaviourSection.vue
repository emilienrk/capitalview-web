<script setup lang="ts">
/**
 * Block 1 of the design — "what I actually do": purchase rhythm, the wait
 * between depositing and investing, and where in the market cycle the money
 * lands.
 *
 * Each card folds itself away when its gate withheld the headline number. The
 * verdict sits under the figures, not above them: the numbers are the block, the
 * sentence is the reading.
 */
import CollapsibleBlock from '@/components/analytics/CollapsibleBlock.vue'
import MetricTile from '@/components/analytics/MetricTile.vue'
import ContributionHeatmap from '@/components/analytics/ContributionHeatmap.vue'
import DensityComparison from '@/components/analytics/DensityComparison.vue'
import MarketStateScatter from '@/components/analytics/MarketStateScatter.vue'
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
    <CollapsibleBlock
      v-if="regularity"
      title="Rythme réel des achats"
      :measurable="regularity.deployment_gap.value !== null"
      :summary="regularity.deployment_gap.caveat"
    >
      <template #help>
        <li>
          <strong>La régularité se mesure sur la courbe de capital cumulé</strong>, pas sur les
          mois calendaires : on regarde l'écart moyen à la droite qui joindrait le premier au
          dernier jour de la fenêtre, rapporté au capital total. Un rythme strict de 30 jours
          dérive d'un mois sur l'autre sans que la discipline change ; jugé au mois, il était
          sanctionné à tort. Les indicateurs mensuels restent affichés à titre d'illustration.
          Des ordres discrets laissent un plancher d'environ 1/(2n) : quelques pour cent d'écart,
          c'est une droite.
        </li>
        <li>
          <strong>La cadence est détectée, jamais déclarée.</strong> Elle est lue sur les ordres —
          soit un jour du mois, soit un intervalle médian — et c'est le plus resserré des deux qui
          est nommé. Aucun « mode d'investissement » n'est demandé : la page cherche la stratégie
          réelle, pas la stratégie annoncée.
        </li>
        <li>
          L'<strong>indice de concentration temporelle</strong> (HHI) appliqué à la répartition de
          ton capital dans le temps est un usage maison : l'indice est standard, le porter sur
          l'axe du temps est une lecture propre à cette page. Son inverse se lit en « achats
          mensuels égaux équivalents ».
        </li>
      </template>
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

      <p class="mt-3 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ regularity.verdict }}
      </p>
    </CollapsibleBlock>

    <!-- ── 2.4 · deposit to purchase lag ─────────────────────────── -->
    <CollapsibleBlock
      v-if="depositLag"
      title="Entre le virement et l'investissement"
      :measurable="depositLag.median_days.value !== null"
      :summary="depositLag.median_days.caveat"
    >
      <template #help>
        <li>
          <strong>Deux conventions de coût coexistent</strong>, pour deux objets différents : le
          délai dépôt → achat suit un <strong>FIFO sur les liquidités</strong> (on suit un euro),
          là où les plus-values réalisées de l'app utilisent le <strong>coût moyen pondéré</strong>.
          Ce n'est pas une incohérence, et aligner les deux ferait dire à cette page l'inverse de
          tes encarts de la page Bourse.
        </li>
        <li>
          <strong>Achat ≠ dépôt.</strong> Tout ce qui juge ton comportement d'investissement est
          calculé sur tes <strong>achats</strong>. Les dépôts ne servent qu'à trois choses : la
          performance réelle de tes euros, le délai avant investissement, et le coût du cash resté
          dormant.
        </li>
      </template>
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

      <p class="mt-3 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ depositLag.verdict }}
      </p>

      <p
        v-if="Number(depositLag.unmatched_share) > 0"
        class="mt-3 text-xs text-text-muted dark:text-text-dark-muted"
      >
        {{ Math.round(Number(depositLag.unmatched_share) * 100) }} % des achats sont financés
        par des provisions automatiques : l'app crée le dépôt au moment de l'achat, donc leur
        délai réel est inconnu et ils sont exclus du calcul plutôt qu'appariés de force.
      </p>
      <p
        v-if="Number(depositLag.never_invested_eur) > 0"
        class="mt-1 text-xs text-text-muted dark:text-text-dark-muted"
      >
        {{ eur(depositLag.never_invested_eur) }} déposés n'ont pas été investis — dépôts moins
        achats, le chiffre que ton relevé confirme.
        <template
          v-if="Number(depositLag.unpaired_deposits_eur) > Number(depositLag.never_invested_eur)"
        >
          L'appariement FIFO en laisse {{ eur(depositLag.unpaired_deposits_eur) }} sans achat en
          face : les achats financés par une provision automatique ne consomment rien de la file.
        </template>
      </p>
    </CollapsibleBlock>

    <!-- ── 2.2 · market conditioning ─────────────────────────────── -->
    <CollapsibleBlock
      v-if="conditioning"
      title="Contrarian ou suiveur ?"
      :measurable="conditioning.weighted_drawdown.value !== null"
      :summary="conditioning.weighted_drawdown.caveat"
    >
      <template #help>
        <li>
          L'état du marché est mesuré en <strong>séances</strong>, jamais en jours calendaires, et
          un jour dont l'année glissante précédente n'est pas complète est écarté : un plus-haut
          calculé sur une fenêtre tronquée afficherait un écart quasi nul et se lirait à tort
          comme un achat dans le creux.
        </li>
        <li>
          Les tests de permutation re-tirent tes achats au hasard (5 000 fois) en gelant tout le
          reste. Le tirage est <strong>à graine fixe</strong> : deux consultations donnent le même
          résultat. Au-delà de p = 0,10, la page dit « rien de détectable » — jamais « tu es bon ».
        </li>
      </template>
      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="L'euro moyen entre à"
          :metric="conditioning.weighted_drawdown"
          kind="pct"
        />
        <MetricTile
          label="Un jour au hasard"
          :metric="conditioning.unconditional_drawdown"
          kind="pct"
        />
        <MetricTile
          label="Élan du marché aux achats"
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

      <p class="mt-3 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ conditioning.verdict }}
      </p>

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
    </CollapsibleBlock>
  </section>
</template>

<script setup lang="ts">
/**
 * Blocks 4 and 3.2 — fees, and what happens on the way out.
 */
import CollapsibleBlock from '@/components/analytics/CollapsibleBlock.vue'
import MetricTile from '@/components/analytics/MetricTile.vue'
import ReadingScale from '@/components/analytics/ReadingScale.vue'
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

    <CollapsibleBlock
      v-if="fees"
      title="Frais de courtage"
      :measurable="fees.total_fees.value !== null"
      :summary="fees.total_fees.caveat"
    >
      <template #help>
        <li>
          <strong>Le seuil de frais par ordre est un calibrage, pas un verdict.</strong> C'est la
          charge annuelle en points de base qui dit s'il y a quelque chose à corriger : chez un
          courtier à moins d'un euro l'ordre, tous les ordres passent sous le seuil alors que la
          charge totale reste dérisoire.
        </li>
        <li>
          <strong>Comment les lire.</strong> La charge annuelle rapporte tes frais au capital
          déployé, ramenés à l'année et exprimés en points de base (1 bp = 0,01 %). La ligne est
          à 25 bps : c'est elle qui décide si le bloc parle d'un problème ou d'un simple
          calibrage, pas le nombre d'ordres sous le seuil.
          <ReadingScale
            :value="fees.annual_bps.value"
            :bands="[
              { upTo: 25, label: 'sous la cible', tone: 'good' },
              { upTo: 75, label: 'ça se voit', tone: 'watch' },
              { label: 'ça pèse', tone: 'bad' },
            ]"
            :format="(n) => `${Math.round(n)} bps`"
          />
        </li>
      </template>
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

      <p class="mt-3 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ fees.verdict }}
      </p>

      <!-- Not conditional: the fee that matters most is the one not visible here. -->
      <p class="mt-3 rounded-md bg-surface-active px-3 py-2 text-xs italic text-text-muted dark:bg-surface-dark-active dark:text-text-dark-muted">
        {{ fees.ter_note }}
      </p>
    </CollapsibleBlock>

    <CollapsibleBlock
      v-if="exits"
      title="Ce que deviennent les sorties"
      :measurable="exits.ratio.value !== null"
      :summary="exits.verdict"
    >
      <template #help>
        <li>
          <strong>Deux conventions de frais cohabitent ici, et c'est voulu.</strong> L'effet de
          disposition compare le prix de vente au prix d'achat moyen <em>hors frais</em> : c'est
          une mesure psychologique, et la théorie des perspectives situe le point de référence au
          prix payé par titre (Odean, 1998). Le taux de réussite et le rapport gain/perte, eux,
          sont <em>nets de frais des deux côtés</em>, parce qu'ils demandent si l'aller-retour a
          rapporté — la distinction sur laquelle repose Barber &amp; Odean (2000). Une même vente
          peut donc être un gain pour la première mesure et une position perdante pour la seconde :
          l'écart est exactement la commission.
        </li>
        <li>
          <strong>Le P/L réalisé affiché sur la page Bourse peut différer</strong> de ce que dit ce
          bloc sur la même vente. Ce n'est pas une incohérence : la page Bourse répond à la
          question comptable — combien d'argent est rentré — et celle-ci à la question
          comportementale.
        </li>
        <li>
          Le <strong>coût des sorties</strong> compare la ligne vendue à l'indice sur un horizon
          fixe d'un an. Les ventes trop récentes pour cet horizon sont exclues et comptées, jamais
          évaluées sur quelques semaines.
        </li>
        <li>
          <strong>Comment le lire.</strong> Le rapport compare la facilité avec laquelle tu
          réalises un gain à celle avec laquelle tu réalises une perte. Au-dessus de 1, tu coupes
          ce qui monte et gardes ce qui baisse — l'effet de disposition d'Odean.
          <ReadingScale
            :value="exits.ratio.value"
            :bands="[
              { upTo: 1, label: 'pas d’effet', tone: 'good' },
              { upTo: 2, label: 'tu coupes tes gains', tone: 'watch' },
              { label: 'marqué', tone: 'bad' },
            ]"
            :format="(n) => `${n.toFixed(1)}×`"
          />
        </li>
      </template>
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

      <p class="mt-3 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ exits.verdict }}
      </p>

      <p class="mt-3 text-xs text-text-muted dark:text-text-dark-muted">
        Le coût des sorties compare, sur {{ exits.horizon_days }} jours après chaque vente, ce que
        la ligne vendue a fait contre l'indice.
        <template v-if="exits.recent_sales">
          {{ exits.recent_sales }} vente{{ exits.recent_sales > 1 ? 's' : '' }} trop récente{{ exits.recent_sales > 1 ? 's' : '' }} pour cet horizon :
          exclue{{ exits.recent_sales > 1 ? 's' : '' }} du calcul plutôt que mesurée sur quelques semaines.
        </template>
      </p>
    </CollapsibleBlock>
  </section>
</template>

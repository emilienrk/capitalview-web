<script setup lang="ts">
/**
 * Blocks 4 and 3.2 — fees, and what happens on the way out.
 */
import CollapsibleBlock from '@/components/analytics/CollapsibleBlock.vue'
import FigureTile from '@/components/analytics/FigureTile.vue'
import MetricTile from '@/components/analytics/MetricTile.vue'
import NoteChip from '@/components/analytics/NoteChip.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { ExitsResponse, FeesResponse } from '@/types'

defineProps<{ fees: FeesResponse | null; exits: ExitsResponse | null }>()

const { formatCurrency, formatPercent } = useFormatters()
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
      id="analyse-fees"
      class="scroll-mt-20"
      title="Frais de courtage"
      :measurable="fees.total_fees.value !== null"
      :summary="fees.total_fees.caveat"
    >
      <!-- Beside the title, before any figure: it is the reading condition for
           the three totals, each of which also carries its own marker. -->
      <template v-if="fees.is_estimated" #badge>
        <NoteChip :label="`Estimé · frais saisis sur ${fees.orders_with_fee}/${fees.order_count} ordres`">
          {{ Math.round(Number(fees.fee_coverage) * 100) }} % des ordres portent leurs frais, soit
          {{ eur(fees.recorded_fees) }} saisis. Les autres sont comptés au même tarif — un frais non
          saisi a quand même été payé. Le seuil par ordre, lui, est mesuré sur les seuls ordres
          facturés.
        </NoteChip>
      </template>
      <template #help>
        <li>
          <strong>Coût annuel</strong> : tes frais rapportés au capital déployé, ramenés à l'année.
          La ligne est à 0,25 % : c'est elle qui dit si les frais pèsent, pas le nombre d'ordres
          sous le seuil.
        </li>
        <li>
          <strong>Ordre minimum rentable</strong> : la taille d'ordre sous laquelle ta commission
          moyenne dépasse 0,25 % du montant. C'est un calibrage : chez un courtier à moins d'un
          euro l'ordre, tous les ordres peuvent passer dessous alors que la charge totale reste
          dérisoire. Sous une commission proportionnelle, il n'existe pas — seul le tarif compte.
        </li>
        <li v-if="fees.projection_eur !== null">
          <strong>Sur 20 ans</strong> : {{ fees.projection_note }}
        </li>
        <li>{{ fees.ter_note }}</li>
      </template>
      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Coût annuel"
          :metric="fees.annual_bps"
          :reading="fees.reading"
          kind="bps"
        />
        <MetricTile label="Frais payés" :metric="fees.total_fees" kind="eur" />
        <MetricTile label="Part du capital déployé" :metric="fees.fee_share" kind="pct" />
        <!-- Under a percentage tariff the entry cost is the same on a 100 € order
             as on a 10 000 € one: there is no size to fall under, so the tile is
             replaced rather than shown empty. -->
        <FigureTile v-if="fees.model === 'proportionnel'" label="Tarif par ordre">
          {{ fees.fee_rate === null ? '—' : formatPercent(Number(fees.fee_rate) * 100).replace(/^\+/, '') }}
        </FigureTile>
        <MetricTile
          v-else
          label="Ordre minimum rentable"
          :metric="fees.threshold_order_size"
          kind="eur"
        />
        <FigureTile v-if="fees.projection_eur !== null" label="Sur 20 ans">
          {{ eur(fees.projection_eur) }}
        </FigureTile>
      </div>

      <p class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">
        {{ fees.verdict }}
      </p>
    </CollapsibleBlock>

    <CollapsibleBlock
      v-if="exits"
      id="analyse-exits"
      class="scroll-mt-20"
      title="Ce que deviennent les ventes"
      :measurable="exits.ratio.value !== null"
      :summary="exits.verdict"
    >
      <template v-if="exits.recent_sales" #badge>
        <NoteChip
          :label="`${exits.recent_sales} vente${exits.recent_sales > 1 ? 's' : ''} récente${exits.recent_sales > 1 ? 's' : ''} exclue${exits.recent_sales > 1 ? 's' : ''}`"
        >
          Trop récentes pour l'horizon de {{ exits.horizon_days }} jours : exclues du calcul
          plutôt que mesurées sur quelques semaines.
        </NoteChip>
      </template>
      <template #help>
        <li>
          <strong>Gains vendus / pertes vendues</strong> compare la facilité avec laquelle tu
          réalises un gain à celle avec laquelle tu réalises une perte. Au-dessus de 1, tu vends ce
          qui monte et gardes ce qui baisse — l'effet de disposition (Odean, 1998).
        </li>
        <li>
          <strong>Ce que vendre a coûté</strong> compare la ligne vendue à l'indice sur
          {{ exits.horizon_days }} jours après chaque vente.
        </li>
        <li>
          <strong>Deux conventions de frais cohabitent.</strong> L'effet de disposition compare le
          prix de vente au prix d'achat moyen <em>hors frais</em> ; le taux de réussite et le
          rapport gain/perte sont <em>nets de frais des deux côtés</em> (Barber &amp; Odean,
          2000). Une même vente peut donc être un gain pour l'un et une perte pour l'autre :
          l'écart est exactement la commission.
        </li>
        <li>
          <strong>Le P/L réalisé de la page Bourse peut différer</strong> : elle répond à la
          question comptable, ce bloc à la question comportementale.
        </li>
      </template>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Gains vendus / pertes vendues"
          :metric="exits.ratio"
          :reading="exits.reading"
          kind="times"
        />
        <MetricTile label="Ce que vendre a coûté" :metric="exits.cost_eur" kind="eur" signed invert />
        <MetricTile label="Taux de réussite" :metric="exits.hit_rate" kind="pct" />
        <MetricTile label="Gain moyen / perte moyenne" :metric="exits.payoff_ratio" kind="times" />
      </div>

      <p class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">
        {{ exits.verdict }}
      </p>
    </CollapsibleBlock>
  </section>
</template>

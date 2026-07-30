<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useDarkMode } from '@/composables/useDarkMode'
import PageHeader from '@/components/PageHeader.vue'
import { BaseCard, BaseAlert, BaseSpinner, BaseEmptyState } from '@/components'
import ReliabilityBadge from '@/components/analytics/ReliabilityBadge.vue'
import AttributionWaterfall from '@/components/analytics/AttributionWaterfall.vue'
import SlippageDistribution from '@/components/analytics/SlippageDistribution.vue'
import BenchmarkPicker from '@/components/analytics/BenchmarkPicker.vue'
import type { MetricOut } from '@/types'

const analysis = useAnalysisStore()
const { formatCurrency, formatPercent, profitLossClass } = useFormatters()
const { maskValue } = usePrivacyMode()
const { isDark } = useDarkMode()

const gap = computed(() => analysis.data?.investor_gap ?? null)
const bridge = computed(() => analysis.data?.counterfactual ?? null)
const execution = computed(() => analysis.data?.execution ?? null)
const benchmarkKey = computed(() => analysis.data?.benchmark_asset_key ?? '')

const cards = computed(() => {
  const g = gap.value
  if (!g) return []
  return [
    { key: 'twr', label: 'Performance de ta stratégie', metric: g.twr_annualised, kind: 'pct' as const },
    { key: 'benchmark', label: 'Indice de référence sur la même période', metric: g.benchmark_annualised, kind: 'pct' as const },
    { key: 'mwr', label: 'Performance réelle de tes euros', metric: g.mwr, kind: 'pct' as const },
    { key: 'gap', label: 'Écart investisseur', metric: g.gap, kind: 'pct' as const, signed: true },
    { key: 'gap_eur', label: 'Ce que cet écart représente', metric: g.gap_eur, kind: 'eur' as const, signed: true },
  ]
})

function display(metric: MetricOut, kind: 'pct' | 'eur' | 'bps'): string {
  if (metric.value === null) return '—'
  const n = Number(metric.value)
  if (kind === 'pct') return formatPercent(n * 100)
  if (kind === 'bps') return `${n > 0 ? '+' : ''}${Math.round(n)} bps`
  return maskValue(formatCurrency(n))
}

function formatEur(value: number | string): string {
  return maskValue(formatCurrency(Number(value)))
}

async function reload(): Promise<void> {
  await analysis.fetchAnalytics(true)
}

onMounted(() => analysis.fetchAnalytics())
</script>

<template>
  <div>
    <PageHeader
      title="Analyse"
      description="Ce que tes données disent de ton comportement d'investisseur"
    />

    <div v-if="analysis.isLoading && !analysis.data" class="flex justify-center py-20">
      <BaseSpinner size="lg" label="Analyse en cours..." />
    </div>

    <BaseAlert v-else-if="analysis.error" variant="danger" class="mb-6">
      {{ analysis.error }}
    </BaseAlert>

    <BaseEmptyState
      v-else-if="!gap"
      title="Pas encore assez d'historique"
      description="L'analyse comportementale demande plusieurs mois de transactions pour dire quoi que ce soit d'utile."
    />

    <template v-else>
      <BaseCard class="mb-6">
        <BenchmarkPicker :current="benchmarkKey" @changed="reload" />
      </BaseCard>

      <BaseCard class="mb-6">
        <p class="text-sm leading-relaxed text-text-main dark:text-text-dark-main">{{ gap.verdict }}</p>
      </BaseCard>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BaseCard v-for="card in cards" :key="card.key">
          <p class="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted">
            {{ card.label }}
          </p>
          <p
            :class="[
              'mb-2 text-2xl font-bold tabular-nums',
              card.signed && card.metric.value !== null
                ? profitLossClass(Number(card.metric.value))
                : 'text-text-main dark:text-text-dark-main',
            ]"
          >
            {{ display(card.metric, card.kind) }}
          </p>
          <ReliabilityBadge :reliability="card.metric.reliability" :caveat="card.metric.caveat" />
        </BaseCard>
      </div>

      <!-- ── Counterfactual bridge ─────────────────────────────────── -->
      <BaseCard v-if="bridge" class="mt-6">
        <h2 class="mb-1 text-sm font-semibold text-text-main dark:text-text-dark-main">
          Ce que ton comportement t'a coûté
        </h2>
        <p class="mb-4 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
          {{ bridge.verdict }}
        </p>

        <AttributionWaterfall :bridge="bridge" :is-dark="isDark" />

        <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted dark:text-text-dark-muted">
          <span>Robot : {{ formatEur(bridge.baseline) }}</span>
          <span>Toi : {{ formatEur(bridge.final) }}</span>
          <span :class="profitLossClass(Number(bridge.behaviour_cost))">
            Écart : {{ formatEur(bridge.behaviour_cost) }}
          </span>
        </div>
      </BaseCard>

      <!-- ── Execution cost ────────────────────────────────────────── -->
      <BaseCard v-if="execution" class="mt-6">
        <h2 class="mb-1 text-sm font-semibold text-text-main dark:text-text-dark-main">
          Le prix que tu paies quand tu achètes
        </h2>
        <p class="mb-4 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
          {{ execution.verdict }}
        </p>

        <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p class="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted">
              Écart moyen au prix du mois
            </p>
            <p
              :class="[
                'mb-2 text-2xl font-bold tabular-nums',
                execution.slippage_bps.value !== null
                  ? profitLossClass(-Number(execution.slippage_bps.value))
                  : 'text-text-main dark:text-text-dark-main',
              ]"
            >
              {{ display(execution.slippage_bps, 'bps') }}
            </p>
            <ReliabilityBadge
              :reliability="execution.slippage_bps.reliability"
              :caveat="execution.slippage_bps.caveat"
            />
          </div>
          <div>
            <p class="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted">
              Sur {{ execution.order_count }} achats
            </p>
            <p
              :class="[
                'mb-2 text-2xl font-bold tabular-nums',
                execution.cost_eur.value !== null
                  ? profitLossClass(-Number(execution.cost_eur.value))
                  : 'text-text-main dark:text-text-dark-main',
              ]"
            >
              {{ display(execution.cost_eur, 'eur') }}
            </p>
            <ReliabilityBadge
              :reliability="execution.cost_eur.reliability"
              :caveat="execution.cost_eur.caveat"
            />
          </div>
        </div>

        <!-- A chart is the same numbers in another shape: when the gate withheld
             them, it must not draw them either. -->
        <SlippageDistribution
          v-if="execution.distribution"
          :distribution="execution.distribution"
          :is-dark="isDark"
        />

        <p
          v-if="execution.p_value !== null"
          class="mt-2 text-xs text-text-muted dark:text-text-dark-muted"
        >
          Test de permutation : p = {{ Number(execution.p_value).toFixed(3) }}
          <template v-if="!execution.is_detectable"> — indistinguable du hasard.</template>
        </p>
      </BaseCard>

      <!-- ── Method note ───────────────────────────────────────────── -->
      <details class="mt-6 rounded-lg border border-border px-4 py-3 dark:border-border-dark">
        <summary class="cursor-pointer text-sm font-medium text-text-main dark:text-text-dark-main">
          Notes de méthode
        </summary>
        <ul class="mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed text-text-muted dark:text-text-dark-muted">
          <li>
            Le prix de référence d'un achat est la <strong>moyenne des clôtures journalières</strong>
            de son mois calendaire (TWAP). Ce n'est pas un VWAP : les volumes intra-journaliers ne
            sont pas stockés. Le véritable <em>implementation shortfall</em> demanderait un horodatage
            de décision qui n'est pas collecté — il n'est ni calculé ni prétendu.
          </li>
          <li>
            Le pont contrefactuel est <strong>dépendant du chemin</strong> : l'ordre des substitutions
            ({{ bridge?.order.join(' → ') }}) est un choix, et le réordonner déplacerait quelques
            euros entre termes voisins. La somme des termes réconcilie exactement avec ton
            portefeuille ; tout reliquat apparaît comme « non expliqué » plutôt que d'être absorbé.
          </li>
          <li>
            Le test de permutation re-date chaque achat au hasard parmi les jours de bourse de son
            propre mois, 5 000 fois, à montant et actif constants. Le tirage est
            <strong>à graine fixe</strong> : deux consultations donnent le même résultat.
          </li>
          <li v-if="bridge?.truncated">
            L'indice de référence n'a pas d'historique sur toute ta période : la comparaison démarre
            au {{ bridge.covered_from }}, sur {{ bridge.covered_days }} jours.
          </li>
          <li>
            Une métrique marquée « données insuffisantes » n'affiche ni valeur ni graphique. Un
            graphe vide est plus honnête qu'un graphe faux.
          </li>
        </ul>
      </details>
    </template>
  </div>
</template>

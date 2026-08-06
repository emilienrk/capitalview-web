<script setup lang="ts">
/**
 * Block 5 — adherence to the declared plan. Absent entirely when no plan is
 * declared: the form in the settings is what brings it into existence.
 */
import { computed } from 'vue'
import CollapsibleBlock from '@/components/analytics/CollapsibleBlock.vue'
import MetricTile from '@/components/analytics/MetricTile.vue'
import ReadingScale from '@/components/analytics/ReadingScale.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { PlanResponse } from '@/types'

const props = defineProps<{ plan: PlanResponse | null }>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

function eur(value: number | string | null): string {
  return value === null ? '—' : maskValue(formatCurrency(Number(value)))
}

const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]

/** "2025-06-01" → "juin 2025". An ISO date is not a month anyone reads. */
function monthLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value ?? '')
  if (!match) return value ?? ''
  const month = MONTHS[Number(match[2]) - 1]
  return month ? `${month} ${match[1]}` : value
}

const drift = computed(() =>
  (props.plan?.drift ?? []).filter((row) => Number(row.target) || Number(row.actual)),
)

/**
 * Each period with the stretch it covers and how it actually went. The API
 * sends start months; a reader needs ranges, and the last one is in force.
 */
const periods = computed(() =>
  (props.plan?.periods ?? []).map((period) => ({
    ...period,
    from: monthLabel(period.since),
    to: period.until ? monthLabel(period.until) : null,
    // Only worth naming when it is off: a period followed to the point needs no
    // sentence, and every period carrying one would bury the one that does.
    drift: Number(period.flow_drift_l1 ?? 0),
    ratio: period.adherence_ratio === null ? null : Number(period.adherence_ratio),
  })),
)

/** The revision half-applied: the amount changed, the split did not. */
const DRIFT_THRESHOLD_POINTS = 10
</script>

<template>
  <section v-if="plan && !plan.error" class="mt-8">
    <h2 class="mb-3 text-base font-semibold text-text-main dark:text-text-dark-main">
      Adhérence au plan cible
    </h2>

    <CollapsibleBlock
      :measurable="plan.adherence_ratio.value !== null"
      title="Adhérence au plan"
      :summary="plan.adherence_ratio.caveat"
    >
      <template #help>
        <li>
          Le <strong>plan cible</strong> n'est évalué qu'à partir du mois que tu déclares, et sur
          les mois complets uniquement. Appliqué rétroactivement, il produirait un verdict sur des
          mois où tu n'avais rien promis ; en comptant le mois en cours, il montrerait un
          sous-investissement à chaque ouverture de la page.
        </li>
        <li>
          <strong>Un plan cible peut être fractionné en périodes.</strong> Chaque mois complet est
          alors confronté à la cible en vigueur ce mois-là, et la dérive d'allocation lit la
          période courante — c'est elle qui dit vers quoi rééquilibrer aujourd'hui.
        </li>
        <li>
          <strong>Deux dérives, deux questions.</strong> La dérive d'allocation compare le
          portefeuille <em>tel qu'il est aujourd'hui</em> à ta cible actuelle : elle dit combien
          rééquilibrer. La dérive par période compare les <em>euros versés pendant la période</em>
          à la répartition que tu avais déclarée pour elle : elle seule peut juger une période
          terminée, puisque le marché a depuis déformé les poids du portefeuille.
        </li>
        <li>
          <strong>Comment la lire.</strong> L'adhérence est ce que tu as investi divisé par ce
          que tu avais promis, sur les mois complets depuis ta date de départ. L'app considère le
          plan tenu à partir de 0,98, et signale la dérive d'allocation au-delà de 10 points.
          <ReadingScale
            :value="plan.adherence_ratio.value"
            :bands="[
              { upTo: 0.8, label: 'décroché', tone: 'bad' },
              { upTo: 0.98, label: 'en retrait', tone: 'watch' },
              { label: 'tenu', tone: 'good' },
            ]"
            :format="(n) => n.toFixed(2)"
          />
        </li>
      </template>
      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricTile label="Adhérence" :metric="plan.adherence_ratio" kind="pct" />
        <MetricTile label="Investi par mois, en réel" :metric="plan.average_monthly" kind="eur" />
        <MetricTile label="Dérive d'allocation" :metric="plan.drift_l1" kind="points" />
      </div>

      <div class="mb-3 text-xs text-text-muted dark:text-text-dark-muted">
        Plan : {{ eur(plan.total_target) }} sur {{ plan.months.length }} mois complets depuis
        {{ monthLabel(plan.since) }}. Investi : {{ eur(plan.total_invested) }}.
        <template v-if="plan.rebalance_eur">
          À rééquilibrer : {{ eur(plan.rebalance_eur) }}.
        </template>
      </div>

      <!-- Each month is scored against the target in force that month, so a plan
           that changed does not create a shortfall it never had. Spelled out as
           rows: a run-on sentence of periods is unreadable on a phone. -->
      <ul
        v-if="periods.length > 1"
        class="mb-4 flex flex-col gap-2 rounded-card bg-background-subtle p-3 dark:bg-background-dark-subtle"
      >
        <li v-for="period in periods" :key="period.since">
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
            <span class="text-text-muted dark:text-text-dark-muted">
              {{ period.to ? `${period.from} → ${period.to}` : `Depuis ${period.from}` }}
              <span v-if="!period.to" class="text-[10px] uppercase tracking-wider">en cours</span>
            </span>
            <span class="tabular-nums text-text-main dark:text-text-dark-main">
              {{ eur(period.monthly_target) }}/mois
              <span v-if="period.ratio !== null" class="text-text-muted dark:text-text-dark-muted">
                · tenu à {{ Math.round(period.ratio * 100) }} %
              </span>
            </span>
          </div>
          <!-- Only the flows can judge a period that has ended: the portfolio
               held today has been reshaped by the market since. -->
          <p
            v-if="period.drift > DRIFT_THRESHOLD_POINTS"
            class="mt-0.5 text-[11px] text-warning"
          >
            Répartition réelle des achats à {{ period.drift.toFixed(0) }} points de la cible de
            cette période.
          </p>
        </li>
      </ul>

      <!-- Four numeric columns do not fit a 360px screen, and a table that has
           to be swiped sideways is a table nobody reads. The gap column is the
           one to drop: it is Réel − Cible, and both are right there. The figures
           never wrap, so "36.0 pts" stays one number. -->
      <div v-if="drift.length" class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="text-text-muted dark:text-text-dark-muted">
            <tr>
              <th class="py-1 font-medium">Ligne</th>
              <th class="whitespace-nowrap py-1 pl-3 text-right font-medium">Cible</th>
              <th class="whitespace-nowrap py-1 pl-3 text-right font-medium">Réel</th>
              <th class="hidden whitespace-nowrap py-1 pl-3 text-right font-medium sm:table-cell">
                Écart
              </th>
            </tr>
          </thead>
          <tbody class="text-text-main dark:text-text-dark-main">
            <tr
              v-for="row in drift"
              :key="row.asset_key"
              class="border-t border-border dark:border-border-dark"
            >
              <td class="py-1.5 pr-2" :title="row.asset_key">{{ row.name }}</td>
              <td class="whitespace-nowrap py-1.5 pl-3 text-right tabular-nums">
                {{ Number(row.target).toFixed(1) }} %
              </td>
              <td class="whitespace-nowrap py-1.5 pl-3 text-right tabular-nums">
                {{ Number(row.actual).toFixed(1) }} %
              </td>
              <td
                class="hidden whitespace-nowrap py-1.5 pl-3 text-right tabular-nums sm:table-cell"
              >
                {{ (Number(row.actual) - Number(row.target)).toFixed(1) }} pts
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="mt-3 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ plan.verdict }}
      </p>
    </CollapsibleBlock>
  </section>
</template>

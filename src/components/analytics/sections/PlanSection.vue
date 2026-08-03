<script setup lang="ts">
/**
 * Block 5 — adherence to the declared plan. Absent entirely when no plan is
 * declared: the form in the page header is what brings it into existence.
 */
import { computed } from 'vue'
import CollapsibleBlock from '@/components/analytics/CollapsibleBlock.vue'
import MetricTile from '@/components/analytics/MetricTile.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { PlanResponse } from '@/types'

const props = defineProps<{ plan: PlanResponse | null }>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

function eur(value: number | string | null): string {
  return value === null ? '—' : maskValue(formatCurrency(Number(value)))
}

const drift = computed(() => (props.plan?.drift ?? []).filter((row) => Number(row.target) || Number(row.actual)))
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
      </template>
      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricTile label="Adhérence" :metric="plan.adherence_ratio" kind="pct" />
        <MetricTile label="Investi par mois, en réel" :metric="plan.average_monthly" kind="eur" />
        <MetricTile label="Dérive d'allocation" :metric="plan.drift_l1" kind="points" />
      </div>

      <div class="mb-3 text-xs text-text-muted dark:text-text-dark-muted">
        Plan : {{ eur(plan.total_target) }} sur {{ plan.months.length }} mois complets depuis
        {{ plan.since }}. Investi : {{ eur(plan.total_invested) }}.
        <template v-if="plan.rebalance_eur">
          À rééquilibrer : {{ eur(plan.rebalance_eur) }}.
        </template>
      </div>

      <!-- Each month is scored against the target in force that month, so a plan
           that changed does not create a shortfall it never had. -->
      <div v-if="plan.periods.length > 1" class="mb-3 text-xs text-text-muted dark:text-text-dark-muted">
        Plan en {{ plan.periods.length }} périodes :
        <span v-for="(period, index) in plan.periods" :key="period.since">
          <template v-if="index">, </template>
          {{ eur(period.monthly_target) }}/mois depuis {{ period.since.slice(0, 7) }}
        </span>
      </div>

      <table v-if="drift.length" class="w-full text-left text-xs">
        <thead class="text-text-muted dark:text-text-dark-muted">
          <tr>
            <th class="py-1 font-medium">Ligne</th>
            <th class="py-1 text-right font-medium">Cible</th>
            <th class="py-1 text-right font-medium">Réel</th>
            <th class="py-1 text-right font-medium">Écart</th>
          </tr>
        </thead>
        <tbody class="text-text-main dark:text-text-dark-main">
          <tr v-for="row in drift" :key="row.asset_key" class="border-t border-border dark:border-border-dark">
            <td class="py-1" :title="row.asset_key">{{ row.name }}</td>
            <td class="py-1 text-right tabular-nums">{{ Number(row.target).toFixed(1) }} %</td>
            <td class="py-1 text-right tabular-nums">{{ Number(row.actual).toFixed(1) }} %</td>
            <td class="py-1 text-right tabular-nums">
              {{ (Number(row.actual) - Number(row.target)).toFixed(1) }} pts
            </td>
          </tr>
        </tbody>
      </table>

      <p class="mt-3 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted">
        {{ plan.verdict }}
      </p>
    </CollapsibleBlock>
  </section>
</template>

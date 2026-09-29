<script setup lang="ts">
/**
 * Each calendar year: what was paid in, what the money earned on top of it, and
 * the stock pocket's return beside the index over the same days.
 *
 * The gain answers "how much did I make", the return "how well did it do": a
 * big deposit just before a rise inflates the first and not the second, which
 * is why only the return is set against the index.
 */
import { computed } from 'vue'
import CollapsibleBlock from '@/components/analytics/CollapsibleBlock.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { YearlyPerformanceResponse } from '@/types'

const props = defineProps<{ yearly: YearlyPerformanceResponse | null }>()

const { formatCurrency, formatNumber, formatPercent, profitLossClass } = useFormatters()
const { maskValue } = usePrivacyMode()

/** Ratio from the API, or null. */
function ratio(value: number | string | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value)
}

function day(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  )
}

const rows = computed(() =>
  [...(props.yearly?.years ?? [])].reverse().map((year) => {
    const stocks = ratio(year.stocks?.time_weighted_return)
    const index = ratio(year.benchmark_return)
    const current = year.end < `${year.year}-12-31`
    return {
      year: year.year,
      span: year.complete ? null : current ? `au ${day(year.end)}` : `depuis le ${day(year.covered_from)}`,
      paid: Number(year.net_contributions),
      gain: Number(year.gain),
      stocks,
      index,
      gap: stocks !== null && index !== null ? (stocks - index) * 100 : null,
      crypto: ratio(year.crypto?.time_weighted_return),
    }
  }),
)

const hasCrypto = computed(() => rows.value.some((row) => row.crypto !== null))

function pct(value: number | null): string {
  return value === null ? '—' : formatPercent(value * 100)
}

function eur(value: number, signed = false): string {
  const text = formatCurrency(value)
  return maskValue(signed && value > 0 ? `+${text}` : text)
}
</script>

<template>
  <section v-if="yearly" class="mt-8">
    <h2 class="mb-3 text-base font-semibold text-text-main dark:text-text-dark-main">Année par année</h2>

    <CollapsibleBlock
      title="Ce que chaque année a rapporté"
      :measurable="rows.length > 0"
      summary="Aucune année mesurée : il faut des comptes bourse, crypto ou placements."
    >
      <template #badge>
        <span class="text-xs text-text-muted dark:text-text-dark-muted">Indice : {{ yearly.benchmark_name }}</span>
      </template>
      <template #help>
        <li>
          <strong>Gagné</strong> : ce que bourse, crypto et placements ont produit dans l'année,
          versements retirés. Verser 1 000 € n'est pas gagner 1 000 €.
        </li>
        <li>
          <strong>Bourse</strong> et <strong>Crypto</strong> : rendement pondéré dans le temps. Il
          neutralise le moment des versements, c'est lui qui se compare à l'indice.
        </li>
        <li>
          <strong>Indice</strong> : mesuré sur les mêmes jours que la poche bourse. L'écart est la
          différence en points.
        </li>
        <li>
          La première année et l'année en cours sont partielles : leur pourcentage couvre les jours
          indiqués, sans être ramené à un an. Les placements n'ont pas de pourcentage, leur valeur
          ne bouge qu'aux relevés saisis.
        </li>
      </template>

      <!-- Paid-in and gap drop below sm: the gap is Bourse − Indice, both on screen. -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="text-text-muted dark:text-text-dark-muted">
            <tr>
              <th class="py-1 font-medium">Année</th>
              <th class="hidden whitespace-nowrap py-1 pl-3 text-right font-medium sm:table-cell">Versé</th>
              <th class="whitespace-nowrap py-1 pl-3 text-right font-medium">Gagné</th>
              <th class="whitespace-nowrap py-1 pl-3 text-right font-medium">Bourse</th>
              <th class="whitespace-nowrap py-1 pl-3 text-right font-medium">Indice</th>
              <th class="hidden whitespace-nowrap py-1 pl-3 text-right font-medium sm:table-cell">Écart</th>
              <th v-if="hasCrypto" class="hidden whitespace-nowrap py-1 pl-3 text-right font-medium sm:table-cell">
                Crypto
              </th>
            </tr>
          </thead>
          <tbody class="text-text-main dark:text-text-dark-main">
            <tr v-for="row in rows" :key="row.year" class="border-t border-border dark:border-border-dark">
              <td class="py-1.5 pr-2">
                <span class="font-medium tabular-nums">{{ row.year }}</span>
                <span v-if="row.span" class="ml-1.5 text-text-muted dark:text-text-dark-muted">{{ row.span }}</span>
              </td>
              <td class="hidden whitespace-nowrap py-1.5 pl-3 text-right tabular-nums sm:table-cell">
                {{ eur(row.paid) }}
              </td>
              <td class="whitespace-nowrap py-1.5 pl-3 text-right font-medium tabular-nums" :class="profitLossClass(row.gain)">
                {{ eur(row.gain, true) }}
              </td>
              <td class="whitespace-nowrap py-1.5 pl-3 text-right tabular-nums">{{ pct(row.stocks) }}</td>
              <td class="whitespace-nowrap py-1.5 pl-3 text-right tabular-nums text-text-muted dark:text-text-dark-muted">
                {{ pct(row.index) }}
              </td>
              <td
                class="hidden whitespace-nowrap py-1.5 pl-3 text-right tabular-nums sm:table-cell"
                :class="row.gap === null ? 'text-text-muted dark:text-text-dark-muted' : profitLossClass(row.gap)"
              >
                {{ row.gap === null ? '—' : `${row.gap > 0 ? '+' : ''}${formatNumber(row.gap, 1)} pts` }}
              </td>
              <td v-if="hasCrypto" class="hidden whitespace-nowrap py-1.5 pl-3 text-right tabular-nums sm:table-cell">
                {{ pct(row.crypto) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CollapsibleBlock>
  </section>
</template>

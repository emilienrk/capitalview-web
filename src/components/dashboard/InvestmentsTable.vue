<script setup lang="ts">
/**
 * The investments side by side, in exact figures. Stock and crypto gains are
 * measured on cost basis (PRU), placements on net deposits: two different
 * questions, so the footnote says which one each row answers.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { InvestmentRow } from '@/composables/useDashboardOverview'

const props = defineProps<{ rows: InvestmentRow[] }>()

const { formatCurrency, formatPercent, profitLossClass } = useFormatters()
const { maskValue } = usePrivacyMode()

const totals = computed(() => {
  const value = props.rows.reduce((sum, row) => sum + row.value, 0)
  const invested = props.rows.reduce((sum, row) => sum + row.invested, 0)
  return { value, invested, gain: value - invested, percent: invested > 0 ? ((value - invested) / invested) * 100 : null }
})

const ROUTES: Record<InvestmentRow['key'], string> = { stock: 'stock', crypto: 'crypto', placements: 'placements' }

function signed(value: number): string {
  return `${value < 0 ? '−' : '+'}${maskValue(formatCurrency(Math.abs(value)))}`
}
</script>

<template>
  <div>
    <table class="w-full text-sm">
      <thead>
        <tr class="text-left text-xs font-medium text-text-muted dark:text-text-dark-muted">
          <th scope="col" class="pb-2 font-medium">Poche</th>
          <th scope="col" class="pb-2 text-right font-medium">Valeur</th>
          <th scope="col" class="pb-2 text-right font-medium">Investi</th>
          <th scope="col" class="pb-2 text-right font-medium">Plus-value</th>
        </tr>
      </thead>
      <tbody class="tabular-nums">
        <tr
          v-for="row in rows"
          :key="row.key"
          class="border-t border-surface-border dark:border-surface-dark-border"
        >
          <th scope="row" class="py-2.5 text-left font-medium">
            <RouterLink :to="{ name: ROUTES[row.key] }" class="text-text-main hover:text-primary dark:text-text-dark-main">
              {{ row.label }}
            </RouterLink>
          </th>
          <td class="py-2.5 text-right text-text-main dark:text-text-dark-main">{{ maskValue(formatCurrency(row.value)) }}</td>
          <td class="py-2.5 text-right text-text-muted dark:text-text-dark-muted">{{ maskValue(formatCurrency(row.invested)) }}</td>
          <td class="py-2.5 text-right" :class="profitLossClass(row.gain)">
            {{ signed(row.gain) }}
            <span class="block text-xs">{{ formatPercent(row.percent) }}</span>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="rows.length > 1" class="tabular-nums">
        <tr class="border-t-2 border-surface-border font-semibold dark:border-surface-dark-border">
          <th scope="row" class="py-2.5 text-left">Total</th>
          <td class="py-2.5 text-right text-text-main dark:text-text-dark-main">{{ maskValue(formatCurrency(totals.value)) }}</td>
          <td class="py-2.5 text-right text-text-muted dark:text-text-dark-muted">{{ maskValue(formatCurrency(totals.invested)) }}</td>
          <td class="py-2.5 text-right" :class="profitLossClass(totals.gain)">
            {{ signed(totals.gain) }}
            <span class="block text-xs font-medium">{{ formatPercent(totals.percent) }}</span>
          </td>
        </tr>
      </tfoot>
    </table>
    <p class="mt-3 text-xs text-text-muted dark:text-text-dark-muted">
      Bourse et crypto : plus-value sur le prix de revient (PRU), hors espèces en compte.
      <template v-if="rows.some((row) => row.key === 'placements')">Placements : sur les versements nets.</template>
    </p>
  </div>
</template>

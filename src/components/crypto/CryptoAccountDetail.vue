<script setup lang="ts">
import { AlertCircle, Pencil } from 'lucide-vue-next'
import { computed } from 'vue'
import { BaseBadge, BaseButton, BaseEmptyState, BaseSegmentedControl } from '@/components'
import { useFormatters } from '@/composables/useFormatters'
import { useDisplayTimezone } from '@/composables/useDisplayTimezone'
import { isFiatSymbol } from '@/utils/cryptoTransactionTypes'
import type { PositionResponse, TransactionResponse } from '@/types'

/**
 * Positions / transaction-history tabs of a crypto account.
 * Shared by the SINGLE-mode card and the MULTI-mode account expansion,
 * which previously duplicated these ~210 template lines.
 */
const props = defineProps<{
  positions: PositionResponse[]
  transactions: TransactionResponse[]
  /** Page-level EUR/USD-aware formatter (depends on the currency toggle). */
  formatAmount: (value: number | string | null | undefined) => string
  /** Same as formatAmount but privacy-masked. */
  maskAmount: (value: number | string | null | undefined) => string
}>()

const tab = defineModel<'positions' | 'history'>('tab', { default: 'positions' })

const emit = defineEmits<{
  (e: 'edit-transaction', tx: TransactionResponse): void
}>()

const { formatNumber, formatPercent, formatDateShort, profitLossClass } = useFormatters()
const { effectiveTimezoneLabel } = useDisplayTimezone()

const TX_TYPE_ORDER: Record<string, number> = {
  REWARD: 0,
  BUY: 1,
  TRANSFER: 2,
  SPEND: 3,
  WITHDRAW: 4,
  FEE: 5,
  ANCHOR: 6,
}

const sortedTransactions = computed(() => {
  return [...props.transactions].sort((a, b) => {
    const dateA = new Date(a.executed_at).getTime()
    const dateB = new Date(b.executed_at).getTime()
    if (dateA !== dateB) return dateB - dateA
    // Group together by group_uuid
    const gA = a.group_uuid ?? ''
    const gB = b.group_uuid ?? ''
    if (gA !== gB) return gA.localeCompare(gB)
    return (TX_TYPE_ORDER[a.type] ?? 99) - (TX_TYPE_ORDER[b.type] ?? 99)
  })
})

const multiRowGroups = computed(() => {
  const counts: Record<string, number> = {}
  for (const tx of props.transactions) {
    if (tx.group_uuid) {
      counts[tx.group_uuid] = (counts[tx.group_uuid] || 0) + 1
    }
  }
  return new Set(Object.entries(counts).filter(([, c]) => c > 1).map(([g]) => g))
})

function isGroupStart(tx: TransactionResponse, idx: number): boolean {
  if (!tx.group_uuid || !multiRowGroups.value.has(tx.group_uuid)) return false
  if (idx === 0) return true
  return sortedTransactions.value[idx - 1]?.group_uuid !== tx.group_uuid
}

function isGroupEnd(tx: TransactionResponse, idx: number): boolean {
  if (!tx.group_uuid || !multiRowGroups.value.has(tx.group_uuid)) return false
  if (idx === sortedTransactions.value.length - 1) return true
  return sortedTransactions.value[idx + 1]?.group_uuid !== tx.group_uuid
}

function isInGroup(tx: TransactionResponse): boolean {
  return !!tx.group_uuid && multiRowGroups.value.has(tx.group_uuid)
}

const groupColorIndex = computed(() => {
  const map: Record<string, number> = {}
  let colorIdx = 0
  for (const tx of sortedTransactions.value) {
    if (tx.group_uuid && multiRowGroups.value.has(tx.group_uuid) && !(tx.group_uuid in map)) {
      map[tx.group_uuid] = colorIdx % 2
      colorIdx++
    }
  }
  return map
})

function rowTooltip(tx: TransactionResponse): string | null {
  if (tx.type === 'ANCHOR') return 'Ancre de valorisation : fige le prix de revient de l\'opération'
  if (tx.type === 'FEE') return 'Frais réseau / exchange — déduit du solde token'
  if (tx.type === 'BUY' && tx.price_per_unit === 0) return 'Ligne d\'achat — le coût EUR est porté par l\'ancre du même groupe'
  return null
}

function isNegativeType(type: string): boolean {
  return ['SPEND', 'FEE', 'TRANSFER', 'WITHDRAW'].includes(type)
}

function txBadgeVariant(type: string): 'success' | 'danger' | 'warning' | 'info' | 'secondary' {
  if (type === 'BUY') return 'success'
  if (type === 'SPEND' || type === 'WITHDRAW') return 'danger'
  if (type === 'FEE') return 'warning'
  if (type === 'REWARD') return 'info'
  return 'secondary'
}
</script>

<template>
  <div>
    <!-- Tabs (Segmented Control) -->
    <div class="mb-6">
      <BaseSegmentedControl v-model="tab" :options="[{ key: 'positions', label: 'Positions' }, { key: 'history', label: 'Historique' }]" variant="surface" size="md" />
    </div>

    <!-- Positions Tab -->
    <div v-if="tab === 'positions'">
      <template v-if="positions.length">
        <!-- Desktop table -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[11px] text-text-muted dark:text-text-dark-muted uppercase tracking-wider border-b border-surface-border dark:border-surface-dark-border">
                <th class="px-4 py-3">Actif</th>
                <th class="px-4 py-3 text-right">Quantité</th>
                <th class="px-4 py-3 text-right">PRU</th>
                <th class="px-4 py-3 text-right">Investi</th>
                <th class="px-4 py-3 text-right">Cours</th>
                <th class="px-4 py-3 text-right">Valeur</th>
                <th class="px-4 py-3 text-right">P/L</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-border dark:divide-surface-dark-border">
              <tr v-for="pos in positions" :key="pos.asset_key" class="hover:bg-surface-hover dark:hover:bg-surface-dark-hover transition-colors">
                <td class="px-4 py-3">
                  <p class="font-semibold text-text-main dark:text-text-dark-main">{{ pos.name || pos.asset_key }}</p>
                  <p v-if="pos.name" class="text-xs text-text-muted dark:text-text-dark-muted">{{ pos.asset_key }}</p>
                </td>
                <td class="px-4 py-3 text-right font-mono text-text-body dark:text-text-dark-body">{{ formatNumber(pos.total_amount, 6) }}</td>
                <td class="px-4 py-3 text-right text-text-muted dark:text-text-dark-muted">{{ isFiatSymbol(pos.asset_key) ? '—' : formatAmount(pos.average_buy_price) }}</td>
                <td class="px-4 py-3 text-right text-text-muted dark:text-text-dark-muted">{{ isFiatSymbol(pos.asset_key) ? '—' : maskAmount(pos.total_invested) }}</td>
                <td class="px-4 py-3 text-right text-text-muted dark:text-text-dark-muted">{{ isFiatSymbol(pos.asset_key) ? '—' : formatAmount(pos.current_price) }}</td>
                <td class="px-4 py-3 text-right font-semibold text-text-main dark:text-text-dark-main">{{ maskAmount(pos.current_value) }}</td>
                <td class="px-4 py-3 text-right">
                  <span :class="['font-semibold', profitLossClass(pos.profit_loss)]">{{ formatPercent(pos.profit_loss_percentage) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Mobile cards -->
        <div class="md:hidden space-y-3">
          <div
            v-for="pos in positions"
            :key="pos.asset_key"
            class="rounded-secondary border border-surface-border dark:border-surface-dark-border p-4"
          >
            <div class="flex items-center justify-between mb-3">
              <div>
                <p class="font-semibold text-text-main dark:text-text-dark-main">{{ pos.name || pos.asset_key }}</p>
                <p v-if="pos.name" class="text-xs text-text-muted dark:text-text-dark-muted">{{ pos.asset_key }}</p>
              </div>
              <span :class="['text-sm font-bold tabular-nums', profitLossClass(pos.profit_loss)]">
                {{ formatPercent(pos.profit_loss_percentage) }}
              </span>
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <p class="text-text-muted dark:text-text-dark-muted">Quantité</p>
                <p class="font-mono font-medium text-text-body dark:text-text-dark-body">{{ formatNumber(pos.total_amount, 6) }}</p>
              </div>
              <div class="text-right">
                <p class="text-text-muted dark:text-text-dark-muted">Valeur</p>
                <p class="font-semibold text-text-main dark:text-text-dark-main">{{ maskAmount(pos.current_value) }}</p>
              </div>
              <div>
                <p class="text-text-muted dark:text-text-dark-muted">PRU</p>
                <p class="text-text-body dark:text-text-dark-body">{{ isFiatSymbol(pos.asset_key) ? '—' : formatAmount(pos.average_buy_price) }}</p>
              </div>
              <div class="text-right">
                <p class="text-text-muted dark:text-text-dark-muted">Investi</p>
                <p class="text-text-body dark:text-text-dark-body">{{ isFiatSymbol(pos.asset_key) ? '—' : maskAmount(pos.total_invested) }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>
      <BaseEmptyState v-else title="Aucune position" description="Ajoutez des transactions pour voir vos positions crypto" />
    </div>

    <!-- History Tab -->
    <div v-else>
      <template v-if="transactions.length">
        <!-- Desktop table -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[11px] text-text-muted dark:text-text-dark-muted uppercase tracking-wider border-b border-surface-border dark:border-surface-dark-border">
                <th class="w-1 px-0 py-3"></th>
                <th class="px-4 py-3">Date</th>
                <th class="px-4 py-3">Type</th>
                <th class="px-4 py-3">Token</th>
                <th class="px-4 py-3 text-right">Quantité</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(tx, idx) in sortedTransactions" :key="tx.id"
                :class="[
                  'transition-colors',
                  isInGroup(tx)
                    ? (groupColorIndex[tx.group_uuid!] === 0
                        ? 'bg-primary/3 dark:bg-primary/6 hover:bg-primary/6 dark:hover:bg-primary/10'
                        : 'bg-secondary/3 dark:bg-secondary/6 hover:bg-secondary/6 dark:hover:bg-secondary/10')
                    : 'hover:bg-surface-hover dark:hover:bg-surface-dark-hover',
                  isGroupStart(tx, idx) ? 'border-t border-surface-border dark:border-surface-dark-border' : '',
                  !isInGroup(tx) ? 'border-t border-surface-border/50 dark:border-surface-dark-border/50' : '',
                ]"
              >
                <td class="w-1 px-0 py-0 relative">
                  <div
                    v-if="isInGroup(tx)"
                    :class="[
                      'absolute left-0 w-0.75',
                      groupColorIndex[tx.group_uuid!] === 0 ? 'bg-primary/40' : 'bg-secondary/40',
                      isGroupStart(tx, idx) ? 'top-0 rounded-t-full' : 'top-0',
                      isGroupEnd(tx, idx)   ? 'bottom-0 rounded-b-full' : 'bottom-0',
                    ]"
                    style="top: 0; bottom: 0;"
                  />
                </td>
                <td class="px-4 py-3 text-text-muted dark:text-text-dark-muted whitespace-nowrap">{{ formatDateShort(tx.executed_at) }}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center gap-1.5">
                    <BaseBadge :variant="txBadgeVariant(tx.type)">
                      {{ tx.type }}
                    </BaseBadge>
                    <span
                      v-if="rowTooltip(tx)"
                      class="relative group/tip cursor-help"
                    >
                      <AlertCircle class="w-3.5 h-3.5 text-text-muted/50 dark:text-text-dark-muted/50" />
                      <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 text-[11px] leading-snug text-primary-content bg-text-main dark:bg-text-dark-main rounded-secondary shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                        {{ rowTooltip(tx) }}
                      </span>
                    </span>
                  </span>
                </td>
                <td class="px-4 py-3 font-medium text-text-main dark:text-text-dark-main">{{ tx.asset_key }}</td>
                <td
                  class="px-4 py-3 text-right font-mono"
                  :class="tx.type === 'ANCHOR' ? 'text-text-muted dark:text-text-dark-muted' : isNegativeType(tx.type) ? 'text-danger' : 'text-success'"
                >
                  {{ tx.type === 'ANCHOR' ? '' : isNegativeType(tx.type) ? '−' : '+' }}{{ formatNumber(tx.amount, 6) }}
                </td>
                <td class="px-4 py-3 text-right">
                  <BaseButton size="sm" variant="ghost" @click="emit('edit-transaction', tx)">
                    <Pencil class="w-4 h-4" />
                  </BaseButton>
                </td>
              </tr>
            </tbody>
          </table>
          <p class="px-4 pt-2 text-xs text-text-muted dark:text-text-dark-muted">
            Dates affichées en {{ effectiveTimezoneLabel }}
          </p>
        </div>
        <!-- Mobile cards -->
        <div class="md:hidden space-y-2">
          <div
            v-for="tx in sortedTransactions" :key="tx.id"
            :class="[
              'rounded-secondary p-3 transition-colors',
              isInGroup(tx)
                ? (groupColorIndex[tx.group_uuid!] === 0
                    ? 'bg-primary/5 dark:bg-primary/10 border-l-2 border-primary/30'
                    : 'bg-secondary/5 dark:bg-secondary/10 border-l-2 border-secondary/30')
                : 'border border-surface-border dark:border-surface-dark-border',
            ]"
          >
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-2 min-w-0">
                <BaseBadge :variant="txBadgeVariant(tx.type)">
                  {{ tx.type }}
                </BaseBadge>
                <span class="font-semibold text-sm text-text-main dark:text-text-dark-main truncate">{{ tx.asset_key }}</span>
              </div>
              <BaseButton size="sm" variant="ghost" @click="emit('edit-transaction', tx)">
                <Pencil class="w-4 h-4" />
              </BaseButton>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-text-muted dark:text-text-dark-muted">{{ formatDateShort(tx.executed_at) }}</span>
              <span
                class="font-mono font-medium"
                :class="tx.type === 'ANCHOR' ? 'text-text-muted dark:text-text-dark-muted' : isNegativeType(tx.type) ? 'text-danger' : 'text-success'"
              >
                {{ tx.type === 'ANCHOR' ? '' : isNegativeType(tx.type) ? '−' : '+' }}{{ formatNumber(tx.amount, 6) }}
              </span>
            </div>
          </div>
        </div>
      </template>
      <BaseEmptyState v-else title="Aucune transaction" description="L'historique des transactions est vide" />
    </div>
  </div>
</template>

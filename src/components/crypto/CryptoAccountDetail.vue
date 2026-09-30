<script setup lang="ts">
import { AlertCircle, ChevronRight, Pencil, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { BaseBadge, BaseButton, BaseEmptyState, BaseSegmentedControl, BaseTooltip } from '@/components'
import type { BadgeVariant } from '@/components/base/BaseBadge.vue'
import { useFormatters } from '@/composables/useFormatters'
import { useDisplayTimezone } from '@/composables/useDisplayTimezone'
import { useDisplayLocale } from '@/composables/useDisplayLocale'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { isFiatSymbol } from '@/utils/cryptoTransactionTypes'
import { changeSince, type PriceReference } from '@/utils/cryptoPositions'
import {
  buildCryptoOperations,
  CRYPTO_OPERATION_LABELS,
  operationUnitPrice,
  type CryptoAmount,
  type CryptoOperation,
  type CryptoOperationKind,
} from '@/utils/cryptoOperations'
import type { NegativeBalanceResponse, PositionResponse, TransactionResponse } from '@/types'

/**
 * Positions / transaction-history tabs of a crypto account.
 * Shared by the SINGLE-mode card and the MULTI-mode account expansion.
 */
const props = defineProps<{
  /** Every position of the account, fiat balances included: they go under the table. */
  positions: PositionResponse[]
  transactions: TransactionResponse[]
  /** Prices of the last snapshot before today, for the change column. */
  priceReference: PriceReference | null
  negativeBalances?: NegativeBalanceResponse[]
}>()

const tab = defineModel<'positions' | 'history'>('tab', { default: 'positions' })

const emit = defineEmits<{
  (e: 'edit-transaction', tx: TransactionResponse): void
  /** The API deletes a row's whole group, so one leg id removes the operation. */
  (e: 'delete-operation', legId: string, summary: string): void
  (e: 'show-price', position: PositionResponse): void
}>()

const { formatCurrency, formatNumber, formatPercent, formatDateShort, formatDayMonth, profitLossClass } = useFormatters()
const { maskValue } = usePrivacyMode()
const { effectiveTimezone, effectiveTimezoneLabel } = useDisplayTimezone()
const { effectiveLocale } = useDisplayLocale()

const money = (value: number | string | null | undefined): string => maskValue(formatCurrency(value))
const signedMoney = (value: number | string | null | undefined): string => {
  if (value == null) return '—'
  return `${Number(value) > 0 ? '+' : ''}${money(value)}`
}
const quantity = (item: CryptoAmount): string => `${formatNumber(item.amount, 6)} ${item.asset}`

// ── Positions ──────────────────────────────────────────────

const holdings = computed(() =>
  props.positions
    .filter((pos) => !isFiatSymbol(pos.asset_key))
    .sort((a, b) => Number(b.total_invested ?? 0) - Number(a.total_invested ?? 0)),
)
const cashPositions = computed(() => props.positions.filter((pos) => isFiatSymbol(pos.asset_key)))
const cashValue = computed(() => cashPositions.value.reduce((sum, pos) => sum + Number(pos.current_value ?? 0), 0))
const onlyEuros = computed(() => cashPositions.value.every((pos) => pos.asset_key === 'EUR'))
const cashDetail = computed(() =>
  onlyEuros.value ? null : cashPositions.value.map((pos) => `${formatNumber(pos.total_amount, 2)} ${pos.asset_key}`).join(' · '),
)

const holdingsValue = computed(() =>
  holdings.value.reduce((sum, pos) => sum + Math.max(Number(pos.current_value ?? 0), 0), 0),
)

function weight(pos: PositionResponse): number | null {
  if (pos.current_value == null || holdingsValue.value <= 0) return null
  return (Number(pos.current_value) / holdingsValue.value) * 100
}

function change(pos: PositionResponse): number | null {
  return changeSince(pos.current_price, props.priceReference?.prices[pos.asset_key])
}

const changeHeader = computed(() => (props.priceReference ? `Depuis le ${formatDayMonth(props.priceReference.date)}` : null))

// ── Negative balances ──────────────────────────────────────

// Below a euro the gap is fee dust, not a transaction worth hunting for.
const NEGATIVE_BALANCE_MIN_EUR = 1

const balanceGaps = computed(() =>
  (props.negativeBalances ?? []).filter(
    (gap) => gap.shortfall_value == null || Number(gap.shortfall_value) >= NEGATIVE_BALANCE_MIN_EUR,
  ),
)

function showGap(gap: NegativeBalanceResponse): void {
  historyFilter.value = gap.asset_key
  tab.value = 'history'
}

// ── History ────────────────────────────────────────────────

const operations = computed(() => buildCryptoOperations(props.transactions))
const FIAT_KINDS = new Set<CryptoOperationKind>(['fiat_deposit', 'fiat_withdraw'])

const historyFilter = ref('all')
const filterOptions = computed(() => {
  const assets = [...new Set(operations.value.flatMap((op) => op.assets))].sort()
  const options = [{ key: 'all', label: 'Toutes' }, ...assets.map((asset) => ({ key: asset, label: asset }))]
  if (operations.value.some((op) => FIAT_KINDS.has(op.kind))) options.push({ key: 'fiat', label: 'Euros' })
  return options
})

const visibleOperations = computed(() => {
  const filter = historyFilter.value
  if (filter === 'all') return operations.value
  if (filter === 'fiat') return operations.value.filter((op) => FIAT_KINDS.has(op.kind))
  return operations.value.filter((op) => op.assets.includes(filter))
})

const monthKey = computed(
  () => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: effectiveTimezone.value }),
)
const monthLabel = computed(
  () => new Intl.DateTimeFormat(effectiveLocale.value, { year: 'numeric', month: 'long', timeZone: effectiveTimezone.value }),
)

const months = computed(() => {
  const out: { key: string; label: string; operations: CryptoOperation[] }[] = []
  for (const op of visibleOperations.value) {
    const date = new Date(op.executedAt)
    const key = monthKey.value.format(date)
    let month = out[out.length - 1]
    if (month?.key !== key) {
      const label = monthLabel.value.format(date)
      month = { key, label: label.charAt(0).toUpperCase() + label.slice(1), operations: [] }
      out.push(month)
    }
    month.operations.push(op)
  }
  return out
})

const expanded = ref(new Set<string>())
function toggle(op: CryptoOperation): void {
  if (op.legs.length < 2) return
  const next = new Set(expanded.value)
  if (next.has(op.key)) next.delete(op.key)
  else next.add(op.key)
  expanded.value = next
}

function operationLabel(op: CryptoOperation): string {
  if (FIAT_KINDS.has(op.kind)) {
    const asset = (op.incoming ?? op.outgoing)?.asset
    return `${CRYPTO_OPERATION_LABELS[op.kind]} ${asset === 'EUR' ? 'en euros' : `en ${asset}`}`
  }
  return CRYPTO_OPERATION_LABELS[op.kind]
}

const BADGE: Record<CryptoOperationKind, BadgeVariant> = {
  buy: 'success',
  crypto_deposit: 'success',
  transfer_in: 'info',
  reward: 'info',
  sell: 'danger',
  send: 'secondary',
  swap: 'primary',
  fee: 'warning',
  fiat_deposit: 'secondary',
  fiat_withdraw: 'secondary',
  other: 'secondary',
}

function operationDetail(op: CryptoOperation): string {
  if (op.kind === 'swap' && op.incoming && op.outgoing) return `${quantity(op.outgoing)} → ${quantity(op.incoming)}`
  if (FIAT_KINDS.has(op.kind)) return ''
  const main = ['sell', 'send', 'fee'].includes(op.kind) ? op.outgoing : op.incoming
  if (main) return quantity(main)
  return `${op.legs.length} écritures`
}

const operationFees = (op: CryptoOperation): string => op.fees.map(quantity).join(', ')

function unitPriceLabel(op: CryptoOperation): string | null {
  const unit = operationUnitPrice(op)
  return unit ? `${formatCurrency(unit.price)}/${unit.asset}` : null
}

function deleteOperation(op: CryptoOperation): void {
  const parts = [`${operationLabel(op)} du ${formatDateShort(op.executedAt)}`, operationDetail(op)]
  if (op.eurValue != null) parts.push(money(op.eurValue))
  emit('delete-operation', op.legs[0]!.id, parts.filter(Boolean).join(' · '))
}

const LEG_LABELS: Record<string, string> = {
  BUY: 'Entrée',
  REWARD: 'Récompense',
  DEPOSIT: 'Dépôt',
  SPEND: 'Sortie',
  TRANSFER: 'Envoi',
  WITHDRAW: 'Retrait',
  FEE: 'Frais',
  ANCHOR: 'Valeur en euros',
}

function isNegativeLeg(type: string): boolean {
  return ['SPEND', 'FEE', 'TRANSFER', 'WITHDRAW'].includes(type)
}

function legAmount(tx: TransactionResponse): string {
  if (tx.type === 'ANCHOR') return money(Number(tx.amount) * Number(tx.price_per_unit))
  return `${isNegativeLeg(tx.type) ? '−' : '+'}${formatNumber(tx.amount, 6)} ${tx.asset_key}`
}

function legTooltip(tx: TransactionResponse): string | null {
  if (tx.type === 'ANCHOR') return 'Fige la valeur en euros de l’opération : elle fait le prix de revient'
  if (tx.type === 'FEE') return 'Frais réseau ou de plateforme, déduits du solde du jeton'
  if (tx.type === 'BUY' && Number(tx.price_per_unit) === 0) return 'Le coût en euros est porté par une autre écriture du groupe'
  return null
}

/** Fiat rows have no market curve of their own, so they stay inert. */
function openPriceChart(position: PositionResponse): void {
  if (isFiatSymbol(position.asset_key)) return
  emit('show-price', position)
}
</script>

<template>
  <div>
    <div class="mb-6">
      <BaseSegmentedControl v-model="tab" :options="[{ key: 'positions', label: 'Positions' }, { key: 'history', label: 'Historique' }]" variant="surface" size="md" />
    </div>

    <div v-if="balanceGaps.length" class="mb-6 space-y-2">
      <div
        v-for="gap in balanceGaps"
        :key="gap.asset_key"
        class="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-3 py-2.5 rounded-secondary bg-warning/5 dark:bg-warning/10 border border-warning/20 text-sm"
      >
        <AlertCircle class="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <div class="min-w-0 flex-1">
          <p class="text-text-main dark:text-text-dark-main">
            {{ gap.asset_key }} passe sous zéro le {{ formatDateShort(gap.since) }}, jusqu’à {{ formatNumber(gap.shortfall, 6) }} {{ gap.asset_key }} manquants.
          </p>
          <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">
            Une transaction manque ou est en double.
            <template v-if="Number(gap.excluded_proceeds) > 0">
              Faute de coût d’achat connu, {{ money(gap.excluded_proceeds) }} de ventes et d’échanges restent hors du P/L réalisé.
            </template>
          </p>
        </div>
        <button type="button" class="shrink-0 text-xs font-medium text-primary hover:underline" @click="showGap(gap)">
          Voir l’historique {{ gap.asset_key }}
        </button>
      </div>
    </div>

    <!-- Positions Tab -->
    <div v-if="tab === 'positions'">
      <template v-if="holdings.length || cashPositions.length">
        <!-- Desktop table -->
        <div v-if="holdings.length" class="hidden md:block overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[11px] text-text-muted dark:text-text-dark-muted uppercase tracking-wider border-b border-surface-border dark:border-surface-dark-border">
                <th class="px-4 py-3">Actif</th>
                <th class="px-4 py-3 text-right">Quantité</th>
                <th class="px-4 py-3 text-right">PRU</th>
                <th class="px-4 py-3 text-right">Investi</th>
                <th class="px-4 py-3 text-right">Cours</th>
                <th v-if="changeHeader" class="px-4 py-3 text-right whitespace-nowrap">{{ changeHeader }}</th>
                <th class="px-4 py-3 text-right">Valeur</th>
                <th class="px-4 py-3 text-right">Poids</th>
                <th class="px-4 py-3 text-right">P/L</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-border dark:divide-surface-dark-border">
              <tr
                v-for="pos in holdings"
                :key="pos.asset_key"
                class="hover:bg-surface-hover dark:hover:bg-surface-dark-hover transition-colors cursor-pointer"
                @click="openPriceChart(pos)"
              >
                <td class="px-4 py-3">
                  <button
                    type="button"
                    class="font-semibold text-text-main dark:text-text-dark-main text-left hover:text-primary dark:hover:text-primary transition-colors"
                    :title="`Voir le cours de ${pos.name || pos.asset_key}`"
                    @click.stop="openPriceChart(pos)"
                  >{{ pos.name || pos.asset_key }}</button>
                  <p v-if="pos.name" class="text-xs text-text-muted dark:text-text-dark-muted">{{ pos.asset_key }}</p>
                </td>
                <td class="px-4 py-3 text-right font-mono text-text-body dark:text-text-dark-body">{{ formatNumber(pos.total_amount, 6) }}</td>
                <td class="px-4 py-3 text-right text-text-muted dark:text-text-dark-muted">{{ formatCurrency(pos.average_buy_price) }}</td>
                <td class="px-4 py-3 text-right text-text-muted dark:text-text-dark-muted">{{ money(pos.total_invested) }}</td>
                <td class="px-4 py-3 text-right text-text-muted dark:text-text-dark-muted">{{ formatCurrency(pos.current_price) }}</td>
                <td v-if="changeHeader" class="px-4 py-3 text-right tabular-nums">
                  <span v-if="change(pos) != null" :class="profitLossClass(change(pos))">{{ formatPercent(change(pos)) }}</span>
                  <span v-else class="text-text-muted dark:text-text-dark-muted">—</span>
                </td>
                <td class="px-4 py-3 text-right font-semibold text-text-main dark:text-text-dark-main">{{ money(pos.current_value) }}</td>
                <td class="px-4 py-3 text-right text-text-body dark:text-text-dark-body whitespace-nowrap tabular-nums">
                  <template v-if="weight(pos) != null">
                    <span class="inline-block w-10 h-1 mr-2 align-middle rounded-full bg-surface-border dark:bg-surface-dark-border overflow-hidden" aria-hidden="true">
                      <span class="block h-full bg-primary" :style="{ width: `${weight(pos)}%` }" />
                    </span>{{ formatNumber(weight(pos), 1) }} %
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                  <span :class="['font-semibold', profitLossClass(pos.profit_loss)]">{{ signedMoney(pos.profit_loss) }}</span>
                  <span :class="['block text-xs', profitLossClass(pos.profit_loss_percentage)]">{{ formatPercent(pos.profit_loss_percentage) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile rows -->
        <div v-if="holdings.length" class="md:hidden divide-y divide-surface-border dark:divide-surface-dark-border">
          <button
            v-for="pos in holdings"
            :key="pos.asset_key"
            type="button"
            class="w-full flex items-start justify-between gap-3 py-3 text-left active:bg-surface-hover dark:active:bg-surface-dark-hover transition-colors"
            @click="openPriceChart(pos)"
          >
            <span class="min-w-0">
              <span class="block font-semibold text-text-main dark:text-text-dark-main truncate">{{ pos.name || pos.asset_key }}</span>
              <span class="block text-xs text-text-muted dark:text-text-dark-muted tabular-nums">
                {{ formatNumber(pos.total_amount, 6) }} {{ pos.asset_key }}<template v-if="weight(pos) != null"> · {{ formatNumber(weight(pos), 1) }} %</template>
              </span>
            </span>
            <span class="text-right whitespace-nowrap tabular-nums">
              <span class="block font-semibold text-text-main dark:text-text-dark-main">{{ money(pos.current_value) }}</span>
              <span :class="['block text-xs font-medium', profitLossClass(pos.profit_loss)]">{{ signedMoney(pos.profit_loss) }} · {{ formatPercent(pos.profit_loss_percentage) }}</span>
            </span>
          </button>
        </div>

        <!-- Fiat balances, under the holdings: they have no cost basis nor price of their own -->
        <div
          v-if="cashPositions.length"
          class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-3 md:px-4 text-sm tabular-nums"
          :class="holdings.length ? 'mt-1 border-t border-surface-border dark:border-surface-dark-border' : ''"
        >
          <span class="text-text-body dark:text-text-dark-body">
            {{ onlyEuros ? 'Liquidités en euros' : 'Liquidités' }}
            <span v-if="cashDetail" class="text-xs text-text-muted dark:text-text-dark-muted">({{ cashDetail }})</span>
          </span>
          <span>
            <span class="font-semibold text-text-main dark:text-text-dark-main">{{ money(cashValue) }}</span>
            <span v-if="cashValue < 0" class="text-xs text-text-muted dark:text-text-dark-muted"> · apports non saisis</span>
          </span>
        </div>
      </template>
      <BaseEmptyState v-else title="Aucune position" description="Ajoutez des transactions pour voir vos positions crypto" />
    </div>

    <!-- History Tab -->
    <div v-else>
      <template v-if="operations.length">
        <div v-if="filterOptions.length > 2" class="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer l’historique">
          <button
            v-for="option in filterOptions"
            :key="option.key"
            type="button"
            :aria-pressed="historyFilter === option.key"
            :class="[
              'px-3 py-1 rounded-full border text-xs font-semibold transition-colors',
              historyFilter === option.key
                ? 'bg-primary border-primary text-primary-content'
                : 'border-surface-border dark:border-surface-dark-border text-text-body dark:text-text-dark-body hover:border-primary/60',
            ]"
            @click="historyFilter = option.key"
          >{{ option.label }}</button>
        </div>

        <!-- Desktop table -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[11px] text-text-muted dark:text-text-dark-muted uppercase tracking-wider border-b border-surface-border dark:border-surface-dark-border">
                <th class="px-4 py-3">Date</th>
                <th class="px-4 py-3">Opération</th>
                <th class="px-4 py-3">Détail</th>
                <th class="px-4 py-3 text-right">Valeur</th>
                <th class="px-4 py-3 text-right">Frais</th>
                <th class="px-4 py-3 text-right"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody v-for="month in months" :key="month.key">
              <tr>
                <td colspan="6" class="px-4 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted dark:text-text-dark-muted">{{ month.label }}</td>
              </tr>
              <template v-for="op in month.operations" :key="op.key">
                <tr
                  :class="[
                    'border-t border-surface-border/60 dark:border-surface-dark-border/60 transition-colors hover:bg-surface-hover dark:hover:bg-surface-dark-hover',
                    op.legs.length > 1 ? 'cursor-pointer' : '',
                  ]"
                  @click="toggle(op)"
                >
                  <td class="px-4 py-3 text-text-muted dark:text-text-dark-muted whitespace-nowrap">{{ formatDateShort(op.executedAt) }}</td>
                  <td class="px-4 py-3 whitespace-nowrap"><BaseBadge :variant="BADGE[op.kind]">{{ operationLabel(op) }}</BaseBadge></td>
                  <td class="px-4 py-3 font-medium text-text-main dark:text-text-dark-main tabular-nums">
                    <template v-if="operationDetail(op)">{{ operationDetail(op) }}</template>
                    <span v-else class="text-text-muted dark:text-text-dark-muted">—</span>
                  </td>
                  <td class="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    <span v-if="op.eurValue != null" class="font-semibold text-text-main dark:text-text-dark-main">{{ money(op.eurValue) }}</span>
                    <span v-else class="text-text-muted dark:text-text-dark-muted">—</span>
                    <span v-if="unitPriceLabel(op)" class="block text-xs text-text-muted dark:text-text-dark-muted">{{ unitPriceLabel(op) }}</span>
                  </td>
                  <td class="px-4 py-3 text-right text-text-muted dark:text-text-dark-muted tabular-nums whitespace-nowrap">{{ operationFees(op) || '—' }}</td>
                  <td class="px-4 py-2 text-right">
                    <BaseButton
                      v-if="op.legs.length > 1"
                      size="sm"
                      variant="ghost"
                      :aria-expanded="expanded.has(op.key)"
                      :aria-label="`Voir les écritures de l’opération du ${formatDateShort(op.executedAt)}`"
                      @click.stop="toggle(op)"
                    >
                      <ChevronRight :class="['w-4 h-4 transition-transform duration-150', expanded.has(op.key) ? 'rotate-90' : '']" />
                    </BaseButton>
                    <BaseButton
                      v-else
                      size="sm"
                      variant="ghost"
                      :aria-label="`Modifier l’opération du ${formatDateShort(op.executedAt)}`"
                      @click.stop="emit('edit-transaction', op.legs[0]!)"
                    >
                      <Pencil class="w-4 h-4" />
                    </BaseButton>
                  </td>
                </tr>
                <tr v-if="expanded.has(op.key)" class="bg-background-subtle dark:bg-background-dark-subtle">
                  <td />
                  <td colspan="5" class="px-4 pb-3 pt-1">
                    <ul class="divide-y divide-surface-border/60 dark:divide-surface-dark-border/60">
                      <li v-for="tx in op.legs" :key="tx.id" class="flex items-center justify-between gap-4 py-1.5 text-xs">
                        <span class="inline-flex items-center gap-1.5 text-text-body dark:text-text-dark-body">
                          {{ LEG_LABELS[tx.type] ?? tx.type }}
                          <BaseTooltip v-if="legTooltip(tx)" label="Détail de l’écriture">
                            <template #trigger>
                              <AlertCircle class="w-3.5 h-3.5 text-text-muted/60 dark:text-text-dark-muted/60" />
                            </template>
                            {{ legTooltip(tx) }}
                          </BaseTooltip>
                        </span>
                        <span class="ml-auto font-mono tabular-nums" :class="tx.type === 'ANCHOR' ? 'text-text-muted dark:text-text-dark-muted' : isNegativeLeg(tx.type) ? 'text-danger' : 'text-success'">{{ legAmount(tx) }}</span>
                        <BaseButton size="sm" variant="ghost" :aria-label="`Modifier l’écriture ${LEG_LABELS[tx.type] ?? tx.type} ${tx.asset_key}`" @click="emit('edit-transaction', tx)">
                          <Pencil class="w-3.5 h-3.5" />
                        </BaseButton>
                      </li>
                    </ul>
                    <div class="flex justify-end pt-1.5">
                      <button type="button" class="inline-flex items-center gap-1.5 rounded-secondary px-2 py-1 text-xs text-text-muted dark:text-text-dark-muted hover:text-danger hover:bg-danger/10 transition-colors" @click="deleteOperation(op)">
                        <Trash2 class="w-3.5 h-3.5" />
                        Supprimer l’opération
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
          <p class="px-4 pt-2 text-xs text-text-muted dark:text-text-dark-muted">
            Dates affichées en {{ effectiveTimezoneLabel }}
          </p>
        </div>

        <!-- Mobile rows -->
        <div class="md:hidden">
          <section v-for="month in months" :key="month.key">
            <h4 class="pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted dark:text-text-dark-muted">{{ month.label }}</h4>
            <div class="divide-y divide-surface-border dark:divide-surface-dark-border">
              <div v-for="op in month.operations" :key="op.key" class="py-2.5">
                <div class="flex items-start justify-between gap-3">
                  <button type="button" class="min-w-0 flex-1 text-left" :aria-expanded="op.legs.length > 1 ? expanded.has(op.key) : undefined" @click="op.legs.length > 1 ? toggle(op) : emit('edit-transaction', op.legs[0]!)">
                    <span class="flex items-center gap-2">
                      <BaseBadge :variant="BADGE[op.kind]">{{ operationLabel(op) }}</BaseBadge>
                      <span class="text-xs text-text-muted dark:text-text-dark-muted">{{ formatDateShort(op.executedAt) }}</span>
                    </span>
                    <span v-if="operationDetail(op)" class="mt-1 block truncate text-sm font-medium text-text-main dark:text-text-dark-main tabular-nums">{{ operationDetail(op) }}</span>
                  </button>
                  <span class="text-right whitespace-nowrap tabular-nums">
                    <span v-if="op.eurValue != null" class="block font-semibold text-text-main dark:text-text-dark-main">{{ money(op.eurValue) }}</span>
                    <span v-else class="block text-text-muted dark:text-text-dark-muted">—</span>
                    <span v-if="unitPriceLabel(op)" class="block text-xs text-text-muted dark:text-text-dark-muted">{{ unitPriceLabel(op) }}</span>
                    <span v-if="op.fees.length" class="block text-xs text-text-muted dark:text-text-dark-muted">frais {{ operationFees(op) }}</span>
                  </span>
                </div>
                <ul v-if="expanded.has(op.key)" class="mt-2 rounded-secondary bg-background-subtle dark:bg-background-dark-subtle px-3 divide-y divide-surface-border/60 dark:divide-surface-dark-border/60">
                  <li v-for="tx in op.legs" :key="tx.id" class="flex items-center justify-between gap-3 py-1.5 text-xs">
                    <span class="text-text-body dark:text-text-dark-body">{{ LEG_LABELS[tx.type] ?? tx.type }}</span>
                    <span class="ml-auto font-mono tabular-nums" :class="tx.type === 'ANCHOR' ? 'text-text-muted dark:text-text-dark-muted' : isNegativeLeg(tx.type) ? 'text-danger' : 'text-success'">{{ legAmount(tx) }}</span>
                    <BaseButton size="sm" variant="ghost" :aria-label="`Modifier l’écriture ${LEG_LABELS[tx.type] ?? tx.type} ${tx.asset_key}`" @click="emit('edit-transaction', tx)">
                      <Pencil class="w-3.5 h-3.5" />
                    </BaseButton>
                  </li>
                </ul>
                <div v-if="expanded.has(op.key)" class="flex justify-end pt-1.5">
                  <button type="button" class="inline-flex items-center gap-1.5 rounded-secondary px-2 py-1 text-xs text-text-muted dark:text-text-dark-muted hover:text-danger hover:bg-danger/10 transition-colors" @click="deleteOperation(op)">
                    <Trash2 class="w-3.5 h-3.5" />
                    Supprimer l’opération
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>
      <BaseEmptyState v-else title="Aucune transaction" description="L'historique des transactions est vide" />
    </div>
  </div>
</template>

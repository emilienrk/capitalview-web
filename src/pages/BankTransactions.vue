<script setup lang="ts">
/**
 * The Banque section's Opérations tab: one month of stored movements, all
 * accounts or one, with that month's totals on top.
 *
 * Month by month because the API can only filter dates on a month — they are
 * stored encrypted. The month and the account live in the query string, so an
 * account card can link straight to its own operations.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftRight, ChevronLeft, ChevronRight, HelpCircle, Search, Undo2 } from 'lucide-vue-next'

import { useBankStore } from '@/stores/bank'
import { useCashflowTypesStore } from '@/stores/cashflowTypes'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import {
  BaseAlert, BaseButton, BaseCard, BaseEmptyState, BaseSelect, BaseSkeleton, BaseToggle,
} from '@/components'
import BankTransactionRow from '@/components/bank/BankTransactionRow.vue'
import BankTransferLinkModal from '@/components/bank/BankTransferLinkModal.vue'
import BankTypePicker from '@/components/bank/BankTypePicker.vue'
import {
  ALL, CASHFLOW_TYPES, CASHFLOW_TYPE_LABELS, OPERATION_TYPE_LABELS, matchesCashflowType, matchesOperationType,
  needsReview,
} from '@/utils/cashflowTypes'
import type { BankTransactionItem, BankTransactionTypeResult, BankTransferDecisionKind, CashflowType } from '@/types'

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const ALL_ACCOUNTS = 'all'
const STRIP_MONTHS = 12

const bank = useBankStore()
const cashflowTypes = useCashflowTypesStore()
const route = useRoute()
const router = useRouter()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

function toPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number)
  return toPeriod(new Date(year!, month! - 1 + months, 1))
}

function periodDate(period: string): Date {
  const [year, month] = period.split('-').map(Number)
  return new Date(year!, month! - 1, 1)
}

const currentPeriod = toPeriod(new Date())

function readPeriod(value: unknown): string {
  return typeof value === 'string' && PERIOD_PATTERN.test(value) && value <= currentPeriod
    ? value
    : currentPeriod
}

function readAccount(value: unknown): string {
  return typeof value === 'string' && value ? value : ALL_ACCOUNTS
}

const period = ref(readPeriod(route.query.period))
const accountId = ref(readAccount(route.query.account))
const accountFilter = computed(() => (accountId.value === ALL_ACCOUNTS ? null : accountId.value))

const accountChips = computed(() => [
  { label: 'Tous les comptes', value: ALL_ACCOUNTS },
  ...(bank.summary?.accounts ?? []).map((account) => ({ label: account.name, value: account.id })),
])

// ── The month strip ─────────────────────────────────────────

const flowsKey = computed(() => `${STRIP_MONTHS}:${accountFilter.value ?? 'all'}`)
const flows = computed(() => bank.observedFlows)
/** The strip still shows the previous filter's months while the new ones load. */
const flowsStale = computed(() => bank.observedFlowsKey !== flowsKey.value)

const strip = computed(() => (flows.value?.covered_months ? flows.value.months : []))

/** What a month is read against, when enough months have been observed. */
const averages = computed(() => {
  if (!flows.value?.covered_months || flowsStale.value) return null
  return {
    inflow: amount(flows.value.monthly_inflow),
    outflow: amount(flows.value.monthly_outflow),
  }
})

/** Bar heights relative to the busiest month, so a quiet one stays visible. */
const stripPeak = computed(() => {
  const peak = Math.max(0, ...strip.value.flatMap((m) => [Number(m.inflow), Number(m.outflow)]))
  return peak > 0 ? peak : 1
})

function barHeight(value: number): string {
  // A floor, so a month with a little movement is not mistaken for an empty one.
  return Number(value) > 0 ? `${Math.max(6, (Number(value) / stripPeak.value) * 100)}%` : '0'
}

function monthShort(p: string): string {
  return periodDate(p).toLocaleDateString('fr-FR', { month: 'short' })
}

function monthLong(p: string): string {
  return periodDate(p).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

const periodLabel = computed(() => monthLong(period.value))

// ── The month ───────────────────────────────────────────────

const monthKey = computed(() => `${period.value}:${accountFilter.value ?? 'all'}`)
/** Only the month and account asked for: never another filter's answer under this label. */
const month = computed(() =>
  bank.transactionsKey === monthKey.value ? bank.transactions : null,
)
/** The filter whose request failed: it stops the skeleton and offers a retry instead. */
const failedKey = ref<string | null>(null)
const loadFailed = computed(() => failedKey.value === monthKey.value && !month.value)

function amount(value: number, currency = month.value?.currency ?? 'EUR'): string {
  return maskValue(formatCurrency(value, currency))
}

/** What a flow question moves, when its label is more than this one operation. */
function stakeOf(tx: BankTransactionItem): string | undefined {
  const question = tx.flow_question
  return question && question.operation_count > 1 ? amount(Number(question.amount), tx.currency) : undefined
}

function signedAmount(tx: BankTransactionItem): string {
  const value = Number(tx.amount)
  return amount(tx.is_credit ? value : -value, tx.currency)
}

// A string rather than a union: it is what the select hands back.
const direction = ref<string>('all')
const directionOptions = [
  { label: 'Entrées et sorties', value: 'all' },
  { label: 'Entrées', value: 'in' },
  { label: 'Sorties', value: 'out' },
]
const sortBy = ref<string>('date')
const sortOptions = [
  { label: 'Plus récentes', value: 'date' },
  { label: 'Plus gros montants', value: 'amount' },
]
const search = ref('')
// Shown by default: they are on the bank statement, and hiding them would make
// the list disagree with it. They are only kept out of the totals.
const showTransfers = ref(true)
/** Only what waits for the user: pairs offered, and labels only they can type. */
const toReviewOnly = ref(false)
const typeFilter = ref<string>(ALL)
const typeOptions = [
  { label: 'Tous types', value: ALL },
  ...CASHFLOW_TYPES.map((value) => ({ label: CASHFLOW_TYPE_LABELS[value], value })),
]
const meansFilter = ref<string>(ALL)
const meansOptions = [
  { label: 'Tous moyens de paiement', value: ALL },
  ...Object.entries(OPERATION_TYPE_LABELS).map(([value, label]) => ({ label, value })),
]

/** Kept out of the totals: every pair but a suggested one. */
function isDeducted(tx: BankTransactionItem): boolean {
  return tx.transfer_status !== null && tx.transfer_status !== 'suggested'
}

const hasFilters = computed(() =>
  direction.value !== 'all' || search.value.trim() !== '' || !showTransfers.value || toReviewOnly.value
  || typeFilter.value !== ALL || meansFilter.value !== ALL,
)

function resetFilters(): void {
  direction.value = 'all'
  search.value = ''
  showTransfers.value = true
  toReviewOnly.value = false
  typeFilter.value = ALL
  meansFilter.value = ALL
}

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return (month.value?.transactions ?? []).filter((tx) => {
    if (direction.value === 'in' && !tx.is_credit) return false
    if (direction.value === 'out' && tx.is_credit) return false
    if (!showTransfers.value && isDeducted(tx)) return false
    if (toReviewOnly.value && !needsReview(tx)) return false
    if (!matchesCashflowType(tx, typeFilter.value)) return false
    if (!matchesOperationType(tx, meansFilter.value)) return false
    if (!query) return true
    return (tx.label ?? '').toLowerCase().includes(query)
      || tx.account_name.toLowerCase().includes(query)
  })
})

/**
 * What the filters leave, summed: "LIDL this month" is a question the list
 * should answer without a calculator. Only the month's own currency adds up.
 */
const filteredTotal = computed(() => {
  const currency = month.value?.currency
  return filtered.value
    .filter((tx) => tx.currency === currency)
    .reduce((sum, tx) => sum + (tx.is_credit ? Number(tx.amount) : -Number(tx.amount)), 0)
})

/** Largest first, whatever the direction: the operations worth a look. */
const byAmount = computed(() =>
  [...filtered.value].sort((a, b) => Number(b.amount) - Number(a.amount)),
)

const days = computed(() => {
  const groups: Array<{ day: string | null; items: BankTransactionItem[] }> = []
  for (const tx of filtered.value) {
    const last = groups[groups.length - 1]
    if (last && last.day === tx.operation_date) last.items.push(tx)
    else groups.push({ day: tx.operation_date, items: [tx] })
  }
  return groups
})

function dayLabel(day: string | null): string {
  if (!day) return 'Sans date'
  const [year, monthIndex, date] = day.split('-').map(Number)
  const label = new Date(year!, monthIndex! - 1, date!)
    .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  // Only the first letter: CSS `capitalize` would also turn "septembre" into "Septembre".
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function shortDay(day: string | null): string {
  if (!day) return ''
  const [year, monthIndex, date] = day.split('-').map(Number)
  return new Date(year!, monthIndex! - 1, date!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function amountClass(tx: BankTransactionItem): string {
  // A transfer is neither income nor spending: coloured as one would contradict the totals.
  if (isDeducted(tx) || tx.cashflow_type === 'NEUTRAL') return 'text-text-muted dark:text-text-dark-muted'
  return tx.is_credit ? 'text-success' : 'text-text-main dark:text-text-dark-main'
}

// ── Transfer decisions ──────────────────────────────────────

/** The operation whose decision is on its way: its row stands still meanwhile. */
const deciding = ref<string | null>(null)
const decisionError = ref<string | null>(null)
const linking = ref<BankTransactionItem | null>(null)

async function decide(tx: BankTransactionItem, kind: BankTransferDecisionKind): Promise<void> {
  if (!tx.transfer_id) return
  deciding.value = tx.id
  decisionError.value = null
  try {
    await bank.decideTransfer(tx.id, tx.transfer_id, kind)
  } catch (e) {
    decisionError.value = e instanceof Error ? e.message : "Impossible d'enregistrer ce choix."
  } finally {
    deciding.value = null
  }
}

// ── Cashflow types ──────────────────────────────────────────

const retyping = ref<BankTransactionItem | null>(null)
/** What the last correction did, said once under the filters. */
const typedMessage = ref<string | null>(null)

function onTyped(result: BankTransactionTypeResult): void {
  const count = result.covered_count
  const label = CASHFLOW_TYPE_LABELS[result.transaction.cashflow_type]
  typedMessage.value = `${count} opération${count > 1 ? 's' : ''} comptée${count > 1 ? 's' : ''} en ${label}.`
}

async function answer(tx: BankTransactionItem, type: CashflowType): Promise<void> {
  deciding.value = tx.id
  decisionError.value = null
  try {
    onTyped(await cashflowTypes.answerFlow(tx.id, type))
  } catch (e) {
    decisionError.value = e instanceof Error ? e.message : "Impossible d'enregistrer cette réponse."
  } finally {
    deciding.value = null
  }
}

const QUESTION_MONTHS_SHOWN = 4
/** The most recent months still holding a question, besides this one. */
const questionMonths = computed(() =>
  (bank.transferQuestions?.months ?? []).filter((q) => q.period !== period.value).reverse(),
)
const otherQuestionMonths = computed(() => questionMonths.value.slice(0, QUESTION_MONTHS_SHOWN))
const olderQuestionMonths = computed(() => questionMonths.value.length - otherQuestionMonths.value.length)

// The review filter has nothing left to show once the month is settled.
watch(() => month.value?.transfer_questions, (count) => {
  if (!count) toReviewOnly.value = false
})

// ── Loading and the query string ────────────────────────────

async function load(force = false): Promise<void> {
  // An account from the URL — a stale link, a deleted account — is checked
  // against the accounts before the API is asked about it, which would only
  // answer 404. Unknown, it falls back to every account; not known yet, the
  // load waits for the accounts to arrive.
  if (accountFilter.value) {
    if (!bank.summary) return
    if (!bank.summary.accounts.some((a) => a.id === accountFilter.value)) {
      accountId.value = ALL_ACCOUNTS
      return
    }
  }
  const key = monthKey.value
  void bank.fetchObservedFlows(STRIP_MONTHS, force, accountFilter.value)
  failedKey.value = null
  if (!(await bank.fetchTransactions(period.value, accountFilter.value, force))) failedKey.value = key
}

// The query string is the source of truth both ways: a link, the tab or the
// browser can change it under the page, and the page writes its filters back.
// Both watchers stand down once the route has left this tab: they still run in
// the flush that unmounts the page, and would write this tab's query onto the next.
watch(
  () => [route.query.period, route.query.account],
  ([queryPeriod, queryAccount]) => {
    if (route.name !== 'bank-transactions') return
    period.value = readPeriod(queryPeriod)
    accountId.value = readAccount(queryAccount)
  },
)

watch([period, accountId], ([p, account]) => {
  if (route.name !== 'bank-transactions') return
  const query = { period: p, account: account === ALL_ACCOUNTS ? undefined : account }
  if (route.query.period !== query.period || route.query.account !== query.account) {
    void router.replace({ query: { ...route.query, ...query } })
  }
  void load()
})

// The load held back until the accounts were known.
watch(() => bank.summary, () => {
  if (!month.value) void load()
})

// A sync or an import from the section header rewrote the movements.
watch(() => bank.dataRevision, () => void load())

onMounted(() => void load())
</script>

<template>
  <div>
    <BaseCard class="mb-6">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1 min-w-0">
            <BaseButton icon size="sm" variant="ghost" aria-label="Mois précédent" @click="period = shiftPeriod(period, -1)">
              <ChevronLeft class="w-4 h-4" />
            </BaseButton>
            <h3 class="w-40 text-center text-lg font-semibold capitalize text-text-main dark:text-text-dark-main">
              {{ periodLabel }}
            </h3>
            <BaseButton
              icon size="sm" variant="ghost" aria-label="Mois suivant"
              :disabled="period >= currentPeriod"
              @click="period = shiftPeriod(period, 1)"
            >
              <ChevronRight class="w-4 h-4" />
            </BaseButton>
          </div>
        </div>
        <!-- Every account one click away, and the one shown always in sight:
             a select hid which account the figures below were about. -->
        <div class="mt-3 -mx-1 px-1 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Compte">
          <button
            v-for="chip in accountChips"
            :key="chip.value"
            type="button"
            :aria-pressed="accountId === chip.value"
            :class="[
              'shrink-0 px-3 py-1.5 rounded-button text-sm font-medium transition-colors whitespace-nowrap',
              accountId === chip.value
                ? 'bg-primary text-primary-content'
                : 'bg-background-subtle dark:bg-background-dark-subtle text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main',
            ]"
            @click="accountId = chip.value"
          >
            {{ chip.label }}
          </button>
        </div>
      </template>

      <!-- Twelve months at a glance; a click opens one. -->
      <div
        v-if="strip.length"
        :class="['grid grid-cols-12 gap-0.5 sm:gap-2 mb-5 transition-opacity', flowsStale ? 'opacity-50' : '']"
      >
        <button
          v-for="m in strip"
          :key="m.period"
          type="button"
          :aria-label="`${monthLong(m.period)} : entrées ${amount(m.inflow)}, sorties ${amount(m.outflow)}`"
          :aria-pressed="m.period === period"
          :title="`${monthShort(m.period)} : +${amount(m.inflow)} / −${amount(m.outflow)}`"
          :class="[
            'flex flex-col items-center gap-1 rounded-button pt-2 pb-1 transition-colors',
            m.period === period
              ? 'bg-primary/10'
              : 'hover:bg-surface-hover dark:hover:bg-surface-dark-hover',
          ]"
          @click="period = m.period"
        >
          <span class="flex items-end justify-center gap-0.5 h-14 w-full">
            <span class="w-1.5 sm:w-2 rounded-t-sm bg-success/70" :style="{ height: barHeight(m.inflow) }" />
            <span class="w-1.5 sm:w-2 rounded-t-sm bg-danger/70" :style="{ height: barHeight(m.outflow) }" />
          </span>
          <span
            :class="[
              'text-xs uppercase sm:normal-case',
              m.period === period ? 'text-primary font-semibold' : 'text-text-muted dark:text-text-dark-muted',
            ]"
          >
            <!-- One letter on a phone: twelve abbreviations do not fit in 24 px columns. -->
            <span class="sm:hidden">{{ monthShort(m.period).charAt(0) }}</span>
            <span class="hidden sm:inline">{{ monthShort(m.period) }}</span>
          </span>
        </button>
      </div>

      <div v-if="loadFailed" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p class="text-sm text-text-muted dark:text-text-dark-muted">
          Impossible de charger les opérations de {{ periodLabel }}.
        </p>
        <BaseButton size="sm" variant="outline" @click="load(true)">Réessayer</BaseButton>
      </div>
      <div v-else-if="!month" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <BaseSkeleton v-for="i in 3" :key="i" variant="rect" width="100%" height="3.5rem" />
      </div>
      <template v-else>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- The monthly average is what this month is read against, but it is
               a second figure next to the one being read: it stays available on
               hover rather than doubling every tile. -->
          <div :title="averages ? `Moyenne : ${averages.inflow} / mois` : undefined">
            <p class="text-sm text-text-muted dark:text-text-dark-muted">Entrées</p>
            <p class="text-xl font-bold text-success">{{ amount(month.inflow) }}</p>
          </div>
          <div :title="averages ? `Moyenne : ${averages.outflow} / mois` : undefined">
            <p class="text-sm text-text-muted dark:text-text-dark-muted">Sorties</p>
            <p class="text-xl font-bold text-danger">{{ amount(month.outflow) }}</p>
          </div>
          <div>
            <p class="text-sm text-text-muted dark:text-text-dark-muted">Solde du mois</p>
            <p class="text-xl font-bold" :class="Number(month.net) >= 0 ? 'text-success' : 'text-danger'">
              {{ amount(month.net) }}
            </p>
            <!-- Said next to the figure someone compares with their bank app,
                 the one place the gap would otherwise look like an error. -->
            <p
              v-if="month.pending_count > 0"
              class="text-xs text-text-muted dark:text-text-dark-muted mt-0.5"
              :title="`${amount(month.pending_outflow)} en sortie, ${amount(month.pending_inflow)} en entrée`"
            >
              hors {{ month.pending_count }} opération{{ month.pending_count > 1 ? 's' : '' }} en attente
            </p>
          </div>
        </div>
        <p
          v-if="month.internal_transfers_excluded > 0"
          class="mt-4 flex items-center gap-1.5 text-xs text-text-muted dark:text-text-dark-muted"
        >
          <ArrowLeftRight class="w-3.5 h-3.5 shrink-0" />
          {{ amount(month.internal_transfers_amount) }} déplacés entre vos comptes, hors des totaux.
        </p>
        <p
          v-if="month.reversals_excluded > 0"
          class="mt-1 flex items-center gap-1.5 text-xs text-text-muted dark:text-text-dark-muted"
        >
          <Undo2 class="w-3.5 h-3.5 shrink-0" />
          {{ amount(month.reversals_amount) }} remboursés ou annulés sur un même compte, hors des totaux.
        </p>
        <!-- What only the user can say: a pair seen once between two current
             accounts — as often a third party refunding a purchase as a transfer —
             and a label nothing types. Both count by default until answered. -->
        <p
          v-if="month.transfer_questions > 0"
          class="mt-1 flex items-center gap-1.5 text-xs text-warning"
        >
          <HelpCircle class="w-3.5 h-3.5 shrink-0" />
          <button
            type="button"
            :aria-pressed="toReviewOnly"
            class="font-medium hover:underline"
            @click="toReviewOnly = !toReviewOnly"
          >
            {{ month.transfer_questions }} point{{ month.transfer_questions > 1 ? 's' : '' }} à vérifier
          </button>
          <span class="text-text-muted dark:text-text-dark-muted">— comptés par défaut d'ici là.</span>
        </p>
        <!-- The other months still holding a question: the tab's badge counts
             them all, this is where to find them. -->
        <div v-if="otherQuestionMonths.length" class="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-text-muted dark:text-text-dark-muted">
          <span>À vérifier aussi :</span>
          <button
            v-for="q in otherQuestionMonths"
            :key="q.period"
            type="button"
            class="px-2 py-0.5 rounded-button bg-warning/10 text-warning font-medium hover:bg-warning/20"
            @click="period = q.period; toReviewOnly = true"
          >
            {{ monthShort(q.period) }} {{ q.period.slice(0, 4) }} ({{ q.count }})
          </button>
          <span v-if="olderQuestionMonths">et {{ olderQuestionMonths }} mois plus ancien{{ olderQuestionMonths > 1 ? 's' : '' }}</span>
        </div>
        <!-- No exchange rate ever arrives with a movement, so these never join a total. -->
        <p
          v-for="other in month.other_currencies"
          :key="other.currency"
          class="mt-1 text-xs text-text-muted dark:text-text-dark-muted"
        >
          En {{ other.currency }}, à part faute de taux :
          {{ amount(other.outflow, other.currency) }} en sortie,
          {{ amount(other.inflow, other.currency) }} en entrée.
        </p>
      </template>
    </BaseCard>

    <BaseCard v-if="!month && !loadFailed" :padding="false">
      <div class="p-4 sm:p-6 space-y-3">
        <BaseSkeleton v-for="i in 5" :key="i" variant="rect" width="100%" height="2.75rem" />
      </div>
    </BaseCard>

    <template v-else-if="month?.transactions.length">
      <div class="mb-4 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="relative w-full sm:w-72">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted dark:text-text-dark-muted" />
            <input
              v-model="search"
              type="text"
              placeholder="Rechercher un libellé…"
              aria-label="Rechercher un libellé"
              class="w-full pl-10 pr-4 py-2.5 rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            />
          </div>
          <label class="flex items-center gap-2 text-sm text-text-muted dark:text-text-dark-muted whitespace-nowrap sm:ml-auto">
            <BaseToggle v-model="showTransfers" aria-label="Afficher les virements internes" />
            Virements internes
          </label>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <BaseSelect v-model="direction" :options="directionOptions" />
          <BaseSelect v-model="sortBy" :options="sortOptions" />
          <BaseSelect v-model="typeFilter" :options="typeOptions" />
          <BaseSelect v-model="meansFilter" :options="meansOptions" />
        </div>
      </div>

      <BaseAlert v-if="typedMessage" variant="success" dismissible class="mb-3" @dismiss="typedMessage = null">
        {{ typedMessage }}
      </BaseAlert>

      <BaseAlert v-if="decisionError" variant="danger" dismissible class="mb-3" @dismiss="decisionError = null">
        {{ decisionError }}
      </BaseAlert>

      <p v-if="hasFilters && filtered.length" class="mb-3 text-sm text-text-muted dark:text-text-dark-muted">
        {{ filtered.length }} opération{{ filtered.length > 1 ? 's' : '' }} ·
        <span class="font-semibold tabular-nums" :class="filteredTotal >= 0 ? 'text-success' : 'text-text-main dark:text-text-dark-main'">
          {{ amount(filteredTotal) }}
        </span>
      </p>

      <BaseCard v-if="filtered.length" :padding="false" class="overflow-hidden">
        <!-- Sorted by amount, days no longer group anything: each row carries its own date. -->
        <ul v-if="sortBy === 'amount'" class="divide-y divide-surface-border dark:divide-surface-dark-border">
          <BankTransactionRow
            v-for="tx in byAmount"
            :key="tx.id"
            :tx="tx"
            :date="shortDay(tx.operation_date)"
            :show-account="!accountFilter"
            :amount="signedAmount(tx)"
            :amount-class="amountClass(tx)"
            :busy="deciding === tx.id"
            :stake-amount="stakeOf(tx)"
            @decide="(kind) => decide(tx, kind)"
            @link="linking = tx"
            @answer="(type) => answer(tx, type)"
            @retype="retyping = tx"
          />
        </ul>
        <template v-else>
          <section v-for="group in days" :key="group.day ?? 'undated'">
            <h4 class="px-4 sm:px-6 py-2 text-xs font-medium bg-background-subtle dark:bg-background-dark-subtle text-text-muted dark:text-text-dark-muted">
              {{ dayLabel(group.day) }}
            </h4>
            <ul class="divide-y divide-surface-border dark:divide-surface-dark-border">
              <BankTransactionRow
                v-for="tx in group.items"
                :key="tx.id"
                :tx="tx"
                :show-account="!accountFilter"
                :amount="signedAmount(tx)"
                :amount-class="amountClass(tx)"
                :busy="deciding === tx.id"
                :stake-amount="stakeOf(tx)"
                @decide="(kind) => decide(tx, kind)"
                @link="linking = tx"
                @answer="(type) => answer(tx, type)"
                @retype="retyping = tx"
              />
            </ul>
          </section>
        </template>
      </BaseCard>

      <BaseEmptyState
        v-else
        title="Aucune opération ne correspond"
        description="Aucune opération de ce mois ne passe ces filtres."
      >
        <template #action>
          <BaseButton v-if="hasFilters" variant="outline" @click="resetFilters">Réinitialiser les filtres</BaseButton>
        </template>
      </BaseEmptyState>
    </template>

    <BaseEmptyState
      v-else-if="month"
      :title="`Aucune opération en ${periodLabel}`"
      description="Synchronisez une banque ou importez un relevé d'opérations depuis le menu Importer."
    />

    <BankTransferLinkModal :open="linking !== null" :tx="linking" @close="linking = null" />
    <BankTypePicker
      :open="retyping !== null"
      :tx="retyping"
      @close="retyping = null"
      @saved="onTyped"
      @cleared="typedMessage = null"
    />
  </div>
</template>

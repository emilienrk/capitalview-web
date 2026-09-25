<script setup lang="ts">
/**
 * The Banque section's À trier tab: every question the history leaves to the
 * user, the one moving the most money first. A few dozen answers settle most
 * of the euros, where the Opérations list would show them month by month, a
 * 5 € sale next to a 20 000 € transfer.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CheckCircle2 } from 'lucide-vue-next'

import { BaseAlert, BaseButton, BaseCard, BaseEmptyState, BaseSkeleton } from '@/components'
import BankRecurringAttachModal from '@/components/bank/BankRecurringAttachModal.vue'
import BankTransactionRow from '@/components/bank/BankTransactionRow.vue'
import BankTransferLinkModal from '@/components/bank/BankTransferLinkModal.vue'
import BankTypePicker from '@/components/bank/BankTypePicker.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useBankStore } from '@/stores/bank'
import { useCashflowTypesStore } from '@/stores/cashflowTypes'
import { useRecurringStore } from '@/stores/recurring'
import { CASHFLOW_TYPE_LABELS, contributionNote } from '@/utils/cashflowTypes'
import type {
  BankReviewItem, BankTransactionItem, BankTransactionTypeResult, BankTransferDecisionKind, CashflowType,
  RecurringDecisionKind,
} from '@/types'

const bank = useBankStore()
const types = useCashflowTypesStore()
const recurring = useRecurringStore()
const route = useRoute()
const router = useRouter()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

function readYear(value: unknown): number | null {
  const year = typeof value === 'string' ? Number(value) : NaN
  return Number.isInteger(year) && year > 1900 ? year : null
}

const year = ref<number | null>(readYear(route.query.year))
const queue = computed(() => (types.queueYear === year.value ? types.queue : null))
// Nothing left in any year: the empty state says it alone, with no card of
// zeros above it. A year left empty among others keeps the card, for its chips.
const allSorted = computed(() => queue.value?.total_count === 0 && !types.queue?.years.length)
const failed = ref(false)

// Totals add questions up in the operations' own currency, the main one in practice.
const currency = computed(() => types.queue?.questions[0]?.transaction.currency ?? 'EUR')
function amount(value: number, code = currency.value): string {
  return maskValue(formatCurrency(Number(value), code))
}

/** What was left when the page opened on this year: the answers since are what it went down by. */
const openedWith = ref<number | null>(null)
const settled = computed(() =>
  queue.value && openedWith.value !== null ? Math.max(0, openedWith.value - Number(queue.value.total_amount)) : 0,
)

async function load(): Promise<void> {
  failed.value = false
  try {
    await types.fetchReviewQueue(year.value)
    if (openedWith.value === null && queue.value) openedWith.value = Number(queue.value.total_amount)
  } catch {
    failed.value = true
  }
}

function chooseYear(value: number | null): void {
  year.value = value
  openedWith.value = null
  void router.replace({ query: { ...route.query, year: value === null ? undefined : String(value) } })
}

watch(() => route.query.year, (value) => {
  const next = readYear(value)
  if (next !== year.value) {
    year.value = next
    openedWith.value = null
  }
})
watch(year, () => void load())
watch(() => bank.dataRevision, () => void load())
onMounted(() => void load())

function shortDay(day: string | null): string {
  if (!day) return ''
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function signedAmount(tx: BankTransactionItem): string {
  return amount(tx.is_credit ? Number(tx.amount) : -Number(tx.amount), tx.currency)
}

function stakeOf(item: BankReviewItem): string | undefined {
  return item.operation_count > 1 && item.kind === 'flow' ? amount(Number(item.amount), item.transaction.currency) : undefined
}

/** The deposit an investment account holds facing the operation, to answer by. */
function contributionOf(tx: BankTransactionItem): string | undefined {
  const match = tx.contribution
  if (!match) return undefined
  return contributionNote(match, amount(Number(match.amount), tx.currency), shortDay(match.day))
}

// ── Answers ─────────────────────────────────────────────────

const busy = ref<string | null>(null)
const error = ref<string | null>(null)
const linking = ref<BankTransactionItem | null>(null)
const filing = ref<BankTransactionItem | null>(null)
const retyping = ref<BankTransactionItem | null>(null)
/** The last label answered, which "Annuler" takes back. */
const lastAnswer = ref<{ ruleId: string; message: string } | null>(null)

async function answer(tx: BankTransactionItem, type: CashflowType): Promise<void> {
  busy.value = tx.id
  error.value = null
  try {
    const result = await types.answerFlow(tx.id, type)
    remember(result)
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Impossible d'enregistrer cette réponse."
  } finally {
    busy.value = null
  }
}

function remember(result: BankTransactionTypeResult): void {
  const count = result.covered_count
  const ruleId = result.transaction.type_rule_id
  const message = `${count} opération${count > 1 ? 's' : ''} comptée${count > 1 ? 's' : ''} en ${CASHFLOW_TYPE_LABELS[result.transaction.cashflow_type]}.`
  lastAnswer.value = ruleId ? { ruleId, message } : null
}

async function undo(): Promise<void> {
  const answered = lastAnswer.value
  if (!answered) return
  lastAnswer.value = null
  try {
    await types.deleteRule(answered.ruleId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Impossible d'annuler cette réponse."
  }
}

async function subscribe(tx: BankTransactionItem, decision: RecurringDecisionKind): Promise<void> {
  busy.value = tx.id
  error.value = null
  try {
    await recurring.decide(tx.id, decision)
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Impossible d'enregistrer cette réponse."
  } finally {
    busy.value = null
  }
}

async function decide(tx: BankTransactionItem, kind: BankTransferDecisionKind): Promise<void> {
  if (!tx.transfer_id) return
  busy.value = tx.id
  error.value = null
  try {
    await bank.decideTransfer(tx.id, tx.transfer_id, kind)
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Impossible d'enregistrer ce choix."
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div>
    <BaseCard v-if="!allSorted" class="mb-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm text-text-muted dark:text-text-dark-muted">À confirmer</p>
          <p v-if="queue" class="text-3xl font-bold tabular-nums text-text-main dark:text-text-dark-main">
            {{ amount(queue.total_amount) }}
          </p>
          <BaseSkeleton v-else variant="rect" width="10rem" height="2.25rem" />
          <p v-if="queue" class="mt-1 text-sm text-text-muted dark:text-text-dark-muted">
            {{ queue.total_count }} question{{ queue.total_count > 1 ? 's' : '' }}, les plus gros montants d'abord :
            quelques réponses suffisent à rendre le Réel juste.
          </p>
          <!-- Asked in their own tab: saying yes or no to one moves no total. -->
          <p v-if="queue?.recurring_count" class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">
            Et {{ queue.recurring_count }} récurrent{{ queue.recurring_count > 1 ? 's' : '' }} à confirmer, paiement ou revenu,
            dans <router-link :to="{ name: 'bank-recurring' }" class="text-primary hover:underline">Récurrent</router-link>.
          </p>
        </div>
        <p v-if="settled > 0" class="flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle2 class="w-4 h-4" /> {{ amount(settled) }} triés depuis l'ouverture
        </p>
      </div>

      <div v-if="types.queue?.years.length" class="mt-4 -mx-1 px-1 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Année">
        <button
          v-for="chip in [{ year: null, label: 'Toutes' }, ...types.queue.years.map((y) => ({ year: y.year, label: `${y.year} · ${amount(y.amount)}` }))]"
          :key="chip.year ?? 'all'"
          type="button"
          :aria-pressed="year === chip.year"
          :class="[
            'shrink-0 px-3 py-1.5 rounded-button text-sm font-medium transition-colors whitespace-nowrap tabular-nums',
            year === chip.year
              ? 'bg-primary text-primary-content'
              : 'bg-background-subtle dark:bg-background-dark-subtle text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main',
          ]"
          @click="chooseYear(chip.year)"
        >
          {{ chip.label }}
        </button>
      </div>
    </BaseCard>

    <BaseAlert v-if="lastAnswer" variant="success" dismissible class="mb-3" @dismiss="lastAnswer = null">
      {{ lastAnswer.message }}
      <button type="button" class="ml-2 font-medium underline" @click="undo">Annuler</button>
    </BaseAlert>
    <BaseAlert v-if="error" variant="danger" dismissible class="mb-3" @dismiss="error = null">{{ error }}</BaseAlert>

    <div v-if="failed" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">Impossible de charger les questions.</p>
      <BaseButton size="sm" variant="outline" @click="load">Réessayer</BaseButton>
    </div>

    <BaseCard v-else-if="!queue" :padding="false">
      <div class="p-4 sm:p-6 space-y-3">
        <BaseSkeleton v-for="i in 6" :key="i" variant="rect" width="100%" height="3.25rem" />
      </div>
    </BaseCard>

    <BaseCard v-else-if="queue.questions.length" :padding="false" class="overflow-hidden">
      <ul class="divide-y divide-surface-border dark:divide-surface-dark-border">
        <BankTransactionRow
          v-for="item in queue.questions"
          :key="item.transaction.id"
          :tx="item.transaction"
          :date="shortDay(item.transaction.operation_date)"
          :show-account="true"
          :amount="signedAmount(item.transaction)"
          amount-class="text-text-main dark:text-text-dark-main"
          :busy="busy === item.transaction.id"
          :stake-amount="stakeOf(item)"
          :contribution-note="contributionOf(item.transaction)"
          @decide="(kind) => decide(item.transaction, kind)"
          @link="linking = item.transaction"
          @recurring="filing = item.transaction"
          @answer="(type) => answer(item.transaction, type)"
          @retype="retyping = item.transaction"
          @subscribe="(decision) => subscribe(item.transaction, decision)"
        />
      </ul>
    </BaseCard>

    <BaseEmptyState
      v-else
      title="Tout est trié"
      :description="year === null
        ? 'Chaque opération compte là où elle doit : le Réel est à jour.'
        : `Plus rien à trier en ${year}.`"
    >
      <template #icon>
        <CheckCircle2 class="w-8 h-8 text-success" />
      </template>
      <template #action>
        <router-link :to="{ name: 'cashflow', query: { view: 'real' } }">
          <BaseButton variant="outline">Voir le Réel</BaseButton>
        </router-link>
      </template>
    </BaseEmptyState>

    <BankTransferLinkModal :open="linking !== null" :tx="linking" @close="linking = null" />
    <BankRecurringAttachModal :open="filing !== null" :tx="filing" @close="filing = null" />
    <BankTypePicker :open="retyping !== null" :tx="retyping" @close="retyping = null" @saved="remember" />
  </div>
</template>

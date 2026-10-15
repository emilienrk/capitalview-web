<script setup lang="ts">
/**
 * The Banque section's À trier tab: every question the history leaves to the
 * user, those facing a deposit first, then the one moving the most money. A few dozen answers settle most
 * of the euros, where the Opérations list would show them month by month, a
 * 5 € sale next to a 20 000 € transfer.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CheckCircle2 } from 'lucide-vue-next'

import { BaseAlert, BaseButton, BaseCard, BaseEmptyState, BaseSkeleton } from '@/components'
import BankHistoryModal from '@/components/bank/BankHistoryModal.vue'
import BankRecurringAttachModal from '@/components/bank/BankRecurringAttachModal.vue'
import BankTransactionRow from '@/components/bank/BankTransactionRow.vue'
import BankTransferLinkModal from '@/components/bank/BankTransferLinkModal.vue'
import BankTypePicker from '@/components/bank/BankTypePicker.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useBankStore } from '@/stores/bank'
import { useCashflowTypesStore } from '@/stores/cashflowTypes'
import { useRecurringStore } from '@/stores/recurring'
import { CASHFLOW_TYPE_LABELS, RULES_PAGE, contributionMessage, contributionNote, ownAnswer } from '@/utils/cashflowTypes'
import type {
  BankContributionDecisionKind, BankHistoryKind, BankReviewItem, BankTransactionItem, BankTransactionTypeResult,
  BankTransferDecisionKind, CashflowType, RecurringDecisionKind, TypeScope,
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
// Emptied by the answers given here, not opened empty: only then does the
// empty state arrive as a finish.
const clearedHere = ref(false)
watch(() => queue.value?.questions.length, (count, previous) => {
  clearedHere.value = count === 0 && !!previous
})

// Totals add questions up in the operations' own currency, the main one in practice.
const currency = computed(() => types.queue?.questions[0]?.transaction.currency ?? 'EUR')
function amount(value: number, code = currency.value): string {
  return maskValue(formatCurrency(Number(value), code))
}

/**
 * The questions where they stood when the page opened on this year, those
 * arriving since beside their neighbours: an answer never moves the row under
 * the pointer, and a label answered one operation at a time stays put.
 */
const ranks = new Map<string, number>()
const shown = computed(() => {
  const questions = queue.value?.questions ?? []
  const rank = questions.map((item) => ranks.get(item.group))
  rank.forEach((known, i) => {
    if (known !== undefined) return
    const before = i > 0 ? rank[i - 1]! : -1
    const after = rank.slice(i + 1).find((next) => next !== undefined && next > before) ?? before + 2
    rank[i] = (before + after) / 2
  })
  questions.forEach((item, i) => ranks.set(item.group, rank[i]!))
  return questions.map((item, i) => ({ item, rank: rank[i]! })).sort((a, b) => a.rank - b.rank).map(({ item }) => item)
})

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
  ranks.clear()
  void router.replace({ query: { ...route.query, year: value === null ? undefined : String(value) } })
}

watch(() => route.query.year, (value) => {
  const next = readYear(value)
  if (next !== year.value) {
    year.value = next
    openedWith.value = null
    ranks.clear()
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
  return contributionNote(match, Number(tx.amount), (value) => amount(value, tx.currency), shortDay(match.day), tx.type_source === 'contribution') ?? undefined
}

// ── Answers ─────────────────────────────────────────────────

const busy = ref<string | null>(null)
const error = ref<string | null>(null)
const showHistory = ref(false)
const linking = ref<BankTransactionItem | null>(null)
const filing = ref<BankTransactionItem | null>(null)
const retyping = ref<BankTransactionItem | null>(null)
/** The last label answered, which "Annuler" takes back. */
const lastAnswer = ref<{
  ruleId: string | null
  transactionIds: string[]
  message: string
  /** Answered yes or no to the deposit facing it: that decision is what goes. */
  contribution?: boolean
  /** The rule written by hand the answer now comes before, by its title. */
  outranked?: string | null
} | null>(null)

async function answer(tx: BankTransactionItem, type: CashflowType, scope: TypeScope, picked: string[]): Promise<void> {
  busy.value = tx.id
  error.value = null
  // The operation asked about may have been unticked: the first ticked one carries the answer.
  const [first = tx.id, ...also] = picked
  try {
    const result = await types.answerFlow(first, type, scope, also)
    remember(result, scope === 'operation' ? [first, ...also] : [result.transaction.id])
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Impossible d'enregistrer cette réponse."
  } finally {
    busy.value = null
  }
}

function remember(
  result: BankTransactionTypeResult, transactionIds = [result.transaction.id], outranked: string | null = null,
): void {
  const count = result.covered_count
  const ruleId = result.transaction.type_rule_id
  const message = `${count} opération${count > 1 ? 's' : ''} comptée${count > 1 ? 's' : ''} en ${CASHFLOW_TYPE_LABELS[result.transaction.cashflow_type]}.`
  // Kept to the operations answered, there is no rule: undoing clears their own type.
  lastAnswer.value = { ruleId, transactionIds, message, outranked }
}

async function undo(): Promise<void> {
  const answered = lastAnswer.value
  if (!answered) return
  lastAnswer.value = null
  try {
    const [id] = answered.transactionIds
    if (answered.contribution) await undoHistory(['contribution', 'not_contribution'], ...answered.transactionIds)
    else if (answered.ruleId) await types.deleteRule(answered.ruleId)
    else await types.clearOverride(...answered.transactionIds)
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Impossible d'annuler cette réponse."
  }
}

/** Withdraws the decisions of these kinds the history holds on these operations. */
async function undoHistory(kinds: BankHistoryKind[], ...transactionIds: (string | undefined)[]): Promise<void> {
  const decisions = (await types.fetchHistory()).filter(
    (item) => kinds.includes(item.kind) && item.operations.some((op) => transactionIds.includes(op.id)),
  )
  for (const decision of decisions) await types.undoAnswer(decision)
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

/** Yes or no to the deposit or withdrawal facing the operation, or each of those ticked. */
async function contribution(
  tx: BankTransactionItem, kind: BankContributionDecisionKind, answers = ownAnswer(tx), kept: CashflowType | null = null,
): Promise<void> {
  const [first, ...also] = answers
  if (!first) return
  busy.value = tx.id
  error.value = null
  try {
    await bank.decideContribution(first.transaction_id, first.contribution_id, kind, also)
    rememberContribution(answers.map((answer) => answer.transaction_id), contributionMessage(kind, kept))
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Impossible d'enregistrer cette réponse."
  } finally {
    busy.value = null
  }
}

function rememberContribution(transactionIds: string[], message: string): void {
  lastAnswer.value = {
    ruleId: null,
    transactionIds,
    message,
    contribution: true,
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

/** The offered pair made with another operation as close, the one the user picked. */
async function pick(tx: BankTransactionItem, otherId: string): Promise<void> {
  busy.value = tx.id
  error.value = null
  try {
    await bank.decideTransfer(tx.id, otherId, 'transfer')
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
            {{ queue.total_count }} question{{ queue.total_count > 1 ? 's' : '' }}
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
      <template v-if="lastAnswer.ruleId">
        Règle créée, dans <router-link :to="RULES_PAGE" class="font-medium underline">Règles de tri</router-link>.
      </template>
      <template v-if="lastAnswer.outranked">
        {{ lastAnswer.ruleId ? 'Pour ce libellé, elle' : 'Ce choix' }} passe avant la règle {{ lastAnswer.outranked }}.
      </template>
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
      <TransitionGroup tag="ul" name="cv-row" class="relative divide-y divide-surface-border dark:divide-surface-dark-border">
        <BankTransactionRow
          v-for="item in shown"
          :key="item.group"
          :tx="item.transaction"
          :date="shortDay(item.transaction.operation_date)"
          :show-account="true"
          :amount="signedAmount(item.transaction)"
          amount-class="text-text-main dark:text-text-dark-main"
          :busy="busy === item.transaction.id"
          :stake-amount="stakeOf(item)"
          :contribution-note="contributionOf(item.transaction)"
          @decide="(kind) => decide(item.transaction, kind)"
          @pick="(otherId) => pick(item.transaction, otherId)"
          @deposit="contribution(item.transaction, 'contribution')"
          @contribution="(kind, answers, kept) => contribution(item.transaction, kind, answers, kept)"
          @link="linking = item.transaction"
          @recurring="filing = item.transaction"
          @answer="(type, scope, picked) => answer(item.transaction, type, scope, picked)"
          @retype="retyping = item.transaction"
          @subscribe="(decision) => subscribe(item.transaction, decision)"
        />
      </TransitionGroup>
    </BaseCard>

    <BaseEmptyState
      v-else
      :class="{ 'cv-done': clearedHere }"
      title="Tout est trié"
      :description="year === null
        ? 'Chaque opération compte là où elle doit : le Réel est à jour.'
        : `Plus rien à trier en ${year}.`"
    >
      <template #icon>
        <CheckCircle2 class="w-8 h-8 text-success" />
      </template>
      <template #action>
        <BaseButton :to="{ name: 'cashflow', query: { view: 'real' } }" variant="outline">Voir le Réel</BaseButton>
      </template>
    </BaseEmptyState>

    <!-- Shown, never asked: no answer would change a total, only adding the
         account the money went through would. -->
    <BaseCard v-if="queue?.unfaced?.length" class="mt-6">
      <h3 class="text-base font-semibold text-text-main dark:text-text-dark-main">Sans contrepartie bancaire</h3>
      <p class="mt-1 text-sm text-text-muted dark:text-text-dark-muted">
        Aucune opération de vos comptes bancaires ne correspond à ces mouvements de vos comptes d'investissement :
        ils sont peut-être passés par un compte que vous n'avez pas ajouté.
      </p>
      <ul class="mt-3 divide-y divide-surface-border dark:divide-surface-dark-border">
        <li
          v-for="(item, i) in queue.unfaced"
          :key="`${item.day}-${i}`"
          class="flex items-center justify-between gap-3 py-2 text-sm"
        >
          <span class="min-w-0 truncate text-text-main dark:text-text-dark-main">
            <span class="text-text-muted dark:text-text-dark-muted">{{ shortDay(item.day) }}</span>
            · {{ item.is_deposit ? 'Dépôt sur' : 'Retrait de' }} {{ item.account_name }}
          </span>
          <span class="shrink-0 font-medium tabular-nums text-text-main dark:text-text-dark-main">{{ amount(item.amount) }}</span>
        </li>
      </ul>
    </BaseCard>

    <p class="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
      <button
        type="button"
        class="text-sm font-medium text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main hover:underline"
        @click="showHistory = true"
      >
        Historique de mes réponses
      </button>
      <router-link
        :to="RULES_PAGE"
        class="text-sm font-medium text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main hover:underline"
      >
        Règles de tri
      </router-link>
    </p>

    <BankHistoryModal :open="showHistory" @close="showHistory = false" />
    <BankTransferLinkModal :open="linking !== null" :tx="linking" @close="linking = null" />
    <BankRecurringAttachModal :open="filing !== null" :tx="filing" @close="filing = null" />
    <BankTypePicker
      :open="retyping !== null" :tx="retyping"
      @close="retyping = null" @saved="(result, outranked) => remember(result, undefined, outranked)"
    />
  </div>
</template>

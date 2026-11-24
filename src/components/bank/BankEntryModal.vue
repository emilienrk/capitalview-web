<script setup lang="ts">
/**
 * An operation typed by hand on an account no bank feeds. Its operations are
 * its balance: the form shows where this one takes it, and can work the amount
 * out from a balance read on a statement — still a real operation, never an
 * adjustment. On a cash account, that balance is what the user counted in their
 * wallet (docs/bank-ledger.md, L13), and the operation is filed as it is typed:
 * an entry says what it is or which withdrawal it came from, a payment out may
 * be a deposit onto an account facing it (docs/bank-sorting.md, R55 and R56).
 *
 * The same form as a placement's "Nouvelle opération" (Placements.vue).
 */
import { computed, reactive, ref, watch } from 'vue'

import { BaseAlert, BaseAutocomplete, BaseButton, BaseInput, BaseModal, BaseSelect } from '@/components'
import { useBankStore } from '@/stores/bank'
import { useLedgerStore } from '@/stores/ledger'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useConfirm } from '@/composables/useConfirm'
import type { BankBalanceResponse, BankTransactionItem, CashflowType } from '@/types'
import { answerHint, answerLabel } from '@/utils/cashflowTypes'
import { hasIdentity, labelSuggestions } from '@/utils/entryLabels'

// COUNT: the cash the user counted in their wallet, the operation being the gap.
type EntryType = 'IN' | 'OUT' | 'COUNT'
/** What a cash entry is: a withdrawal from one of the user's accounts, or an answer. */
type Nature = '' | 'TRANSFER' | CashflowType

const props = defineProps<{
  open: boolean
  /** The account the entry goes on. */
  accountId: string | null
  /** A manual operation to correct or delete. */
  editing?: BankTransactionItem | null
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const ENTRY_OPTIONS: { label: string; value: EntryType }[] = [
  { label: 'Entrée', value: 'IN' },
  { label: 'Sortie', value: 'OUT' },
]
const COUNT_OPTION = { label: 'Comptage', value: 'COUNT' as const }

const bank = useBankStore()
const ledger = useLedgerStore()
const { formatCurrency, formatDayMonth } = useFormatters()
const { maskValue } = usePrivacyMode()
const { confirmDialog } = useConfirm()

const today = (): string => new Date().toISOString().slice(0, 10)

const form = reactive<{ type: EntryType; amount: number | ''; day: string; label: string }>({
  type: 'OUT',
  amount: '',
  day: today(),
  label: '',
})
const error = ref<string | null>(null)
const saving = ref(false)
const balance = ref<BankBalanceResponse | null>(null)
// The balance read on a statement, when the user would rather type that.
const fromStatement = ref(false)
const statementBalance = ref<number | ''>('')

const account = computed(() => bank.summary?.accounts.find((a) => a.id === props.accountId) ?? null)
const currency = computed(() => account.value?.currency ?? 'EUR')
const isCash = computed(() => account.value?.account_type === 'CASH')
const typeOptions = computed(() => (isCash.value && !props.editing ? [...ENTRY_OPTIONS, COUNT_OPTION] : ENTRY_OPTIONS))
const isCounting = computed(() => form.type === 'COUNT')

// A cash operation asks nothing and is filed as it is typed: its label groups
// nothing, so one is given when left out (docs/bank-ledger.md, L10).
const CASH_LABELS: Record<Exclude<Nature, ''>, string> = {
  TRANSFER: 'Retrait',
  INCOME: 'Entrée en espèces',
  EXPENSE: 'Remboursement en espèces',
  SAVING: "Reprise d'épargne",
  INVESTMENT: "Reprise d'investissement",
  NEUTRAL: 'Entrée non comptée',
}
const CASH_SPENT_LABEL = 'Dépense en espèces'
const COUNT_LABEL = 'Écart de comptage'

const CREDIT_ANSWERS: CashflowType[] = ['INCOME', 'EXPENSE', 'SAVING', 'INVESTMENT', 'NEUTRAL']
const NATURE_OPTIONS: { label: string; value: Nature }[] = [
  { label: "Retrait d'un de mes comptes", value: 'TRANSFER' },
  ...CREDIT_ANSWERS.map((type) => ({ label: answerLabel(type, true), value: type })),
]
// No pick, kept apart from the operations offered: a payment out that was
// spent, an entry whose withdrawal the bank has not sent yet.
const NONE = 'NONE'
const nature = ref<Nature>('')
const counterpartId = ref<string>('')
const counterparts = ref<BankTransactionItem[]>([])
const asksNature = computed(() => isCash.value && form.type === 'IN')
const natureHint = computed(() =>
  nature.value && nature.value !== 'TRANSFER' ? answerHint(nature.value, true) : null,
)
const labelPlaceholder = computed(() => {
  if (!isCash.value) return 'ex. Virement vers Livret A'
  if (isCounting.value) return COUNT_LABEL
  if (form.type === 'OUT') return CASH_SPENT_LABEL
  return nature.value ? CASH_LABELS[nature.value] : 'Facultatif'
})
const counterpartOptions = computed(() => [
  ...(form.type === 'OUT' ? [{ label: 'Non, dépensé', value: NONE }] : []),
  ...counterparts.value.map((tx) => ({
    label: [tx.account_name, tx.operation_date ? formatDayMonth(tx.operation_date) : null, tx.label]
      .filter(Boolean).join(' · '),
    value: tx.id,
  })),
  ...(form.type === 'IN' ? [{ label: 'Aucune de celles-ci', value: NONE }] : []),
])
/** The pick shows for an entry said to be a withdrawal, and for a payment out
 * only when something faces it: spent is the rule (R55). */
const asksCounterpart = computed(() =>
  isCash.value && (form.type === 'IN' ? nature.value === 'TRANSFER' : true) && counterparts.value.length > 0,
)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = null
    balance.value = null
    fromStatement.value = false
    statementBalance.value = ''
    const tx = props.editing
    // A wallet is mostly counted, seldom typed line by line (L13).
    form.type = tx ? (tx.is_credit ? 'IN' : 'OUT') : isCash.value ? 'COUNT' : 'OUT'
    form.amount = tx ? Number(tx.amount) : ''
    form.day = tx?.operation_date ?? today()
    form.label = tx?.label ?? ''
    // Typed again, an operation keeps what it was filed as.
    const paired = tx?.transfer_id && tx.transfer_status === 'confirmed' ? tx.transfer_id : null
    nature.value = tx?.is_credit ? (paired ? 'TRANSFER' : tx.type_source === 'override' ? tx.cashflow_type : '') : ''
    counterpartId.value = paired ?? (tx && !tx.is_credit ? NONE : '')
    counterparts.value = []
    // The labels to pick from; the browser answers 304 while nothing changed.
    void ledger.fetchLedger()
  },
)

/** The label is what groups the entry with its kin and lets a rule reach it:
 * one already used here, taken as it is, files it with them. */
const suggestions = computed(() =>
  props.accountId && !isCounting.value ? labelSuggestions(ledger.ledger, props.accountId, form.type === 'IN') : [],
)

// The balance on the chosen day, asked of the API as the date changes.
let balanceTimer: ReturnType<typeof setTimeout> | undefined
let latestBalance = 0
watch(
  () => [props.open, props.accountId, form.day] as const,
  ([open, accountId, day]) => {
    clearTimeout(balanceTimer)
    if (!open || !accountId || !day) return
    const asked = ++latestBalance
    balanceTimer = setTimeout(async () => {
      try {
        const answer = await bank.fetchBalance(accountId, day)
        if (asked === latestBalance) balance.value = answer
      } catch {
        // The line just stays away: saving does not depend on it.
      }
    }, 200)
  },
  { immediate: true },
)

// What the entry could pair with, asked again as its amount, direction or day moves.
let counterpartTimer: ReturnType<typeof setTimeout> | undefined
let latestCounterparts = 0
watch(
  () => [props.open, isCash.value, props.accountId, form.type, form.amount, form.day] as const,
  ([open, cash, accountId, type, amount, day]) => {
    clearTimeout(counterpartTimer)
    const asked = ++latestCounterparts
    if (!open || !cash || !accountId || !day || type === 'COUNT' || amount === '' || Number(amount) <= 0) {
      counterparts.value = []
      return
    }
    counterpartTimer = setTimeout(async () => {
      try {
        const found = await bank.fetchEntryCounterparts(
          accountId, day, signedOf(type, Number(amount)), props.editing?.id,
        )
        if (asked !== latestCounterparts) return
        counterparts.value = found
        // A pick the new amount or day no longer offers is dropped, never sent.
        if (counterpartId.value !== NONE && !found.some((tx) => tx.id === counterpartId.value)) {
          counterpartId.value = type === 'OUT' ? NONE : ''
        }
        if (type === 'OUT' && !counterpartId.value) counterpartId.value = NONE
      } catch {
        if (asked === latestCounterparts) counterparts.value = []
      }
    }, 250)
  },
  { immediate: true },
)

function signedOf(type: Exclude<EntryType, 'COUNT'>, amount: number): number {
  return type === 'IN' ? amount : -amount
}

// Corrected by being typed again: the operation being edited is not part of
// the balance it lands on.
const editedShare = computed(() => {
  const tx = props.editing
  if (!tx) return { onDay: 0, now: 0 }
  const signed = signedOf(tx.is_credit ? 'IN' : 'OUT', Number(tx.amount))
  return { onDay: tx.operation_date && tx.operation_date <= form.day ? signed : 0, now: signed }
})
const before = computed(() => {
  if (!balance.value || balance.value.day !== form.day) return null
  return {
    onDay: Number(balance.value.balance_on_day) - editedShare.value.onDay,
    now: Number(balance.value.balance_now) - editedShare.value.now,
  }
})
const typed = computed(() =>
  form.amount === '' || form.type === 'COUNT' ? 0 : signedOf(form.type, Number(form.amount)),
)
// What the wallet holds by the operations, against what the user counted.
const countGap = computed(() => {
  if (!isCounting.value || statementBalance.value === '' || !before.value) return null
  return Number((Number(statementBalance.value) - before.value.onDay).toFixed(2))
})

watch([statementBalance, before], ([read, known]) => {
  if (!fromStatement.value || read === '' || !known) return
  const gap = Number((Number(read) - known.onDay).toFixed(2))
  form.type = gap >= 0 ? 'IN' : 'OUT'
  form.amount = Math.abs(gap)
})

function money(value: number): string {
  return maskValue(formatCurrency(value, currency.value))
}

const isToday = computed(() => form.day === today())
const canSubmit = computed(() => {
  if (isCounting.value) return statementBalance.value !== ''
  return form.amount !== '' && (isCash.value || !!form.label.trim())
})

/** What is sent: a count becomes the gap it leaves, spent or not counted. */
function entryToSend(): { amount: number; label: string; type: CashflowType | null; transfer_with: string | null } | null {
  const label = form.label.trim()
  if (form.type === 'COUNT') {
    if (!countGap.value) return null
    return {
      amount: countGap.value,
      label: label || COUNT_LABEL,
      // Found in the wallet, nobody knows where from: it counts nowhere.
      type: countGap.value > 0 ? 'NEUTRAL' : null,
      transfer_with: null,
    }
  }
  const pairedWith = asksCounterpart.value && counterpartId.value !== NONE ? counterpartId.value : null
  let type: CashflowType | null = null
  if (asksNature.value && nature.value) {
    // A withdrawal with nothing to bind yet counts nowhere until its pair comes.
    type = nature.value === 'TRANSFER' ? (pairedWith ? null : 'NEUTRAL') : nature.value
  }
  const fallback = !isCash.value ? '' : form.type === 'OUT' ? CASH_SPENT_LABEL : nature.value ? CASH_LABELS[nature.value] : ''
  return {
    amount: signedOf(form.type, Number(form.amount)),
    label: label || fallback,
    type,
    transfer_with: pairedWith,
  }
}

async function submit(): Promise<void> {
  if (!props.accountId || saving.value) return
  if (isCounting.value) {
    if (statementBalance.value === '') return
    if (!countGap.value) {
      error.value = 'Vos opérations donnent déjà ce montant à cette date : il n\'y a rien à ajouter.'
      return
    }
  } else if (form.amount === '') {
    return
  }
  if (!isCash.value && !hasIdentity(form.label)) {
    error.value = 'Donnez un libellé : c\'est lui qui regroupe vos opérations et porte vos règles.'
    return
  }
  if (asksNature.value && !nature.value) {
    error.value = 'Dites ce qu\'est cette entrée : elle sera classée pour de bon.'
    return
  }
  if (asksCounterpart.value && form.type === 'IN' && !counterpartId.value) {
    error.value = 'Choisissez le retrait d\'où vient cet argent, ou « Aucune de celles-ci ».'
    return
  }
  if (!isCounting.value && Number(form.amount) <= 0) {
    error.value = fromStatement.value
      ? 'Vos opérations donnent déjà ce solde à cette date : il n\'y a rien à ajouter.'
      : 'Le montant doit être positif : le type dit si c\'est une entrée ou une sortie.'
    return
  }
  saving.value = true
  error.value = null
  try {
    // A typed operation is corrected by being typed again.
    if (props.editing) await bank.deleteTransaction(props.editing.id)
    const entry = entryToSend()
    if (!entry) return
    await bank.addEntry(props.accountId, { day: form.day, ...entry })
    emit('saved')
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Impossible d'enregistrer cette opération."
  } finally {
    saving.value = false
  }
}

async function remove(): Promise<void> {
  if (!props.editing) return
  const confirmed = await confirmDialog({
    title: 'Supprimer l\'opération',
    message: 'Le solde du compte sera recalculé sans elle.',
    confirmLabel: 'Supprimer',
  })
  if (!confirmed) return
  try {
    await bank.deleteTransaction(props.editing.id)
    emit('saved')
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Impossible de supprimer cette opération.'
  }
}
</script>

<template>
  <BaseModal :open="open" :title="editing ? 'Modifier l\'opération' : 'Nouvelle opération'" @close="emit('close')">
    <BaseAlert v-if="error" variant="danger" dismissible class="mb-4" @dismiss="error = null">
      {{ error }}
    </BaseAlert>
    <form class="space-y-4" @submit.prevent="submit">
      <BaseSelect v-model="form.type" label="Type d'opération" :options="typeOptions" />
      <!-- Above the other fields, so its suggestions open over them rather than past the modal's foot. -->
      <BaseAutocomplete
        v-model="form.label"
        label="Libellé"
        :placeholder="labelPlaceholder"
        :options="suggestions"
        show-all-on-focus
        :required="!isCash"
      />
      <div v-if="isCounting">
        <BaseInput
          v-model="statementBalance"
          label="Montant compté"
          type="number"
          step="any"
          min="0"
          placeholder="0.00"
          required
        />
        <p v-if="before" class="mt-1 text-xs text-text-muted dark:text-text-dark-muted tabular-nums">
          Vos opérations donnent {{ money(before.onDay) }}<template v-if="countGap !== null"> :
            <template v-if="countGap < 0">une dépense en espèces de {{ money(-countGap) }} sera ajoutée.</template>
            <template v-else-if="countGap > 0">une entrée de {{ money(countGap) }} sera ajoutée, en Non compté.</template>
            <template v-else>rien à ajouter.</template>
          </template>
        </p>
        <!-- More than expected is most often a withdrawal not yet bound: left as
             it is, the withdrawal counts as spent and the gap is spent again. -->
        <p v-if="countGap !== null && countGap > 0" class="mt-1 text-xs text-warning">
          Un retrait oublié ? Liez-le d'abord depuis l'opération de votre compte (« Lier », puis « Retiré en
          espèces »), puis recomptez : sinon il comptera deux fois en dépense.
        </p>
      </div>
      <div v-if="fromStatement">
        <BaseInput
          v-model="statementBalance"
          :label="isToday ? 'Solde lu sur votre relevé aujourd\'hui' : `Solde lu sur votre relevé au ${formatDayMonth(form.day)}`"
          type="number"
          step="any"
          placeholder="0.00"
        />
        <button
          type="button"
          class="mt-1 text-xs font-medium text-primary hover:underline underline-offset-2"
          @click="fromStatement = false"
        >
          Saisir le montant directement
        </button>
      </div>
      <div v-if="!isCounting">
        <BaseInput
          v-model="form.amount"
          label="Montant"
          type="number"
          step="any"
          min="0"
          placeholder="0.00"
          required
        />
        <p v-if="before" class="mt-1 text-xs text-text-muted dark:text-text-dark-muted tabular-nums">
          {{ isToday ? 'Solde du compte' : `Solde au ${formatDayMonth(form.day)}` }} :
          {{ money(before.onDay) }}<template v-if="typed"> → <span class="text-text-body dark:text-text-dark-body">{{ money(before.onDay + typed) }}</span></template>
          <template v-if="!isToday && before.now !== before.onDay">
            · aujourd'hui {{ money(before.now) }}<template v-if="typed"> → {{ money(before.now + typed) }}</template>
          </template>
        </p>
        <button
          v-if="!fromStatement && !editing && !isCash"
          type="button"
          class="mt-1 text-xs font-medium text-primary hover:underline underline-offset-2"
          @click="fromStatement = true"
        >
          Calculer le montant depuis le solde de votre relevé
        </button>
      </div>
      <BaseInput v-model="form.day" label="Date" type="date" :max="today()" required />
      <div v-if="asksNature">
        <BaseSelect v-model="nature" label="Ce que c'est" :options="NATURE_OPTIONS" placeholder="Choisir…" required />
        <p v-if="natureHint" class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">{{ natureHint }}</p>
        <p
          v-else-if="nature === 'TRANSFER' && !counterparts.length"
          class="mt-1 text-xs text-text-muted dark:text-text-dark-muted"
        >
          Aucune sortie de ce montant à ces dates : l'entrée sera comptée en Non compté, et la paire vous sera
          proposée dans À trier dès que votre banque aura remonté le retrait.
        </p>
      </div>
      <BaseSelect
        v-if="asksCounterpart"
        v-model="counterpartId"
        :label="form.type === 'IN' ? 'Opération en face' : 'Déposé sur un de mes comptes ?'"
        :options="counterpartOptions"
        placeholder="Choisir…"
        :required="form.type === 'IN'"
      />
    </form>
    <template #footer>
      <div class="flex justify-between w-full">
        <BaseButton v-if="editing" variant="danger" @click="remove">Supprimer</BaseButton>
        <div v-else></div>
        <div class="flex gap-2">
          <BaseButton variant="ghost" @click="emit('close')">Annuler</BaseButton>
          <BaseButton :disabled="!canSubmit || saving" @click="submit">
            {{ editing ? 'Enregistrer' : 'Valider' }}
          </BaseButton>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

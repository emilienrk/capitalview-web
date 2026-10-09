<script setup lang="ts">
/**
 * An operation typed by hand on an account no bank feeds. Its operations are
 * its balance: the form shows where this one takes it, and can work the amount
 * out from a balance read on a statement — still a real operation, never an
 * adjustment.
 *
 * The same form as a placement's "Nouvelle opération" (Placements.vue).
 */
import { computed, reactive, ref, watch } from 'vue'

import { BaseAlert, BaseButton, BaseInput, BaseModal, BaseSelect } from '@/components'
import { useBankStore } from '@/stores/bank'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useConfirm } from '@/composables/useConfirm'
import type { BankBalanceResponse, BankTransactionItem } from '@/types'

type EntryType = 'IN' | 'OUT'

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

const bank = useBankStore()
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

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = null
    balance.value = null
    fromStatement.value = false
    statementBalance.value = ''
    const tx = props.editing
    form.type = tx ? (tx.is_credit ? 'IN' : 'OUT') : 'OUT'
    form.amount = tx ? Number(tx.amount) : ''
    form.day = tx?.operation_date ?? today()
    form.label = tx?.label ?? ''
  },
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

function signedOf(type: EntryType, amount: number): number {
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
const typed = computed(() => (form.amount === '' ? 0 : signedOf(form.type, Number(form.amount))))

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

async function submit(): Promise<void> {
  if (!props.accountId || form.amount === '' || saving.value) return
  if (Number(form.amount) <= 0) {
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
    await bank.addEntry(props.accountId, {
      day: form.day,
      amount: signedOf(form.type, Number(form.amount)),
      label: form.label || null,
    })
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
      <BaseSelect v-model="form.type" label="Type d'opération" :options="ENTRY_OPTIONS" />
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
      <div>
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
          v-if="!fromStatement && !editing"
          type="button"
          class="mt-1 text-xs font-medium text-primary hover:underline underline-offset-2"
          @click="fromStatement = true"
        >
          Calculer le montant depuis le solde de votre relevé
        </button>
      </div>
      <BaseInput v-model="form.day" label="Date" type="date" :max="today()" required />
      <BaseInput v-model="form.label" label="Libellé" placeholder="Optionnel" />
    </form>
    <template #footer>
      <div class="flex justify-between w-full">
        <BaseButton v-if="editing" variant="danger" @click="remove">Supprimer</BaseButton>
        <div v-else></div>
        <div class="flex gap-2">
          <BaseButton variant="ghost" @click="emit('close')">Annuler</BaseButton>
          <BaseButton :disabled="form.amount === '' || saving" @click="submit">
            {{ editing ? 'Enregistrer' : 'Valider' }}
          </BaseButton>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

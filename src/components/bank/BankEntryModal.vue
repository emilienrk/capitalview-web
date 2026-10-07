<script setup lang="ts">
/**
 * An operation typed by hand, or a balance read on a statement, on an account
 * no bank feeds. Its operations are its balance: a balance read becomes the
 * adjustment that makes them agree with it, shown before it is saved.
 *
 * The same form as a placement's "Nouvelle opération" (Placements.vue).
 */
import { computed, reactive, ref, watch } from 'vue'

import { BaseAlert, BaseButton, BaseInput, BaseModal, BaseSelect } from '@/components'
import { useBankStore } from '@/stores/bank'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useConfirm } from '@/composables/useConfirm'
import type { BankEntryResponse, BankTransactionItem } from '@/types'

type EntryType = 'IN' | 'OUT' | 'BALANCE'

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
  { label: 'Relevé de solde', value: 'BALANCE' },
]

const bank = useBankStore()
const { formatCurrency, formatDateShort } = useFormatters()
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
const preview = ref<BankEntryResponse | null>(null)

const account = computed(() => bank.summary?.accounts.find((a) => a.id === props.accountId) ?? null)
const currency = computed(() => account.value?.currency ?? 'EUR')

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = null
    preview.value = null
    const tx = props.editing
    form.type = tx ? (tx.is_credit ? 'IN' : 'OUT') : 'OUT'
    form.amount = tx ? Number(tx.amount) : ''
    form.day = tx?.operation_date ?? today()
    form.label = tx?.label ?? ''
  },
)

function money(value: number): string {
  return maskValue(formatCurrency(Number(value), currency.value))
}

function request() {
  const value = Number(form.amount)
  if (form.type === 'BALANCE') return { kind: 'balance' as const, day: form.day, balance: value, label: form.label || null }
  return { kind: 'operation' as const, day: form.day, amount: form.type === 'IN' ? value : -value, label: form.label || null }
}

// What a balance read would record, asked of the API as it is typed.
let previewTimer: ReturnType<typeof setTimeout> | undefined
let latestPreview = 0
watch(
  () => [form.type, form.amount, form.day, props.open],
  () => {
    clearTimeout(previewTimer)
    preview.value = null
    if (!props.open || !props.accountId || form.type !== 'BALANCE' || form.amount === '' || !form.day) return
    const asked = ++latestPreview
    const accountId = props.accountId
    previewTimer = setTimeout(async () => {
      try {
        const answer = await bank.addEntry(accountId, request(), true)
        if (asked === latestPreview) preview.value = answer
      } catch {
        // The submit says what is wrong; the hint just stays away.
      }
    }, 300)
  },
)

const hint = computed(() => {
  const p = preview.value
  if (!p || p.adjustment === null) return null
  const day = formatDateShort(form.day)
  const change = `solde actuel ${money(p.balance_now_before)} → ${money(p.balance_now_after)}`
  if (Number(p.adjustment) === 0) return `Vos opérations donnent déjà ce solde au ${day} : rien à ajuster.`
  const sign = Number(p.adjustment) > 0 ? '+' : ''
  return `Ajustement de ${sign}${money(p.adjustment)} au ${day} — ${change}`
})

async function submit(): Promise<void> {
  if (!props.accountId || form.amount === '' || saving.value) return
  if (form.type !== 'BALANCE' && Number(form.amount) <= 0) {
    error.value = 'Le montant doit être positif : le type dit si c\'est une entrée ou une sortie.'
    return
  }
  saving.value = true
  error.value = null
  try {
    // A typed operation is corrected by being typed again.
    if (props.editing) await bank.deleteTransaction(props.editing.id)
    await bank.addEntry(props.accountId, request())
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
      <BaseSelect
        v-model="form.type"
        label="Type d'opération"
        :options="editing ? ENTRY_OPTIONS.filter((o) => o.value !== 'BALANCE') : ENTRY_OPTIONS"
      />
      <BaseInput
        v-model="form.amount"
        :label="form.type === 'BALANCE' ? 'Solde lu' : 'Montant'"
        type="number"
        step="any"
        :min="form.type === 'BALANCE' ? undefined : '0'"
        placeholder="0.00"
        required
      />
      <p v-if="form.type === 'BALANCE'" class="-mt-2 text-xs text-text-muted dark:text-text-dark-muted">
        <template v-if="hint">{{ hint }}</template>
        <template v-else>
          Le solde affiché sur votre relevé à cette date. L'écart avec vos opérations est enregistré comme un ajustement,
          qui ne compte ni en dépense ni en revenu.
        </template>
      </p>
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

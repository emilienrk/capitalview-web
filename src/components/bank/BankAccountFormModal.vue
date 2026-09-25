<script setup lang="ts">
/**
 * Create or edit a bank account. Opened through `openCreate` / `openEdit` from
 * the Banque section's shared header and from its account cards alike.
 *
 * Nothing is reloaded from here: every store write invalidates the bank caches,
 * and each tab reloads what it shows on that signal.
 */
import { computed, reactive, ref, watch } from 'vue'

import { useBankStore } from '@/stores/bank'
import { BASE_CURRENCY, currencyOptions } from '@/utils/currencies'
import { useConfirm } from '@/composables/useConfirm'
import { BaseButton, BaseInput, BaseModal, BaseSelect } from '@/components'
import type {
  BankAccountCreate, BankAccountResponse, BankAccountType, BankAccountUpdate, InterestMethod,
} from '@/types'

const bank = useBankStore()
const { confirmDialog } = useConfirm()

const open = ref(false)
const editingId = ref<string | null>(null)
// A linked account's balance is the bank's last reading and its currency is what
// that reading is matched on: the API refuses either being changed by hand.
const editingLinked = ref(false)

// Every field bound, none optional: the inputs always hold a value, and the two
// API payloads are built from it explicitly rather than by spreading it.
interface AccountForm {
  name: string
  account_type: BankAccountType
  institution_name: string
  identifier: string
  balance: number
  currency: string
  /** '' when unset — what a cleared date input holds. */
  opened_at: string
  /** Percentages as typed, '' when unset; sent to the API as decimals. */
  interest_rate_pct: string | number
  interest_method: InterestMethod
  boosted_rate_pct: string | number
  boosted_until: string
}

const form = reactive<AccountForm>({
  name: '',
  account_type: 'CHECKING',
  institution_name: '',
  identifier: '',
  balance: 0,
  currency: BASE_CURRENCY,
  opened_at: '',
  interest_rate_pct: '',
  interest_method: 'FORTNIGHTLY',
  boosted_rate_pct: '',
  boosted_until: '',
})
const formError = ref<string | null>(null)
const showBoost = ref(false)

// Served by the API so the list lives in one place; the static fallback in
// @/utils/currencies keeps the picker populated if the call fails.
const currencyChoices = computed(() => currencyOptions())

// Regulated savings: held in euros only, and at most one of each per person.
const REGULATED_TYPES = new Set<BankAccountType>(['LIVRET_A', 'LIVRET_DEVE', 'LEP', 'LDD', 'PEL', 'CEL'])
const isRegulated = computed(() => REGULATED_TYPES.has(form.account_type))
watch(isRegulated, (regulated) => {
  if (regulated) form.currency = BASE_CURRENCY
})

// Mirrors INTEREST_BEARING_TYPES in the API: the PEL's fixed rate and rules are its own.
const INTEREST_TYPES = new Set<BankAccountType>(['SAVINGS', 'LIVRET_A', 'LIVRET_DEVE', 'LEP', 'LDD', 'CEL'])
const bearsInterest = computed(() => INTEREST_TYPES.has(form.account_type))

const METHOD_OPTIONS: Array<{ label: string; value: InterestMethod }> = [
  { label: 'Par quinzaines (le plus courant)', value: 'FORTNIGHTLY' },
  { label: 'Au jour le jour', value: 'DAILY' },
]

const toPct = (rate: number | null): string | number => (rate === null ? '' : Number((Number(rate) * 100).toFixed(4)))
const toRate = (pct: string | number): number | null => (pct === '' ? null : Number((Number(pct) / 100).toFixed(6)))

const ACCOUNT_TYPE_LABELS: Array<{ label: string; value: BankAccountType }> = [
  { label: 'Compte courant', value: 'CHECKING' },
  { label: 'Autre épargne (compte sur livret…)', value: 'SAVINGS' },
  { label: 'Livret A', value: 'LIVRET_A' },
  { label: 'LDDS', value: 'LIVRET_DEVE' },
  { label: 'LEP', value: 'LEP' },
  { label: 'LDD', value: 'LDD' },
  { label: 'PEL', value: 'PEL' },
  { label: 'CEL', value: 'CEL' },
]

const accountTypeOptions = computed(() => {
  const existingTypes = new Set(bank.summary?.accounts?.map((a) => a.account_type) ?? [])
  return ACCOUNT_TYPE_LABELS.map((option) => ({
    ...option,
    disabled: REGULATED_TYPES.has(option.value) && existingTypes.has(option.value),
  }))
})

function openCreate(): void {
  editingLinked.value = false
  editingId.value = null
  form.name = ''
  form.account_type = 'CHECKING'
  form.institution_name = ''
  form.identifier = ''
  form.balance = 0
  form.currency = BASE_CURRENCY
  form.opened_at = ''
  form.interest_rate_pct = ''
  form.interest_method = 'FORTNIGHTLY'
  form.boosted_rate_pct = ''
  form.boosted_until = ''
  showBoost.value = false
  formError.value = null
  open.value = true
}

function openEdit(account: BankAccountResponse): void {
  editingId.value = account.id
  editingLinked.value = account.is_linked
  form.name = account.name
  form.account_type = account.account_type
  form.institution_name = account.institution_name ?? ''
  form.identifier = account.identifier ?? ''
  form.balance = account.balance
  form.currency = account.currency
  form.opened_at = account.opened_at ?? ''
  form.interest_rate_pct = toPct(account.interest_rate)
  form.interest_method = account.interest_method ?? 'FORTNIGHTLY'
  form.boosted_rate_pct = toPct(account.boosted_rate)
  form.boosted_until = account.boosted_until ?? ''
  showBoost.value = account.boosted_rate !== null
  formError.value = null
  open.value = true
}

/** The interest fields to send, or null with `formError` set when they do not hold together. */
function interestTerms(): Pick<BankAccountCreate, 'interest_rate' | 'boosted_rate' | 'boosted_until' | 'interest_method'> | null {
  const boosted = showBoost.value ? toRate(form.boosted_rate_pct) : null
  const until = showBoost.value ? form.boosted_until || null : null
  if ((boosted === null) !== (until === null)) {
    formError.value = 'Un taux boosté va avec la date jusqu\'à laquelle il s\'applique.'
    return null
  }
  const rate = toRate(form.interest_rate_pct)
  if (boosted !== null && rate === null) {
    formError.value = 'Saisissez aussi le taux de base, celui qui s\'applique après le taux boosté.'
    return null
  }
  return {
    interest_rate: rate,
    boosted_rate: boosted,
    boosted_until: until,
    // Regulated livrets count by quinzaine by law: the API applies it itself.
    interest_method: form.account_type === 'SAVINGS' ? form.interest_method : null,
  }
}

async function handleSubmit(): Promise<void> {
  formError.value = null
  const interest = bearsInterest.value ? interestTerms() : {}
  if (interest === null) return
  open.value = false
  let result
  const common = {
    name: form.name,
    institution_name: form.institution_name,
    identifier: form.identifier,
    opened_at: form.opened_at || null,
    ...interest,
  }
  if (editingId.value) {
    // No account_type: the API has no field for it, and the picker is locked
    // while editing. A linked account's balance and currency belong to its bank.
    const update: BankAccountUpdate = editingLinked.value
      ? common
      : { ...common, balance: form.balance, currency: form.currency }
    result = await bank.updateAccount(editingId.value, update)
  } else {
    const create: BankAccountCreate = {
      ...common,
      account_type: form.account_type,
      balance: form.balance,
      currency: form.currency,
    }
    result = await bank.createAccount(create)
  }
  if (!result) open.value = true
}

async function handleDelete(id: string): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Supprimer le compte',
    message: 'Supprimer ce compte bancaire ? Cette action est définitive.',
    confirmLabel: 'Supprimer',
  })
  if (!confirmed) return
  open.value = false
  if (!(await bank.deleteAccount(id))) open.value = true
}

defineExpose({ openCreate, openEdit })
</script>

<template>
  <BaseModal :open="open" :title="editingId ? 'Modifier le compte' : 'Nouveau compte'" @close="open = false">
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <BaseInput v-model="form.name" label="Nom du compte" placeholder="Nom du compte" required />
      <div>
        <BaseSelect
          v-model="form.account_type"
          label="Type de compte"
          :options="accountTypeOptions"
          :disabled="!!editingId"
          required
        />
        <p v-if="editingId" class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">
          Le type d'un compte est fixé à sa création.
        </p>
      </div>
      <BaseInput v-model="form.institution_name" label="Banque" placeholder="Nom de la banque" />
      <BaseInput v-model="form.identifier" label="Identifiant" placeholder="IBAN" />
      <BaseInput
        v-if="!(editingId && editingLinked)"
        v-model="form.balance"
        label="Solde"
        type="number"
        placeholder="0.00"
      />
      <div>
        <BaseSelect
          v-model="form.currency"
          label="Devise"
          :options="currencyChoices"
          :disabled="isRegulated || (!!editingId && editingLinked)"
        />
        <p class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">
          {{ editingId && editingLinked
            ? 'Compte lié : le solde et la devise viennent de votre banque, à chaque synchronisation.'
            : isRegulated
              ? 'Les livrets réglementés sont en euros.'
              : 'Le solde est affiché dans cette devise ; les totaux et les courbes restent en euros.' }}
        </p>
      </div>
      <BaseInput v-model="form.opened_at" label="Date d'ouverture" type="date" />

      <fieldset v-if="bearsInterest" class="space-y-3 pt-4 border-t border-surface-border dark:border-surface-dark-border">
        <legend class="sr-only">Intérêts</legend>
        <p class="text-sm font-medium text-text-main dark:text-text-dark-main">Intérêts</p>
        <BaseInput
          v-model="form.interest_rate_pct"
          label="Taux annuel brut (%)"
          type="number"
          step="0.01"
          min="0"
          placeholder="Optionnel, ex. 2,4"
        />
        <BaseSelect
          v-if="form.account_type === 'SAVINGS'"
          v-model="form.interest_method"
          label="Calcul des intérêts"
          :options="METHOD_OPTIONS"
        />
        <p class="text-xs text-text-muted dark:text-text-dark-muted">
          {{ form.account_type === 'SAVINGS'
            ? 'Voir les conditions de votre banque. Par quinzaines, un versement rapporte à partir du 1er ou du 16 qui suit.'
            : 'Calculés par quinzaines, comme sur tous les livrets réglementés.' }}
          Sert à estimer les intérêts de l'année et la projection.
        </p>

        <button
          v-if="!showBoost"
          type="button"
          class="text-sm font-medium text-primary hover:underline underline-offset-2"
          @click="showBoost = true"
        >
          + Taux boosté temporaire
        </button>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BaseInput
            v-model="form.boosted_rate_pct"
            label="Taux boosté (%)"
            type="number"
            step="0.01"
            min="0"
            placeholder="ex. 5"
          />
          <BaseInput v-model="form.boosted_until" label="Jusqu'au" type="date" />
          <p class="sm:col-span-2 -mt-1 text-xs text-text-muted dark:text-text-dark-muted">
            Le taux de base reprend le lendemain.
            <button
              type="button"
              class="ml-1 font-medium text-primary hover:underline underline-offset-2"
              @click="showBoost = false; form.boosted_rate_pct = ''; form.boosted_until = ''"
            >
              Retirer
            </button>
          </p>
        </div>
      </fieldset>

      <p v-if="formError" class="text-sm text-danger">{{ formError }}</p>
    </form>
    <template #footer>
      <div class="flex justify-between w-full">
        <BaseButton v-if="editingId" variant="danger" @click="handleDelete(editingId)">
          Supprimer
        </BaseButton>
        <div v-else></div> <!-- Spacer -->
        <div class="flex gap-2">
          <BaseButton variant="ghost" @click="open = false">Annuler</BaseButton>
          <BaseButton :loading="bank.isLoading" @click="handleSubmit">
            {{ editingId ? 'Enregistrer' : 'Créer' }}
          </BaseButton>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { Plus, Settings2, Trash2 } from 'lucide-vue-next'
import { reactive, ref, watch, computed } from 'vue'
import type { ImportCategory, ImportOptions, ColumnMapping } from '@/types'

interface Props {
  modelValue: ImportOptions
  /** Column headers detected in the uploaded CSV. */
  headers: string[]
  category: ImportCategory
}
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: ImportOptions] }>()

const isBank = computed(() => props.category === 'bank')

const selectClass =
  'w-full px-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'

// ── Crypto / stock field descriptors ─────────────────────────
const txFields = computed(() => {
  const base = [
    { key: 'date', label: 'Date', required: true },
    { key: 'type', label: 'Type d\'opération', required: false },
    { key: 'asset', label: 'Actif (symbole / ISIN)', required: true },
    { key: 'quantity', label: 'Quantité', required: true },
    { key: 'price', label: 'Prix unitaire', required: false },
  ] as { key: keyof ColumnMapping; label: string; required: boolean }[]
  if (props.category === 'stock') base.push({ key: 'fees', label: 'Frais', required: false })
  return base
})

const mapping = reactive<ColumnMapping>({ ...(props.modelValue.mapping ?? {}) })
const delimiter = ref(props.modelValue.delimiter ?? '')
const decimalSeparator = ref(props.modelValue.decimal_separator ?? '')
const dateFormat = ref(props.modelValue.date_format ?? '')
const typeRows = ref<{ from: string; to: string }[]>(
  Object.entries(props.modelValue.type_mapping ?? {}).map(([from, to]) => ({ from, to })),
)
const showAdvanced = ref(false)

// ── Bank-specific state ──────────────────────────────────────
const bankMode = ref<'balance' | 'delta'>(props.modelValue.bank_mode ?? 'balance')
const bankValueColumn = ref<string | undefined>(mapping.balance ?? mapping.amount)
const initialBalance = ref<string>(String(props.modelValue.initial_balance ?? ''))

const typeOptions =
  props.category === 'crypto'
    ? ['BUY', 'SPEND', 'FEE', 'REWARD', 'DEPOSIT', 'TRANSFER', 'WITHDRAW']
    : ['BUY', 'SELL', 'DEPOSIT', 'DIVIDEND']

// Auto-guess a mapping from common header names when none is set yet.
function autoGuess() {
  const norm = (s: string) => s.toLowerCase()
  const find = (patterns: string[]) => props.headers.find((h) => patterns.some((p) => norm(h).includes(p)))
  if (isBank.value) {
    if (!mapping.date) mapping.date = find(['date', 'jour', 'valeur'])
    if (!bankValueColumn.value) bankValueColumn.value = find(['solde', 'balance', 'montant', 'amount'])
    return
  }
  if (Object.values(mapping).some(Boolean)) return
  mapping.date = find(['date', 'time', 'utc', 'horodat'])
  mapping.type = find(['type', 'operation', 'opération', 'side', 'sens', 'transaction'])
  mapping.asset = find(['symbol', 'symbole', 'asset', 'coin', 'ticker', 'isin', 'valeur', 'actif'])
  mapping.quantity = find(['quantity', 'quantité', 'qty', 'amount', 'montant', 'nombre', 'shares', 'volume'])
  mapping.price = find(['price', 'prix', 'cours', 'unit'])
  if (props.category === 'stock') mapping.fees = find(['fee', 'frais', 'commission'])
}
watch(() => props.headers, autoGuess, { immediate: true })

function emitOptions() {
  const cleanedMapping: ColumnMapping = {}
  const options: ImportOptions = {}

  if (isBank.value) {
    if (mapping.date) cleanedMapping.date = mapping.date
    if (bankValueColumn.value) {
      cleanedMapping[bankMode.value === 'balance' ? 'balance' : 'amount'] = bankValueColumn.value
    }
    options.bank_mode = bankMode.value
    if (bankMode.value === 'delta' && initialBalance.value.trim()) {
      options.initial_balance = initialBalance.value.trim()
    }
  } else {
    for (const [k, v] of Object.entries(mapping)) {
      if (v) cleanedMapping[k as keyof ColumnMapping] = v
    }
    const type_mapping: Record<string, string> = {}
    for (const row of typeRows.value) {
      if (row.from.trim() && row.to.trim()) type_mapping[row.from.trim()] = row.to.trim()
    }
    if (Object.keys(type_mapping).length) options.type_mapping = type_mapping
  }

  options.mapping = cleanedMapping
  if (delimiter.value) options.delimiter = delimiter.value
  if (decimalSeparator.value) options.decimal_separator = decimalSeparator.value
  if (dateFormat.value.trim()) options.date_format = dateFormat.value.trim()
  emit('update:modelValue', options)
}
watch(
  [mapping, delimiter, decimalSeparator, dateFormat, typeRows, bankMode, bankValueColumn, initialBalance],
  emitOptions,
  { deep: true, immediate: true },
)

function addTypeRow() { typeRows.value.push({ from: '', to: typeOptions[0]! }) }
function removeTypeRow(i: number) { typeRows.value.splice(i, 1) }
</script>

<template>
  <div class="space-y-5">
    <p class="text-sm text-text-body dark:text-text-dark-body">
      Associez les colonnes de votre fichier aux champs attendus. Les champs marqués
      <span class="text-danger">*</span> sont obligatoires.
    </p>

    <!-- ── Bank mapping ──────────────────────────────── -->
    <template v-if="isBank">
      <div class="space-y-1.5">
        <label class="block text-sm font-medium text-text-main dark:text-text-dark-main">Type de relevé</label>
        <select v-model="bankMode" :class="selectClass">
          <option value="balance">Solde (chaque ligne = un solde à une date)</option>
          <option value="delta">Mouvements (chaque ligne = une entrée/sortie)</option>
        </select>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <label class="block text-sm font-medium text-text-main dark:text-text-dark-main">Date <span class="text-danger">*</span></label>
          <select v-model="mapping.date" :class="selectClass">
            <option :value="undefined">— non mappé —</option>
            <option v-for="h in props.headers" :key="h" :value="h">{{ h }}</option>
          </select>
        </div>
        <div class="space-y-1.5">
          <label class="block text-sm font-medium text-text-main dark:text-text-dark-main">
            {{ bankMode === 'balance' ? 'Colonne du solde' : 'Colonne des mouvements' }} <span class="text-danger">*</span>
          </label>
          <select v-model="bankValueColumn" :class="selectClass">
            <option :value="undefined">— non mappé —</option>
            <option v-for="h in props.headers" :key="h" :value="h">{{ h }}</option>
          </select>
        </div>
      </div>
      <div v-if="bankMode === 'delta'" class="space-y-1.5 max-w-xs">
        <label class="block text-sm font-medium text-text-main dark:text-text-dark-main">Solde initial</label>
        <input v-model="initialBalance" type="text" inputmode="decimal" placeholder="0" :class="selectClass" />
        <p class="text-xs text-text-muted dark:text-text-dark-muted">Solde avant le premier mouvement du fichier.</p>
      </div>
    </template>

    <!-- ── Crypto / stock mapping ────────────────────── -->
    <template v-else>
      <div class="grid sm:grid-cols-2 gap-4">
        <div v-for="field in txFields" :key="field.key" class="space-y-1.5">
          <label class="block text-sm font-medium text-text-main dark:text-text-dark-main">
            {{ field.label }}
            <span v-if="field.required" class="text-danger ml-0.5">*</span>
          </label>
          <select v-model="mapping[field.key]" :class="selectClass">
            <option :value="undefined">— non mappé —</option>
            <option v-for="h in props.headers" :key="h" :value="h">{{ h }}</option>
          </select>
        </div>
      </div>
    </template>

    <!-- ── Advanced options ──────────────────────────── -->
    <div class="border-t border-surface-border dark:border-surface-dark-border pt-4">
      <button
        type="button"
        class="flex items-center gap-2 text-sm font-medium text-text-body dark:text-text-dark-body hover:text-primary transition-colors"
        @click="showAdvanced = !showAdvanced"
      >
        <Settings2 class="w-4 h-4" />
        Options avancées
      </button>

      <div v-if="showAdvanced" class="mt-4 space-y-4">
        <div class="grid sm:grid-cols-3 gap-4">
          <div class="space-y-1.5">
            <label class="block text-sm font-medium text-text-main dark:text-text-dark-main">Délimiteur</label>
            <select v-model="delimiter" :class="selectClass">
              <option value="">Auto</option>
              <option value=",">Virgule ( , )</option>
              <option value=";">Point-virgule ( ; )</option>
              <option value="&#9;">Tabulation</option>
            </select>
          </div>
          <div class="space-y-1.5">
            <label class="block text-sm font-medium text-text-main dark:text-text-dark-main">Décimales</label>
            <select v-model="decimalSeparator" :class="selectClass">
              <option value="">Auto</option>
              <option value=".">Point ( . )</option>
              <option value=",">Virgule ( , )</option>
            </select>
          </div>
          <div class="space-y-1.5">
            <label class="block text-sm font-medium text-text-main dark:text-text-dark-main">Format de date</label>
            <input v-model="dateFormat" type="text" placeholder="ex : %d/%m/%Y" :class="selectClass" />
          </div>
        </div>

        <!-- Type mapping (transactions only) -->
        <div v-if="!isBank" class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-sm font-medium text-text-main dark:text-text-dark-main">Correspondance des types</label>
            <button type="button" class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover" @click="addTypeRow">
              <Plus class="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
          <p class="text-xs text-text-muted dark:text-text-dark-muted">
            Traduisez les libellés de votre fichier (ex : « Achat ») vers un type reconnu.
          </p>
          <div v-for="(row, i) in typeRows" :key="i" class="flex items-center gap-2">
            <input v-model="row.from" type="text" placeholder="Libellé du fichier" :class="selectClass" />
            <span class="text-text-muted">→</span>
            <select v-model="row.to" :class="selectClass">
              <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option>
            </select>
            <button type="button" class="p-2 text-text-muted hover:text-danger transition-colors" @click="removeTypeRow(i)">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

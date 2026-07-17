<script setup lang="ts">
import { Check, Circle, Download, X } from 'lucide-vue-next'
import Papa from 'papaparse'

import { ref, computed, watch } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseAlert from '@/components/base/BaseAlert.vue'
import {
  CRYPTO_COMPOSITE_ALLOWED_IMPORT_TYPES,
  normalizeCompositeImportType,
} from '@/utils/cryptoTransactionTypes'

interface Props {
  open: boolean
  title?: string
  accountId: string
  assetType: 'stocks' | 'crypto'
  onImport: (transactions: any[]) => Promise<boolean>
  accounts?: { id: string; name: string; account_type?: string }[]
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Importer des transactions',
})

const emit = defineEmits<{
  close: []
  'update:accountId': [id: string]
}>()

const localAccountId = ref(props.accountId)
watch(() => props.accountId, (v) => { localAccountId.value = v })
watch(localAccountId, (v) => emit('update:accountId', v))

const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref<string | null>(null)
const parsedTransactions = ref<any[]>([])
const error = ref<string | null>(null)
const isLoading = ref(false)

const hasFile = computed(() => parsedTransactions.value.length > 0)

const csvTemplate = computed(() => {
  if (props.assetType === 'stocks') {
    return 'isin,type,amount,price_per_unit,fees,executed_at,notes'
  }
  // Composite format: one line = one full operation (decomposed server-side)
  return 'asset_key,type,amount,eur_amount,quote_asset_key,quote_amount,fee_asset_key,fee_amount,fee_included,executed_at,tx_hash,notes'
})

const csvExample = computed(() => {
  if (props.assetType === 'stocks') {
    return 'US0378331005,BUY,10,150.50,2.99,2026-01-15T10:30:00,Premier achat\nUS88160R1014,SELL,5,250.00,1.50,2026-01-20T14:00:00,\n,DEPOSIT,1000,,2.50,2026-01-22T09:00:00,Dépôt net de frais'
  }
  return (
    'BTC,BUY,0.1,3000,EUR,3000,,,,2026-01-15T10:30:00,,Premier achat\n' +
    'BTC,BUY,0.1,2760,USDC,3000,BNB,0.01,,2026-01-20T14:00:00,0xabc,Swap avec frais\n' +
    'ETH,REWARD,2.5,0,,,,,,2026-01-25T09:00:00,,Staking\n' +
    'BTC,CRYPTO_DEPOSIT,0.5,15000,,,,,,2026-01-28T12:00:00,0xdef,Transfert entrant'
  )
})

/** Map of common header aliases to canonical field names. */
const HEADER_ALIASES: Record<string, string> = {
  isin: 'asset_key',
}

/** Normalize a raw CSV header to its canonical field name. */
function normalizeHeader(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  return HEADER_ALIASES[trimmed] ?? trimmed
}

function onFileSelect(event: Event): void {
  error.value = null
  parsedTransactions.value = []

  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (!file.name.endsWith('.csv')) {
    error.value = 'Veuillez sélectionner un fichier CSV valide'
    return
  }

  fileName.value = file.name
  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      const text = e.target?.result as string
      parseCSV(text)
    } catch (err) {
      error.value = 'Erreur lors de la lecture du fichier'
      console.error(err)
    }
  }

  reader.onerror = () => {
    error.value = 'Erreur lors de la lecture du fichier'
  }

  reader.readAsText(file)
}

/** Normalize French decimal commas to dots in a single field value (e.g. "30,552" → "30.552"). */
function normalizeDecimal(value: string): string {
  return value.replace(/(\d),(\d)/g, '$1.$2')
}

function parseCSV(text: string): void {
  // Normalize DD/MM/YYYY dates to ISO (skip header line)
  const lines = text.split('\n')
  const dateNormalized = lines.map((line, index) => {
    if (index === 0) return line // Skip header
    return line.replace(/(\d{2})\/(\d{2})\/(\d{4})/g, '$3-$2-$1T00:00:00')
  }).join('\n')

  // Use PapaParse for robust CSV parsing (handles quoted fields, mixed delimiters, etc.)
  const result = Papa.parse<Record<string, string>>(dateNormalized.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
    delimiter: '', // auto-detect
  })

  if (result.errors.length > 0) {
    const firstError = result.errors[0]
    const lineInfo = firstError?.row != null ? `Ligne ${firstError.row + 2}` : 'Fichier CSV'
    error.value = `${lineInfo} : ${firstError?.message ?? 'Erreur de parsing CSV'}`
    console.error('PapaParse errors:', result.errors)
    return
  }

  if (result.data.length === 0) {
    error.value = 'Le fichier CSV est vide ou ne contient aucune ligne de données'
    return
  }

  const transactions: any[] = []

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i]
    if (!row) continue

    const transaction: any = {}
    const csvLineNumber = i + 2 // +1 for 0-index, +1 for header row

    for (const [header, rawValue] of Object.entries(row)) {
      const value = rawValue?.trim() ?? ''

      // Numeric fields — normalize French decimal commas per-field (safe after delimiter parsing)
      const numericFields = props.assetType === 'stocks'
        ? ['amount', 'price_per_unit', 'fees']
        : ['amount', 'eur_amount', 'quote_amount', 'fee_amount']

      if (numericFields.includes(header)) {
        const normalized = normalizeDecimal(value)
        const numValue = normalized ? parseFloat(normalized) : 0
        if (normalized && isNaN(numValue)) {
          error.value = `Ligne ${csvLineNumber} : valeur numérique invalide pour « ${header} » : « ${value} »`
          return
        }
        transaction[header] = numValue
      } else if (header === 'fee_included') {
        transaction[header] = value === '' || value === undefined || value.toLowerCase() !== 'false'
      } else {
        transaction[header] = value || ''
      }
    }

    try {
      validateTransaction(transaction)
      transactions.push(transaction)
    } catch (err) {
      const preview = Object.values(row).join(' | ')
      const truncated = preview.length > 80 ? preview.slice(0, 80) + '…' : preview
      error.value = `Ligne ${csvLineNumber} : ${err instanceof Error ? err.message : 'Données invalides'}\n→ ${truncated}`
      console.error(`Ligne ${csvLineNumber} validation error:`, transaction, err)
      return
    }
  }

  parsedTransactions.value = transactions
}

function validateTransaction(transaction: any): void {
  if (transaction.asset_key) {
    const rawAssetKey = String(transaction.asset_key).trim()
    transaction.asset_key = props.assetType === 'crypto' ? rawAssetKey.toUpperCase() : rawAssetKey
  }
  if (transaction.type) transaction.type = String(transaction.type).trim().toUpperCase()
  if (transaction.quote_asset_key) transaction.quote_asset_key = String(transaction.quote_asset_key).trim().toUpperCase()
  if (transaction.fee_asset_key) transaction.fee_asset_key = String(transaction.fee_asset_key).trim().toUpperCase()

  const requiredFields = props.assetType === 'stocks'
    ? ['type', 'amount', 'executed_at']
    : ['asset_key', 'type', 'amount', 'executed_at']

  for (const field of requiredFields) {
    if (!transaction[field] || transaction[field] === '') {
      throw new Error(`Champ « ${field} » manquant ou vide`)
    }
  }

  if (props.assetType === 'stocks') {
    const validTypes = ['BUY', 'SELL', 'DEPOSIT', 'DIVIDEND']
    if (!validTypes.includes(transaction.type)) {
      throw new Error(`Type « ${transaction.type} » invalide (valeurs acceptées : ${validTypes.join(', ')})`)
    }

    if (transaction.fees !== undefined && (isNaN(transaction.fees) || transaction.fees < 0)) {
      throw new Error('Les frais doivent être un nombre positif ou nul')
    }

    if (transaction.type === 'DEPOSIT') {
      if (transaction.asset_key && transaction.asset_key !== 'EUR') {
        throw new Error('Pour un dépôt, le champ ISIN doit être vide ou « EUR »')
      }

      const grossAmount = Number(transaction.amount)
      const fees = Number(transaction.fees || 0)
      const netAmount = grossAmount - fees
      if (netAmount <= 0) {
        throw new Error(`Pour un dépôt, le montant (${grossAmount}) doit être supérieur aux frais (${fees})`)
      }

      // Normalize deposit to EUR source of truth and store only the net value.
      transaction.asset_key = 'EUR'
      transaction.price_per_unit = 1
      transaction.amount = netAmount
      transaction.fees = 0
    } else {
      if (!transaction.asset_key || transaction.asset_key.length !== 12) {
        const got = transaction.asset_key ? `« ${transaction.asset_key} » (${transaction.asset_key.length} car.)` : 'vide'
        throw new Error(`ISIN invalide : ${got} — un code ISIN fait exactement 12 caractères`)
      }

      if (isNaN(transaction.price_per_unit) || transaction.price_per_unit < 0) {
        throw new Error(`Prix unitaire invalide : « ${transaction.price_per_unit} » (doit être ≥ 0)`)
      }
    }
  } else {
    const normalizedType = normalizeCompositeImportType(transaction.type)
    if (!normalizedType) {
      throw new Error(`Type « ${transaction.type} » invalide (valeurs acceptées : ${CRYPTO_COMPOSITE_ALLOWED_IMPORT_TYPES.join(', ')})`)
    }
    transaction.type = normalizedType

    // BUY, CRYPTO_DEPOSIT and SELL_TO_FIAT need eur_amount
    if (['BUY', 'CRYPTO_DEPOSIT', 'SELL_TO_FIAT'].includes(transaction.type)) {
      const eur = Number(transaction.eur_amount)
      if (isNaN(eur) || eur < 0) {
        throw new Error(`« eur_amount » invalide pour le type ${transaction.type}`)
      }
    }

    // quote_amount required if quote_asset_key is set
    if (transaction.quote_asset_key && (!transaction.quote_amount || Number(transaction.quote_amount) <= 0)) {
      throw new Error('« quote_amount » requis quand « quote_asset_key » est renseigné')
    }

    // fee_amount required if fee_asset_key is set
    if (transaction.fee_asset_key && (!transaction.fee_amount || Number(transaction.fee_amount) <= 0)) {
      throw new Error('« fee_amount » requis quand « fee_asset_key » est renseigné')
    }
  }

  if (isNaN(transaction.amount) || transaction.amount <= 0) {
    throw new Error(`Quantité invalide : « ${transaction.amount} » (doit être > 0)`)
  }

  if (!isValidDate(transaction.executed_at)) {
    throw new Error(`Date invalide : « ${transaction.executed_at} » (formats acceptés : YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss, DD/MM/YYYY)`)
  }
}

function isValidDate(dateString: string): boolean {
  const ddmmyyyyPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/
  const match = dateString.match(ddmmyyyyPattern)
  
  if (match) {
    const [, day, month, year] = match
    const isoDate = `${year}-${month}-${day}T00:00:00`
    const date = new Date(isoDate)
    return date instanceof Date && !isNaN(date.getTime())
  }
  
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}

function triggerFileInput(): void {
  fileInput.value?.click()
}

function resetFile(): void {
  fileName.value = null
  parsedTransactions.value = []
  error.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

async function handleImport(): Promise<void> {
  if (parsedTransactions.value.length === 0) return
  isLoading.value = true
  error.value = null
  try {
    const success = await props.onImport(parsedTransactions.value)
    if (success) {
      resetFile()
      emit('close')
    } else {
      error.value = "L'import a échoué. Vérifiez vos données et réessayez."
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Erreur inattendue lors de l'import"
  } finally {
    isLoading.value = false
  }
}

function handleClose(): void {
  resetFile()
  emit('close')
}

function downloadTemplate(): void {
  const template = csvTemplate.value + '\n' + csvExample.value
  const blob = new Blob([template], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `template_import_${props.assetType}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <BaseModal :open="props.open" title="Importer des transactions (CSV)" size="lg" @close="handleClose">
    <div class="space-y-6">
      <!-- Account selector (when accounts provided) -->
      <div v-if="props.accounts && props.accounts.length >= 1">
        <label class="block text-xs font-medium text-text-muted dark:text-text-dark-muted mb-1">Compte</label>
        <select
          v-model="localAccountId"
          class="w-full px-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option v-for="acc in props.accounts" :key="acc.id" :value="acc.id">
            {{ acc.name }}{{ acc.account_type ? ' — ' + acc.account_type : '' }}
          </option>
        </select>
      </div>

      <!-- Instructions -->
      <div class="bg-background-subtle dark:bg-background-dark-subtle p-4 rounded-secondary">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-text-main dark:text-text-dark-main">
            Format CSV
          </h3>
          <button
            @click="downloadTemplate"
            class="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
          >
            <Download class="w-3.5 h-3.5" />
            Modèle
          </button>
        </div>
        <code
          class="block text-xs bg-background dark:bg-surface-dark p-2 rounded border border-surface-border dark:border-surface-dark-border overflow-x-auto"
        >
          {{ csvTemplate }}
        </code>
        <p class="mt-2 text-xs text-text-muted dark:text-text-dark-muted">
          Séparateurs (<code>,</code> <code>;</code> <code>tab</code>) et décimales détectés automatiquement.
          Le header <code>isin</code> est aussi accepté.
        </p>
      </div>

      <!-- Error Alert -->
      <BaseAlert v-if="error" variant="danger" dismissible @dismiss="error = null">
        <span style="white-space: pre-line">{{ error }}</span>
      </BaseAlert>

      <!-- File Upload -->
      <div>
        <input
          ref="fileInput"
          type="file"
          accept=".csv"
          class="hidden"
          @change="onFileSelect"
        />

        <div v-if="!fileName" class="border-2 border-dashed border-surface-border dark:border-surface-dark-border rounded-card p-8 text-center">
          <Circle class="w-12 h-12 mx-auto mb-4 text-text-muted dark:text-text-dark-muted" />
          <p class="text-sm text-text-body dark:text-text-dark-body mb-3">
            Glissez un fichier CSV ici ou
          </p>
          <BaseButton variant="outline" @click="triggerFileInput">
            Parcourir
          </BaseButton>
        </div>

        <div v-else class="space-y-3">
          <div class="flex items-center justify-between p-4 bg-background-subtle dark:bg-surface-dark-hover rounded-secondary">
            <div class="flex items-center gap-3">
              <Circle class="w-8 h-8 text-success" />
              <div>
                <p class="font-medium text-text-main dark:text-text-dark-main">
                  {{ fileName }}
                </p>
                <p v-if="parsedTransactions.length > 0" class="text-sm text-success flex items-center gap-1">
                  <Check class="w-4 h-4" />
                  {{ parsedTransactions.length }} transaction(s) détectée(s)
                </p>
              </div>
            </div>
            <button
              @click="resetFile"
              class="p-2 rounded-secondary text-text-muted dark:text-text-dark-muted hover:bg-surface-active dark:hover:bg-surface-dark-hover transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <BaseButton variant="ghost" @click="handleClose">
          Annuler
        </BaseButton>
        <BaseButton
          :disabled="!hasFile || isLoading"
          :loading="isLoading"
          @click="handleImport"
        >
          Importer {{ parsedTransactions.length }} transaction(s)
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

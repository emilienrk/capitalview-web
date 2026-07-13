<script setup lang="ts">
import { Upload, Wand2 } from 'lucide-vue-next'
import { ref, reactive, computed, watch } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseAlert from '@/components/base/BaseAlert.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import ColumnMappingForm from '@/components/imports/ColumnMappingForm.vue'
import { useImportsStore } from '@/stores/imports'
import type {
  BinanceImportGroupPreview,
  ImportCategory,
  ImportOptions,
  ImportPreviewResponse,
  ImportSourceInfo,
  StockImportRowPreview,
  BankImportPointPreview,
} from '@/types'

interface Props {
  open: boolean
  category: ImportCategory
  accounts: { id: string; name: string }[]
  accountId?: string
}
const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  imported: [accountId: string]
  'update:accountId': [id: string]
}>()

const imports = useImportsStore()

type Step = 'source' | 'mapping' | 'review' | 'result'
const step = ref<Step>('source')

const sources = ref<ImportSourceInfo[]>([])
const selectedSourceId = ref('')
const detectedSourceId = ref('')

const localAccountId = ref(props.accountId ?? props.accounts[0]?.id ?? '')
watch(() => props.accountId, (v) => { if (v) localAccountId.value = v })
watch(localAccountId, (v) => emit('update:accountId', v))

const fileName = ref<string | null>(null)
const csvContent = ref('')
const csvHeaders = ref<string[]>([])
const options = ref<ImportOptions>({})

const preview = ref<ImportPreviewResponse | null>(null)
const cryptoGroups = ref<BinanceImportGroupPreview[]>([])
const stockRows = ref<StockImportRowPreview[]>([])
const bankPoints = ref<BankImportPointPreview[]>([])

const skipDuplicates = ref(true)
const overwrite = ref(false)

const isLoading = ref(false)
const error = ref<string | null>(null)
const result = reactive({ imported: 0, skipped: 0, groups: null as number | null })

const selectedSource = computed(() => sources.value.find((s) => s.source_id === selectedSourceId.value) ?? null)
const needsMapping = computed(() => !!selectedSource.value?.supports_mapping)

/** Whether the current mapping has enough required fields to preview. */
const mappingReady = computed(() => {
  const m = options.value.mapping
  if (!m) return false
  if (props.category === 'bank') return !!m.date && !!(m.balance || m.amount)
  return !!m.date && !!m.asset && !!m.quantity
})

const modalTitle = computed(() => {
  const map: Record<ImportCategory, string> = { crypto: 'Import crypto', stock: 'Import titres', bank: 'Import bancaire' }
  return map[props.category]
})

// ── Lifecycle ────────────────────────────────────────────────
watch(() => props.open, async (open) => {
  if (!open) return
  reset()
  try {
    sources.value = await imports.sourcesFor(props.category)
    if (sources.value.length && !selectedSourceId.value) {
      // default to first non-generic source
      selectedSourceId.value = (sources.value.find((s) => !s.supports_mapping) ?? sources.value[0]!).source_id
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Impossible de charger les sources d\'import'
  }
})

function reset() {
  step.value = 'source'
  fileName.value = null
  csvContent.value = ''
  csvHeaders.value = []
  options.value = {}
  preview.value = null
  cryptoGroups.value = []
  stockRows.value = []
  bankPoints.value = []
  detectedSourceId.value = ''
  skipDuplicates.value = true
  overwrite.value = false
  error.value = null
  isLoading.value = false
  if (props.accountId) localAccountId.value = props.accountId
  else if (props.accounts[0]) localAccountId.value = props.accounts[0].id
}

// ── File handling & detection ────────────────────────────────
function parseHeaders(csv: string): string[] {
  let content = csv.startsWith('﻿') ? csv.slice(1) : csv
  const firstLine = content.split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  const counts: Record<string, number> = {
    ',': (firstLine.match(/,/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
  }
  const delimiter = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]) || ','
  return firstLine.split(delimiter).map((h) => h.trim().replace(/^"|"$/g, '')).filter(Boolean)
}

function onFileSelect(event: Event) {
  error.value = null
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.name.endsWith('.csv')) {
    error.value = 'Veuillez sélectionner un fichier CSV (.csv)'
    return
  }
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = async (e) => {
    const text = e.target?.result as string
    if (!text) { error.value = 'Fichier vide'; return }
    csvContent.value = text
    csvHeaders.value = parseHeaders(text)
    await runDetect()
  }
  reader.onerror = () => { error.value = 'Erreur de lecture du fichier.' }
  reader.readAsText(file)
}

async function runDetect() {
  try {
    const matches = await imports.detect(csvContent.value)
    const best = matches.find((m) => sources.value.some((s) => s.source_id === m.source_id))
    if (best) {
      detectedSourceId.value = best.source_id
      selectedSourceId.value = best.source_id
    }
  } catch {
    // detection is best-effort; ignore failures
  }
}

// ── Preview ──────────────────────────────────────────────────
async function goFromSource() {
  if (!selectedSourceId.value || !csvContent.value) return
  if (needsMapping.value) {
    step.value = 'mapping'
    return
  }
  await runPreview()
}

async function runPreview() {
  isLoading.value = true
  error.value = null
  try {
    const res = await imports.preview(
      selectedSourceId.value,
      csvContent.value,
      localAccountId.value || undefined,
      options.value,
    )
    if (res.total_rows === 0) {
      error.value = 'Aucune donnée exploitable trouvée dans le fichier.'
      return
    }
    preview.value = res
    cryptoGroups.value = res.crypto ? res.crypto.groups.map((g) => ({ ...g, rows: [...g.rows] })) : []
    stockRows.value = res.stock_rows ? res.stock_rows.map((r) => ({ ...r })) : []
    bankPoints.value = res.bank_points ? res.bank_points.map((p) => ({ ...p })) : []
    step.value = 'review'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur lors de l\'analyse du fichier'
  } finally {
    isLoading.value = false
  }
}

// ── Review helpers ───────────────────────────────────────────
const validStockRows = computed(() => stockRows.value.filter((r) => !r.error))
const stockErrorCount = computed(() => stockRows.value.filter((r) => r.error).length)
const stockMissingAsset = computed(() =>
  validStockRows.value.filter((r) => r.needs_asset_key || (!r.asset_key && ['BUY', 'SELL', 'DIVIDEND'].includes(r.type))),
)

const cryptoNeedsEur = computed(() => cryptoGroups.value.filter((g) => g.needs_eur_input))
const canConfirm = computed(() => {
  if (props.category === 'crypto') {
    return cryptoNeedsEur.value.every((g) => g.eur_amount !== null && g.eur_amount >= 0)
  }
  if (props.category === 'stock') {
    return validStockRows.value.length > 0 && stockMissingAsset.value.length === 0
  }
  return bankPoints.value.length > 0
})

function setAssetKey(row: StockImportRowPreview, value: string) {
  row.asset_key = value.trim().toUpperCase() || null
  if (row.asset_key) row.needs_asset_key = false
}

function setGroupEur(group: BinanceImportGroupPreview, value: string) {
  const n = value === '' ? null : parseFloat(value.replace(',', '.'))
  group.eur_amount = n !== null && !isNaN(n) ? n : null
}

// ── Confirm ──────────────────────────────────────────────────
async function runConfirm() {
  if (!localAccountId.value) { error.value = 'Sélectionnez un compte de destination.'; return }
  isLoading.value = true
  error.value = null
  try {
    const res = await imports.confirm(selectedSourceId.value, {
      account_id: localAccountId.value,
      skip_duplicates: skipDuplicates.value,
      options: options.value,
      crypto_groups: props.category === 'crypto' ? cryptoGroups.value : null,
      stock_rows: props.category === 'stock' ? validStockRows.value : null,
      bank_points: props.category === 'bank' ? bankPoints.value : null,
      overwrite: props.category === 'bank' ? overwrite.value : false,
    })
    result.imported = res.imported_count
    result.skipped = res.skipped_duplicates
    result.groups = res.groups_count
    step.value = 'result'
    emit('imported', localAccountId.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur lors de l\'import'
  } finally {
    isLoading.value = false
  }
}

function handleClose() {
  emit('close')
}

// ── Display helpers ──────────────────────────────────────────
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return iso }
}
function typeLabel(t: string): string {
  const map: Record<string, string> = {
    BUY: 'Achat', SELL: 'Vente', SPEND: 'Dépense', FEE: 'Frais', REWARD: 'Récompense',
    DEPOSIT: 'Dépôt', DIVIDEND: 'Dividende', TRANSFER: 'Transfert', WITHDRAW: 'Sortie', ANCHOR: 'Ancre €',
  }
  return map[t] ?? t
}
function typeBadgeClass(t: string): string {
  switch (t) {
    case 'BUY': case 'DEPOSIT': case 'DIVIDEND': return 'bg-success/10 text-success'
    case 'SELL': case 'SPEND': case 'WITHDRAW': return 'bg-danger/10 text-danger'
    case 'FEE': return 'bg-warning/10 text-warning'
    case 'REWARD': return 'bg-info/10 text-info'
    default: return 'bg-secondary/10 text-secondary'
  }
}
</script>

<template>
  <BaseModal :open="props.open" :title="modalTitle" size="lg" @close="handleClose">
    <!-- ── STEP 1: Source + file ───────────────────────── -->
    <template v-if="step === 'source'">
      <div class="space-y-4">
        <!-- Account -->
        <div v-if="props.accounts.length >= 1">
          <label class="block text-sm font-medium text-text-main dark:text-text-dark-main mb-1">Compte de destination</label>
          <select v-model="localAccountId" class="w-full px-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option v-for="acc in props.accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
          </select>
        </div>

        <!-- Source -->
        <div>
          <label class="block text-sm font-medium text-text-main dark:text-text-dark-main mb-1">Plateforme / format</label>
          <select v-model="selectedSourceId" class="w-full px-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option v-for="s in sources" :key="s.source_id" :value="s.source_id">
              {{ s.label }}{{ s.source_id === detectedSourceId ? ' — détecté' : '' }}
            </option>
          </select>
          <p v-if="selectedSource" class="text-xs text-text-muted dark:text-text-dark-muted mt-1">{{ selectedSource.file_hint }}</p>
        </div>

        <!-- File dropzone -->
        <label class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-surface-border dark:border-surface-dark-border rounded-card cursor-pointer hover:border-primary transition-colors">
          <Upload class="w-7 h-7 text-text-muted dark:text-text-dark-muted mb-2" />
          <span v-if="fileName" class="text-sm font-medium text-text-main dark:text-text-dark-main">{{ fileName }}</span>
          <span v-else class="text-sm text-text-muted dark:text-text-dark-muted">Cliquer pour choisir un fichier .csv</span>
          <input type="file" accept=".csv" class="hidden" @change="onFileSelect" />
        </label>

        <BaseAlert v-if="detectedSourceId && detectedSourceId === selectedSourceId" variant="info">
          <span class="inline-flex items-center gap-1.5"><Wand2 class="w-4 h-4" /> Format détecté automatiquement.</span>
        </BaseAlert>
        <BaseAlert v-if="error" variant="danger">{{ error }}</BaseAlert>

        <div v-if="isLoading" class="flex items-center justify-center py-2">
          <BaseSpinner /><span class="ml-2 text-sm text-text-muted">Analyse…</span>
        </div>
      </div>
    </template>

    <!-- ── STEP 2: Mapping ─────────────────────────────── -->
    <template v-else-if="step === 'mapping'">
      <ColumnMappingForm
        v-model="options"
        :headers="csvHeaders"
        :category="props.category"
      />
      <BaseAlert v-if="error" variant="danger" class="mt-4">{{ error }}</BaseAlert>
    </template>

    <!-- ── STEP 3: Review ──────────────────────────────── -->
    <template v-else-if="step === 'review'">
      <div class="flex flex-wrap gap-4 mb-4 text-sm">
        <span class="text-text-body dark:text-text-dark-body"><strong>{{ preview?.total_rows }}</strong> lignes</span>
        <span v-if="preview && preview.duplicates_count > 0" class="text-text-muted dark:text-text-dark-muted">
          {{ preview.duplicates_count }} doublon(s)
        </span>
        <span v-if="stockErrorCount > 0" class="text-danger">{{ stockErrorCount }} ligne(s) en erreur (ignorées)</span>
      </div>

      <BaseAlert v-for="(w, i) in preview?.warnings || []" :key="i" variant="warning" class="mb-2">{{ w }}</BaseAlert>
      <BaseAlert v-if="error" variant="danger" class="mb-4">{{ error }}</BaseAlert>

      <!-- CRYPTO -->
      <div v-if="props.category === 'crypto'" class="overflow-x-auto -mx-6 px-6">
        <table class="w-full text-xs border-collapse min-w-144">
          <thead>
            <tr class="border-b border-surface-border dark:border-surface-dark-border text-left">
              <th class="py-2 pr-2 font-medium text-text-muted dark:text-text-dark-muted w-28">Date</th>
              <th class="py-2 pr-2 font-medium text-text-muted dark:text-text-dark-muted">Détails</th>
              <th class="py-2 font-medium text-text-muted dark:text-text-dark-muted w-36 text-right">Montant €</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in cryptoGroups" :key="g.group_index"
                class="border-b border-surface-border/50 dark:border-surface-dark-border/50"
                :class="{ 'opacity-50': g.is_duplicate }">
              <td class="py-2 pr-2 align-top whitespace-nowrap text-text-body dark:text-text-dark-body">{{ fmtDate(g.timestamp) }}</td>
              <td class="py-2 pr-2 align-top">
                <div v-for="(r, ri) in g.rows" :key="ri" class="flex items-center gap-1 mb-0.5">
                  <span :class="['inline-block px-1.5 py-0.5 rounded-badge text-[10px] font-semibold', typeBadgeClass(r.mapped_type)]">{{ typeLabel(r.mapped_type) }}</span>
                  <span class="text-text-body dark:text-text-dark-body">{{ r.mapped_amount }} {{ r.mapped_asset_key }}</span>
                </div>
              </td>
              <td class="py-2 align-top text-right">
                <template v-if="g.has_eur">
                  <span class="text-success font-medium">{{ g.auto_eur_amount?.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) }} €</span>
                </template>
                <template v-else-if="g.needs_eur_input">
                  <input type="text" inputmode="decimal" placeholder="€"
                         :value="g.eur_amount ?? ''"
                         @input="setGroupEur(g, ($event.target as HTMLInputElement).value)"
                         class="w-24 text-right text-xs px-2 py-1 rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:ring-1 focus:ring-primary outline-none" />
                </template>
                <template v-else><span class="text-text-muted">—</span></template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- STOCK -->
      <div v-else-if="props.category === 'stock'" class="overflow-x-auto -mx-6 px-6">
        <table class="w-full text-xs border-collapse min-w-160">
          <thead>
            <tr class="border-b border-surface-border dark:border-surface-dark-border text-left">
              <th class="py-2 pr-2 font-medium text-text-muted dark:text-text-dark-muted w-24">Date</th>
              <th class="py-2 pr-2 font-medium text-text-muted dark:text-text-dark-muted">Type</th>
              <th class="py-2 pr-2 font-medium text-text-muted dark:text-text-dark-muted">Actif</th>
              <th class="py-2 pr-2 font-medium text-text-muted dark:text-text-dark-muted text-right">Qté</th>
              <th class="py-2 pr-2 font-medium text-text-muted dark:text-text-dark-muted text-right">Prix</th>
              <th class="py-2 font-medium text-text-muted dark:text-text-dark-muted text-right">Frais</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in stockRows" :key="row.row_index"
                class="border-b border-surface-border/50 dark:border-surface-dark-border/50"
                :class="{ 'bg-danger/5': row.error, 'opacity-50': row.is_duplicate }">
              <td class="py-2 pr-2 align-top whitespace-nowrap text-text-body dark:text-text-dark-body">{{ fmtDate(row.executed_at) }}</td>
              <td class="py-2 pr-2 align-top">
                <span :class="['inline-block px-1.5 py-0.5 rounded-badge text-[10px] font-semibold', typeBadgeClass(row.type)]">{{ typeLabel(row.type) }}</span>
              </td>
              <td class="py-2 pr-2 align-top">
                <template v-if="!row.error && (row.needs_asset_key || (!row.asset_key && ['BUY','SELL','DIVIDEND'].includes(row.type)))">
                  <input type="text" placeholder="Symbole"
                         :value="row.asset_key ?? ''"
                         @input="setAssetKey(row, ($event.target as HTMLInputElement).value)"
                         class="w-24 text-xs px-2 py-1 rounded-input border border-warning/60 bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:ring-1 focus:ring-primary outline-none" />
                </template>
                <span v-else class="text-text-body dark:text-text-dark-body font-medium">{{ row.asset_key || '—' }}</span>
                <p v-if="row.error" class="text-[10px] text-danger mt-0.5">{{ row.error }}</p>
              </td>
              <td class="py-2 pr-2 align-top text-right text-text-body dark:text-text-dark-body">{{ row.amount }}</td>
              <td class="py-2 pr-2 align-top text-right text-text-body dark:text-text-dark-body">{{ row.price_per_unit }}</td>
              <td class="py-2 align-top text-right text-text-body dark:text-text-dark-body">{{ row.fees }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- BANK -->
      <div v-else class="overflow-x-auto -mx-6 px-6">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="border-b border-surface-border dark:border-surface-dark-border text-left">
              <th class="py-2 pr-2 font-medium text-text-muted dark:text-text-dark-muted">Date</th>
              <th class="py-2 font-medium text-text-muted dark:text-text-dark-muted text-right">Solde</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in bankPoints" :key="i"
                class="border-b border-surface-border/50 dark:border-surface-dark-border/50"
                :class="{ 'opacity-50': p.is_duplicate && !overwrite }">
              <td class="py-2 pr-2 text-text-body dark:text-text-dark-body">{{ fmtDate(p.snapshot_date) }}</td>
              <td class="py-2 text-right text-text-body dark:text-text-dark-body">{{ Number(p.value).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) }} €</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Options -->
      <div class="mt-4 space-y-2">
        <label v-if="props.category !== 'bank'" class="flex items-center gap-2 text-sm cursor-pointer">
          <input v-model="skipDuplicates" type="checkbox" class="w-4 h-4 rounded accent-primary" />
          <span class="text-text-body dark:text-text-dark-body">Ignorer les doublons déjà importés</span>
        </label>
        <label v-else class="flex items-center gap-2 text-sm cursor-pointer">
          <input v-model="overwrite" type="checkbox" class="w-4 h-4 rounded accent-primary" />
          <span class="text-text-body dark:text-text-dark-body">Écraser l'historique existant du compte</span>
        </label>
      </div>
    </template>

    <!-- ── STEP 4: Result ──────────────────────────────── -->
    <template v-else>
      <BaseAlert variant="success" class="mb-4">Import terminé avec succès !</BaseAlert>
      <div class="text-sm text-text-body dark:text-text-dark-body space-y-1">
        <p><strong>{{ result.imported }}</strong> élément(s) importé(s)</p>
        <p v-if="result.groups !== null"><strong>{{ result.groups }}</strong> opération(s) traitée(s)</p>
        <p v-if="result.skipped > 0" class="text-text-muted dark:text-text-dark-muted">{{ result.skipped }} doublon(s) ignoré(s)</p>
      </div>
    </template>

    <!-- ── Footer ──────────────────────────────────────── -->
    <template #footer>
      <template v-if="step === 'source'">
        <BaseButton variant="outline" @click="handleClose">Annuler</BaseButton>
        <BaseButton :disabled="!csvContent || !selectedSourceId || isLoading" :loading="isLoading" @click="goFromSource">
          {{ needsMapping ? 'Configurer les colonnes' : 'Aperçu' }}
        </BaseButton>
      </template>
      <template v-else-if="step === 'mapping'">
        <BaseButton variant="outline" @click="step = 'source'">Retour</BaseButton>
        <BaseButton :disabled="!mappingReady || isLoading" :loading="isLoading" @click="runPreview">
          Aperçu
        </BaseButton>
      </template>
      <template v-else-if="step === 'review'">
        <BaseButton variant="outline" @click="step = needsMapping ? 'mapping' : 'source'">Retour</BaseButton>
        <BaseButton :disabled="!canConfirm || isLoading" :loading="isLoading" @click="runConfirm">Importer</BaseButton>
      </template>
      <template v-else>
        <BaseButton @click="handleClose">Fermer</BaseButton>
      </template>
    </template>
  </BaseModal>
</template>

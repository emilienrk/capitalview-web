<script setup lang="ts">
import { Camera, ImagePlus, Loader2, X, Trash2, CheckCircle2 } from 'lucide-vue-next'
import { ref, computed, watch } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseAlert from '@/components/base/BaseAlert.vue'
import { apiClient } from '@/api/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedStockTransaction {
  asset_key: string | null
  type: 'BUY' | 'SELL' | 'DIVIDEND'
  amount: number
  price_per_unit: number
  fees: number
  executed_at: string
  notes: string | null
}

export interface ExtractedCryptoTransaction {
  asset_key: string
  type: string
  amount: number
  price_per_unit: number
  executed_at: string
  tx_hash: string | null
  notes: string | null
}

export type ExtractedTransaction = ExtractedStockTransaction | ExtractedCryptoTransaction

interface Props {
  open: boolean
  assetType: 'stock' | 'crypto'
  accountId: string
}

// ── Props & Emits ─────────────────────────────────────────────────────────────

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  confirm: [transactions: ExtractedTransaction[]]
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const imagePreviewUrl = ref<string | null>(null)
const isAnalyzing = ref(false)
const error = ref<string | null>(null)
const extractedTransactions = ref<ExtractedTransaction[]>([])
const step = ref<'upload' | 'review'>('upload')

// ── Computed ──────────────────────────────────────────────────────────────────

const modalTitle = computed(() =>
  props.assetType === 'stock'
    ? 'Importer depuis une photo — Actions'
    : 'Importer depuis une photo — Crypto'
)

const hasTransactions = computed(() => extractedTransactions.value.length > 0)

const stockTypes = ['BUY', 'SELL', 'DIVIDEND']
const cryptoTypes = ['BUY', 'SELL', 'REWARD', 'TRANSFER', 'FIAT_DEPOSIT', 'FIAT_WITHDRAWAL', 'CRYPTO_DEPOSIT', 'CRYPTO_WITHDRAWAL', 'SELL_TO_FIAT']

const txTypeOptions = computed(() =>
  props.assetType === 'stock' ? stockTypes : cryptoTypes
)

// ── File handling ─────────────────────────────────────────────────────────────

function triggerFileInput() {
  fileInput.value?.click()
}

function onFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    error.value = 'Veuillez sélectionner une image (JPG, PNG, WEBP…)'
    return
  }

  error.value = null
  selectedFile.value = file

  // Prévisualisation locale
  const reader = new FileReader()
  reader.onload = (e) => {
    imagePreviewUrl.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (!file) return

  // Simuler une sélection de fichier
  const dt = new DataTransfer()
  dt.items.add(file)
  if (fileInput.value) fileInput.value.files = dt.files
  onFileSelect({ target: fileInput.value } as unknown as Event)
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
}

function resetPhoto() {
  selectedFile.value = null
  imagePreviewUrl.value = null
  error.value = null
  extractedTransactions.value = []
  step.value = 'upload'
  if (fileInput.value) fileInput.value.value = ''
}

// ── Analyse ───────────────────────────────────────────────────────────────────

async function analyzePhoto() {
  if (!selectedFile.value) return

  isAnalyzing.value = true
  error.value = null

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)

    const endpoint = props.assetType === 'stock'
      ? '/stocks/transactions/extract'
      : '/crypto/transactions/extract'

    const response = await apiClient.postForm<{ transactions: ExtractedTransaction[] }>(endpoint, formData)

    if (!response.transactions || response.transactions.length === 0) {
      error.value = "Aucune transaction n'a pu être extraite de cette image. Vérifiez que la photo est lisible."
      return
    }

    extractedTransactions.value = response.transactions.map(tx => ({ ...tx }))
    step.value = 'review'
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Erreur lors de l'analyse de la photo"
  } finally {
    isAnalyzing.value = false
  }
}

// ── Review actions ────────────────────────────────────────────────────────────

function removeTransaction(index: number) {
  extractedTransactions.value.splice(index, 1)
  if (extractedTransactions.value.length === 0) {
    step.value = 'upload'
  }
}

function formatDatetimeLocal(isoStr: string): string {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return isoStr
    // Format: YYYY-MM-DDTHH:mm
    return d.toISOString().slice(0, 16)
  } catch {
    return isoStr
  }
}

function handleDateInput(index: number, value: string) {
  const tx = extractedTransactions.value[index]
  if (tx) tx.executed_at = value
}

// ── Confirm & close ───────────────────────────────────────────────────────────

function handleConfirm() {
  emit('confirm', [...extractedTransactions.value])
  handleClose()
}

function handleClose() {
  resetPhoto()
  emit('close')
}

// Reset quand la modale se ferme
watch(() => props.open, (open) => {
  if (!open) resetPhoto()
})
</script>

<template>
  <BaseModal :open="props.open" :title="modalTitle" size="lg" @close="handleClose">
    <div class="space-y-5">

      <!-- ── STEP 1 : Upload ──────────────────────────────────────────── -->
      <template v-if="step === 'upload'">

        <!-- Zone de drop -->
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="onFileSelect"
        />

        <div
          v-if="!selectedFile"
          class="border-2 border-dashed border-surface-border dark:border-surface-dark-border rounded-card p-10 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5"
          @click="triggerFileInput"
          @drop="onDrop"
          @dragover="onDragOver"
        >
          <div class="flex flex-col items-center gap-3">
            <div class="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <ImagePlus class="w-7 h-7 text-primary" />
            </div>
            <div>
              <p class="text-sm font-medium text-text-main dark:text-text-dark-main">
                Glissez une photo ici ou cliquez pour parcourir
              </p>
              <p class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">
                JPG, PNG, WEBP acceptés
              </p>
            </div>
            <BaseButton variant="outline" size="sm" @click.stop="triggerFileInput">
              <Camera class="w-4 h-4 mr-1.5" />
              Choisir une image
            </BaseButton>
          </div>
        </div>

        <!-- Preview de l'image sélectionnée -->
        <div v-else class="space-y-4">
          <div class="relative rounded-card overflow-hidden bg-background-subtle dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border">
            <img
              :src="imagePreviewUrl ?? ''"
              alt="Aperçu"
              class="w-full max-h-64 object-contain"
            />
            <button
              class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              @click="resetPhoto"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
          <p class="text-xs text-text-muted dark:text-text-dark-muted text-center">
            {{ selectedFile.name }}
          </p>
        </div>

        <!-- Erreur -->
        <BaseAlert v-if="error" variant="danger" dismissible @dismiss="error = null">
          {{ error }}
        </BaseAlert>

        <!-- Info -->
        <div class="flex items-start gap-2 p-3 rounded-secondary bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
          <Camera class="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p class="text-xs text-blue-700 dark:text-blue-300">
            L'agent IA va analyser la photo et extraire automatiquement les transactions.
            Vous pourrez les corriger avant de valider.
          </p>
        </div>
      </template>

      <!-- ── STEP 2 : Review ──────────────────────────────────────────── -->
      <template v-if="step === 'review'">

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <CheckCircle2 class="w-4 h-4 text-success" />
            <span class="text-sm font-medium text-text-main dark:text-text-dark-main">
              {{ extractedTransactions.length }} transaction(s) extraite(s)
            </span>
          </div>
          <button
            class="text-xs text-text-muted dark:text-text-dark-muted hover:text-primary transition-colors"
            @click="step = 'upload'"
          >
            ← Changer de photo
          </button>
        </div>

        <!-- Erreur -->
        <BaseAlert v-if="error" variant="danger" dismissible @dismiss="error = null">
          {{ error }}
        </BaseAlert>

        <!-- Liste éditable -->
        <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div
            v-for="(tx, index) in extractedTransactions"
            :key="index"
            class="p-4 rounded-card border border-surface-border dark:border-surface-dark-border bg-background dark:bg-surface-dark space-y-3"
          >
            <!-- Header ligne -->
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-text-muted dark:text-text-dark-muted uppercase tracking-wide">
                Transaction {{ index + 1 }}
              </span>
              <button
                class="p-1 text-text-muted dark:text-text-dark-muted hover:text-danger transition-colors"
                @click="removeTransaction(index)"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>

            <!-- Champs -->
            <div class="grid grid-cols-2 gap-3">

              <!-- Asset key -->
              <div class="col-span-2">
                <label class="block text-xs font-medium text-text-muted dark:text-text-dark-muted mb-1">
                  {{ assetType === 'stock' ? 'ISIN' : 'Ticker' }}
                </label>
                <input
                  v-model="(tx as any).asset_key"
                  type="text"
                  class="w-full px-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                  :placeholder="assetType === 'stock' ? 'Ex: US0378331005' : 'Ex: BTC'"
                />
              </div>

              <!-- Type -->
              <div>
                <label class="block text-xs font-medium text-text-muted dark:text-text-dark-muted mb-1">
                  Type
                </label>
                <select
                  v-model="(tx as any).type"
                  class="w-full px-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option v-for="t in txTypeOptions" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>

              <!-- Amount -->
              <div>
                <label class="block text-xs font-medium text-text-muted dark:text-text-dark-muted mb-1">
                  Quantité
                </label>
                <input
                  v-model.number="(tx as any).amount"
                  type="number"
                  min="0"
                  step="any"
                  class="w-full px-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <!-- Price -->
              <div>
                <label class="block text-xs font-medium text-text-muted dark:text-text-dark-muted mb-1">
                  Prix unitaire (€)
                </label>
                <input
                  v-model.number="(tx as any).price_per_unit"
                  type="number"
                  min="0"
                  step="any"
                  class="w-full px-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <!-- Fees (stocks seulement) -->
              <div v-if="assetType === 'stock'">
                <label class="block text-xs font-medium text-text-muted dark:text-text-dark-muted mb-1">
                  Frais (€)
                </label>
                <input
                  v-model.number="(tx as any).fees"
                  type="number"
                  min="0"
                  step="any"
                  class="w-full px-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <!-- Date -->
              <div :class="assetType === 'stock' ? 'col-span-1' : 'col-span-2'">
                <label class="block text-xs font-medium text-text-muted dark:text-text-dark-muted mb-1">
                  Date
                </label>
                <input
                  :value="formatDatetimeLocal((tx as any).executed_at)"
                  type="datetime-local"
                  class="w-full px-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  @input="handleDateInput(index, ($event.target as HTMLInputElement).value)"
                />
              </div>

              <!-- Notes -->
              <div class="col-span-2">
                <label class="block text-xs font-medium text-text-muted dark:text-text-dark-muted mb-1">
                  Notes
                </label>
                <input
                  v-model="(tx as any).notes"
                  type="text"
                  class="w-full px-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Optionnel"
                />
              </div>
            </div>
          </div>
        </div>
      </template>

    </div>

    <!-- Footer -->
    <template #footer>
      <div class="flex justify-between items-center w-full gap-3">
        <BaseButton variant="ghost" @click="handleClose">
          Annuler
        </BaseButton>

        <div class="flex gap-2">
          <!-- Analyser (step upload) -->
          <BaseButton
            v-if="step === 'upload'"
            :disabled="!selectedFile || isAnalyzing"
            :loading="isAnalyzing"
            @click="analyzePhoto"
          >
            <Loader2 v-if="isAnalyzing" class="w-4 h-4 mr-1.5 animate-spin" />
            <Camera v-else class="w-4 h-4 mr-1.5" />
            {{ isAnalyzing ? 'Analyse en cours…' : 'Analyser la photo' }}
          </BaseButton>

          <!-- Valider (step review) -->
          <BaseButton
            v-if="step === 'review'"
            :disabled="!hasTransactions"
            @click="handleConfirm"
          >
            <CheckCircle2 class="w-4 h-4 mr-1.5" />
            Valider {{ extractedTransactions.length }} transaction(s)
          </BaseButton>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

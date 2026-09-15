<script setup lang="ts">
/**
 * Enable Banking JSON export, for the history the API window cannot reach.
 * No account to pick: the export names its accounts by fingerprint, and only
 * the ones already attached are imported.
 */
import { FileJson } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useBankStore } from '@/stores/bank'
import { BaseAlert, BaseButton, BaseModal } from '@/components'
import type { BankExportImportResponse } from '@/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const bank = useBankStore()

const isImporting = ref(false)
const isDragging = ref(false)
const error = ref<string | null>(null)
const result = ref<BankExportImportResponse | null>(null)
const fileName = ref<string | null>(null)

watch(() => props.open, (open) => {
  if (!open) return
  error.value = null
  result.value = null
  fileName.value = null
})

/** Account names for the result table: the API answers with uuids only. */
const accountNameByUuid = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const a of bank.summary?.accounts ?? []) map[a.id] = a.name
  return map
})

async function readFile(file: File): Promise<void> {
  error.value = null
  result.value = null
  fileName.value = file.name

  let payload: unknown
  try {
    payload = JSON.parse(await file.text())
  } catch {
    error.value = 'Ce fichier n\'est pas du JSON valide.'
    return
  }

  isImporting.value = true
  try {
    result.value = await bank.importBankingExport(payload)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Import impossible.'
  } finally {
    isImporting.value = false
  }
}

function onFileSelect(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void readFile(file)
  // Cleared so re-picking the same file after a rejected read still fires `change`.
  input.value = ''
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void readFile(file)
}
</script>

<template>
  <BaseModal :open="props.open" title="Importer un export Enable Banking" size="lg" @close="emit('close')">
    <div class="space-y-4">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">
        La synchronisation ne remonte que ce que votre banque expose encore. L'export JSON d'une
        session Enable Banking reprend les opérations et les soldes de vos comptes rattachés.
      </p>

      <label
        :class="[
          'flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-card transition-colors',
          isImporting ? 'opacity-60 cursor-wait' : 'cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-surface-border dark:border-surface-dark-border hover:border-primary',
        ]"
        @drop="onDrop"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
      >
        <FileJson class="w-7 h-7 text-text-muted dark:text-text-dark-muted mb-2" />
        <span v-if="isImporting" class="text-sm font-medium text-text-main dark:text-text-dark-main">
          Import en cours…
        </span>
        <span v-else-if="fileName" class="text-sm font-medium text-text-main dark:text-text-dark-main">
          {{ fileName }}
        </span>
        <span v-else class="text-sm text-text-muted dark:text-text-dark-muted">
          Glissez le fichier .json ici ou cliquez pour le choisir
        </span>
        <span class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">
          Les comptes sont reconnus par leur empreinte : seuls ceux déjà rattachés sont importés
        </span>
        <input type="file" accept=".json,application/json" class="hidden" :disabled="isImporting" @change="onFileSelect" />
      </label>

      <p v-if="error" class="text-xs text-danger">{{ error }}</p>

      <BaseAlert v-if="result" :variant="result.imported_accounts ? 'success' : 'warning'">
        <p class="font-medium">
          {{ result.imported_accounts }} compte(s) importé(s).
        </p>
        <p v-if="!result.imported_accounts" class="mt-0.5 opacity-90">
          Aucun compte de cet export ne correspond à un compte rattaché. Connectez d'abord la
          banque, rattachez les comptes, puis relancez l'import.
        </p>
        <ul v-else class="mt-2 space-y-1">
          <li v-for="r in result.results" :key="r.bank_account_uuid" class="text-xs">
            <span class="font-medium">{{ accountNameByUuid[r.bank_account_uuid] ?? r.bank_account_uuid }}</span> —
            {{ r.inserted }} ajoutée(s), {{ r.updated }} mise(s) à jour, {{ r.skipped }} déjà connue(s),
            {{ r.snapshots_written }} point(s) d'historique
            <template v-if="r.malformed"> · {{ r.malformed }} ligne(s) inexploitable(s)</template>
            <template v-if="r.detail"> · {{ r.detail }}</template>
          </li>
        </ul>
      </BaseAlert>

      <BaseAlert variant="info">
        <p class="font-medium">Où trouver ce fichier</p>
        <p class="mt-0.5 opacity-90">
          Dans le portail Enable Banking, ouvrez votre application puis la session bancaire
          concernée, et exportez ses données au format JSON. S'il ne remonte pas assez loin,
          importez les opérations d'un relevé CSV : elles complètent le compte jusqu'au début de
          l'historique bancaire.
        </p>
      </BaseAlert>
    </div>

    <template #footer>
      <BaseButton @click="emit('close')">Fermer</BaseButton>
    </template>
  </BaseModal>
</template>

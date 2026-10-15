<script setup lang="ts">
/**
 * Every answer the user gave that is still in force — pairs bound or refused,
 * types, recurring payments — newest first, each one withdrawable. A withdrawn
 * answer leaves the list: the operations read as they did before it
 * (docs/bank-sorting.md). Rules speak for the operations to come: they have
 * their own page, the Banque section's Règles tab.
 */
import { ref, watch } from 'vue'

import { BaseAlert, BaseButton, BaseEmptyState, BaseModal, BaseSkeleton } from '@/components'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useCashflowTypesStore } from '@/stores/cashflowTypes'
import type { BankHistoryItem, BankHistoryOperation } from '@/types'
import { historyTitle } from '@/utils/bankHistory'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const types = useCashflowTypesStore()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

const items = ref<BankHistoryItem[] | null>(null)
const failed = ref(false)
const undoing = ref<string | null>(null)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  failed.value = false
  try {
    items.value = await types.fetchHistory()
  } catch {
    failed.value = true
  }
}

watch(() => props.open, (open) => {
  items.value = null
  error.value = null
  if (open) void load()
}, { immediate: true })

async function undo(item: BankHistoryItem): Promise<void> {
  undoing.value = item.id
  error.value = null
  const index = items.value?.indexOf(item) ?? -1
  items.value = items.value?.filter((other) => other !== item) ?? null
  try {
    await types.undoAnswer(item)
  } catch (e) {
    // Back where it was, unless a list read again meanwhile already holds it.
    if (items.value && index >= 0 && !items.value.some((other) => other.kind === item.kind && other.id === item.id)) {
      items.value = [...items.value.slice(0, index), item, ...items.value.slice(index)]
    }
    error.value = e instanceof Error ? e.message : "Impossible d'annuler cette réponse."
  } finally {
    undoing.value = null
  }
}

function when(at: string | null): string {
  if (!at) return 'Date inconnue'
  return `Le ${new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function day(value: string | null): string {
  if (!value) return ''
  const [year, month, date] = value.split('-').map(Number)
  return new Date(year!, month! - 1, date!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function signed(op: BankHistoryOperation): string {
  const value = Number(op.amount)
  return maskValue(formatCurrency(op.is_credit ? value : -value, op.currency))
}
</script>

<template>
  <BaseModal :open="open" title="Historique de mes réponses" size="lg" scroll-fade @close="emit('close')">
    <div class="space-y-4">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">
        Chaque réponse encore en vigueur, la plus récente d'abord. L'annuler remet les opérations comme avant elle.
      </p>

      <BaseAlert v-if="error" variant="danger">{{ error }}</BaseAlert>

      <div v-if="failed" class="flex items-center justify-between gap-3">
        <p class="text-sm text-text-muted dark:text-text-dark-muted">Impossible de charger l'historique.</p>
        <BaseButton size="sm" variant="outline" @click="load">Réessayer</BaseButton>
      </div>
      <div v-else-if="!items" class="space-y-2">
        <BaseSkeleton v-for="i in 4" :key="i" variant="rect" width="100%" height="3.25rem" />
      </div>
      <BaseEmptyState
        v-else-if="!items.length"
        title="Aucune réponse"
        description="Les paires liées ou refusées, les types choisis et les récurrents décidés apparaîtront ici."
      />
      <ul v-else class="divide-y divide-surface-border dark:divide-surface-dark-border -mx-2">
        <li v-for="item in items" :key="`${item.kind}-${item.id}`" class="flex items-start gap-3 px-2 py-2.5">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-text-main dark:text-text-dark-main">{{ historyTitle(item) }}</p>
            <p
              v-for="op in item.operations"
              :key="op.id"
              class="mt-0.5 flex items-baseline gap-2 text-xs text-text-muted dark:text-text-dark-muted"
            >
              <span class="min-w-0 truncate" :title="op.label ?? undefined">
                {{ day(op.operation_date) }} · {{ op.account_name }} · {{ op.label ?? 'Opération sans libellé' }}
              </span>
              <span class="ml-auto shrink-0 tabular-nums text-text-main dark:text-text-dark-main">{{ signed(op) }}</span>
            </p>
            <!-- Never replaced in silence: the pair reads first, and says so. -->
            <p v-if="item.overridden_by_pair" class="mt-0.5 text-xs text-warning">
              Une paire reconnue depuis passe avant ce choix : l'opération est comptée avec elle.
            </p>
            <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">{{ when(item.at) }}</p>
          </div>
          <BaseButton
            size="sm" variant="outline" class="shrink-0"
            :disabled="undoing !== null"
            @click="undo(item)"
          >
            Annuler
          </BaseButton>
        </li>
      </ul>
    </div>
  </BaseModal>
</template>

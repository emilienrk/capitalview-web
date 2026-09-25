<script setup lang="ts">
/**
 * Files an operation under a recurring by hand: into one already found, of its
 * own direction — a debit under a payment, a credit under an income — or as a
 * new one the detection missed. One already filed is taken out instead.
 */
import { computed, ref, watch } from 'vue'
import { Plus, Repeat } from 'lucide-vue-next'

import { BaseAlert, BaseButton, BaseEmptyState, BaseModal, BaseSkeleton } from '@/components'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useRecurringStore } from '@/stores/recurring'
import { CADENCE_PER } from '@/utils/recurring'
import type { BankRecurringItem, BankTransactionItem, RecurringDirection } from '@/types'

const props = defineProps<{
  open: boolean
  tx: BankTransactionItem | null
}>()

const emit = defineEmits<{ close: [] }>()

const store = useRecurringStore()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

const direction = computed<RecurringDirection>(() => (props.tx?.is_credit ? 'income' : 'expense'))
const income = computed(() => direction.value === 'income')
const failed = ref(false)
const saving = ref<string | null>(null)
const error = ref<string | null>(null)

watch(
  () => [props.open, props.tx?.id] as const,
  async ([open, id]) => {
    failed.value = false
    error.value = null
    if (!open || !id || props.tx?.recurring) return
    try {
      await store.fetchList(direction.value)
    } catch {
      failed.value = true
    }
  },
  { immediate: true },
)

const candidates = computed<BankRecurringItem[] | null>(() => {
  const list = store.lists[direction.value]
  return list ? list.items.filter((item) => item.state !== 'refused') : null
})

function money(value: number, currency: string): string {
  return maskValue(formatCurrency(Number(value), currency))
}

function signed(tx: BankTransactionItem): string {
  return money(tx.is_credit ? Number(tx.amount) : -Number(tx.amount), tx.currency)
}

async function save(key: string, action: () => Promise<unknown>): Promise<void> {
  saving.value = key
  error.value = null
  try {
    await action()
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Impossible d'enregistrer ce choix."
  } finally {
    saving.value = null
  }
}

function attach(item: BankRecurringItem): Promise<void> {
  const tx = props.tx
  if (!tx) return Promise.resolve()
  return save(item.key, async () => store.correct(await store.decisionId(item), tx.id, 'include'))
}

function markNew(): Promise<void> {
  const tx = props.tx
  if (!tx) return Promise.resolve()
  return save('new', () => store.mark(tx.id))
}

function detach(): Promise<void> {
  const tx = props.tx
  const tag = tx?.recurring
  if (!tx || !tag) return Promise.resolve()
  return save(tag.key, async () =>
    store.correct(await store.decisionId({ id: tag.id, transaction_id: tx.id }), tx.id, 'exclude'))
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="tx?.recurring ? 'Récurrent' : `Rattacher à un ${income ? 'revenu' : 'paiement'} récurrent`"
    size="lg"
    @close="emit('close')"
  >
    <div v-if="tx" class="space-y-4">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">
        {{ tx.label ?? 'Opération sans libellé' }} · {{ tx.account_name }} ·
        <span class="font-semibold tabular-nums text-text-main dark:text-text-dark-main">{{ signed(tx) }}</span>
      </p>

      <BaseAlert v-if="error" variant="danger">{{ error }}</BaseAlert>

      <div v-if="tx.recurring" class="flex flex-wrap items-center justify-between gap-3">
        <p class="flex items-center gap-1.5 text-sm text-text-main dark:text-text-dark-main">
          <Repeat class="w-4 h-4 shrink-0 text-primary" />
          Comptée dans {{ tx.recurring.name }}.
        </p>
        <BaseButton
          size="sm" variant="outline"
          :loading="saving === tx.recurring.key" :disabled="saving !== null"
          @click="detach"
        >
          L'en retirer
        </BaseButton>
      </div>

      <template v-else>
        <p v-if="failed" class="text-sm text-text-muted dark:text-text-dark-muted">
          Impossible de charger les {{ income ? 'revenus' : 'paiements' }} récurrents.
        </p>
        <div v-else-if="!candidates" class="space-y-2">
          <BaseSkeleton v-for="i in 3" :key="i" variant="rect" width="100%" height="2.75rem" />
        </div>
        <BaseEmptyState
          v-else-if="!candidates.length"
          :title="income ? 'Aucun revenu récurrent' : 'Aucun paiement récurrent'"
          description="Aucun n'a encore été trouvé dans ce sens : faites de celle-ci le premier."
        />
        <ul v-else class="max-h-80 overflow-y-auto divide-y divide-surface-border dark:divide-surface-dark-border -mx-2">
          <li v-for="item in candidates" :key="item.key" class="flex items-center gap-3 px-2 py-2.5">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-text-main dark:text-text-dark-main" :title="item.name">{{ item.name }}</p>
              <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted tabular-nums">
                <template v-if="item.variable">≈ </template>{{ money(item.amount, item.currency) }} {{ CADENCE_PER[item.cadence] }}
                · {{ item.accounts.join(', ') }}
              </p>
            </div>
            <BaseButton
              size="sm" variant="outline" class="shrink-0"
              :loading="saving === item.key" :disabled="saving !== null"
              @click="attach(item)"
            >
              Rattacher
            </BaseButton>
          </li>
        </ul>
        <div class="flex justify-end">
          <BaseButton size="sm" variant="ghost" :loading="saving === 'new'" :disabled="saving !== null" @click="markNew">
            <Plus class="w-3.5 h-3.5 mr-1" /> Nouveau {{ income ? 'revenu' : 'paiement' }} récurrent
          </BaseButton>
        </div>
      </template>
    </div>
  </BaseModal>
</template>

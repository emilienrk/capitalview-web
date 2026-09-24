<script setup lang="ts">
/**
 * The operations one answer to a flow question would type, on demand.
 *
 * The question says how many operations it settles and what they add up to;
 * this opens the list of the very operations counted, so an answer is given
 * knowing what it moves rather than on trust. Fetched on the first opening
 * only: the group spans the whole history, which the month's list never loads.
 */
import { computed, ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

import { BaseSkeleton } from '@/components'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useCashflowTypesStore } from '@/stores/cashflowTypes'
import type { BankTransactionItem } from '@/types'
import { contributionNote } from '@/utils/cashflowTypes'

const props = defineProps<{
  transactionId: string
  /** The operations the answer covers, as the question counts them. */
  count: number
  /** Their formatted total. */
  stake?: string
  /** The label asked about: only the operations reading differently show theirs. */
  label: string | null
}>()

const types = useCashflowTypesStore()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

const open = ref(false)
const operations = ref<BankTransactionItem[] | null>(null)
const failed = ref(false)

/** Shown while the list is on its way: the count is already known. */
const placeholders = computed(() => Math.min(props.count, 5))

async function toggle(): Promise<void> {
  open.value = !open.value
  if (!open.value || operations.value) return
  failed.value = false
  try {
    operations.value = await types.fetchFlowGroup(props.transactionId)
  } catch {
    failed.value = true
  }
}

function signed(tx: BankTransactionItem): string {
  const value = Number(tx.amount)
  return maskValue(formatCurrency(tx.is_credit ? value : -value, tx.currency))
}

function hint(tx: BankTransactionItem): string | null {
  const match = tx.contribution
  if (!match) return null
  return contributionNote(match, maskValue(formatCurrency(Number(match.amount), tx.currency)), day(match.day))
}

function day(value: string | null): string {
  if (!value) return ''
  const [year, month, date] = value.split('-').map(Number)
  return new Date(year!, month! - 1, date!).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
</script>

<template>
  <span class="basis-full flex flex-col gap-1">
    <button
      type="button"
      class="self-start inline-flex items-center gap-1 text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main transition-colors"
      :aria-expanded="open"
      @click="toggle"
    >
      s'applique aux {{ count }} opérations de ce libellé<template v-if="stake">, {{ stake }} en tout</template>
      <ChevronDown :class="['w-3 h-3 transition-transform', open ? 'rotate-180' : '']" />
    </button>

    <ul
      v-if="open"
      class="rounded-button bg-background-subtle dark:bg-background-dark-subtle divide-y divide-surface-border dark:divide-surface-dark-border"
    >
      <template v-if="operations">
        <li
          v-for="operation in operations"
          :key="operation.id"
          class="px-2.5 py-1.5 text-text-muted dark:text-text-dark-muted"
        >
          <div class="flex items-baseline gap-2">
            <span class="shrink-0 tabular-nums">{{ day(operation.operation_date) }}</span>
            <span class="shrink-0">{{ operation.account_name }}</span>
            <!-- The references and dates a bank writes into its labels differ from
                 one operation to the next; the words they share are what groups them. -->
            <span v-if="operation.label && operation.label !== label" class="truncate" :title="operation.label">
              {{ operation.label }}
            </span>
            <span class="ml-auto shrink-0 font-medium tabular-nums text-text-main dark:text-text-dark-main">
              {{ signed(operation) }}
            </span>
          </div>
          <p v-if="hint(operation)" class="text-info">{{ hint(operation) }}</p>
        </li>
      </template>
      <li v-else-if="failed" class="px-2.5 py-1.5 text-danger">
        Impossible de charger ces opérations.
      </li>
      <li v-for="n in placeholders" v-else :key="n" class="px-2.5 py-1.5">
        <BaseSkeleton variant="text" width="100%" />
      </li>
    </ul>
  </span>
</template>

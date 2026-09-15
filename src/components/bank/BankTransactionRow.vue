<script setup lang="ts">
/** One operation in the Opérations tab, grouped under its day or listed by amount. */
import { computed } from 'vue'
import { ArrowLeftRight, Check, Link2, Sparkles, Tag, Undo2, Unlink, X } from 'lucide-vue-next'

import { BaseBadge, BaseButton } from '@/components'
import { OPERATION_TYPE_LABELS, isUncategorized } from '@/utils/bankCategories'
import type { BankTransactionItem, BankTransferDecisionKind } from '@/types'

const props = defineProps<{
  tx: BankTransactionItem
  /** Shown only when the list is not already grouped by day. */
  date?: string
  showAccount: boolean
  amount: string
  amountClass: string
  /** A decision about this operation is on its way. */
  busy?: boolean
}>()

defineEmits<{
  decide: [kind: BankTransferDecisionKind]
  link: []
  categorize: []
}>()

const suggested = computed(() => props.tx.transfer_status === 'suggested')
const cancelled = computed(() =>
  props.tx.transfer_status === 'reversal' || props.tx.transfer_status === 'refund',
)
const toFile = computed(() => isUncategorized(props.tx))
/** A paired transfer counts by its pair: its category is only shown once the user gave one. */
const showsCategory = computed(() => toFile.value || props.tx.category_name !== null)
</script>

<template>
  <li :class="['group flex items-center gap-3 px-4 sm:px-6 py-3', tx.is_pending ? 'opacity-70' : '']">
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-text-main dark:text-text-dark-main" :title="tx.label ?? undefined">
        {{ tx.label ?? 'Opération sans libellé' }}
      </p>
      <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted dark:text-text-dark-muted">
        <span v-if="date">{{ date }}</span>
        <span v-if="date && showAccount" aria-hidden="true">·</span>
        <span v-if="showAccount">{{ tx.account_name }}</span>
        <span v-if="tx.operation_type !== 'UNKNOWN'" class="text-text-muted/80 dark:text-text-dark-muted/80">
          {{ OPERATION_TYPE_LABELS[tx.operation_type] }}
        </span>
        <button
          v-if="showsCategory"
          type="button"
          :class="[
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium transition-colors',
            tx.category_name
              ? 'bg-primary/10 text-primary hover:bg-primary/20'
              : 'border border-dashed border-surface-border dark:border-surface-dark-border hover:text-text-main dark:hover:text-text-dark-main',
          ]"
          :title="tx.category_name ? 'Changer la catégorie' : 'Ranger cette opération'"
          @click="$emit('categorize')"
        >
          <Tag class="w-3 h-3" />
          {{ tx.category_name ?? 'À ranger' }}
          <span
            v-if="tx.category_source === 'ai_rule'"
            class="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide opacity-80"
            title="Rangée par l'IA"
          >
            <Sparkles class="w-2.5 h-2.5" />IA
          </span>
        </button>
        <BaseBadge v-if="cancelled" variant="secondary">
          <Undo2 class="inline w-3 h-3 mr-1 -mt-px" />
          {{ tx.transfer_status === 'refund' ? (tx.is_credit ? 'Remboursement' : 'Remboursée') : 'Annulée' }}
        </BaseBadge>
        <BaseBadge v-else-if="tx.transfer_account_name" :variant="suggested ? 'warning' : 'info'">
          <ArrowLeftRight class="inline w-3 h-3 mr-1 -mt-px" />
          {{ tx.is_credit ? 'depuis' : 'vers' }} {{ tx.transfer_account_name }}{{ suggested ? ' ?' : '' }}
          <Check v-if="tx.transfer_status === 'confirmed'" class="inline w-3 h-3 ml-1 -mt-px" aria-label="confirmé" />
        </BaseBadge>
        <BaseBadge v-if="tx.is_pending" variant="warning">En attente</BaseBadge>
      </div>
    </div>
    <p :class="['shrink-0 text-sm font-semibold tabular-nums', amountClass]">
      {{ amount }}
    </p>
    <!-- A fixed width, so the amounts line up whether a row offers one action or two. -->
    <div class="shrink-0 w-16 flex items-center justify-end gap-0.5">
      <!-- Only a suggested pair asks: every other one was settled without the user.
           The corrections stay out of sight until hovered, so the list does not
           read as a to-do list. -->
      <template v-if="suggested">
        <BaseButton
          icon size="sm" variant="ghost" :disabled="busy"
          aria-label="C'est un virement entre mes comptes" title="C'est un virement entre mes comptes"
          @click="$emit('decide', 'transfer')"
        >
          <Check class="w-4 h-4" />
        </BaseButton>
        <BaseButton
          icon size="sm" variant="ghost" :disabled="busy"
          aria-label="Ce n'est pas un virement" title="Ce n'est pas un virement"
          @click="$emit('decide', 'not_transfer')"
        >
          <X class="w-4 h-4" />
        </BaseButton>
      </template>
      <BaseButton
        v-else-if="tx.transfer_id"
        class="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        icon size="sm" variant="ghost" :disabled="busy"
        aria-label="Dissocier" title="Dissocier : compter les deux opérations"
        @click="$emit('decide', 'not_transfer')"
      >
        <Unlink class="w-4 h-4" />
      </BaseButton>
      <BaseButton
        v-else
        class="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        icon size="sm" variant="ghost" :disabled="busy"
        aria-label="Lier à une autre opération" title="Lier à un virement ou à son remboursement"
        @click="$emit('link')"
      >
        <Link2 class="w-4 h-4" />
      </BaseButton>
    </div>
  </li>
</template>

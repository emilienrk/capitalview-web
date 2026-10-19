<script setup lang="ts">
/**
 * Says how an operation counts: every type is offered whatever the payment
 * means — a card purchase at a crypto broker is an investment. By default the
 * choice types every operation of the label, and of nearby labels, on this
 * account and in this direction, including those imported later.
 */
import { computed, ref, watch } from 'vue'

import { BaseAlert, BaseButton, BaseModal, BaseToggle } from '@/components'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useBankStore } from '@/stores/bank'
import { useCashflowTypesStore } from '@/stores/cashflowTypes'
import { CASHFLOW_TYPES, RULES_PAGE, answerHint, answerLabel, contributionNote, ruleTitle } from '@/utils/cashflowTypes'
import { retypeEffect } from '@/utils/optimisticRetype'
import type { BankTransactionItem, BankTransactionTypeResult, CashflowType } from '@/types'

const props = defineProps<{
  open: boolean
  tx: BankTransactionItem | null
  /** The other operations on screen (the month's), which a label's rule may type too. */
  neighbours?: BankTransactionItem[]
}>()

const emit = defineEmits<{
  close: []
  /** `outranked`: the rule written by hand the choice now comes before, by its title. */
  saved: [result: BankTransactionTypeResult, outranked: string | null]
  cleared: []
  /** The type chosen could not be saved: the list is back as it was, the page says why. */
  failed: [message: string]
}>()

const bank = useBankStore()
const types = useCashflowTypesStore()
const { formatCurrency, formatDateShort } = useFormatters()
const { maskValue } = usePrivacyMode()

const byLabel = ref(true)
const clearing = ref(false)
const error = ref<string | null>(null)

const hasLabel = computed(() => Boolean(props.tx?.label?.trim()))
/** What the user set, which going back to the detected type undoes. */
const userSet = computed(() => props.tx?.type_source === 'override' || props.tx?.type_source === 'rule')
/**
 * A rule written by hand reaches far beyond this label: it is changed on its
 * page, never dropped from here.
 */
const writtenRule = computed(() => {
  const id = props.tx?.type_source === 'rule' ? props.tx.type_rule_id : null
  return types.rules?.find((rule) => rule.id === id && rule.match !== 'similar') ?? null
})
/**
 * Its label's rule reaches the recurring it is part of: typed as anything but
 * the recurring's kind, it leaves the fixed payments or income. Said before
 * the choice, as the rule page's preview says it.
 */
const recurringNote = computed(() => {
  const tag = props.tx?.recurring
  if (!tag || tag.role === 'refund' || !byLabel.value) return null
  const income = tag.direction === 'income'
  return `Fait partie de « ${tag.name} » : classées autrement qu'en ${answerLabel(income ? 'INCOME' : 'EXPENSE', income)}, `
    + `ses opérations ne compteront plus dans vos ${income ? 'revenus' : 'paiements'} récurrents.`
})

/** Why it carries this type, when one of the investment accounts explains it. */
const contribution = computed(() => {
  const tx = props.tx
  if (!tx?.contribution) return null
  const format = (value: number) => maskValue(formatCurrency(value, tx.currency))
  // The row says it with a badge; here the type needs its reason spelled out.
  return contributionNote(
    tx.contribution, Number(tx.amount), format, formatDateShort(tx.contribution.day), tx.type_source === 'contribution',
  )
    ?? `${tx.contribution.is_deposit ? 'Versé sur' : 'Retiré de'} ${tx.contribution.account_name} le même jour.`
})

watch(
  () => [props.open, props.tx?.id] as const,
  () => {
    error.value = null
    clearing.value = false
    byLabel.value = hasLabel.value
    // Which kind of rule types it is only known from the list of rules.
    if (props.open && props.tx?.type_source === 'rule' && !types.rules) types.fetchRules().catch(() => {})
  },
  { immediate: true },
)

function signed(tx: BankTransactionItem): string {
  const value = Number(tx.amount)
  return maskValue(formatCurrency(tx.is_credit ? value : -value, tx.currency))
}

async function choose(type: CashflowType): Promise<void> {
  const tx = props.tx
  if (!tx) return
  const scope = byLabel.value ? 'label' : 'operation'
  const outranked = writtenRule.value ? ruleTitle(writtenRule.value) : null
  // The list shows the type at once: the modal has nothing left to wait for.
  emit('close')
  try {
    const result = await bank.answering(
      retypeEffect(tx, type, scope, props.neighbours), () => types.setType(tx.id, type, scope),
    )
    emit('saved', result, outranked)
  } catch (e) {
    emit('failed', e instanceof Error ? e.message : "Impossible d'enregistrer ce type.")
  }
}

async function backToDetected(): Promise<void> {
  const tx = props.tx
  if (!tx) return
  clearing.value = true
  error.value = null
  try {
    if (tx.type_source === 'override') await types.clearOverride(tx.id)
    else if (tx.type_rule_id) await types.deleteRule(tx.type_rule_id)
    emit('cleared')
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Impossible de revenir au type détecté.'
  } finally {
    clearing.value = false
  }
}
</script>

<template>
  <BaseModal :open="open" title="Type de l'opération" @close="emit('close')">
    <div v-if="tx" class="space-y-4">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">
        {{ tx.label ?? 'Opération sans libellé' }} · {{ tx.account_name }} ·
        <span class="font-semibold tabular-nums text-text-main dark:text-text-dark-main">{{ signed(tx) }}</span>
      </p>

      <p v-if="contribution" class="text-sm text-info">{{ contribution }}</p>

      <BaseAlert v-if="error" variant="danger">{{ error }}</BaseAlert>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label="Type">
        <button
          v-for="type in CASHFLOW_TYPES"
          :key="type"
          :autofocus="tx.cashflow_type === type"
          type="button"
          :aria-pressed="tx.cashflow_type === type"
          :disabled="clearing"
          :title="answerHint(type, tx.is_credit)"
          :class="[
            'flex items-center px-3 py-2.5 rounded-button border text-sm font-medium transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60',
            tx.cashflow_type === type
              ? 'border-primary bg-primary/5 text-text-main dark:text-text-dark-main'
              : 'border-surface-border dark:border-surface-dark-border text-text-main dark:text-text-dark-main hover:bg-surface-hover dark:hover:bg-surface-dark-hover',
          ]"
          @click="choose(type)"
        >
          {{ answerLabel(type, tx.is_credit) }}
        </button>
      </div>

      <label
        :class="['flex items-start gap-3 text-sm', hasLabel ? 'text-text-main dark:text-text-dark-main' : 'text-text-muted dark:text-text-dark-muted']"
      >
        <BaseToggle v-model="byLabel" :disabled="!hasLabel" aria-label="Appliquer au libellé" class="mt-0.5" />
        <span v-if="hasLabel">
          Appliquer à toutes les opérations « {{ tx.label }} » de ce compte et aux libellés proches, y compris les prochaines
          <template v-if="tx.flow_question && tx.flow_question.operation_count > 1">
            ({{ tx.flow_question.operation_count }} opérations)
          </template>
        </span>
        <span v-else>Sans libellé, seule cette opération peut être corrigée.</span>
      </label>
      <p v-if="recurringNote" class="text-sm text-text-muted dark:text-text-dark-muted">{{ recurringNote }}</p>
    </div>

    <template v-if="tx && userSet" #footer>
      <p v-if="writtenRule" class="text-sm text-text-muted dark:text-text-dark-muted">
        Comptée par la règle {{ ruleTitle(writtenRule) }} :
        <router-link :to="RULES_PAGE" class="font-medium text-primary hover:underline" @click="emit('close')">la modifier</router-link>
      </p>
      <BaseButton
        v-else variant="ghost" size="sm" :loading="clearing" :disabled="clearing" @click="backToDetected"
      >
        {{ tx.type_source === 'override' ? 'Revenir au type détecté' : 'Retirer la règle de ce libellé' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

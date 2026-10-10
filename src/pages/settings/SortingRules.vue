<script setup lang="ts">
/**
 * The user's sorting rules, their own dictionary: each label they typed with
 * « les prochaines aussi ». A rule types every operation of that label, and of
 * nearby ones, on its account and in its direction, those imported later
 * included (docs/bank-sorting.md in the API).
 */
import { BookMarked } from 'lucide-vue-next'
import { onActivated, ref } from 'vue'

import { BaseAlert, BaseButton, BaseEmptyState, BaseSkeleton } from '@/components'
import { useCashflowTypesStore } from '@/stores/cashflowTypes'
import type { BankTypeRule, CashflowType } from '@/types'
import { CASHFLOW_TYPES, answerLabel } from '@/utils/cashflowTypes'
import SettingsSection from './SettingsSection.vue'

const types = useCashflowTypesStore()

const failed = ref(false)
const busy = ref<string | null>(null)
const removing = ref<string | null>(null)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  failed.value = false
  try {
    await types.fetchRules()
  } catch {
    failed.value = true
  }
}

// Kept alive with the settings page, and fired on the first mount too: read
// again each time the tab shows, a rule may have been made in « À trier » since.
onActivated(load)

async function retype(rule: BankTypeRule, type: CashflowType): Promise<void> {
  if (type === rule.type) return
  busy.value = rule.id
  error.value = null
  try {
    await types.retypeRule(rule.id, type)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Impossible de changer le type de cette règle.'
  } finally {
    busy.value = null
  }
}

async function remove(rule: BankTypeRule): Promise<void> {
  busy.value = rule.id
  removing.value = rule.id
  error.value = null
  try {
    await types.deleteRule(rule.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Impossible de supprimer cette règle.'
  } finally {
    busy.value = null
    removing.value = null
  }
}

function details(rule: BankTypeRule): string {
  const count = rule.operation_count
  const reach = count ? `${count} opération${count > 1 ? 's' : ''}` : 'aucune opération pour le moment'
  return `${rule.account_name} · ${rule.is_credit ? 'Entrées' : 'Sorties'} · ${reach}`
}
</script>

<template>
  <SettingsSection
    id="regles-de-tri"
    :icon="BookMarked"
    title="Règles de tri"
    subtitle="Les libellés pour lesquels vous avez coché « les prochaines aussi ». Chaque règle compte toutes les opérations de ce libellé, et celles importées plus tard."
  >
    <BaseAlert v-if="error" variant="danger" dismissible class="mb-3" @dismiss="error = null">{{ error }}</BaseAlert>

    <div v-if="failed" class="flex items-center justify-between gap-3">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">Impossible de charger les règles.</p>
      <BaseButton size="sm" variant="outline" @click="load">Réessayer</BaseButton>
    </div>
    <div v-else-if="!types.rules" class="space-y-2">
      <BaseSkeleton v-for="i in 3" :key="i" variant="rect" width="100%" height="3.25rem" />
    </div>
    <BaseEmptyState
      v-else-if="!types.rules.length"
      title="Aucune règle"
      description="En répondant dans « À trier », cochez « les prochaines aussi » : le libellé et son type s'ajoutent ici."
    />
    <ul v-else class="divide-y divide-surface-border dark:divide-surface-dark-border -mx-2">
      <li
        v-for="rule in types.rules"
        :key="rule.id"
        class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-2 py-2.5"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-text-main dark:text-text-dark-main" :title="rule.label ?? rule.signature">
            {{ rule.label ?? rule.signature }}
          </p>
          <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">{{ details(rule) }}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <select
            :value="rule.type"
            :disabled="busy !== null"
            :aria-label="`Type de la règle « ${rule.label ?? rule.signature} »`"
            class="min-w-0 flex-1 sm:flex-none sm:w-44 pl-3 pr-8 py-1.5 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
            @change="retype(rule, ($event.target as HTMLSelectElement).value as CashflowType)"
          >
            <option v-for="type in CASHFLOW_TYPES" :key="type" :value="type">{{ answerLabel(type, rule.is_credit) }}</option>
          </select>
          <BaseButton
            size="sm" variant="outline"
            :loading="removing === rule.id" :disabled="busy !== null"
            @click="remove(rule)"
          >
            Supprimer
          </BaseButton>
        </div>
      </li>
    </ul>
  </SettingsSection>
</template>

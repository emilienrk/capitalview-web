<script setup lang="ts">
/**
 * The real cashflow, next to the declared one: read from the bank operations,
 * a year by default, a completed month on demand.
 */
import { computed, onMounted, watch } from 'vue'
import { Landmark } from 'lucide-vue-next'

import { BaseAlert, BaseButton, BaseEmptyState, BaseSkeleton } from '@/components'
import RealCashflowMonth from '@/components/cashflow/RealCashflowMonth.vue'
import RealCashflowYear from '@/components/cashflow/RealCashflowYear.vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { useRealCashflowView } from '@/composables/useRealCashflowView'
import { useBankStore } from '@/stores/bank'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()
const bank = useBankStore()
const { isDark } = useDarkMode()
const view = useRealCashflowView()
const { store, mode, statistic } = view

const bankEnabled = computed(() => settingsStore.settings?.bank_module_enabled ?? true)
const noOperations = computed(() => store.year !== null && store.year.years_available.length === 0)

onMounted(() => {
  if (!bankEnabled.value) return
  void view.openYear()
  // The banner links to the most recent month still holding a question.
  void bank.fetchTransferQuestions()
})

// A sync, an import or a filing changed the operations the figures come from.
watch(() => bank.dataRevision, () => {
  if (mode.value === 'month' && store.month) void store.fetchMonth(store.month.period, true)
  else void store.fetchYear(view.selectedYear.value, true)
})
</script>

<template>
  <div>
    <BaseEmptyState
      v-if="!bankEnabled || noOperations"
      title="Aucune opération bancaire"
      :description="bankEnabled
        ? 'Le cashflow réel se lit sur vos opérations : synchronisez une banque ou importez un relevé.'
        : 'Le cashflow réel se lit sur vos opérations bancaires : activez le module Banque.'"
    >
      <template #icon>
        <Landmark class="w-8 h-8 text-text-muted dark:text-text-dark-muted" />
      </template>
      <template #action>
        <router-link v-if="bankEnabled" :to="{ name: 'bank-transactions' }">
          <BaseButton variant="outline">Aller à Banque</BaseButton>
        </router-link>
        <router-link v-else :to="{ name: 'settings', query: { tab: 'modules' } }">
          <BaseButton variant="outline">Réglages des modules</BaseButton>
        </router-link>
      </template>
    </BaseEmptyState>

    <template v-else>
      <BaseAlert v-if="store.error" variant="danger" class="mb-6">
        {{ store.error }}
        <BaseButton size="sm" variant="outline" class="ml-3" @click="mode === 'month' && store.month ? store.fetchMonth(store.month.period, true) : store.fetchYear(view.selectedYear.value, true)">
          Réessayer
        </BaseButton>
      </BaseAlert>

      <RealCashflowMonth
        v-if="mode === 'month' && store.month"
        :data="store.month"
        @back="view.backToYear()"
        @previous="view.previousMonth()"
        @next="view.nextMonth()"
      />
      <RealCashflowYear
        v-else-if="mode === 'year' && store.year"
        v-model:statistic="statistic"
        :data="store.year"
        :is-dark="isDark"
        @select-year="view.openYear($event)"
        @select-month="view.openMonth($event)"
      />
      <div v-else-if="!store.error" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BaseSkeleton v-for="i in 4" :key="i" variant="rect" width="100%" height="6rem" />
      </div>
    </template>
  </div>
</template>

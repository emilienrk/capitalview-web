<script setup lang="ts">
import { BarChart3, RefreshCw, Wallet } from 'lucide-vue-next'

import { onMounted, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { BaseCard, BaseButton, BaseInput, BaseAlert, BaseSkeleton, BaseTextarea, BaseToggle } from '@/components'

const settingsStore = useSettingsStore()

const flatTaxRate = ref(30)
const taxPeaRate = ref(17.2)
const yieldExpectation = ref(5)
const inflationRate = ref(2)
const objectives = ref('')
const isSaving = ref(false)
const saveSuccess = ref(false)
const isSavingObjectives = ref(false)
const saveObjectivesSuccess = ref(false)
const bankAutoSync = ref(true)

onMounted(() => {
  if (settingsStore.settings) {
    flatTaxRate.value = +(settingsStore.settings.flat_tax_rate * 100).toFixed(2)
    taxPeaRate.value = +(settingsStore.settings.tax_pea_rate * 100).toFixed(2)
    yieldExpectation.value = +(settingsStore.settings.yield_expectation * 100).toFixed(2)
    inflationRate.value = +(settingsStore.settings.inflation_rate * 100).toFixed(2)
    objectives.value = settingsStore.settings.objectives ?? ''
    bankAutoSync.value = settingsStore.settings.bank_auto_sync_enabled
  }
})

async function saveBankAutoSync(value: boolean): Promise<void> {
  bankAutoSync.value = value
  await settingsStore.updateSettings({ bank_auto_sync_enabled: value })
}

async function saveFinancialSettings(): Promise<void> {
  isSaving.value = true
  saveSuccess.value = false
  const success = await settingsStore.updateSettings({
    flat_tax_rate: flatTaxRate.value / 100,
    tax_pea_rate: taxPeaRate.value / 100,
    yield_expectation: yieldExpectation.value / 100,
    inflation_rate: inflationRate.value / 100,
  })
  isSaving.value = false
  if (success) {
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 2000)
  }
}

async function saveObjectives(): Promise<void> {
  isSavingObjectives.value = true
  saveObjectivesSuccess.value = false
  const success = await settingsStore.updateSettings({
    objectives: objectives.value || null,
  })
  isSavingObjectives.value = false
  if (success) {
    saveObjectivesSuccess.value = true
    setTimeout(() => { saveObjectivesSuccess.value = false }, 2000)
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Financial Parameters -->
    <BaseCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
            <Wallet class="w-4 h-4 text-primary" stroke-width="2" />
          </div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Paramètres financiers</h3>
        </div>
      </template>
      <template v-if="settingsStore.isLoading && !settingsStore.settings">
        <div class="space-y-4">
          <div v-for="i in 4" :key="i" class="space-y-2">
            <BaseSkeleton variant="rect" width="30%" height="0.75rem" />
            <BaseSkeleton variant="rect" height="2.5rem" />
          </div>
        </div>
      </template>
      <template v-else>
        <p class="text-sm text-text-muted dark:text-text-dark-muted mb-4">
          Ces taux sont utilisés pour les projections et calculs de fiscalité.
        </p>
        <form @submit.prevent="saveFinancialSettings" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BaseInput v-model="flatTaxRate" label="Flat Tax / PFU (%)" type="number" step="0.1" min="0" max="100" placeholder="30" />
            <BaseInput v-model="taxPeaRate" label="Prélèvements sociaux PEA (%)" type="number" step="0.1" min="0" max="100" placeholder="17.2" />
            <BaseInput v-model="yieldExpectation" label="Rendement attendu (%)" type="number" step="0.1" min="0" max="100" placeholder="5" />
            <BaseInput v-model="inflationRate" label="Taux d'inflation (%)" type="number" step="0.1" min="0" max="100" placeholder="2" />
          </div>
          <div class="flex items-center justify-end gap-4">
            <BaseAlert v-if="saveSuccess" variant="success" class="flex-1 py-1.5!">
              Paramètres financiers sauvegardés.
            </BaseAlert>
            <BaseButton type="submit" :loading="isSaving" size="sm">
              Enregistrer
            </BaseButton>
          </div>
        </form>
      </template>
    </BaseCard>

    <!-- Bank sync -->
    <BaseCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
            <RefreshCw class="w-4 h-4 text-primary" stroke-width="2" />
          </div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Synchronisation bancaire</h3>
        </div>
      </template>
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="font-medium text-text-main dark:text-text-dark-main">Appliquer les flux aux soldes bancaires</p>
          <p class="text-sm text-text-muted dark:text-text-dark-muted">
            Chaque revenu ou dépense lié à un compte ajuste automatiquement son solde à échéance.
            Désactivé, les soldes ne bougent plus et les échéances passées ne sont pas rattrapées.
          </p>
        </div>
        <BaseToggle
          :model-value="bankAutoSync"
          aria-label="Appliquer les flux aux soldes bancaires"
          @update:model-value="saveBankAutoSync"
        />
      </div>
    </BaseCard>

    <!-- Objectives -->
    <BaseCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
            <BarChart3 class="w-4 h-4 text-primary" stroke-width="2" />
          </div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Objectifs patrimoniaux</h3>
        </div>
      </template>
      <template v-if="settingsStore.isLoading && !settingsStore.settings">
        <div class="space-y-2">
          <BaseSkeleton variant="rect" height="5rem" />
        </div>
      </template>
      <template v-else>
        <p class="text-sm text-text-muted dark:text-text-dark-muted mb-4">
          Notez vos objectifs d'investissement et d'épargne.
        </p>
        <form @submit.prevent="saveObjectives" class="space-y-4">
          <BaseTextarea v-model="objectives" :rows="4" placeholder="Vos objectifs d'épargne et d'investissement..." />
          <div class="flex items-center justify-end gap-4">
            <BaseAlert v-if="saveObjectivesSuccess" variant="success" class="flex-1 py-1.5!">
              Objectifs sauvegardés.
            </BaseAlert>
            <BaseButton type="submit" :loading="isSavingObjectives" size="sm">
              Enregistrer
            </BaseButton>
          </div>
        </form>
      </template>
    </BaseCard>
  </div>
</template>

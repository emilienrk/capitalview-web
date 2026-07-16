<script setup lang="ts">
import { Pencil, RefreshCw, Upload } from 'lucide-vue-next'

import { onMounted, ref, reactive, computed } from 'vue'
import { useBankStore } from '@/stores/bank'
import { useHistoryGranularity } from '@/composables/useHistoryGranularity'
import { useConfirm } from '@/composables/useConfirm'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useDarkMode } from '@/composables/useDarkMode'
import PageHeader from '@/components/PageHeader.vue'
import {
  BaseCard, BaseButton, BaseAddButton, BaseInput, BaseSelect, BaseModal,
  BaseAlert, BaseEmptyState, BaseBadge, BaseSkeleton, BaseSegmentedControl,
  ChartPerformanceBadge,
} from '@/components'
import BankHistoryImportModal from '@/components/imports/BankHistoryImportModal.vue'
import PlatformImportModal from '@/components/imports/PlatformImportModal.vue'
import HistoryLineChart from '@/components/charts/HistoryLineChart.vue'
import type { BankAccountCreate, BankAccountType } from '@/types'

const bank = useBankStore()
const { formatCurrency, formatDate, formatAccountType } = useFormatters()
const { privacyMode, togglePrivacyMode, maskValue } = usePrivacyMode()
const { isDark } = useDarkMode()
const { confirmDialog } = useConfirm()

const showCreateModal = ref(false)
const showHistoryImportModal = ref(false)
const showPlatformImportModal = ref(false)
const platformImportAccountId = ref('')
const editingId = ref<string | null>(null)
const hasFetchedOnce = ref(false)

const {
  granularity: historyGranularity,
  granularityOptions,
  applyGranularity,
} = useHistoryGranularity(() => bank.history ?? [])

const form = reactive<BankAccountCreate>({
  name: '',
  account_type: 'CHECKING' as BankAccountType,
  institution_name: '',
  identifier: '',
  balance: 0,
  opened_at: null,
})

const accountTypeOptions = computed(() => {
  const existingTypes = new Set(bank.summary?.accounts?.map(a => a.account_type) || [])
  
  // Regulated accounts that should be unique per person
  const uniqueTypes = new Set(['LIVRET_A', 'LIVRET_DEVE', 'LEP', 'LDD', 'PEL', 'CEL'])

  return [
    { label: 'Compte courant', value: 'CHECKING' },
    { label: 'Épargne', value: 'SAVINGS' },
    { label: 'Livret A', value: 'LIVRET_A', disabled: existingTypes.has('LIVRET_A') },
    { label: 'LDDS', value: 'LIVRET_DEVE', disabled: existingTypes.has('LIVRET_DEVE') },
    { label: 'LEP', value: 'LEP', disabled: existingTypes.has('LEP') },
    { label: 'LDD', value: 'LDD', disabled: existingTypes.has('LDD') },
    { label: 'PEL', value: 'PEL', disabled: existingTypes.has('PEL') },
    { label: 'CEL', value: 'CEL', disabled: existingTypes.has('CEL') },
  ]
})

const chartSeries = computed(() => {
  const totalHistory = applyGranularity(bank.history)
  const accountSeries = (bank.summary?.accounts ?? [])
    .map((account) => ({
      name: account.name,
      history: applyGranularity(bank.accountHistoryById[account.id] ?? []),
    }))
    .filter((series) => series.history.length > 0)

  const series = [{ name: 'Solde total', history: totalHistory }, ...accountSeries]
  return series.filter((line) => line.history.length > 0)
})

async function loadChartHistories(force = false): Promise<void> {
  await bank.fetchHistory(force)
  const accounts = bank.summary?.accounts ?? []
  await Promise.all(accounts.map((account) => bank.fetchHistoryForAccount(account.id, force)))
}

async function handleHistoryImported(): Promise<void> {
  showHistoryImportModal.value = false
  await loadChartHistories(true)
}

async function handlePlatformImported(): Promise<void> {
  showPlatformImportModal.value = false
  await bank.fetchAccounts()
  await loadChartHistories(true)
}

function openCreate(): void {
  editingId.value = null
  form.name = ''
  form.account_type = 'CHECKING'
  form.institution_name = ''
  form.identifier = ''
  form.balance = 0
  form.opened_at = null
  showCreateModal.value = true
}

function openEdit(account: { id: string; name: string; account_type: BankAccountType; institution_name: string | null; identifier: string | null; balance: number; opened_at: string | null }): void {
  editingId.value = account.id
  form.name = account.name
  form.account_type = account.account_type
  form.institution_name = account.institution_name ?? ''
  form.identifier = account.identifier ?? ''
  form.balance = account.balance
  form.opened_at = account.opened_at ?? null
  showCreateModal.value = true
}

async function handleSubmit(): Promise<void> {
  showCreateModal.value = false
  let result
  if (editingId.value) {
    result = await bank.updateAccount(editingId.value, { ...form })
  } else {
    result = await bank.createAccount({ ...form })
  }
  if (!result) {
    showCreateModal.value = true
    return
  }
  await loadChartHistories(true)
}

async function handleDelete(id: string): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Supprimer le compte',
    message: 'Supprimer ce compte bancaire ? Cette action est définitive.',
    confirmLabel: 'Supprimer',
  })
  if (confirmed) {
    showCreateModal.value = false
    const success = await bank.deleteAccount(id)
    if (!success) {
      showCreateModal.value = true
      return
    }
    await loadChartHistories(true)
  }
}

onMounted(async () => {
  await bank.fetchAccounts()
  await loadChartHistories()
  hasFetchedOnce.value = true
})

const chartPerformance = ref<{ diff: number; percent: number } | null>(null)
</script>

<template>
  <div>
    <PageHeader title="Comptes Bancaires" description="Gérez vos comptes courants et d'épargne">
      <template #actions>
        <BaseButton variant="outline" @click="showHistoryImportModal = true" :disabled="!bank.summary?.accounts?.length">
          <Upload class="w-4 h-4" /><span class="hidden sm:inline">&nbsp; Importer</span>
        </BaseButton>
        <BaseButton variant="outline" @click="showPlatformImportModal = true" :disabled="!bank.summary?.accounts?.length">
          <Upload class="w-4 h-4" /><span class="hidden sm:inline">&nbsp; Relevé</span>
        </BaseButton>
        <BaseAddButton @click="openCreate">Nouveau compte</BaseAddButton>
      </template>
    </PageHeader>

    <!-- Error -->
    <BaseAlert v-if="bank.error" variant="danger" dismissible @dismiss="bank.error = null" class="mb-6">
      {{ bank.error }}
    </BaseAlert>

    <!-- Total balance -->
    <div v-if="bank.summary" class="mb-6 p-4 rounded-card bg-primary/5 border border-primary/10">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">Solde total</p>
      <p class="text-3xl font-bold text-text-main dark:text-text-dark-main">
        {{ maskValue(formatCurrency(bank.summary.total_balance)) }}
      </p>
    </div>

    <!-- Bank History Chart -->
    <BaseCard v-if="bank.summary?.accounts?.length" class="mb-6">
      <template #header>
        <div class="flex items-start sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Évolution du solde</h3>
            <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">Historique de tous les comptes bancaires</p>
          </div>
          <ChartPerformanceBadge :performance="chartPerformance" />
        </div>
      </template>
      <div v-if="bank.historyLoading" class="h-72 flex items-center justify-center">
        <BaseSkeleton variant="rect" width="100%" height="18rem" />
      </div>
      <BaseAlert v-else-if="bank.error" variant="danger" class="mb-4">
        {{ bank.error }}
      </BaseAlert>
      <template v-else-if="chartSeries.length > 0">
        <HistoryLineChart
          :series="chartSeries"
          :is-dark="isDark"
          :granularity="historyGranularity"
          show-performance
          @update:performance="chartPerformance = $event"
        >
          <template #leading>
            <BaseButton icon size="sm" variant="outline" @click="loadChartHistories(true)">
              <RefreshCw class="w-4 h-4" />
            </BaseButton>
            <BaseSegmentedControl v-model="historyGranularity" :options="granularityOptions" variant="primary" size="sm" />
          </template>
        </HistoryLineChart>
      </template>
      <BaseEmptyState
        v-else
        title="Pas encore de données historiques"
        description="L'historique s'affichera après avoir importé ou créé des entrées de solde"
      />
    </BaseCard>

    <!-- Account list -->
    <div v-if="bank.summary?.accounts?.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <BaseCard
        v-for="account in bank.summary.accounts"
        :key="account.id"
        hoverable
      >
        <div class="flex items-start justify-between">
          <div>
            <h3 class="font-semibold text-text-main dark:text-text-dark-main">{{ account.name }}</h3>
            <div class="flex items-center gap-2 mt-1">
              <BaseBadge variant="secondary">{{ formatAccountType(account.account_type) }}</BaseBadge>
              <span v-if="account.institution_name" class="text-xs text-text-muted dark:text-text-dark-muted">{{ account.institution_name }}</span>
            </div>
          </div>
          <p class="text-xl font-bold text-text-main dark:text-text-dark-main">
            {{ maskValue(formatCurrency(account.balance)) }}
          </p>
        </div>
        <div class="mt-4 flex items-center justify-between">
          <div class="flex flex-col gap-0.5">
            <p v-if="!account.balance_updated_at" class="text-xs text-text-muted dark:text-text-dark-muted">Mis à jour {{ formatDate(account.updated_at) }}</p>
            <p v-if="account.balance_updated_at" class="flex items-center gap-1 text-xs text-success">
              <RefreshCw class="w-3 h-3" />
              Sync le {{ formatDate(account.balance_updated_at) }}
            </p>
          </div>
          <div class="flex gap-2">
            <BaseButton size="sm" variant="ghost" @click="openEdit(account)">
              <Pencil class="w-4 h-4" />
            </BaseButton>
          </div>
        </div>
      </BaseCard>
    </div>

    <BaseEmptyState
      v-else-if="hasFetchedOnce && !bank.isLoading"
      title="Aucun compte"
      description="Ajoutez votre premier compte bancaire pour commencer le suivi"
      action-label="Ajouter un compte"
      @action="openCreate"
    />

    <!-- History Import Modal -->
    <BankHistoryImportModal
      v-if="bank.summary?.accounts?.length"
      :open="showHistoryImportModal"
      :accounts="bank.summary.accounts"
      @close="showHistoryImportModal = false"
      @imported="handleHistoryImported"
    />

    <!-- Platform Import Modal (unified, multi-source) -->
    <PlatformImportModal
      v-if="bank.summary?.accounts?.length"
      :open="showPlatformImportModal"
      category="bank"
      :accounts="bank.summary.accounts"
      v-model:accountId="platformImportAccountId"
      @close="showPlatformImportModal = false"
      @imported="handlePlatformImported"
    />

    <!-- Create/Edit Modal -->
    <BaseModal :open="showCreateModal" :title="editingId ? 'Modifier le compte' : 'Nouveau compte'" @close="showCreateModal = false">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <BaseInput v-model="form.name" label="Nom du compte" placeholder="Nom du compte" required />
        <BaseSelect v-model="form.account_type" label="Type de compte" :options="accountTypeOptions" required />
        <BaseInput v-model="form.institution_name!" label="Banque" placeholder="Nom de la banque" />
        <BaseInput v-model="form.identifier!" label="Identifiant" placeholder="IBAN" />
        <BaseInput v-model="form.balance!" label="Solde" type="number" placeholder="0.00" />
        <BaseInput v-model="form.opened_at!" label="Date d'ouverture" type="date" />
      </form>
      <template #footer>
        <div class="flex justify-between w-full">
          <BaseButton v-if="editingId" variant="danger" @click="handleDelete(editingId)">
            Supprimer
          </BaseButton>
          <div v-else></div> <!-- Spacer -->
          <div class="flex gap-2">
            <BaseButton variant="ghost" @click="showCreateModal = false">Annuler</BaseButton>
            <BaseButton :loading="bank.isLoading" @click="handleSubmit">
              {{ editingId ? 'Enregistrer' : 'Créer' }}
            </BaseButton>
          </div>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
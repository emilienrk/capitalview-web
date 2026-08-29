<script setup lang="ts">
import { FileSpreadsheet, Landmark, Pencil, RefreshCw, TriangleAlert, Upload } from 'lucide-vue-next'

import { nextTick, onMounted, ref, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBankStore } from '@/stores/bank'
import { BASE_CURRENCY, currencyOptions, loadSupportedCurrencies } from '@/utils/currencies'
import { useSettingsStore } from '@/stores/settings'
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
import ImportMenu, { type ImportMenuItem } from '@/components/imports/ImportMenu.vue'
import PlatformImportModal from '@/components/imports/PlatformImportModal.vue'
import HistoryLineChart from '@/components/charts/HistoryLineChart.vue'
import type { BankAccountCreate, BankAccountType } from '@/types'

const bank = useBankStore()
const router = useRouter()
const settingsStore = useSettingsStore()
const { formatCurrency, formatDate, formatAccountType } = useFormatters()
const { privacyMode, togglePrivacyMode, maskValue } = usePrivacyMode()
const { isDark } = useDarkMode()
const { confirmDialog } = useConfirm()

const showCreateModal = ref(false)
const showPlatformImportModal = ref(false)
const platformImportAccountId = ref('')
const importSourceId = ref('')
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
  currency: BASE_CURRENCY,
  opened_at: null,
})

// Served by the API so the list lives in one place; the static fallback in
// @/utils/currencies keeps the picker populated if the call fails.
const currencyChoices = computed(() => currencyOptions())

// A Livret A or a PEL cannot be held in anything but euros.
const REGULATED_TYPES = new Set(['LIVRET_A', 'LIVRET_DEVE', 'LEP', 'LDD', 'PEL', 'CEL'])
const isRegulated = computed(() => REGULATED_TYPES.has(form.account_type))
watch(isRegulated, (regulated) => {
  if (regulated) form.currency = BASE_CURRENCY
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

const IMPORT_MENU_ITEMS: ImportMenuItem[] = [
  { key: 'native_bank', label: 'Format CapitalView', icon: FileSpreadsheet },
  { key: 'generic_bank', label: 'Relevé bancaire', icon: Upload },
]

function onImportMenuSelect(key: string): void {
  importSourceId.value = key
  showPlatformImportModal.value = true
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
  form.currency = BASE_CURRENCY
  form.opened_at = null
  showCreateModal.value = true
}

function openEdit(account: { id: string; name: string; account_type: BankAccountType; institution_name: string | null; identifier: string | null; balance: number; currency: string; opened_at: string | null }): void {
  editingId.value = account.id
  form.name = account.name
  form.account_type = account.account_type
  form.institution_name = account.institution_name ?? ''
  form.identifier = account.identifier ?? ''
  form.balance = account.balance
  form.currency = account.currency
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

/** Only "à reconnecter" is a documented state; anything else stays neutral. */
function linkStatusVariant(status: string): 'warning' | 'secondary' {
  return /reconnect/i.test(status) ? 'warning' : 'secondary'
}

const openBankingEnabled = computed(
  () => settingsStore.settings?.open_banking_enabled ?? false,
)

async function syncNow(): Promise<void> {
  if (await bank.syncBanking()) await loadChartHistories(true)
}

/**
 * Spec §D1: the synchronisation is fired after the page has rendered, never
 * before. The daily cap is re-checked server-side, so a redundant call is
 * harmless — a blocking one would not be.
 */
async function autoSyncAfterRender(): Promise<void> {
  await nextTick()
  // The layout's own settings fetch may still be in flight when this page
  // mounts, and an unknown opt-in must not be read as "off".
  if (!settingsStore.settings) await settingsStore.fetchSettings()
  if (!openBankingEnabled.value || !bank.hasStaleSync) return
  await syncNow()
}

onMounted(async () => {
  void loadSupportedCurrencies()
  await bank.fetchAccounts()
  hasFetchedOnce.value = true
  // Chart histories load in the background (the chart has a skeleton state)
  void loadChartHistories()
  void autoSyncAfterRender()
})

const chartPerformance = ref<{ diff: number; percent: number | null } | null>(null)
</script>

<template>
  <div>
    <PageHeader title="Comptes Bancaires" description="Gérez vos comptes courants et d'épargne">
      <template #actions>
        <BaseButton
          v-if="openBankingEnabled && bank.linkedAccounts.length"
          variant="outline"
          :loading="bank.isSyncing"
          @click="syncNow"
        >
          <RefreshCw class="w-4 h-4 mr-1.5" />
          Synchroniser
        </BaseButton>
        <!-- Only for someone who already opted in: this page is not where the
             feature gets discovered, the banking settings are. -->
        <BaseButton
          v-else-if="openBankingEnabled"
          variant="outline"
          @click="router.push({ name: 'settings', query: { tab: 'banque' } })"
        >
          <Landmark class="w-4 h-4 mr-1.5" />
          Connecter une banque
        </BaseButton>
        <ImportMenu
          :items="IMPORT_MENU_ITEMS"
          :disabled="!bank.summary?.accounts?.length"
          @select="onImportMenuSelect"
        />
        <BaseAddButton @click="openCreate">Nouveau compte</BaseAddButton>
      </template>
    </PageHeader>

    <!-- Error -->
    <BaseAlert v-if="bank.error" variant="danger" dismissible @dismiss="bank.error = null" class="mb-6">
      {{ bank.error }}
    </BaseAlert>

    <BaseAlert v-if="settingsStore.settings && !settingsStore.settings.bank_auto_sync_enabled" variant="info" class="mb-6">
      Synchronisation automatique désactivée : les flux liés n'ajustent plus les soldes.
    </BaseAlert>

    <!-- Total balance -->
    <div v-if="bank.summary" class="mb-6 p-4 rounded-card bg-primary/5 border border-primary/10">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">Solde total</p>
      <p class="text-3xl font-bold text-text-main dark:text-text-dark-main">
        {{ maskValue(formatCurrency(bank.summary.total_balance)) }}
      </p>
      <!-- No total rather than a wrong one: a currency held has no published rate. -->
      <p v-if="bank.summary.total_balance === null" class="mt-1 text-xs text-warning">
        Total indisponible : le cours d'une de vos devises n'est pas publié.
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
            <div class="flex flex-wrap items-center gap-2 mt-1">
              <BaseBadge variant="secondary">{{ formatAccountType(account.account_type) }}</BaseBadge>
              <!--
                Turning the feature off stops every sync but destroys nothing, so
                the attachment survives. Saying "Banque liée" then reads as live
                when it no longer is — the account is dormant, not connected.
              -->
              <template v-if="account.is_linked">
                <BaseBadge v-if="openBankingEnabled" variant="success">Banque liée</BaseBadge>
                <BaseBadge v-else variant="secondary" title="La connexion bancaire est désactivée dans les paramètres.">
                  Liaison en sommeil
                </BaseBadge>
                <BaseBadge
                  v-if="openBankingEnabled && account.link_status"
                  :variant="linkStatusVariant(account.link_status)"
                >
                  {{ account.link_status }}
                </BaseBadge>
              </template>
              <span v-if="account.institution_name" class="text-xs text-text-muted dark:text-text-dark-muted">{{ account.institution_name }}</span>
            </div>
          </div>
          <p class="text-xl font-bold text-text-main dark:text-text-dark-main">
            {{ maskValue(formatCurrency(account.balance, account.currency)) }}
          </p>
        </div>
        <!-- A gap means a movement is missing or counted twice: a real signal about the user's money. -->
        <!-- Ruling R18: display alert ONLY when reconciliation_status === 'gap' and reconciliation_gap != null -->
        <div
          v-if="account.reconciliation_status === 'gap' && account.reconciliation_gap != null"
          class="mt-3 flex items-start gap-2 p-2 rounded-input bg-warning/10 border border-warning/20 text-warning text-xs"
        >
          <TriangleAlert class="w-4 h-4 shrink-0" />
          <span>
            Écart de réconciliation de {{ maskValue(formatCurrency(account.reconciliation_gap, account.currency)) }} :
            un mouvement manque ou est compté deux fois sur la dernière période.
          </span>
        </div>

        <div class="mt-4 flex items-center justify-between">
          <div class="flex flex-col gap-0.5">
            <template v-if="account.is_linked">
              <!-- Green with a refresh icon reads as "kept up to date"; with the
                   feature off nothing is, so the same date goes neutral. -->
              <p
                v-if="account.last_synced_at && openBankingEnabled"
                class="flex items-center gap-1 text-xs text-success"
              >
                <RefreshCw class="w-3 h-3" />
                Synchronisé le {{ formatDate(account.last_synced_at) }}
              </p>
              <p v-else-if="account.last_synced_at" class="text-xs text-text-muted dark:text-text-dark-muted">
                Dernière synchro le {{ formatDate(account.last_synced_at) }} — connexion désactivée
              </p>
              <p v-else class="text-xs text-text-muted dark:text-text-dark-muted">Jamais synchronisé</p>
            </template>
            <template v-else>
              <p v-if="!account.balance_updated_at" class="text-xs text-text-muted dark:text-text-dark-muted">Mis à jour {{ formatDate(account.updated_at) }}</p>
              <p v-else class="flex items-center gap-1 text-xs text-success">
                <RefreshCw class="w-3 h-3" />
                Sync le {{ formatDate(account.balance_updated_at) }}
              </p>
            </template>
          </div>
          <div class="flex gap-2">
            <BaseButton size="sm" variant="ghost" :aria-label="`Modifier ${account.name}`" @click="openEdit(account)">
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

    <!-- Platform Import Modal (unified, multi-source) -->
    <PlatformImportModal
      v-if="bank.summary?.accounts?.length"
      :open="showPlatformImportModal"
      category="bank"
      :accounts="bank.summary.accounts"
      :initial-source-id="importSourceId"
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
        <div>
          <BaseSelect
            v-model="form.currency!"
            label="Devise"
            :options="currencyChoices"
            :disabled="isRegulated"
          />
          <p class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">
            {{ isRegulated
              ? 'Les livrets réglementés sont en euros.'
              : 'Le solde est affiché dans cette devise ; les totaux et les courbes restent en euros.' }}
          </p>
        </div>
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
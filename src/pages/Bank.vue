<script setup lang="ts">
import { ArrowLeftRight, ChevronLeft, ChevronRight, Landmark, RefreshCw, Upload } from 'lucide-vue-next'

import { nextTick, onMounted, ref, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCarousel } from '@/composables/useCarousel'
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
  BaseAlert, BaseEmptyState, BaseSkeleton, BaseSegmentedControl,
  ChartPerformanceBadge,
} from '@/components'
import ImportMenu, { type ImportMenuItem } from '@/components/imports/ImportMenu.vue'
import PlatformImportModal from '@/components/imports/PlatformImportModal.vue'
import HistoryLineChart from '@/components/charts/HistoryLineChart.vue'
import BankAccountCard from '@/components/bank/BankAccountCard.vue'
import ObservedFlowsCard from '@/components/bank/ObservedFlowsCard.vue'
import type {
  BankAccountCreate, BankAccountResponse, BankAccountType, BankAccountUpdate,
} from '@/types'

const bank = useBankStore()
const router = useRouter()
const settingsStore = useSettingsStore()
const { formatCurrency } = useFormatters()
const { privacyMode, togglePrivacyMode, maskValue } = usePrivacyMode()
const { isDark } = useDarkMode()
const { confirmDialog } = useConfirm()

const showCreateModal = ref(false)
const showPlatformImportModal = ref(false)
const platformImportAccountId = ref('')
const importSourceId = ref('')
const editingId = ref<string | null>(null)
// A linked account's balance is the bank's last reading and its currency is what
// that reading is matched on: the API refuses either being changed by hand.
const editingLinked = ref(false)
const hasFetchedOnce = ref(false)

const {
  granularity: historyGranularity,
  granularityOptions,
  applyGranularity,
} = useHistoryGranularity(() => bank.history ?? [])

// Every field bound, none optional: the inputs always hold a value, and the two
// API payloads are built from it explicitly rather than by spreading it.
interface AccountForm {
  name: string
  account_type: BankAccountType
  institution_name: string
  identifier: string
  balance: number
  currency: string
  /** '' when unset — what a cleared date input holds. */
  opened_at: string
}

const form = reactive<AccountForm>({
  name: '',
  account_type: 'CHECKING',
  institution_name: '',
  identifier: '',
  balance: 0,
  currency: BASE_CURRENCY,
  opened_at: '',
})

// Served by the API so the list lives in one place; the static fallback in
// @/utils/currencies keeps the picker populated if the call fails.
const currencyChoices = computed(() => currencyOptions())

// Regulated savings: held in euros only, and at most one of each per person.
const REGULATED_TYPES = new Set<BankAccountType>(['LIVRET_A', 'LIVRET_DEVE', 'LEP', 'LDD', 'PEL', 'CEL'])
const isRegulated = computed(() => REGULATED_TYPES.has(form.account_type))
watch(isRegulated, (regulated) => {
  if (regulated) form.currency = BASE_CURRENCY
})

const ACCOUNT_TYPE_LABELS: Array<{ label: string; value: BankAccountType }> = [
  { label: 'Compte courant', value: 'CHECKING' },
  { label: 'Épargne', value: 'SAVINGS' },
  { label: 'Livret A', value: 'LIVRET_A' },
  { label: 'LDDS', value: 'LIVRET_DEVE' },
  { label: 'LEP', value: 'LEP' },
  { label: 'LDD', value: 'LDD' },
  { label: 'PEL', value: 'PEL' },
  { label: 'CEL', value: 'CEL' },
]

const accountTypeOptions = computed(() => {
  const existingTypes = new Set(bank.summary?.accounts?.map((a) => a.account_type) ?? [])
  return ACCOUNT_TYPE_LABELS.map((option) => ({
    ...option,
    disabled: REGULATED_TYPES.has(option.value) && existingTypes.has(option.value),
  }))
})

// The total on its own, then the accounts that make it up. Together on one
// chart the total dwarfs each account and nothing is readable; and the total is
// the figure that answers "combien j'ai", so it gets a slide to itself.
type BankChartSlide = 'total' | 'accounts'
const chartSlides: Array<{ key: BankChartSlide; label: string }> = [
  { key: 'total', label: 'Total du cash' },
  { key: 'accounts', label: 'Par compte' },
]
const {
  current: chartSlide,
  currentLabel: chartSlideLabel,
  next: nextChartSlide,
  prev: prevChartSlide,
  swipeHandlers: chartSwipe,
} = useCarousel(chartSlides)

const totalSeries = computed(() => {
  const history = applyGranularity(bank.history)
  return history.length ? [{ name: 'Solde total', history }] : []
})

const accountSeries = computed(() =>
  (bank.summary?.accounts ?? [])
    .map((account) => ({
      name: account.name,
      history: applyGranularity(bank.accountHistoryById[account.id] ?? []),
    }))
    .filter((series) => series.history.length > 0),
)

const chartSeries = computed(() =>
  chartSlide.value === 'total' ? totalSeries.value : accountSeries.value,
)

async function loadChartHistories(force = false): Promise<void> {
  await bank.fetchHistory(force)
  const accounts = bank.summary?.accounts ?? []
  await Promise.all(accounts.map((account) => bank.fetchHistoryForAccount(account.id, force)))
}

// The two kinds are complementary, not alternatives: a Livret A wants both, and
// the choice is about what gets written, not about the file's shape.
const IMPORT_MENU_ITEMS: ImportMenuItem[] = [
  {
    key: 'generic_bank_transactions',
    label: 'Opérations',
    description: 'Historique des mouvements et flux observés',
    icon: ArrowLeftRight,
  },
  {
    key: 'generic_bank',
    label: 'Soldes',
    description: 'Courbe du compte, depuis un relevé ou le modèle CapitalView',
    icon: Upload,
  },
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
  editingLinked.value = false
  editingId.value = null
  form.name = ''
  form.account_type = 'CHECKING'
  form.institution_name = ''
  form.identifier = ''
  form.balance = 0
  form.currency = BASE_CURRENCY
  form.opened_at = ''
  showCreateModal.value = true
}

function openEdit(account: BankAccountResponse): void {
  editingId.value = account.id
  editingLinked.value = account.is_linked
  form.name = account.name
  form.account_type = account.account_type
  form.institution_name = account.institution_name ?? ''
  form.identifier = account.identifier ?? ''
  form.balance = account.balance
  form.currency = account.currency
  form.opened_at = account.opened_at ?? ''
  showCreateModal.value = true
}

async function handleSubmit(): Promise<void> {
  showCreateModal.value = false
  let result
  const common = {
    name: form.name,
    institution_name: form.institution_name,
    identifier: form.identifier,
    opened_at: form.opened_at || null,
  }
  if (editingId.value) {
    // No account_type: the API has no field for it, and the picker is locked
    // while editing. A linked account's balance and currency belong to its bank.
    const update: BankAccountUpdate = editingLinked.value
      ? common
      : { ...common, balance: form.balance, currency: form.currency }
    result = await bank.updateAccount(editingId.value, update)
  } else {
    const create: BankAccountCreate = {
      ...common,
      account_type: form.account_type,
      balance: form.balance,
      currency: form.currency,
    }
    result = await bank.createAccount(create)
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
        <div class="mt-3 flex items-center gap-1 min-w-0">
          <BaseButton icon size="sm" variant="ghost" class="shrink-0" @click="prevChartSlide">
            <ChevronLeft class="w-4 h-4" />
          </BaseButton>
          <p class="text-xs font-medium text-text-main dark:text-text-dark-main truncate">
            {{ chartSlideLabel }}
          </p>
          <BaseButton icon size="sm" variant="ghost" class="shrink-0" @click="nextChartSlide">
            <ChevronRight class="w-4 h-4" />
          </BaseButton>
        </div>
      </template>
      <div v-if="bank.historyLoading" class="h-72 flex items-center justify-center">
        <BaseSkeleton variant="rect" width="100%" height="18rem" />
      </div>
      <BaseAlert v-else-if="bank.error" variant="danger" class="mb-4">
        {{ bank.error }}
      </BaseAlert>
      <template v-else-if="chartSeries.length > 0">
        <div v-on="chartSwipe">
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
        </div>
      </template>
      <BaseEmptyState
        v-else
        title="Pas encore de données historiques"
        description="L'historique s'affichera après avoir importé ou créé des entrées de solde"
      />
    </BaseCard>

    <!--
      What the balance curve above cannot say: where the money went. Placed
      after it because the curve is the headline and this is the explanation.
    -->
    <ObservedFlowsCard v-if="bank.summary?.accounts?.length" />

    <!-- Account list -->
    <div v-if="bank.summary?.accounts?.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <BankAccountCard
        v-for="account in bank.summary.accounts"
        :key="account.id"
        :account="account"
        @edit="openEdit"
        @refreshed="loadChartHistories(true)"
      />
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
        <div>
          <BaseSelect
            v-model="form.account_type"
            label="Type de compte"
            :options="accountTypeOptions"
            :disabled="!!editingId"
            required
          />
          <p v-if="editingId" class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">
            Le type d'un compte est fixé à sa création.
          </p>
        </div>
        <BaseInput v-model="form.institution_name" label="Banque" placeholder="Nom de la banque" />
        <BaseInput v-model="form.identifier" label="Identifiant" placeholder="IBAN" />
        <BaseInput
          v-if="!(editingId && editingLinked)"
          v-model="form.balance"
          label="Solde"
          type="number"
          placeholder="0.00"
        />
        <div>
          <BaseSelect
            v-model="form.currency"
            label="Devise"
            :options="currencyChoices"
            :disabled="isRegulated || (!!editingId && editingLinked)"
          />
          <p class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">
            {{ editingId && editingLinked
              ? 'Compte lié : le solde et la devise viennent de votre banque, à chaque synchronisation.'
              : isRegulated
                ? 'Les livrets réglementés sont en euros.'
                : 'Le solde est affiché dans cette devise ; les totaux et les courbes restent en euros.' }}
          </p>
        </div>
        <BaseInput v-model="form.opened_at" label="Date d'ouverture" type="date" />
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
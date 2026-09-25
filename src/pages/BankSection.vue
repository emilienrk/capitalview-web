<script setup lang="ts">
/**
 * The Banque section's shell: one header, the tabs, and what every tab needs —
 * the bank sync, the imports and the account form. Rendered once, so switching
 * between Comptes and Opérations swaps the content without redrawing the header
 * or losing its actions.
 */
import { ArrowLeftRight, FileJson, Landmark, RefreshCw, Upload } from 'lucide-vue-next'
import { computed, nextTick, onMounted, provide, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useBankStore } from '@/stores/bank'
import { useSettingsStore } from '@/stores/settings'
import { loadSupportedCurrencies } from '@/utils/currencies'
import { BANK_SECTION_KEY } from '@/composables/useBankSection'
import PageHeader from '@/components/PageHeader.vue'
import BankTabs from '@/components/bank/BankTabs.vue'
import BankAccountFormModal from '@/components/bank/BankAccountFormModal.vue'
import ImportMenu, { type ImportMenuItem } from '@/components/imports/ImportMenu.vue'
import PlatformImportModal from '@/components/imports/PlatformImportModal.vue'
import BankingExportImportModal from '@/components/banking/BankingExportImportModal.vue'
import { BaseAddButton, BaseAlert, BaseButton } from '@/components'

const bank = useBankStore()
const router = useRouter()
const settingsStore = useSettingsStore()

const accountForm = ref<InstanceType<typeof BankAccountFormModal> | null>(null)

provide(BANK_SECTION_KEY, {
  openCreateAccount: () => accountForm.value?.openCreate(),
  openEditAccount: (account) => accountForm.value?.openEdit(account),
})

const showPlatformImportModal = ref(false)
const showExportImportModal = ref(false)
const platformImportAccountId = ref('')
const importSourceId = ref('')

const BANKING_EXPORT_KEY = 'enablebanking_export'

// The two CSV kinds are complementary, not alternatives: a Livret A wants both,
// and the choice is about what gets written, not about the file's shape.
const CSV_IMPORT_ITEMS: ImportMenuItem[] = [
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

const openBankingEnabled = computed(
  () => settingsStore.settings?.open_banking_enabled ?? false,
)

// The export only feeds attached accounts: offered once there is one.
const importMenuItems = computed<ImportMenuItem[]>(() =>
  openBankingEnabled.value && bank.linkedAccounts.length
    ? [
        ...CSV_IMPORT_ITEMS,
        {
          key: BANKING_EXPORT_KEY,
          label: 'Export Enable Banking',
          description: 'Opérations et soldes des comptes synchronisés, en JSON',
          icon: FileJson,
        },
      ]
    : CSV_IMPORT_ITEMS,
)

function onImportMenuSelect(key: string): void {
  if (key === BANKING_EXPORT_KEY) {
    showExportImportModal.value = true
    return
  }
  importSourceId.value = key
  showPlatformImportModal.value = true
}

async function handlePlatformImported(): Promise<void> {
  showPlatformImportModal.value = false
  await bank.fetchAccounts()
  // The import wrote movements or balances behind the store's back.
  bank.invalidateHistoryCache()
}

async function syncNow(): Promise<void> {
  await bank.syncBanking()
}

/**
 * The synchronisation is fired after the page has rendered, never
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
  void autoSyncAfterRender()
})
</script>

<template>
  <div>
    <PageHeader title="Banque">
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
          :items="importMenuItems"
          :disabled="!bank.summary?.accounts?.length"
          @select="onImportMenuSelect"
        />
        <BaseAddButton @click="accountForm?.openCreate()">Nouveau compte</BaseAddButton>
      </template>
    </PageHeader>

    <BankTabs />

    <BaseAlert v-if="bank.error" variant="danger" dismissible @dismiss="bank.error = null" class="mb-6">
      {{ bank.error }}
    </BaseAlert>

    <router-view />

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

    <BankingExportImportModal :open="showExportImportModal" @close="showExportImportModal = false" />

    <BankAccountFormModal ref="accountForm" />
  </div>
</template>

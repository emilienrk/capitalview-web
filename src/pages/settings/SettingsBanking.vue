<script setup lang="ts">
import { Check, Copy, FileKey, FileJson, KeyRound, Landmark, Link2, ListOrdered, Plug, Stethoscope, Trash2, Unplug } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useBankStore } from '@/stores/bank'
import { useConfirm } from '@/composables/useConfirm'
import { BaseAlert, BaseBadge, BaseButton, BaseInput, BaseSkeleton, BaseToggle } from '@/components'
import type { BankExportImportResponse, BankSessionSummary } from '@/types'
import { useFormatters } from '@/composables/useFormatters'
import type { AlertVariant } from '@/components/base/BaseAlert.vue'
import BankLinkModal from '@/components/banking/BankLinkModal.vue'
import SettingsSection from './SettingsSection.vue'

const settingsStore = useSettingsStore()
const bank = useBankStore()
const route = useRoute()
const router = useRouter()
const { confirmDialog } = useConfirm()
const { formatDate } = useFormatters()

const isLoading = ref(true)
const isSaving = ref(false)
const isChecking = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const applicationId = ref('')
// Key material stays here until it is sent, and is never rendered back: the API
// only ever answers with a presence boolean.
const privateKey = ref<string | null>(null)
const privateKeyFileName = ref<string | null>(null)
const isDraggingKey = ref(false)

/**
 * The whole screen hangs off this opt-in. `/banking/check` reaches Enable
 * Banking on every call, so nothing below may load before it is on.
 */
const isEnabled = computed(() => settingsStore.settings?.open_banking_enabled ?? false)
const isTogglingFeature = ref(false)
const sessions = computed(() => settingsStore.bankingSessions ?? [])

const status = computed(() => settingsStore.bankingStatus)
const check = computed(() => settingsStore.bankingCheck)
const hasCredentials = computed(() => status.value?.has_credentials ?? false)
const canSave = computed(() =>
  applicationId.value.trim().length > 0 && (privateKey.value !== null || hasCredentials.value),
)

interface Diagnosis {
  variant: AlertVariant
  title: string
  detail: string
}

/** One message per cause, in the order the user has to fix them. */
const diagnosis = computed<Diagnosis | null>(() => {
  const c = check.value
  if (!c) return null
  if (!c.configured) {
    return {
      variant: 'info',
      title: 'Aucun identifiant enregistré.',
      detail: 'Déposez votre identifiant d\'application et votre clé privée ci-dessus.',
    }
  }
  if (!c.key_valid) {
    return {
      variant: 'danger',
      title: 'Clé privée refusée par Enable Banking.',
      detail: c.error
        ?? 'Vérifiez que le fichier déposé est bien la clé privée générée pour cette application, et que l\'identifiant d\'application correspond.',
    }
  }
  if (!c.application_active) {
    return {
      variant: 'warning',
      title: 'Application inactive.',
      detail: 'Dans le portail Enable Banking, ouvrez votre application et utilisez « Activate by linking accounts » pour y lier un de vos comptes. Tant qu\'elle est inactive, aucune donnée bancaire n\'est accessible.',
    }
  }
  if (!c.callback_url_declared) {
    return {
      variant: 'warning',
      title: 'URL de redirection non déclarée.',
      detail: 'Ajoutez l\'URL ci-dessous aux « redirect URLs » de votre application, à l\'identique et sans paramètre de requête.',
    }
  }
  return {
    variant: 'success',
    title: 'Configuration valide.',
    detail: 'Clé acceptée, application active, URL de redirection déclarée. Vous pouvez connecter une banque.',
  }
})

const callbackUrl = computed(() => check.value?.callback_url ?? '')
const callbackCopied = ref(false)

async function copyCallbackUrl(): Promise<void> {
  try {
    await navigator.clipboard.writeText(callbackUrl.value)
    callbackCopied.value = true
    setTimeout(() => { callbackCopied.value = false }, 2000)
  } catch {
    // clipboard unavailable — the field is selectable, the user can still copy manually
  }
}

/** Any PEM armor used to pass, so the public half of the pair sailed through and
 *  only surfaced later as a misleading "clé refusée" diagnostic. */
const PRIVATE_KEY_ARMOR = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/

/** A rejected drop must not leave the previous file looking accepted. */
function rejectKeyFile(message: string): void {
  error.value = message
  privateKey.value = null
  privateKeyFileName.value = null
}

function readKeyFile(file: File): void {
  error.value = null
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    if (!text || !PRIVATE_KEY_ARMOR.test(text)) {
      rejectKeyFile(
        text?.includes('-----BEGIN')
          ? 'Ce fichier est bien au format PEM, mais ce n\'est pas une clé privée. Déposez le fichier téléchargé à la création de l\'application.'
          : 'Ce fichier ne ressemble pas à une clé privée au format PEM.',
      )
      return
    }
    privateKey.value = text
    privateKeyFileName.value = file.name
  }
  reader.onerror = () => rejectKeyFile('Erreur de lecture du fichier.')
  reader.readAsText(file)
}

function onKeyFileSelect(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) readKeyFile(file)
  // Cleared so re-picking the same file after a rejected read still fires `change`.
  input.value = ''
}

function onKeyDrop(event: DragEvent): void {
  event.preventDefault()
  isDraggingKey.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) readKeyFile(file)
}

async function save(): Promise<void> {
  isSaving.value = true
  error.value = null
  success.value = null
  try {
    // An absent field means "unchanged": the key is only sent when a new file was dropped.
    await settingsStore.updateBankingCredentials({
      application_id: applicationId.value.trim(),
      ...(privateKey.value !== null ? { private_key: privateKey.value } : {}),
    })
    privateKey.value = null
    privateKeyFileName.value = null
    success.value = 'Identifiants enregistrés.'
    await runCheck()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde.'
  } finally {
    isSaving.value = false
  }
}

async function clearCredentials(): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Supprimer les identifiants',
    message: 'Supprimer votre identifiant d\'application et votre clé privée Enable Banking ? Les connexions bancaires existantes ne pourront plus être synchronisées.',
    confirmLabel: 'Supprimer',
  })
  if (!confirmed) return

  isSaving.value = true
  error.value = null
  success.value = null
  try {
    await settingsStore.updateBankingCredentials({ application_id: '', private_key: '' })
    applicationId.value = ''
    privateKey.value = null
    privateKeyFileName.value = null
    success.value = 'Identifiants supprimés.'
    await runCheck()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur lors de la suppression.'
  } finally {
    isSaving.value = false
  }
}

async function runCheck(): Promise<void> {
  isChecking.value = true
  try {
    await settingsStore.fetchBankingCheck()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Diagnostic impossible.'
  } finally {
    isChecking.value = false
  }
}

// --- Linking journey ---
const showLinkModal = ref(false)
const bankSessionUuid = ref<string | null>(null)
const isReady = computed(() => {
  const c = check.value
  return Boolean(c?.configured && c.key_valid && c.application_active && c.callback_url_declared)
})

async function openLinkModal(): Promise<void> {
  // Starting a new journey over a pending session would strand its accounts.
  if (bankSessionUuid.value) {
    const confirmed = await confirmDialog({
      title: 'Autorisation en attente',
      message: 'Une autorisation bancaire attend encore son rattachement. En démarrer une nouvelle l\'abandonne, et y revenir demandera une nouvelle authentification auprès de votre banque.',
      confirmLabel: 'Démarrer quand même',
      cancelLabel: 'Reprendre celle en attente',
    })
    if (!confirmed) {
      resumeLinkModal()
      return
    }
    discardLinkSession()
  }
  showLinkModal.value = true
}

/** Reopens the pending session on its attachment step. */
function resumeLinkModal(): void {
  showLinkModal.value = true
}

/**
 * Plain dismissal — the session stays in the URL so a reload, or the "Reprendre"
 * button, still finds it. Losing it would cost a new strong authentication.
 */
function dismissLinkModal(): void {
  showLinkModal.value = false
}

// --- Historical import ---
const isImporting = ref(false)
const isDraggingExport = ref(false)
const importError = ref<string | null>(null)
const importResult = ref<BankExportImportResponse | null>(null)
const importedFileName = ref<string | null>(null)

/** Account names for the result table: the API answers with uuids only. */
const accountNameByUuid = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const a of bank.summary?.accounts ?? []) map[a.id] = a.name
  return map
})

async function readExportFile(file: File): Promise<void> {
  importError.value = null
  importResult.value = null
  importedFileName.value = file.name

  let payload: unknown
  try {
    payload = JSON.parse(await file.text())
  } catch {
    importError.value = 'Ce fichier n\'est pas du JSON valide.'
    return
  }

  isImporting.value = true
  try {
    importResult.value = await bank.importBankingExport(payload)
  } catch (e) {
    importError.value = e instanceof Error ? e.message : 'Import impossible.'
  } finally {
    isImporting.value = false
  }
}

function onExportFileSelect(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void readExportFile(file)
  // Cleared so re-picking the same file after a rejected read still fires `change`.
  input.value = ''
}

function onExportDrop(event: DragEvent): void {
  event.preventDefault()
  isDraggingExport.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void readExportFile(file)
}

const disconnectingUuid = ref<string | null>(null)
// Its own pair: the credentials section renders `error`/`success`, and the
// connections panel sits outside it — sharing them would print each message twice.
const disconnectError = ref<string | null>(null)
const disconnectSuccess = ref<string | null>(null)

/**
 * Disconnecting costs more than the consent: the API drops the account
 * attachments too, so the accounts stay but stop being fed, and coming back
 * means a new strong authentication *and* re-attaching each one.
 */
async function disconnect(session: BankSessionSummary): Promise<void> {
  const bankName = session.aspsp_name ?? 'cette banque'
  const attached = session.accounts.length
  const confirmed = await confirmDialog({
    title: `Déconnecter ${bankName}`,
    message: attached > 0
      ? `Cette autorisation sera fermée et ${attached === 1 ? 'le compte rattaché sera détaché' : `les ${attached} comptes rattachés seront détachés`}. Vos comptes CapitalView et l'historique déjà importé restent intacts, mais ils ne se synchroniseront plus. Y revenir demandera une nouvelle authentification auprès de votre banque, puis un nouveau rattachement.`
      : `Cette autorisation sera fermée auprès de votre banque. Y revenir demandera une nouvelle authentification.`,
    confirmLabel: 'Déconnecter',
    variant: 'danger',
  })
  if (!confirmed) return

  disconnectingUuid.value = session.uuid
  disconnectError.value = null
  disconnectSuccess.value = null
  try {
    await settingsStore.deleteBankingSession(session.uuid)
    // The accounts page reads `is_linked` from its own payload, not from here.
    await bank.fetchAccounts()
    disconnectSuccess.value = `${bankName} déconnectée.`
  } catch (e) {
    disconnectError.value = e instanceof Error ? e.message : 'Déconnexion impossible.'
  } finally {
    disconnectingUuid.value = null
  }
}

/** A fresh attachment changes both the accounts page and this screen's list. */
async function onLinked(): Promise<void> {
  await bank.fetchAccounts()
  await settingsStore.fetchBankingSessions()
}

/** The session is spent: everything is attached, or the user chose to drop it. */
function discardLinkSession(): void {
  showLinkModal.value = false
  bankSessionUuid.value = null
  if (route.query.bank_session) {
    const { bank_session: _dropped, ...query } = route.query
    void router.replace({ query })
  }
}

/** Everything the screen needs once the feature is on. */
async function loadConnection(): Promise<void> {
  isLoading.value = true
  try {
    await settingsStore.fetchBankingStatus()
    applicationId.value = status.value?.application_id ?? ''
    // The check also carries the callback URL to declare, so it runs even
    // when nothing is configured yet.
    await runCheck()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Impossible de charger la connexion bancaire.'
  } finally {
    isLoading.value = false
  }
}

/** Turning it off dismantles nothing; the watcher below reacts to either side. */
async function toggleFeature(next: boolean): Promise<void> {
  isTogglingFeature.value = true
  error.value = null
  try {
    if (!await settingsStore.updateSettings({ open_banking_enabled: next })) {
      error.value = settingsStore.error ?? 'Impossible d\'enregistrer ce réglage.'
    }
  } finally {
    isTogglingFeature.value = false
  }
}

const hasLoadedConnection = ref(false)

/**
 * Driven by the store rather than by `onMounted`: a child tab mounts before the
 * parent's settings fetch resolves, so the opt-in is unknown at mount time.
 */
watch(() => settingsStore.settings, async (loaded) => {
  if (!loaded) return
  if (!isEnabled.value) {
    isLoading.value = false
    // Reopened, not latched: this tab lives under <KeepAlive>, so turning the
    // feature off and on again would otherwise keep showing pre-toggle values.
    hasLoadedConnection.value = false
    return
  }
  if (hasLoadedConnection.value) return
  hasLoadedConnection.value = true
  await loadConnection()

  // The bank's return lands here with the session opened by the callback.
  const returned = route.query.bank_session
  if (typeof returned === 'string' && returned) {
    bankSessionUuid.value = returned
    showLinkModal.value = true
  }
}, { immediate: true })

onMounted(async () => {
  // Listed either way: opting back out must not hide what is still attached.
  try {
    await settingsStore.fetchBankingSessions()
  } catch {
    // A connection list that fails to load is not worth blocking the screen on.
  }
})
</script>

<template>
  <div class="space-y-6">

    <!-- The opt-in this whole screen hangs off -->
    <SettingsSection
      :icon="Landmark"
      title="Connexion bancaire"
      subtitle="Reliez un vrai compte bancaire pour que ses soldes et ses opérations remontent seuls. Facultatif : tout le reste de CapitalView fonctionne sans."
    >
      <template #header-action>
        <BaseToggle
          :model-value="isEnabled"
          :disabled="isTogglingFeature"
          aria-label="Activer la connexion bancaire"
          @update:model-value="toggleFeature"
        />
      </template>

      <p v-if="!isEnabled" class="text-sm text-text-muted dark:text-text-dark-muted">
        L'activation demande votre propre application Enable Banking : son offre gratuite n'expose
        que les comptes de son propre titulaire. Comptez une dizaine de minutes la première fois.
      </p>
      <p v-if="error && !isEnabled" class="mt-2 text-xs text-danger">{{ error }}</p>
    </SettingsSection>

    <!-- Connections. Listed with the feature off too: opting out attaches nothing
         and detaches nothing, so hiding them would hide live consents. -->
    <SettingsSection
      v-if="sessions.length"
      :icon="Plug"
      title="Connexions bancaires"
      subtitle="Une autorisation par banque. Les comptes rattachés lui survivent : un consentement expiré se reconnecte, il ne se reconstruit pas."
    >
      <BaseAlert v-if="!isEnabled" variant="warning" class="mb-4">
        <p class="font-medium">La fonctionnalité est désactivée, ces connexions restent en place.</p>
        <p class="mt-0.5 opacity-90">
          Elles ne se synchronisent plus tant qu'elle est éteinte. Vos comptes et leur historique
          déjà importé, eux, ne bougent pas.
        </p>
      </BaseAlert>

      <p v-if="disconnectSuccess" class="mb-3 text-xs text-success">{{ disconnectSuccess }}</p>
      <p v-if="disconnectError" class="mb-3 text-xs text-danger">{{ disconnectError }}</p>

      <ul class="space-y-3">
        <li
          v-for="s in sessions"
          :key="s.uuid"
          class="p-3 rounded-card border border-surface-border dark:border-surface-dark-border"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="font-medium text-text-main dark:text-text-dark-main">
              {{ s.aspsp_name ?? 'Banque non renseignée' }}
            </p>
            <BaseBadge :variant="s.active ? 'success' : 'warning'">
              {{ s.active ? 'Active' : 'À reconnecter' }}
            </BaseBadge>
          </div>

          <p class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">{{ s.status_message }}</p>
          <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">
            Autorisée le {{ formatDate(s.authorized_at) }}<template v-if="s.active"> — valide jusqu'au {{ formatDate(s.consent_valid_until) }}</template>
          </p>

          <ul v-if="s.accounts.length" class="mt-2 space-y-1">
            <li
              v-for="a in s.accounts"
              :key="a.bank_account_uuid"
              class="flex flex-wrap items-baseline justify-between gap-x-3 text-xs"
            >
              <span class="text-text-body dark:text-text-dark-body">{{ a.name }}</span>
              <span class="text-text-muted dark:text-text-dark-muted">
                {{ a.last_synced_at ? `Synchronisé le ${formatDate(a.last_synced_at)}` : 'Jamais synchronisé' }}
              </span>
            </li>
          </ul>
          <p v-else class="mt-2 text-xs text-text-muted dark:text-text-dark-muted">
            Aucun compte rattaché à cette autorisation.
          </p>

          <div class="mt-3 flex justify-end">
            <BaseButton
              size="sm"
              variant="ghost"
              :loading="disconnectingUuid === s.uuid"
              :disabled="disconnectingUuid !== null"
              @click="disconnect(s)"
            >
              <Unplug class="w-4 h-4 mr-1.5" />
              Déconnecter
            </BaseButton>
          </div>
        </li>
      </ul>
    </SettingsSection>

    <template v-if="isEnabled">

    <!-- Credentials -->
    <SettingsSection
      :icon="KeyRound"
      title="Identifiants Enable Banking"
      subtitle="Votre clé privée est chiffrée de bout en bout avec votre Master Key avant d'être stockée, et n'est jamais réaffichée."
    >
      <template #header-action>
        <span
          :class="[
            'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-secondary shrink-0',
            hasCredentials
              ? 'bg-success/10 text-success'
              : 'bg-surface-border dark:bg-surface-dark-border text-text-muted dark:text-text-dark-muted',
          ]"
        >
          {{ hasCredentials ? 'Configuré' : 'Non configuré' }}
        </span>
      </template>

      <div v-if="isLoading" class="space-y-4">
        <BaseSkeleton variant="rect" height="3rem" />
        <BaseSkeleton variant="rect" height="8rem" />
      </div>

      <div v-else class="space-y-4">
        <BaseInput
          v-model="applicationId"
          label="Identifiant d'application"
          placeholder="00000000-0000-0000-0000-000000000000"
        />

        <div class="space-y-1.5">
          <p class="text-sm font-medium text-text-main dark:text-text-dark-main">Clé privée</p>
          <label
            :class="[
              'flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-card cursor-pointer transition-colors',
              isDraggingKey
                ? 'border-primary bg-primary/5'
                : 'border-surface-border dark:border-surface-dark-border hover:border-primary',
            ]"
            @drop="onKeyDrop"
            @dragover.prevent="isDraggingKey = true"
            @dragleave="isDraggingKey = false"
          >
            <FileKey class="w-7 h-7 text-text-muted dark:text-text-dark-muted mb-2" />
            <span v-if="privateKeyFileName" class="text-sm font-medium text-text-main dark:text-text-dark-main">
              {{ privateKeyFileName }}
            </span>
            <span v-else class="text-sm text-text-muted dark:text-text-dark-muted">
              Glissez le fichier .pem ici ou cliquez pour le choisir
            </span>
            <span class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">
              {{ hasCredentials && !privateKeyFileName ? 'Une clé est déjà enregistrée — déposez un fichier pour la remplacer' : 'Fichier téléchargé depuis le portail Enable Banking' }}
            </span>
            <input type="file" accept=".pem,.key,.txt" class="hidden" @change="onKeyFileSelect" />
          </label>
        </div>

        <p v-if="success" class="text-xs text-success">{{ success }}</p>
        <p v-if="error" class="text-xs text-danger">{{ error }}</p>

        <div class="flex items-center gap-2">
          <BaseButton :loading="isSaving" :disabled="!canSave" @click="save">Enregistrer</BaseButton>
          <BaseButton
            v-if="hasCredentials"
            variant="ghost"
            :disabled="isSaving"
            @click="clearCredentials"
          >
            <Trash2 class="w-4 h-4 mr-1.5" />
            Supprimer
          </BaseButton>
        </div>
      </div>
    </SettingsSection>

    <!-- Callback URL to declare in the portal -->
    <SettingsSection
      :icon="Link2"
      title="URL de redirection à déclarer"
      subtitle="À copier telle quelle dans les « redirect URLs » de votre application. Le portail refuse toute URL comportant un paramètre de requête."
    >
      <div class="flex items-center gap-2">
        <code
          class="flex-1 min-w-0 px-3 py-2 rounded-input bg-surface-alt dark:bg-surface-dark-alt border border-surface-border dark:border-surface-dark-border text-sm font-mono text-text-main dark:text-text-dark-main overflow-x-auto whitespace-nowrap select-all"
        >{{ callbackUrl || '—' }}</code>
        <BaseButton variant="outline" size="sm" :disabled="!callbackUrl" @click="copyCallbackUrl">
          <Check v-if="callbackCopied" class="w-4 h-4 mr-1.5" />
          <Copy v-else class="w-4 h-4 mr-1.5" />
          {{ callbackCopied ? 'Copié' : 'Copier' }}
        </BaseButton>
      </div>
    </SettingsSection>

    <!-- Diagnostic -->
    <SettingsSection
      :icon="Stethoscope"
      title="Diagnostic"
      subtitle="Vérifie en un appel que la clé est valide, que l'application est active et que l'URL de redirection est déclarée."
    >
      <template #header-action>
        <BaseButton size="sm" variant="outline" :loading="isChecking" @click="runCheck">
          Vérifier
        </BaseButton>
      </template>

      <BaseSkeleton v-if="isLoading" variant="rect" height="4rem" />
      <BaseAlert v-else-if="diagnosis" :variant="diagnosis.variant">
        <p class="font-medium">{{ diagnosis.title }}</p>
        <p class="mt-0.5 opacity-90">{{ diagnosis.detail }}</p>
      </BaseAlert>

      <BaseAlert v-if="bankSessionUuid && !showLinkModal" variant="info" class="mt-4">
        <p class="font-medium">Une autorisation bancaire attend son rattachement.</p>
        <p class="mt-0.5 opacity-90">
          Reprenez-la maintenant : une fois abandonnée, revenir sur ces comptes demandera une
          nouvelle authentification auprès de votre banque.
        </p>
        <BaseButton size="sm" class="mt-2" @click="resumeLinkModal">Reprendre</BaseButton>
      </BaseAlert>

      <div v-if="isReady" class="mt-4">
        <BaseButton @click="openLinkModal">
          <Landmark class="w-4 h-4 mr-1.5" />
          Connecter une banque
        </BaseButton>
      </div>
    </SettingsSection>

    <!-- Historical catch-up -->
    <SettingsSection
      :icon="FileJson"
      title="Importer l'historique complet"
      subtitle="La synchronisation ne remonte que ce que votre banque expose encore. L'export du portail Enable Banking, lui, contient tout l'historique."
    >
      <div class="space-y-4">
        <label
          :class="[
            'flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-card transition-colors',
            isImporting ? 'opacity-60 cursor-wait' : 'cursor-pointer',
            isDraggingExport
              ? 'border-primary bg-primary/5'
              : 'border-surface-border dark:border-surface-dark-border hover:border-primary',
          ]"
          @drop="onExportDrop"
          @dragover.prevent="isDraggingExport = true"
          @dragleave="isDraggingExport = false"
        >
          <FileJson class="w-7 h-7 text-text-muted dark:text-text-dark-muted mb-2" />
          <span v-if="isImporting" class="text-sm font-medium text-text-main dark:text-text-dark-main">
            Import en cours…
          </span>
          <span v-else-if="importedFileName" class="text-sm font-medium text-text-main dark:text-text-dark-main">
            {{ importedFileName }}
          </span>
          <span v-else class="text-sm text-text-muted dark:text-text-dark-muted">
            Glissez le fichier .json ici ou cliquez pour le choisir
          </span>
          <span class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">
            Les comptes sont reconnus par leur empreinte : seuls ceux déjà rattachés sont importés
          </span>
          <input type="file" accept=".json,application/json" class="hidden" :disabled="isImporting" @change="onExportFileSelect" />
        </label>

        <p v-if="importError" class="text-xs text-danger">{{ importError }}</p>

        <BaseAlert v-if="importResult" :variant="importResult.imported_accounts ? 'success' : 'warning'">
          <p class="font-medium">
            {{ importResult.imported_accounts }} compte(s) importé(s).
          </p>
          <p v-if="!importResult.imported_accounts" class="mt-0.5 opacity-90">
            Aucun compte de cet export ne correspond à un compte rattaché. Connectez d'abord la
            banque, rattachez les comptes, puis relancez l'import.
          </p>
          <ul v-else class="mt-2 space-y-1">
            <li v-for="r in importResult.results" :key="r.bank_account_uuid" class="text-xs">
              <span class="font-medium">{{ accountNameByUuid[r.bank_account_uuid] ?? r.bank_account_uuid }}</span> —
              {{ r.inserted }} ajoutée(s), {{ r.updated }} mise(s) à jour, {{ r.skipped }} déjà connue(s),
              {{ r.snapshots_written }} point(s) d'historique
              <template v-if="r.malformed"> · {{ r.malformed }} ligne(s) inexploitable(s)</template>
              <template v-if="r.detail"> · {{ r.detail }}</template>
            </li>
          </ul>
        </BaseAlert>

        <BaseAlert variant="info">
          <p class="font-medium">Où trouver ce fichier</p>
          <p class="mt-0.5 opacity-90">
            Dans le portail Enable Banking, ouvrez votre application puis la session bancaire
            concernée, et exportez ses données au format JSON. L'export ignore la fenêtre de 90 jours
            que l'API impose.
          </p>
        </BaseAlert>
      </div>
    </SettingsSection>

    <!-- The seven steps -->
    <SettingsSection
      :icon="ListOrdered"
      title="Comment connecter votre banque"
      subtitle="Enable Banking n'expose gratuitement que les comptes de son propre titulaire : l'application doit être la vôtre."
    >
      <ol class="space-y-3 text-sm text-text-body dark:text-text-dark-body list-decimal list-outside pl-5 marker:text-text-muted marker:font-semibold">
        <li>
          Créez un compte sur le
          <a href="https://enablebanking.com/cp/" target="_blank" rel="noopener" class="text-primary hover:underline">portail Enable Banking</a>.
        </li>
        <li>Enregistrez une application de <strong>production</strong>, en service <strong>AIS</strong> et en type d'utilisateur <strong>personal</strong>.</li>
        <li>Déclarez l'URL de redirection ci-dessus dans les <em>redirect URLs</em> de l'application.</li>
        <li>Téléchargez la <strong>clé privée</strong> proposée à la création : elle n'est affichée qu'une seule fois.</li>
        <li>Activez l'application avec <em>« Activate by linking accounts »</em> en y liant un de vos comptes bancaires — sans cela elle reste inactive et ne renvoie aucune donnée.</li>
        <li>Déposez ci-dessus l'identifiant d'application et le fichier de clé privée, puis lancez le diagnostic.</li>
        <li>Connectez votre banque depuis CapitalView et autorisez l'accès aux comptes que vous voulez suivre.</li>
      </ol>

      <BaseAlert variant="warning" class="mt-4">
        <p class="font-medium">L'étape 5 n'autorise pas l'accès à vos données.</p>
        <p class="mt-0.5 opacity-90">
          Lier un compte au portail ne fait qu'activer votre application. L'étape 7 vous demandera
          une <strong>seconde authentification auprès de votre banque</strong>, y compris lorsqu'il
          s'agit du même compte. Certaines banques françaises basculent alors vers leur application
          mobile : la liaison se termine dans l'onglet où vous êtes connecté à CapitalView.
        </p>
      </BaseAlert>
    </SettingsSection>

    <BankLinkModal
      :open="showLinkModal"
      :bank-session-uuid="bankSessionUuid"
      @close="dismissLinkModal"
      @discard="discardLinkSession"
      @linked="onLinked"
    />

    </template>

  </div>
</template>

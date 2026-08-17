<script setup lang="ts">
import { Check, Copy, FileKey, KeyRound, Landmark, Link2, ListOrdered, Stethoscope, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useBankStore } from '@/stores/bank'
import { useConfirm } from '@/composables/useConfirm'
import { BaseAlert, BaseButton, BaseInput, BaseSkeleton } from '@/components'
import type { AlertVariant } from '@/components/base/BaseAlert.vue'
import BankLinkModal from '@/components/banking/BankLinkModal.vue'
import SettingsSection from './SettingsSection.vue'

const settingsStore = useSettingsStore()
const bank = useBankStore()
const route = useRoute()
const router = useRouter()
const { confirmDialog } = useConfirm()

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

function readKeyFile(file: File): void {
  error.value = null
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    if (!text?.includes('-----BEGIN')) {
      error.value = 'Ce fichier ne ressemble pas à une clé privée au format PEM.'
      return
    }
    privateKey.value = text
    privateKeyFileName.value = file.name
  }
  reader.onerror = () => { error.value = 'Erreur de lecture du fichier.' }
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

/** The session is spent: everything is attached, or the user chose to drop it. */
function discardLinkSession(): void {
  showLinkModal.value = false
  bankSessionUuid.value = null
  if (route.query.bank_session) {
    const { bank_session: _dropped, ...query } = route.query
    void router.replace({ query })
  }
}

onMounted(async () => {
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

  // The bank's return lands here with the session opened by the callback.
  const returned = route.query.bank_session
  if (typeof returned === 'string' && returned) {
    bankSessionUuid.value = returned
    showLinkModal.value = true
  }
})
</script>

<template>
  <div class="space-y-6">

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
      @linked="bank.fetchAccounts()"
    />

  </div>
</template>

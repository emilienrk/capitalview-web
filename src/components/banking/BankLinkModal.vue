<script setup lang="ts">
import { Check, Landmark, Search } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseAlert from '@/components/base/BaseAlert.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import { useBankStore } from '@/stores/bank'
import type { AspspSummary, BankSessionAccount } from '@/types'

interface Props {
  open: boolean
  /** Set on the return from the bank: the modal reopens straight on the attachment step. */
  bankSessionUuid?: string | null
}
const props = withDefaults(defineProps<Props>(), { bankSessionUuid: null })
/**
 * `close` merely hides the modal and leaves the bank session recoverable;
 * `discard` says the session is spent. They are not interchangeable: getting a
 * discarded session back costs a fresh strong authentication at the bank.
 */
const emit = defineEmits<{ close: []; discard: []; linked: [] }>()

const bank = useBankStore()

const COUNTRY = 'FR'
const WIDGET_SCRIPT_URL = 'https://auth.enablebanking.com/lib/widgets.umd.min.js'
const WIDGET_CSS_URL = 'https://auth.enablebanking.com/lib/widgets.css'

/**
 * Networks whose customers must pick their caisse régionale before authenticating.
 * Their entries in the catalogue carry the network name as a prefix.
 */
const REGIONAL_NETWORKS = ['Crédit Agricole', 'Banque Populaire', 'Caisse d\'Épargne']

type Step = 'bank' | 'region' | 'confirm' | 'accounts'
const step = ref<Step>('bank')

const selectedBank = ref<{ name: string; country: string } | null>(null)
const regionalNetwork = ref<string | null>(null)
const regionalOptions = ref<AspspSummary[]>([])
const regionalFilter = ref('')
const sessionAccounts = ref<BankSessionAccount[]>([])
/** Whether `sessionAccounts` can be trusted — an empty list is not an answer. */
const accountsState = ref<'idle' | 'loading' | 'loaded' | 'failed'>('idle')
const linkedSomething = ref(false)
const targetAccountByHash = ref<Record<string, string>>({})
const linkingHash = ref<string | null>(null)
const isBusy = ref(false)
const error = ref<string | null>(null)

/** The vendor bundle is fetched once per page, on first use. */
let widgetAssets: Promise<void> | null = null

function loadWidgetAssets(): Promise<void> {
  if (widgetAssets) return widgetAssets
  widgetAssets = new Promise<void>((resolve, reject) => {
    if (!document.querySelector(`link[href="${WIDGET_CSS_URL}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = WIDGET_CSS_URL
      document.head.appendChild(link)
    }
    const script = document.createElement('script')
    script.src = WIDGET_SCRIPT_URL
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Le sélecteur de banque n\'a pas pu être chargé.'))
    document.head.appendChild(script)
  }).catch((e) => {
    widgetAssets = null
    throw e
  })
  return widgetAssets
}

const selectorHost = ref<HTMLElement | null>(null)
const isSelectorLoading = ref(false)

/**
 * The selector is a vendor custom element, created imperatively so the bundle
 * stays off the app's critical path and the Vue compiler needs no custom-element
 * configuration. It consumes no application identity, so no origin has to be
 * declared for it — unlike Enable Banking's two other widgets.
 */
async function mountSelector(): Promise<void> {
  error.value = null
  isSelectorLoading.value = true
  try {
    await loadWidgetAssets()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Sélecteur de banque indisponible.'
    return
  } finally {
    isSelectorLoading.value = false
  }

  await nextTick()
  const host = selectorHost.value
  if (!host || host.firstElementChild) return

  const element = document.createElement('enablebanking-aspsp-list')
  element.setAttribute('country', COUNTRY)
  element.setAttribute('psu-type', 'personal')
  element.setAttribute('service', 'AIS')
  // Documented for the vendor's other widgets; harmless here if ignored.
  element.setAttribute('locale', 'FR')
  element.setAttribute('no-beta', '')
  element.addEventListener('selected', onAspspSelected as EventListener)
  host.appendChild(element)
}

/** Accent- and case-insensitive, the catalogue's spelling varies. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

async function onAspspSelected(event: Event): Promise<void> {
  const detail = (event as CustomEvent<{ name: string; country?: string }>).detail
  if (!detail?.name) return
  selectedBank.value = { name: detail.name, country: detail.country ?? COUNTRY }

  const network = REGIONAL_NETWORKS.find((n) => normalize(n) === normalize(detail.name))
  if (!network) {
    regionalNetwork.value = null
    regionalOptions.value = []
    step.value = 'confirm'
    return
  }
  regionalNetwork.value = network
  step.value = 'region'
  await loadRegionalOptions(network, selectedBank.value.country)
}

async function loadRegionalOptions(network: string, country: string): Promise<void> {
  isBusy.value = true
  error.value = null
  regionalFilter.value = ''
  try {
    const aspsps = await bank.fetchAspsps(country)
    const prefix = normalize(network)
    regionalOptions.value = aspsps.filter(
      (a) => normalize(a.name).startsWith(prefix) && normalize(a.name) !== prefix,
    )
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Impossible de charger les caisses régionales.'
  } finally {
    isBusy.value = false
  }
}

function retryRegionalOptions(): void {
  if (regionalNetwork.value && selectedBank.value) {
    void loadRegionalOptions(regionalNetwork.value, selectedBank.value.country)
  }
}

const filteredRegionalOptions = computed(() => {
  const needle = normalize(regionalFilter.value)
  if (!needle) return regionalOptions.value
  return regionalOptions.value.filter((a) => normalize(a.name).includes(needle))
})

function selectRegional(aspsp: AspspSummary): void {
  selectedBank.value = { name: aspsp.name, country: aspsp.country }
  step.value = 'confirm'
}

async function startAuthorization(): Promise<void> {
  if (!selectedBank.value) return
  isBusy.value = true
  error.value = null
  try {
    const authUrl = await bank.authorizeBank(selectedBank.value.name, selectedBank.value.country)
    window.location.href = authUrl
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Impossible d\'ouvrir le parcours d\'autorisation.'
    isBusy.value = false
  }
}

async function loadSessionAccounts(uuid: string): Promise<void> {
  accountsState.value = 'loading'
  sessionAccounts.value = []
  isBusy.value = true
  error.value = null
  try {
    if (!bank.summary) await bank.fetchAccounts()
    sessionAccounts.value = await bank.fetchSessionAccounts(uuid)
    accountsState.value = 'loaded'
  } catch (e) {
    accountsState.value = 'failed'
    error.value = e instanceof Error ? e.message : 'Impossible de lire les comptes de cette session.'
  } finally {
    isBusy.value = false
  }
}

function retrySessionAccounts(): void {
  if (props.bankSessionUuid) void loadSessionAccounts(props.bankSessionUuid)
}

const capitalViewAccountOptions = computed(() =>
  (bank.summary?.accounts ?? []).map((a) => ({ value: a.id, label: a.name })),
)

/** Never `currency`: real accounts return the ISO code meaning "no currency". */
function accountLabel(account: BankSessionAccount): string {
  return account.name?.trim() || account.product?.trim() || 'Compte bancaire'
}

async function linkAccount(account: BankSessionAccount): Promise<void> {
  const target = targetAccountByHash.value[account.identification_hash]
  if (!props.bankSessionUuid || !target) return
  linkingHash.value = account.identification_hash
  error.value = null
  try {
    await bank.linkSessionAccount(props.bankSessionUuid, {
      identification_hash: account.identification_hash,
      bank_account_uuid: target,
    })
    account.linked = true
    account.bank_account_uuid = target
    linkedSomething.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Rattachement impossible.'
  } finally {
    linkingHash.value = null
  }
}

const unattachedCount = computed(() => sessionAccounts.value.filter((a) => !a.linked).length)

/**
 * The session is spendable only when the list is *known* complete. An empty
 * `sessionAccounts` while loading or after a failed read means "unknown", not
 * "nothing left to attach" — treating the two alike would drop a live session
 * on a network blip, and getting it back costs a strong authentication.
 */
const isSessionSpent = computed(
  () => accountsState.value === 'loaded' && unattachedCount.value === 0,
)

function closeWith(mode: 'close' | 'discard'): void {
  // Attachments made in this sitting must reach the parent on every exit path.
  if (linkedSomething.value) emit('linked')
  if (mode === 'close') emit('close')
  else emit('discard')
}

function requestClose(): void {
  closeWith(step.value === 'accounts' && !isSessionSpent.value ? 'close' : 'discard')
}

/**
 * Confirmed inline rather than through `confirmDialog`: that dialog is mounted in
 * App.vue, so its teleported node sits earlier in <body> than this modal's and
 * would paint underneath it at the shared z-50 — and its promise would still be
 * pending if the user dismissed this modal meanwhile.
 */
const isConfirmingAbandon = ref(false)

function finish(): void {
  if (!isSessionSpent.value) {
    isConfirmingAbandon.value = true
    return
  }
  closeWith('discard')
}

function confirmAbandon(): void {
  isConfirmingAbandon.value = false
  closeWith('discard')
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    error.value = null
    selectedBank.value = null
    regionalNetwork.value = null
    regionalOptions.value = []
    targetAccountByHash.value = {}
    sessionAccounts.value = []
    accountsState.value = 'idle'
    isConfirmingAbandon.value = false
    linkedSomething.value = false

    if (props.bankSessionUuid) {
      step.value = 'accounts'
      await loadSessionAccounts(props.bankSessionUuid)
      return
    }
    step.value = 'bank'
    await mountSelector()
  },
  { immediate: true },
)

// Stepping back destroys the host element, so the selector is mounted again.
watch(step, (value) => {
  if (value === 'bank') void mountSelector()
})

const title = computed(() => {
  if (step.value === 'region') return `Choisissez votre caisse ${regionalNetwork.value}`
  if (step.value === 'confirm') return 'Avant de continuer'
  if (step.value === 'accounts') return 'Rattacher vos comptes'
  return 'Connecter une banque'
})
</script>

<template>
  <BaseModal :open="props.open" :title="title" size="lg" @close="requestClose">

    <!-- ── STEP 1: bank selector ───────────────────────── -->
    <template v-if="step === 'bank'">
      <div v-if="isSelectorLoading" class="flex items-center justify-center py-10">
        <BaseSpinner />
        <span class="ml-2 text-sm text-text-muted dark:text-text-dark-muted">Chargement des banques…</span>
      </div>
      <BaseAlert v-if="error" variant="danger" class="mb-4">
        {{ error }}
        <button type="button" class="ml-1 underline" @click="mountSelector">Réessayer</button>
      </BaseAlert>
      <div ref="selectorHost" />
    </template>

    <!-- ── STEP 2: caisse régionale ────────────────────── -->
    <template v-else-if="step === 'region'">
      <p class="text-sm text-text-body dark:text-text-dark-body mb-4">
        Ce réseau est un groupe de caisses régionales : choisissez celle qui tient votre compte,
        sinon l'authentification échouera.
      </p>

      <div v-if="isBusy" class="flex items-center justify-center py-10">
        <BaseSpinner />
      </div>

      <template v-else-if="regionalOptions.length">
        <div class="relative mb-3">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted dark:text-text-dark-muted" />
          <input
            v-model="regionalFilter"
            type="search"
            placeholder="Rechercher une caisse…"
            class="w-full pl-9 pr-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div class="max-h-72 overflow-y-auto space-y-1.5">
          <button
            v-for="aspsp in filteredRegionalOptions"
            :key="aspsp.name"
            type="button"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-card border border-surface-border dark:border-surface-dark-border text-left text-sm text-text-main dark:text-text-dark-main hover:border-primary hover:bg-primary/5 transition-colors"
            @click="selectRegional(aspsp)"
          >
            <Landmark class="w-4 h-4 text-text-muted dark:text-text-dark-muted shrink-0" />
            {{ aspsp.name }}
          </button>
        </div>
      </template>

      <BaseAlert v-else-if="!error" variant="info">
        Ce réseau n'expose qu'une seule entrée : votre caisse régionale vous sera demandée sur la
        page d'authentification de la banque.
      </BaseAlert>

      <BaseAlert v-if="error" variant="danger" class="mt-4">
        {{ error }} Le catalogue des caisses n'a pas pu être lu, impossible de savoir laquelle
        choisir.
      </BaseAlert>
    </template>

    <!-- ── STEP 3: double authentication warning ───────── -->
    <template v-else-if="step === 'confirm'">
      <div class="space-y-4">
        <div class="flex items-center gap-2 text-sm text-text-main dark:text-text-dark-main">
          <Landmark class="w-4 h-4 text-primary" />
          <span class="font-medium">{{ selectedBank?.name }}</span>
        </div>

        <BaseAlert variant="warning">
          <p class="font-medium">Une authentification bancaire vous sera demandée.</p>
          <p class="mt-0.5 opacity-90">
            Avoir lié ce compte à votre application dans le portail Enable Banking n'autorise pas
            l'accès à ses données, <strong>y compris lorsqu'il s'agit du même compte</strong>.
            Votre banque va donc vous demander de vous authentifier à nouveau.
          </p>
        </BaseAlert>

        <BaseAlert variant="info">
          Plusieurs banques françaises basculent vers leur application mobile pour cette étape. Si
          vous atterrissez ensuite dans un navigateur où vous n'êtes pas connecté, revenez dans
          l'onglet CapitalView pour terminer le rattachement.
        </BaseAlert>

        <BaseAlert v-if="error" variant="danger">{{ error }}</BaseAlert>
      </div>
    </template>

    <!-- ── STEP 4: attach the discovered accounts ──────── -->
    <template v-else>
      <!-- Outside the load branches below: abandoning is offered whatever the list's state. -->
      <BaseAlert v-if="isConfirmingAbandon" variant="warning" class="mb-4">
        <p class="font-medium">
          Terminer sans rattacher {{ accountsState === 'loaded' ? `${unattachedCount} compte(s)` : 'les comptes de cette autorisation' }} ?
        </p>
        <p class="mt-0.5 opacity-90">
          Cette autorisation sera abandonnée : y revenir demandera une nouvelle authentification
          auprès de votre banque.
        </p>
        <div class="flex gap-2 mt-2">
          <BaseButton size="sm" variant="danger" @click="confirmAbandon">Terminer quand même</BaseButton>
          <BaseButton size="sm" variant="ghost" @click="isConfirmingAbandon = false">
            Revenir au rattachement
          </BaseButton>
        </div>
      </BaseAlert>

      <div v-if="isBusy" class="flex items-center justify-center py-10">
        <BaseSpinner />
      </div>

      <template v-else-if="accountsState === 'failed'">
        <BaseAlert variant="danger">
          <p class="font-medium">Les comptes de cette autorisation n'ont pas pu être lus.</p>
          <p class="mt-0.5 opacity-90">{{ error }}</p>
          <p class="mt-0.5 opacity-90">
            L'autorisation reste valable : réessayez, ou fermez cette fenêtre et reprenez plus tard.
          </p>
        </BaseAlert>
      </template>

      <template v-else>
        <p class="text-sm text-text-body dark:text-text-dark-body mb-4">
          Choisissez à quel compte CapitalView rattacher chaque compte découvert. Les comptes non
          rattachés ne seront pas synchronisés.
        </p>

        <BaseAlert v-if="!capitalViewAccountOptions.length" variant="warning" class="mb-4">
          Créez d'abord un compte bancaire dans CapitalView pour pouvoir y rattacher un compte réel.
        </BaseAlert>

        <div class="space-y-3">
          <div
            v-for="account in sessionAccounts"
            :key="account.identification_hash"
            class="p-3 rounded-card border border-surface-border dark:border-surface-dark-border space-y-2"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-text-main dark:text-text-dark-main truncate">
                  {{ accountLabel(account) }}
                </p>
                <p v-if="account.account_id" class="text-xs text-text-muted dark:text-text-dark-muted font-mono truncate">
                  {{ account.account_id }}
                </p>
              </div>
              <BaseBadge v-if="account.linked" variant="success">Rattaché</BaseBadge>
            </div>

            <div v-if="!account.linked" class="flex items-end gap-2">
              <BaseSelect
                class="flex-1 min-w-0"
                :model-value="targetAccountByHash[account.identification_hash] ?? ''"
                :options="capitalViewAccountOptions"
                placeholder="Compte CapitalView…"
                @update:model-value="targetAccountByHash[account.identification_hash] = String($event)"
              />
              <BaseButton
                size="sm"
                :loading="linkingHash === account.identification_hash"
                :disabled="!targetAccountByHash[account.identification_hash]"
                @click="linkAccount(account)"
              >
                Rattacher
              </BaseButton>
            </div>
          </div>
        </div>

        <BaseAlert v-if="accountsState === 'loaded' && !sessionAccounts.length" variant="info" class="mt-2">
          Aucun compte n'a été renvoyé par cette autorisation.
        </BaseAlert>
        <BaseAlert v-if="error" variant="danger" class="mt-4">{{ error }}</BaseAlert>
      </template>
    </template>

    <template #footer>
      <BaseButton v-if="step === 'bank'" variant="ghost" @click="emit('discard')">Annuler</BaseButton>
      <BaseButton v-if="step === 'region'" variant="ghost" @click="step = 'bank'">Retour</BaseButton>
      <BaseButton
        v-if="step === 'region' && error"
        variant="outline"
        :loading="isBusy"
        @click="retryRegionalOptions"
      >
        Réessayer
      </BaseButton>
      <!-- Only a genuinely single-entry network lets the user move on: after a failed
           catalogue read we do not know which caisse the bank expects. -->
      <BaseButton
        v-if="step === 'region' && !regionalOptions.length && !error"
        @click="step = 'confirm'"
      >
        Continuer
      </BaseButton>

      <template v-if="step === 'confirm'">
        <BaseButton variant="ghost" @click="step = regionalNetwork ? 'region' : 'bank'">Retour</BaseButton>
        <BaseButton :loading="isBusy" @click="startAuthorization">
          Continuer vers ma banque
        </BaseButton>
      </template>

      <template v-if="step === 'accounts'">
        <!-- Leaves the session recoverable, unlike "Terminer". -->
        <BaseButton v-if="!isSessionSpent" variant="ghost" @click="closeWith('close')">
          Plus tard
        </BaseButton>
        <BaseButton
          v-if="accountsState === 'failed'"
          variant="outline"
          :loading="isBusy"
          @click="retrySessionAccounts"
        >
          Réessayer
        </BaseButton>
        <BaseButton v-if="!isConfirmingAbandon" @click="finish">
          <Check class="w-4 h-4 mr-1.5" />
          Terminer
        </BaseButton>
      </template>
    </template>
  </BaseModal>
</template>

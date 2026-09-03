<script setup lang="ts">
import { Check, Landmark } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseAlert from '@/components/base/BaseAlert.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import { useBankStore } from '@/stores/bank'
import type { BankSessionAccount } from '@/types'

interface Props {
  open: boolean
  /** Set on the return from the bank: the modal reopens straight on the attachment step. */
  bankSessionUuid?: string | null
  /**
   * The application is registered in Enable Banking's sandbox environment. The
   * picker then lists simulated banks instead of real ones; getting this wrong
   * either way makes the selection unusable at authorization time.
   */
  sandbox?: boolean
}
const props = withDefaults(defineProps<Props>(), { bankSessionUuid: null, sandbox: false })
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

type Step = 'bank' | 'confirm' | 'accounts'
const step = ref<Step>('bank')

const selectedBank = ref<{ name: string; country: string } | null>(null)
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
  // Presence is what the widget reads, so the attribute is set or absent, never
  // set to "false" — which would read as present and list simulated banks to a
  // production application.
  if (props.sandbox) element.setAttribute('sandbox', '')
  // Documented for the vendor's other widgets; harmless here if ignored.
  element.setAttribute('locale', 'FR')
  // No `no-beta`: it hid 94 of the 129 French entries, BNP Paribas, La Banque
  // Postale, Société Générale (particuliers), the 39 Crédit Agricole and the 15
  // Caisse d'Épargne among them — the feature was unusable for most people.
  // Flagging them instead was not worth it either: a marker on three entries out
  // of four carries no signal (same reasoning as ruling R18).
  element.addEventListener('selected', onAspspSelected as EventListener)
  host.appendChild(element)
}

/**
 * The widget emits a catalogue entry, never a network heading: the FR catalogue
 * carries no bare "Crédit Agricole" / "Caisse d'Épargne" / "Banque Populaire",
 * only their regional entries. Verified against a real GET /aspsps?country=FR
 * and against the event itself ({name: "Crédit Mutuel", country: "FR", …}).
 */
function onAspspSelected(event: Event): void {
  const detail = (event as CustomEvent<{ name: string; country?: string }>).detail
  if (!detail?.name) return
  selectedBank.value = { name: detail.name, country: detail.country ?? COUNTRY }
  step.value = 'confirm'
}

async function startAuthorization(): Promise<void> {
  if (!selectedBank.value) return
  isBusy.value = true
  error.value = null
  try {
    const authUrl = await bank.authorizeBank(selectedBank.value.name, selectedBank.value.country)
    // Escape, the backdrop and the X all close the modal unconditionally, and
    // the parent renders it without v-if: without this guard, a user who gave up
    // mid-request still gets thrown onto the bank's authentication page.
    if (!props.open) {
      isBusy.value = false
      return
    }
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
    if (!bank.summary) {
      // The store swallows its own error and returns void, so a failed accounts
      // fetch would otherwise land here as "loaded with no accounts" — and tell
      // the user to create one they already have, with no way to retry.
      await bank.fetchAccounts()
      if (!bank.summary) throw new Error(bank.error ?? 'Vos comptes CapitalView n\'ont pas pu être chargés.')
    }
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

/** CapitalView accounts already carrying one of the discovered accounts. */
const takenAccountIds = computed(
  () =>
    new Set(
      sessionAccounts.value
        .filter((a) => a.linked && a.bank_account_uuid)
        .map((a) => a.bank_account_uuid as string),
    ),
)

/**
 * The attachment is one-to-one, and the API answers 409 on a second one. Offering
 * a taken account would send the user into that refusal at the very end of a
 * journey that cost them a strong authentication. A card and a current account
 * also have to stay apart for the cross-account deduplication to work at all.
 */
const availableAccountOptions = computed(() =>
  capitalViewAccountOptions.value.filter((o) => !takenAccountIds.value.has(o.value)),
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
    // Another row may still be pointing at the account we just took; leaving it
    // there arms a button whose only outcome is a 409.
    for (const [hash, chosen] of Object.entries(targetAccountByHash.value)) {
      if (hash !== account.identification_hash && chosen === target) {
        delete targetAccountByHash.value[hash]
      }
    }
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
 * Confirmed inline rather than through `confirmDialog`: that dialog's promise
 * would still be pending if the user dismissed this modal meanwhile.
 */
const isConfirmingAbandon = ref(false)

/**
 * The warning is about what would be left behind, so it has to go once nothing
 * is. Attaching the last account while it is open otherwise leaves it asking
 * whether to abandon "0 compte(s)" — and it hides the plain "Terminer" button,
 * so the only way out reads as destructive on a session that is fully spent.
 */
watch(isSessionSpent, (spent) => {
  if (spent) isConfirmingAbandon.value = false
})

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
    isBusy.value = false
    selectedBank.value = null
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

    <!-- ── STEP 2: double authentication warning ───────── -->
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

    <!-- ── STEP 3: attach the discovered accounts ──────── -->
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
        <BaseAlert
          v-else-if="!availableAccountOptions.length && unattachedCount"
          variant="warning"
          class="mb-4"
        >
          Chacun de vos comptes CapitalView porte déjà un compte bancaire. Créez-en un autre pour
          rattacher {{ unattachedCount }} compte(s) restant(s) — un compte carte et un compte
          courant doivent rester séparés.
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
                :options="availableAccountOptions"
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

        <!--
          An authorization that succeeds and returns nothing has exactly one
          documented cause on a restricted production application, and no other
          symptom: Enable Banking strips every account that was not linked to
          the application in the portal. Naming it here is the difference
          between a dead end and a five-minute fix.
        -->
        <!--
          Emilien chose "hidden" over "greyed out" for card accounts, so this
          says it once under the list rather than per row: a compte visible at
          the bank and missing here would otherwise be a mystery.
        -->
        <p
          v-if="accountsState === 'loaded'"
          class="mt-3 text-xs text-text-muted dark:text-text-dark-muted"
        >
          Les comptes carte ne sont pas proposés : leurs opérations sont déjà celles du compte
          qu'ils débitent, et leur solde n'est pas un solde de compte.
        </p>

        <BaseAlert v-if="accountsState === 'loaded' && !sessionAccounts.length" variant="warning" class="mt-2">
          <p class="font-medium">Aucun compte n'a été renvoyé par cette autorisation.</p>
          <p class="mt-0.5 opacity-90">
            En mode restreint, Enable Banking ne renvoie que les comptes liés à votre application
            avec <em>« Activate by linking accounts »</em>. Liez-y le compte concerné dans le portail,
            puis relancez la connexion depuis CapitalView.
          </p>
        </BaseAlert>
        <BaseAlert v-if="error" variant="danger" class="mt-4">{{ error }}</BaseAlert>
      </template>
    </template>

    <template #footer>
      <BaseButton v-if="step === 'bank'" variant="ghost" @click="emit('discard')">Annuler</BaseButton>

      <template v-if="step === 'confirm'">
        <BaseButton variant="ghost" @click="step = 'bank'">Retour</BaseButton>
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

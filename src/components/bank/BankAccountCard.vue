<script setup lang="ts">
/**
 * One bank account on the Banque page: its balance, what its bank link says,
 * and every reason the balance or the curve may not be what the user expects.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, Pencil, TriangleAlert } from 'lucide-vue-next'

import { useBankStore } from '@/stores/bank'
import { useSettingsStore } from '@/stores/settings'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { BaseBadge, BaseButton, BaseCard, BaseHelpPopover } from '@/components'
import type { BadgeVariant } from '@/components/base/BaseBadge.vue'
import type { BankAccountResponse } from '@/types'

const props = defineProps<{ account: BankAccountResponse }>()
const emit = defineEmits<{
  edit: [account: BankAccountResponse]
}>()

const bank = useBankStore()
const router = useRouter()
const settingsStore = useSettingsStore()
const { formatCurrency, formatDate, formatAccountType } = useFormatters()
const { maskValue } = usePrivacyMode()

const openBankingEnabled = computed(() => settingsStore.settings?.open_banking_enabled ?? false)

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * One badge for the bank link. Only a linked account gets one: an imported
 * account is not synchronised with anything.
 */
const syncBadge = computed<{ label: string; variant: BadgeVariant; title?: string } | null>(() => {
  const account = props.account
  if (!account.is_linked) return null
  // Turning the feature off stops every sync but destroys nothing, so the
  // attachment survives: the account is dormant, not synchronised.
  if (!openBankingEnabled.value) {
    return { label: 'Liaison en sommeil', variant: 'secondary', title: 'La connexion bancaire est désactivée dans les paramètres.' }
  }
  if (account.link_status === 'reconnect_required') return { label: 'À reconnecter', variant: 'warning' }
  if (!account.last_synced_at) return { label: 'Jamais synchronisé', variant: 'secondary' }
  // How far back the bank served this account: worth knowing, not worth a line.
  const title = account.history_served_from && !account.history_pending
    ? `Historique bancaire depuis le ${formatDate(account.history_served_from)}`
    : undefined
  // The date only once it is not today's: a badge saying "synchronised" over a
  // week-old reading would be the one thing on the card that is wrong.
  const label = account.last_synced_at >= todayIso()
    ? 'Synchronisé'
    : `Synchronisé le ${formatDate(account.last_synced_at)}`
  return { label, variant: 'success', title }
})

/** Positive: the bank counts more coming in than the stored operations explain. */
const gapDirection = computed(() => ((props.account.reconciliation_gap ?? 0) > 0 ? 'entrées' : 'sorties'))

/**
 * Why this account got nothing out of the last sync, or null when it did.
 *
 * `POST /banking/sync` answers 200 whatever happened to each account, so a
 * failure has no other symptom than a balance that does not move — the very
 * thing an unread failure is indistinguishable from. `skipped_daily_cap` is
 * deliberately not one: it means the account is already up to date today.
 */
const syncFailure = computed(() => {
  // The persisted reason first: once a failure has spent the day, the next
  // sync answers skipped_daily_cap and carries no detail at all.
  if (props.account.sync_error) return props.account.sync_error
  const result = bank.syncResultByAccount[props.account.id]
  if (!result || (result.status !== 'error' && result.status !== 'reconnect_required')) return null
  return result.detail ?? 'La synchronisation a échoué.'
})

const retrying = ref(false)
const reseeding = ref(false)

function openOperations(): void {
  void router.push({ name: 'bank-transactions', query: { account: props.account.id } })
}

async function retrySync(): Promise<void> {
  retrying.value = true
  try {
    await bank.retrySync(props.account.id)
  } finally {
    retrying.value = false
  }
}

/**
 * Ask the bank for everything again on this account. The daily cap is lifted
 * server-side for that one call, so the sync the store fires right after is the
 * seeding pass itself rather than a no-op the user would have to wait a day for.
 */
async function reseedHistory(): Promise<void> {
  reseeding.value = true
  try {
    await bank.reseedHistory(props.account.id)
  } finally {
    reseeding.value = false
  }
}
</script>

<template>
  <!-- The whole card opens the account's operations; its own buttons stop the click. -->
  <BaseCard
    hoverable
    role="link"
    tabindex="0"
    :aria-label="`Opérations de ${account.name}`"
    @click="openOperations"
    @keydown.enter.self="openOperations"
    body-class="flex-1 flex flex-col"
  >
    <div class="flex items-start justify-between">
      <div>
        <h3 class="font-semibold text-text-main dark:text-text-dark-main">{{ account.name }}</h3>
        <div class="flex flex-wrap items-center gap-2 mt-1">
          <BaseBadge variant="secondary">{{ formatAccountType(account.account_type) }}</BaseBadge>
          <BaseBadge v-if="syncBadge" :variant="syncBadge.variant" :title="syncBadge.title">
            {{ syncBadge.label }}
          </BaseBadge>
          <span v-if="account.institution_name" class="text-xs text-text-muted dark:text-text-dark-muted">{{ account.institution_name }}</span>
        </div>
      </div>
      <p class="text-xl font-bold text-text-main dark:text-text-dark-main">
        {{ maskValue(formatCurrency(account.balance, account.currency)) }}
      </p>
    </div>
    <!-- The sync's own refusal, in the same place as the reconciliation gap:
         both explain the balance shown right above them. -->
    <div
      v-if="syncFailure"
      class="mt-3 flex items-start gap-2 p-2 rounded-input bg-danger/10 border border-danger/20 text-danger text-xs"
    >
      <TriangleAlert class="w-4 h-4 shrink-0" />
      <div class="min-w-0">
        <p>Synchronisation impossible : {{ syncFailure }}</p>
        <!-- A failure is not retried on its own before tomorrow: this is the
             way to try again once the cause is fixed. -->
        <button
          v-if="account.sync_error && openBankingEnabled"
          type="button"
          class="mt-1 font-medium underline underline-offset-2 disabled:opacity-50"
          :disabled="retrying"
          @click.stop="retrySync"
        >
          {{ retrying ? 'Nouvelle tentative…' : 'Réessayer' }}
        </button>
      </div>
    </div>

    <!--
      The bank publishes a single OTHR balance on a card account
      and no accounting one. A curve is walked back *from* a balance, so
      there is nothing to draw it from — by design, not by failure. Said
      permanently rather than only after a sync: a balance with no history is
      exactly what a broken connection looks like.
    -->
    <p
      v-else-if="account.reconciliation_status === 'not_reconcilable'"
      class="mt-3 text-xs text-text-muted dark:text-text-dark-muted"
    >
      Courbe non tracée : votre banque ne publie pas de solde comptable pour ce compte carte.
    </p>

    <!--
      The curve rests on an available balance (ITAV): the bank publishes no
      accounting one at all. Said permanently, like the card case above, and
      in the neutral tone — the account is healthy, its curve is simply
      approximate while an operation is blocked but not yet booked.
    -->
    <div
      v-else-if="account.reconciliation_status === 'estimated'"
      class="mt-3 flex items-center gap-1 text-xs text-text-muted dark:text-text-dark-muted"
    >
      Courbe estimée
      <BaseHelpPopover label="Pourquoi estimée ?">
        Votre banque ne publie que le solde disponible, opérations en attente déduites.
        La courbe peut être décalée du montant des paiements pas encore comptabilisés.
      </BaseHelpPopover>
    </div>

    <!--
      Shown only when reconciliation_status === 'gap'. The balance
      itself is the bank's and is right; what the check doubts is the list of
      operations since the previous sync, so that is what the message talks
      about — in the user's terms, not the ledger's.
    -->
    <div
      v-if="account.reconciliation_status === 'gap' && account.reconciliation_gap != null"
      class="mt-3 flex items-start gap-2 p-2 rounded-input bg-warning/10 border border-warning/20 text-warning text-xs"
    >
      <TriangleAlert class="w-4 h-4 shrink-0" />
      <div class="min-w-0 flex-1">
        <p>
          Opérations incomplètes : votre banque compte
          {{ maskValue(formatCurrency(Math.abs(account.reconciliation_gap), account.currency)) }}
          de {{ gapDirection }} de plus que les opérations reçues depuis la synchronisation précédente.
        </p>
        <button
          v-if="openBankingEnabled"
          type="button"
          class="mt-1 font-medium underline underline-offset-2 disabled:opacity-50"
          :disabled="reseeding"
          @click.stop="reseedHistory"
        >
          {{ reseeding ? 'Récupération…' : 'Récupérer les opérations' }}
        </button>
      </div>
      <span class="shrink-0 -my-1">
        <BaseHelpPopover label="Qu'est-ce que cet écart ?" width="md">
          Le solde affiché vient de votre banque : il est juste. À chaque synchronisation,
          CapitalView vérifie que le solde précédent plus les opérations reçues depuis
          redonnent bien ce solde. Quand ce n'est pas le cas, une opération manque ou est
          comptée deux fois : les totaux de l'onglet Opérations et la courbe avant cette date
          sont décalés d'autant. « Récupérer les opérations » redemande tout l'historique à
          votre banque.
        </BaseHelpPopover>
      </span>
    </div>

    <!-- Syncing daily over a history the bank never sent reads as healthy on
         every other signal — the curve is simply flat where nothing arrived.
         Naming it is the difference between three weeks of confusion and one
         click. -->
    <div
      v-if="account.is_linked && account.history_pending && openBankingEnabled"
      class="mt-3 flex items-start gap-2 p-2 rounded-input bg-warning/10 border border-warning/20 text-warning text-xs"
    >
      <TriangleAlert class="w-4 h-4 shrink-0" />
      <div class="min-w-0">
        <p>
          Historique incomplet : votre banque n'a pas encore renvoyé les opérations
          antérieures au rattachement. La courbe est plate sur cette période.
          Certaines banques ne l'envoient qu'au moment de la connexion : si rien ne
          revient, reconnectez-la.
        </p>
        <button
          type="button"
          class="mt-1 font-medium underline underline-offset-2 disabled:opacity-50"
          :disabled="reseeding"
          @click.stop="reseedHistory"
        >
          {{ reseeding ? 'Récupération…' : 'Récupérer l\'historique' }}
        </button>
      </div>
    </div>

    <!-- mt-auto: the footer sits at the bottom whatever the card above says,
         so the cards of one row line up. -->
    <div class="mt-auto pt-4 flex items-center justify-between gap-2">
      <!-- An imported account has no sync to report: when its balance last changed is what it has. -->
      <p v-if="!account.is_linked" class="text-xs text-text-muted dark:text-text-dark-muted">
        Mis à jour le {{ formatDate(account.balance_updated_at ?? account.updated_at) }}
      </p>
      <span v-else />
      <div class="flex items-center gap-1">
        <BaseButton size="sm" variant="ghost" :aria-label="`Modifier ${account.name}`" @click.stop="emit('edit', account)">
          <Pencil class="w-4 h-4" />
        </BaseButton>
        <span class="flex items-center gap-0.5 text-sm font-medium text-primary">
          Opérations
          <ChevronRight class="w-4 h-4" />
        </span>
      </div>
    </div>
  </BaseCard>
</template>

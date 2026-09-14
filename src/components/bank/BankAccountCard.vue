<script setup lang="ts">
/**
 * One bank account on the Banque page: its balance, what its bank link says,
 * and every reason the balance or the curve may not be what the user expects.
 */
import { computed, ref } from 'vue'
import { Pencil, RefreshCw, TriangleAlert } from 'lucide-vue-next'

import { useBankStore } from '@/stores/bank'
import { useSettingsStore } from '@/stores/settings'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { BaseBadge, BaseButton, BaseCard } from '@/components'
import type { BankAccountResponse, LinkStatus } from '@/types'

const props = defineProps<{ account: BankAccountResponse }>()
const emit = defineEmits<{
  edit: [account: BankAccountResponse]
  /** A retry or a history re-fetch went through: the curves are stale. */
  refreshed: []
}>()

const bank = useBankStore()
const settingsStore = useSettingsStore()
const { formatCurrency, formatDate, formatAccountType } = useFormatters()
const { maskValue } = usePrivacyMode()

const LINK_STATUS_BADGE: Record<LinkStatus, { label: string; variant: 'warning' | 'secondary' }> = {
  connected: { label: 'connecté', variant: 'secondary' },
  reconnect_required: { label: 'à reconnecter', variant: 'warning' },
}

const openBankingEnabled = computed(() => settingsStore.settings?.open_banking_enabled ?? false)

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

async function retrySync(): Promise<void> {
  retrying.value = true
  try {
    await bank.retrySync(props.account.id)
    emit('refreshed')
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
    emit('refreshed')
  } finally {
    reseeding.value = false
  }
}
</script>

<template>
  <BaseCard hoverable>
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
              :variant="LINK_STATUS_BADGE[account.link_status].variant"
            >
              {{ LINK_STATUS_BADGE[account.link_status].label }}
            </BaseBadge>
          </template>
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
          @click="retrySync"
        >
          {{ retrying ? 'Nouvelle tentative…' : 'Réessayer' }}
        </button>
      </div>
    </div>

    <!--
      Ruling R19: the bank publishes a single OTHR balance on a card account
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
    <p
      v-else-if="account.reconciliation_status === 'estimated'"
      class="mt-3 text-xs text-text-muted dark:text-text-dark-muted"
    >
      Courbe estimée : votre banque ne publie que le solde disponible, opérations en attente
      déduites. La courbe peut être décalée du montant des paiements non encore comptabilisés.
    </p>

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
          @click="reseedHistory"
        >
          {{ reseeding ? 'Récupération…' : 'Récupérer l\'historique' }}
        </button>
      </div>
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
          <!-- A measured limit, not an apology: how far back the bank served
               this account. Stated rather than offered as a retry, because a
               bank that caps its history answers a retry the same way. -->
          <p
            v-if="!account.history_pending && account.history_served_from"
            class="text-xs text-text-muted dark:text-text-dark-muted"
          >
            Historique bancaire depuis le {{ formatDate(account.history_served_from) }}
          </p>
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
        <BaseButton size="sm" variant="ghost" :aria-label="`Modifier ${account.name}`" @click="emit('edit', account)">
          <Pencil class="w-4 h-4" />
        </BaseButton>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
/**
 * Every account on one list, each with its own figure and, for a bank, how
 * fresh that figure is: a balance is only as true as its last sync.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useDisplayLocale } from '@/composables/useDisplayLocale'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { AccountSummaryResponse, BankAccountResponse } from '@/types'

const props = defineProps<{
  bankAccounts: BankAccountResponse[]
  investmentAccounts: AccountSummaryResponse[]
  placementsValue: number | null
}>()

const { formatCurrency, formatPercent, formatAccountType, profitLossClass } = useFormatters()
const { maskValue } = usePrivacyMode()
const { effectiveLocale } = useDisplayLocale()

const sortedBank = computed(() => [...props.bankAccounts].sort((a, b) => Number(b.balance) - Number(a.balance)))
const sortedInvestments = computed(() =>
  [...props.investmentAccounts].sort((a, b) => Number(b.current_value ?? 0) - Number(a.current_value ?? 0)),
)

function day(value: string): string {
  return new Intl.DateTimeFormat(effectiveLocale.value, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${value.slice(0, 10)}T00:00:00Z`),
  )
}

function typeLabel(account: AccountSummaryResponse): string {
  return account.account_type === 'CRYPTO' ? 'Crypto' : formatAccountType(account.account_type)
}

function freshness(account: BankAccountResponse): { text: string; warn: boolean } {
  if (account.link_status === 'reconnect_required') return { text: 'À reconnecter', warn: true }
  if (account.sync_error) return { text: 'Synchro en échec', warn: true }
  if (account.is_linked) return { text: account.last_synced_at ? `Synchro ${day(account.last_synced_at)}` : 'Jamais synchronisé', warn: false }
  return { text: 'Saisie manuelle', warn: false }
}
</script>

<template>
  <div class="space-y-5">
    <section v-if="sortedBank.length" aria-labelledby="accounts-bank">
      <h4 id="accounts-bank" class="mb-1 text-xs font-medium text-text-muted dark:text-text-dark-muted">Banque</h4>
      <ul class="divide-y divide-surface-border dark:divide-surface-dark-border">
        <li v-for="account in sortedBank" :key="account.id" class="flex items-baseline justify-between gap-3 py-2 text-sm">
          <div class="min-w-0">
            <RouterLink :to="{ name: 'bank' }" class="block truncate font-medium text-text-main hover:text-primary dark:text-text-dark-main">
              {{ account.name }}
            </RouterLink>
            <p class="text-xs" :class="freshness(account).warn ? 'text-warning' : 'text-text-muted dark:text-text-dark-muted'">
              {{ freshness(account).text }}
            </p>
          </div>
          <span class="shrink-0 tabular-nums text-text-main dark:text-text-dark-main">
            {{ maskValue(formatCurrency(account.balance, account.currency)) }}
          </span>
        </li>
      </ul>
    </section>

    <section v-if="sortedInvestments.length || placementsValue" aria-labelledby="accounts-investments">
      <h4 id="accounts-investments" class="mb-1 text-xs font-medium text-text-muted dark:text-text-dark-muted">Investissements</h4>
      <ul class="divide-y divide-surface-border dark:divide-surface-dark-border">
        <li v-for="account in sortedInvestments" :key="account.account_id" class="flex items-baseline justify-between gap-3 py-2 text-sm">
          <div class="min-w-0">
            <RouterLink
              :to="{ name: account.account_type === 'CRYPTO' ? 'crypto' : 'stock' }"
              class="block truncate font-medium text-text-main hover:text-primary dark:text-text-dark-main"
            >
              {{ account.account_name }}
            </RouterLink>
            <p v-if="typeLabel(account) !== account.account_name" class="text-xs text-text-muted dark:text-text-dark-muted">
              {{ typeLabel(account) }}
            </p>
          </div>
          <div class="shrink-0 text-right tabular-nums">
            <p class="text-text-main dark:text-text-dark-main">
              {{ maskValue(formatCurrency(Number(account.current_value ?? 0) + Number(account.cash_balance ?? 0), account.currency)) }}
            </p>
            <p v-if="account.profit_loss_percentage !== null" class="text-xs" :class="profitLossClass(account.profit_loss_percentage)">
              {{ formatPercent(account.profit_loss_percentage) }}
            </p>
          </div>
        </li>
        <li v-if="placementsValue" class="flex items-baseline justify-between gap-3 py-2 text-sm">
          <RouterLink :to="{ name: 'placements' }" class="font-medium text-text-main hover:text-primary dark:text-text-dark-main">
            Placements
          </RouterLink>
          <span class="shrink-0 tabular-nums text-text-main dark:text-text-dark-main">{{ maskValue(formatCurrency(placementsValue)) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

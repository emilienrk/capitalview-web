<script setup lang="ts">
/**
 * The one figure the dashboard exists for: the whole net worth, how far it
 * moved since dated snapshots, and what it is made of.
 *
 * Each change names the day it is measured from rather than "yesterday" or
 * "this month": a missing snapshot moves the reference, and the label has to
 * move with it to stay true.
 */
import { RouterLink } from 'vue-router'
import { BaseSkeleton } from '@/components'
import CompositionBar from '@/components/dashboard/CompositionBar.vue'
import { useDisplayLocale } from '@/composables/useDisplayLocale'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { CompositionSegment, NetWorthChange } from '@/utils/netWorth'

withDefaults(
  defineProps<{
    total: number | null
    changes: NetWorthChange[]
    composition: CompositionSegment[]
    cashUncounted: boolean
    pricesLive: boolean
    loading: boolean
    layout?: 'mobile' | 'desktop'
  }>(),
  { layout: 'mobile' },
)

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()
const { effectiveLocale } = useDisplayLocale()

function since(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  const sameYear = date.getUTCFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat(effectiveLocale.value, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(date)
}

function signed(value: number): string {
  const amount = maskValue(formatCurrency(Math.abs(value)))
  return `${value < 0 ? '−' : '+'}${amount}`
}

function percent(value: number | null): string {
  if (value === null) return ''
  const formatted = Math.abs(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${value < 0 ? '−' : '+'}${formatted} %`
}

function tone(value: number): string {
  if (Math.abs(value) < 0.005) return 'text-text-main dark:text-text-dark-main'
  return value > 0 ? 'text-success' : 'text-danger'
}
</script>

<template>
  <section aria-labelledby="net-worth-title" class="flex flex-1 flex-col">
    <h2 id="net-worth-title" class="text-sm font-medium text-text-muted dark:text-text-dark-muted">
      Patrimoine net
    </h2>

    <template v-if="loading && total === null">
      <BaseSkeleton variant="rect" width="14rem" height="2.75rem" class="mt-2" />
      <BaseSkeleton variant="rect" width="100%" height="0.5rem" class="mt-6" />
    </template>

    <template v-else-if="total !== null">
      <p
        class="cv-figure mt-1 font-bold tabular-nums tracking-tight text-text-main dark:text-text-dark-main"
        :class="layout === 'desktop' ? 'text-5xl' : 'text-4xl'"
      >
        {{ maskValue(formatCurrency(total)) }}
      </p>

      <ul
        v-if="changes.length"
        class="mt-3 text-sm"
        :class="layout === 'desktop' ? 'flex flex-wrap gap-x-6 gap-y-1' : 'space-y-1'"
      >
        <li
          v-for="change in changes"
          :key="change.key"
          :class="layout === 'desktop' ? '' : 'flex items-baseline justify-between gap-3'"
        >
          <span class="font-semibold tabular-nums" :class="tone(change.diff)">
            {{ signed(change.diff) }}
            <span v-if="change.percent !== null" class="font-medium">({{ percent(change.percent) }})</span>
          </span>
          <span class="text-text-muted dark:text-text-dark-muted" :class="layout === 'desktop' ? 'ml-1.5' : ''">
            depuis le {{ since(change.since) }}
          </span>
        </li>
      </ul>

      <p v-if="cashUncounted" class="mt-3 text-sm text-warning">
        Un compte en devise sans cours publié compte pour 0 € dans ce total.
        <RouterLink :to="{ name: 'bank' }" class="font-medium underline underline-offset-2">Voir la banque</RouterLink>
      </p>
      <p v-else-if="!pricesLive" class="mt-3 text-xs text-text-muted dark:text-text-dark-muted" role="status">
        Cours enregistrés, mise à jour en cours…
      </p>

      <!-- Pinned to the bottom when the card is stretched taller than its content. -->
      <CompositionBar
        class="mt-auto pt-6"
        :segments="composition"
        :columns="layout === 'desktop' ? 2 : 1"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
/**
 * The Banque section's Récurrent tab: every recurring charge found in the
 * operations, what the running ones cost a month, and the ones still to
 * confirm, ended or refused, folded away underneath.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { Repeat } from 'lucide-vue-next'

import { BaseAlert, BaseButton, BaseCard, BaseCollapsible, BaseEmptyState, BaseSkeleton } from '@/components'
import BankRecurringRow from '@/components/bank/BankRecurringRow.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useBankStore } from '@/stores/bank'
import { useRecurringStore } from '@/stores/recurring'
import { NATURE_LABELS, historyByNature, isCounted, isCurrent, isInTotal } from '@/utils/recurring'
import type { BankRecurringItem } from '@/types'

const bank = useBankStore()
const store = useRecurringStore()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

const failed = ref(false)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  failed.value = false
  try {
    await store.fetchList()
  } catch {
    failed.value = true
  }
}

watch(() => bank.dataRevision, () => void load())
onMounted(() => void load())

const list = computed(() => store.list)
const items = computed(() => list.value?.items ?? [])
const current = computed(() => items.value.filter(isCurrent))
// Everything that is added up holds to the response's own currency, as the API
// does: a charge in another one is listed, never folded into a sum in euros.
const inCurrency = (item: BankRecurringItem) => item.currency === list.value?.currency
// The totals leave a late one out: it may already be over. It stays listed.
const counted = computed(() => items.value.filter((item) => isInTotal(item) && inCurrency(item)))

// Grouped by what the user filed them as, the heaviest group first, the ones
// still to file last. Nothing is judged here: the groups only gather.
const groups = computed(() => {
  const gathered = new Map<string, { title: string; items: BankRecurringItem[]; monthly: number }>()
  for (const item of current.value) {
    const key = item.nature ?? 'unfiled'
    const group = gathered.get(key)
      ?? { title: item.nature ? NATURE_LABELS[item.nature] : 'À classer', items: [], monthly: 0 }
    group.items.push(item)
    if (isInTotal(item) && inCurrency(item)) group.monthly += Number(item.monthly_equivalent)
    gathered.set(key, group)
  }
  return [...gathered]
    .sort(([a, one], [b, two]) => (a === 'unfiled' ? 1 : b === 'unfiled' ? -1 : two.monthly - one.monthly))
    .map(([, group]) => group)
})
const grouped = computed(() => groups.value.some((group) => group.title !== 'À classer'))

// Counted ones only, ended ones in: what was really paid, year by year.
const history = computed(() => historyByNature(items.value.filter((item) => isCounted(item) && inCurrency(item))))
const candidates = computed(() => items.value.filter((item) => item.state === 'candidate'))
const ended = computed(() => items.value.filter((item) => isCounted(item) && !isCurrent(item)))
const refused = computed(() => items.value.filter((item) => item.state === 'refused'))

const folded = computed(() => [
  { key: 'candidates', title: 'À confirmer', items: candidates.value, open: true },
  { key: 'ended', title: 'Terminés', items: ended.value, open: false },
  { key: 'refused', title: 'Pas récurrents', items: refused.value, open: false },
].filter((section) => section.items.length))

function amount(value: number): string {
  return maskValue(formatCurrency(Number(value), list.value?.currency ?? 'EUR'))
}
</script>

<template>
  <div>
    <BaseCard class="mb-6">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">Paiements récurrents</p>
      <p v-if="list" class="text-3xl font-bold tabular-nums text-text-main dark:text-text-dark-main">
        {{ amount(list.monthly_total) }}
        <span class="text-base font-medium text-text-muted dark:text-text-dark-muted">/ mois</span>
      </p>
      <BaseSkeleton v-else variant="rect" width="10rem" height="2.25rem" />
      <p v-if="list" class="mt-1 text-sm text-text-muted dark:text-text-dark-muted">
        Soit {{ amount(list.annual_total) }} par an pour {{ counted.length }} paiement{{ counted.length > 1 ? 's' : '' }} récurrent{{ counted.length > 1 ? 's' : '' }} :
        loyer, énergie, forfaits, assurances, abonnements… toute dépense qui revient.
      </p>
    </BaseCard>

    <BaseAlert v-if="error" variant="danger" dismissible class="mb-3" @dismiss="error = null">{{ error }}</BaseAlert>

    <div v-if="failed" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">Impossible de charger les paiements récurrents.</p>
      <BaseButton size="sm" variant="outline" @click="load">Réessayer</BaseButton>
    </div>

    <BaseCard v-else-if="!list" :padding="false">
      <div class="p-4 sm:p-6 space-y-3">
        <BaseSkeleton v-for="i in 5" :key="i" variant="rect" width="100%" height="3.25rem" />
      </div>
    </BaseCard>

    <BaseEmptyState
      v-else-if="!items.length"
      title="Aucun paiement récurrent trouvé"
      description="CapitalView les repère dans les opérations de vos comptes : reliez ou importez un compte, puis laissez passer quelques échéances. Le reste de l'app n'en dépend pas."
    >
      <template #icon>
        <Repeat class="w-8 h-8 text-text-muted dark:text-text-dark-muted" />
      </template>
    </BaseEmptyState>

    <div v-else class="space-y-4">
      <template v-if="grouped">
        <section v-for="group in groups" :key="group.title">
          <!-- The total stays even at zero: it is the explanation's only anchor. -->
          <h2
            class="mb-1.5 text-sm font-semibold text-text-main dark:text-text-dark-main"
            title="Un paiement en retard, ou dans une autre devise, est listé sans être compté."
          >
            {{ group.title }}
            <span class="font-normal text-text-muted dark:text-text-dark-muted">· {{ amount(group.monthly) }} / mois</span>
          </h2>
          <BaseCard :padding="false" class="overflow-hidden">
            <ul class="divide-y divide-surface-border dark:divide-surface-dark-border">
              <BankRecurringRow v-for="item in group.items" :key="item.key" :item="item" @failed="error = $event" />
            </ul>
          </BaseCard>
        </section>
      </template>

      <BaseCard v-else-if="current.length" :padding="false" class="overflow-hidden">
        <ul class="divide-y divide-surface-border dark:divide-surface-dark-border">
          <BankRecurringRow v-for="item in current" :key="item.key" :item="item" @failed="error = $event" />
        </ul>
      </BaseCard>

      <BaseCollapsible v-if="history.length" title="Ce que ça a coûté, année par année" :default-open="false">
        <div class="-mx-4 space-y-3">
          <div v-for="line in history" :key="line.nature ?? 'unfiled'">
            <p class="flex items-baseline justify-between gap-3 text-sm">
              <span class="font-medium text-text-main dark:text-text-dark-main">
                {{ line.nature ? NATURE_LABELS[line.nature] : 'À classer' }}
              </span>
              <span class="tabular-nums text-text-muted dark:text-text-dark-muted">{{ amount(line.total) }} en tout</span>
            </p>
            <p class="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted dark:text-text-dark-muted">
              <span v-for="year in line.years" :key="year.year" class="tabular-nums">
                {{ year.year }} {{ amount(year.amount) }}
              </span>
            </p>
          </div>
        </div>
      </BaseCollapsible>

      <BaseCollapsible
        v-for="section in folded"
        :key="section.key"
        :title="`${section.title} (${section.items.length})`"
        :default-open="section.open"
      >
        <ul class="-mx-4 divide-y divide-surface-border dark:divide-surface-dark-border">
          <BankRecurringRow v-for="item in section.items" :key="item.key" :item="item" @failed="error = $event" />
        </ul>
      </BaseCollapsible>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Banque section's Récurrent tab: every recurring charge — or, switched
 * over, every recurring income — found in the operations, what the running
 * ones weigh a month, the ones still to confirm first, then every category
 * with its ended ones folded at its foot. The direction lives in the query
 * string, so the real cashflow can link straight to the income.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronDown, ChevronRight, Repeat } from 'lucide-vue-next'

import {
  BaseButton, BaseCard, BaseCollapsible, BaseEmptyState, BaseSegmentedControl, BaseSkeleton,
} from '@/components'
import BankHistoryModal from '@/components/bank/BankHistoryModal.vue'
import BankRecurringCategoryModal from '@/components/bank/BankRecurringCategoryModal.vue'
import BankRecurringRow from '@/components/bank/BankRecurringRow.vue'
import { useFormatters } from '@/composables/useFormatters'
import { toastWhileSet } from '@/composables/useToast'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useBankStore } from '@/stores/bank'
import { useRecurringStore } from '@/stores/recurring'
import { NATURE_LABELS, isCounted, isCurrent, isInTotal } from '@/utils/recurring'
import type { BankRecurringItem, RecurringDecisionKind, RecurringDirection, RecurringNature } from '@/types'

const bank = useBankStore()
const store = useRecurringStore()
const route = useRoute()
const router = useRouter()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

function readDirection(value: unknown): RecurringDirection {
  return value === 'income' ? 'income' : 'expense'
}

const direction = ref<RecurringDirection>(readDirection(route.query.direction))
const directionOptions = [
  { label: 'Dépenses', value: 'expense' },
  { label: 'Revenus', value: 'income' },
]
const income = computed(() => direction.value === 'income')

function chooseDirection(value: string | number): void {
  direction.value = readDirection(value)
  error.value = null
  void router.replace({ query: { ...route.query, direction: income.value ? 'income' : undefined } })
}

const failed = ref(false)
const error = ref<string | null>(null)
toastWhileSet(error)

async function load(): Promise<void> {
  failed.value = false
  try {
    await store.fetchList(direction.value)
  } catch {
    failed.value = true
  }
}

watch(() => route.query.direction, (value) => { direction.value = readDirection(value) })
watch(direction, () => void load())
watch(() => bank.dataRevision, () => void load())
onMounted(() => void load())

const list = computed(() => store.lists[direction.value])
const items = computed(() => list.value?.items ?? [])
// Everything that is added up holds to the response's own currency, as the API
// does: a charge in another one is listed, never folded into a sum in euros.
const inCurrency = (item: BankRecurringItem) => item.currency === list.value?.currency
// The totals leave a late one out: it may already be over. It stays listed.
const counted = computed(() => items.value.filter((item) => isInTotal(item) && inCurrency(item)))

// Grouped by what the user filed them as, the heaviest group first, the ones
// still to file last. Nothing is judged here: the groups only gather. A
// category keeps its ended ones, folded under its running ones: an old lease
// stays with the rent, and a category ended whole still has its place.
interface Group {
  key: string
  nature: RecurringNature | null
  title: string
  items: BankRecurringItem[]
  ended: BankRecurringItem[]
  monthly: number
}
const groups = computed(() => {
  const gathered = new Map<string, Group>()
  for (const item of items.value.filter(isCounted)) {
    const key = item.nature ?? 'unfiled'
    const group = gathered.get(key) ?? {
      key, nature: item.nature, title: item.nature ? NATURE_LABELS[item.nature] : 'À classer', items: [], ended: [], monthly: 0,
    }
    if (isCurrent(item)) group.items.push(item)
    else group.ended.push(item)
    if (isInTotal(item) && inCurrency(item)) group.monthly += Number(item.monthly_equivalent)
    gathered.set(key, group)
  }
  return [...gathered]
    .sort(([a, one], [b, two]) => (a === 'unfiled' ? 1 : b === 'unfiled' ? -1 : two.monthly - one.monthly))
    .map(([, group]) => group)
})
const grouped = computed(() => groups.value.some((group) => group.title !== 'À classer'))

// A category over its whole history: the ended ones of its nature join the running ones.
const category = ref<RecurringNature | null>(null)
const categoryItems = computed(() =>
  category.value ? items.value.filter((item) => isCounted(item) && item.nature === category.value) : [],
)

const openEnded = ref(new Set<string>())
function toggleEnded(key: string): void {
  const next = new Set(openEnded.value)
  if (!next.delete(key)) next.add(key)
  openEnded.value = next
}

const candidates = computed(() => items.value.filter((item) => item.state === 'candidate'))
// A no is rarely taken back: no section of its own, only the way to the
// answers' history, where each one can be withdrawn.
const refused = computed(() => items.value.filter((item) => item.state === 'refused'))
const showHistory = ref(false)

// What can be merged: anything of the list not refused, the API refusing a
// payment with an income anyway.
const mergeable = computed(() => items.value.filter((item) => item.state !== 'refused'))

/** Said here: the row answered has moved to another section by the time a failure comes back. */
async function answer(item: BankRecurringItem, decision: RecurringDecisionKind, name?: string): Promise<void> {
  try {
    await store.answer(item, decision, name)
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Impossible d'enregistrer ce choix."
  }
}

function amount(value: number): string {
  return maskValue(formatCurrency(Number(value), list.value?.currency ?? 'EUR'))
}
</script>

<template>
  <div>
    <div class="mb-4">
      <BaseSegmentedControl
        :model-value="direction"
        :options="directionOptions"
        size="sm"
        aria-label="Dépenses ou revenus récurrents"
        @update:model-value="chooseDirection"
      />
    </div>

    <BaseCard class="mb-6">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">{{ income ? 'Revenus récurrents' : 'Paiements récurrents' }}</p>
      <p v-if="list" class="text-3xl font-bold tabular-nums text-text-main dark:text-text-dark-main">
        <span v-if="income" class="text-base font-medium text-text-muted dark:text-text-dark-muted">rapportent</span>
        {{ amount(list.monthly_total) }}
        <span class="text-base font-medium text-text-muted dark:text-text-dark-muted">/ mois</span>
      </p>
      <BaseSkeleton v-else variant="rect" width="10rem" height="2.25rem" />
      <p v-if="list && income" class="mt-1 text-sm text-text-muted dark:text-text-dark-muted">
        Soit {{ amount(list.annual_total) }} par an pour {{ counted.length }} revenu{{ counted.length > 1 ? 's' : '' }} récurrent{{ counted.length > 1 ? 's' : '' }} :
        salaire, aides, pension, loyers perçus… toute entrée qui revient.
      </p>
      <p v-else-if="list" class="mt-1 text-sm text-text-muted dark:text-text-dark-muted">
        Soit {{ amount(list.annual_total) }} par an pour {{ counted.length }} paiement{{ counted.length > 1 ? 's' : '' }} récurrent{{ counted.length > 1 ? 's' : '' }} :
        loyer, énergie, forfaits, assurances, abonnements… toute dépense qui revient.
      </p>
    </BaseCard>

    <div v-if="failed" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">
        Impossible de charger les {{ income ? 'revenus' : 'paiements' }} récurrents.
      </p>
      <BaseButton size="sm" variant="outline" @click="load">Réessayer</BaseButton>
    </div>

    <BaseCard v-else-if="!list" :padding="false">
      <div class="p-4 sm:p-6 space-y-3">
        <BaseSkeleton v-for="i in 5" :key="i" variant="rect" width="100%" height="3.25rem" />
      </div>
    </BaseCard>

    <BaseEmptyState
      v-else-if="!items.length"
      :title="income ? 'Aucun revenu récurrent trouvé' : 'Aucun paiement récurrent trouvé'"
      description="CapitalView les repère dans les opérations de vos comptes : reliez ou importez un compte, puis laissez passer quelques échéances. Le reste de l'app n'en dépend pas."
    >
      <template #icon>
        <Repeat class="w-8 h-8 text-text-muted dark:text-text-dark-muted" />
      </template>
    </BaseEmptyState>

    <div v-else class="space-y-4">
      <BaseCollapsible v-if="candidates.length" :title="`À confirmer (${candidates.length})`" default-open>
        <ul class="-mx-4 divide-y divide-surface-border dark:divide-surface-dark-border">
          <BankRecurringRow
            v-for="item in candidates" :key="item.key" :item="item" :others="mergeable" @failed="error = $event"
            @answer="(decision, name) => answer(item, decision, name)"
          />
        </ul>
      </BaseCollapsible>

      <section v-for="group in groups" :key="group.key">
        <!-- The total stays even at zero: it is the explanation's only anchor. -->
        <h2
          v-if="grouped"
          class="mb-1.5 text-sm font-semibold text-text-main dark:text-text-dark-main"
          :title="`Un ${income ? 'revenu' : 'paiement'} en retard, ou dans une autre devise, est listé sans être compté.`"
        >
          <button
            v-if="group.nature"
            type="button"
            class="inline-flex items-center gap-1 hover:text-primary transition-colors"
            :aria-label="`${group.title} : voir la catégorie`"
            @click="category = group.nature"
          >
            {{ group.title }}
            <span class="font-normal text-text-muted dark:text-text-dark-muted">· {{ amount(group.monthly) }} / mois</span>
            <ChevronRight class="w-3.5 h-3.5 text-text-muted dark:text-text-dark-muted" />
          </button>
          <template v-else>
            {{ group.title }}
            <span class="font-normal text-text-muted dark:text-text-dark-muted">· {{ amount(group.monthly) }} / mois</span>
          </template>
        </h2>
        <BaseCard :padding="false" class="overflow-hidden">
          <ul class="divide-y divide-surface-border dark:divide-surface-dark-border">
            <BankRecurringRow
              v-for="item in group.items" :key="item.key" :item="item" :others="mergeable" @failed="error = $event"
              @answer="(decision, name) => answer(item, decision, name)"
            />
            <li v-if="group.ended.length">
              <button
                type="button"
                class="w-full flex items-center gap-1.5 px-4 sm:px-6 py-2.5 text-left text-xs font-medium text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main transition-colors"
                :aria-expanded="openEnded.has(group.key)"
                @click="toggleEnded(group.key)"
              >
                <ChevronDown :class="['w-3.5 h-3.5 transition-transform', openEnded.has(group.key) ? 'rotate-180' : '']" />
                {{ group.ended.length }} terminé{{ group.ended.length > 1 ? 's' : '' }}
              </button>
            </li>
            <template v-if="openEnded.has(group.key)">
              <BankRecurringRow
                v-for="item in group.ended" :key="item.key" :item="item" :others="mergeable" @failed="error = $event"
                @answer="(decision, name) => answer(item, decision, name)"
              />
            </template>
          </ul>
        </BaseCard>
      </section>

      <p v-if="refused.length" class="text-xs text-text-muted dark:text-text-dark-muted">
        {{ refused.length }} écarté{{ refused.length > 1 ? 's' : '' }} comme non récurrent{{ refused.length > 1 ? 's' : '' }} ·
        <button
          type="button"
          class="font-medium hover:text-text-main dark:hover:text-text-dark-main hover:underline"
          @click="showHistory = true"
        >
          Historique de mes réponses
        </button>
      </p>
    </div>
    <BankHistoryModal :open="showHistory" @close="showHistory = false" />
    <BankRecurringCategoryModal
      :open="category !== null"
      :title="category ? NATURE_LABELS[category] : ''"
      :items="categoryItems"
      :currency="list?.currency ?? 'EUR'"
      :income="income"
      @close="category = null"
    />
  </div>
</template>

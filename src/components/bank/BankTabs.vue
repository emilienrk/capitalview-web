<script setup lang="ts">
/**
 * The Banque section's views. Routes rather than in-page state, so an
 * account's operations can be linked to and survive a reload.
 */
import { nextTick, onMounted, ref, watch } from 'vue'
import { ArrowLeftRight, ListChecks, Repeat, Wallet } from 'lucide-vue-next'
import { useRoute } from 'vue-router'

import { useBankStore } from '@/stores/bank'

const route = useRoute()
const bank = useBankStore()

// The pairs waiting for the user, wherever they are in the history: the tab
// says so from the Comptes view too, since nothing else would.
onMounted(() => void bank.fetchTransferQuestions())
watch(() => bank.dataRevision, () => void bank.fetchTransferQuestions())

// On a phone the strip scrolls: the tab shown is brought into it, never left
// under the edge. Horizontal only, so the page itself does not move.
const strip = ref<HTMLElement | null>(null)
function showActive(): void {
  const active = strip.value?.querySelector<HTMLElement>('[aria-current="page"]')
  if (!strip.value || !active) return
  strip.value.scrollLeft = active.offsetLeft - (strip.value.clientWidth - active.offsetWidth) / 2
}
onMounted(showActive)
watch(() => route.name, () => void nextTick(showActive))

const tabs = [
  { name: 'bank', label: 'Comptes', icon: Wallet },
  { name: 'bank-review', label: 'À trier', icon: ListChecks },
  { name: 'bank-transactions', label: 'Opérations', icon: ArrowLeftRight },
  { name: 'bank-recurring', label: 'Récurrent', icon: Repeat },
] as const
</script>

<template>
  <nav ref="strip" class="relative mb-6 flex gap-1 overflow-x-auto border-b border-surface-border dark:border-surface-dark-border">
    <router-link
      v-for="tab in tabs"
      :key="tab.name"
      :to="{ name: tab.name }"
      :class="[
        '-mb-px flex shrink-0 items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors duration-150',
        route.name === tab.name
          ? 'border-primary text-primary'
          : 'border-transparent text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main',
      ]"
    >
      <component :is="tab.icon" class="w-4 h-4" :stroke-width="1.75" />
      {{ tab.label }}
      <span
        v-if="tab.name === 'bank-review' && bank.transferQuestions?.total"
        class="min-w-5 h-5 px-1.5 rounded-full bg-warning/15 text-warning text-xs font-semibold leading-5 text-center tabular-nums"
        :title="`${bank.transferQuestions.total} question${bank.transferQuestions.total > 1 ? 's' : ''} à trier`"
      >
        {{ bank.transferQuestions.total }}
      </span>
      <span
        v-if="tab.name === 'bank-recurring' && bank.transferQuestions?.recurring"
        class="min-w-5 h-5 px-1.5 rounded-full bg-warning/15 text-warning text-xs font-semibold leading-5 text-center tabular-nums"
        :title="`${bank.transferQuestions.recurring} récurrent${bank.transferQuestions.recurring > 1 ? 's' : ''} à confirmer`"
      >
        {{ bank.transferQuestions.recurring }}
      </span>
    </router-link>
  </nav>
</template>

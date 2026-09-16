<script setup lang="ts">
/**
 * The Banque section's two views. Routes rather than in-page state, so an
 * account's operations can be linked to and survive a reload.
 */
import { onMounted, watch } from 'vue'
import { ArrowLeftRight, Wallet } from 'lucide-vue-next'
import { useRoute } from 'vue-router'

import { useBankStore } from '@/stores/bank'

const route = useRoute()
const bank = useBankStore()

// The pairs waiting for the user, wherever they are in the history: the tab
// says so from the Comptes view too, since nothing else would.
onMounted(() => void bank.fetchTransferQuestions())
watch(() => bank.dataRevision, () => void bank.fetchTransferQuestions())

const tabs = [
  { name: 'bank', label: 'Comptes', icon: Wallet },
  { name: 'bank-transactions', label: 'Opérations', icon: ArrowLeftRight },
] as const
</script>

<template>
  <nav class="mb-6 flex gap-1 border-b border-surface-border dark:border-surface-dark-border">
    <router-link
      v-for="tab in tabs"
      :key="tab.name"
      :to="{ name: tab.name }"
      :class="[
        '-mb-px flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150',
        route.name === tab.name
          ? 'border-primary text-primary'
          : 'border-transparent text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main',
      ]"
    >
      <component :is="tab.icon" class="w-4 h-4" :stroke-width="1.75" />
      {{ tab.label }}
      <span
        v-if="tab.name === 'bank-transactions' && bank.transferQuestions?.total"
        class="min-w-5 h-5 px-1.5 rounded-full bg-warning/15 text-warning text-xs font-semibold leading-5 text-center tabular-nums"
        :title="`${bank.transferQuestions.total} rapprochement${bank.transferQuestions.total > 1 ? 's' : ''} à vérifier`"
      >
        {{ bank.transferQuestions.total }}
      </span>
    </router-link>
  </nav>
</template>

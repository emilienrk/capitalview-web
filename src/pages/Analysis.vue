<script setup lang="ts">
/**
 * The behavioural analysis page. Assembly only: every block owns its own
 * rendering, so this file stays readable as blocks are added.
 */
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Settings } from 'lucide-vue-next'
import { useAnalysisStore } from '@/stores/analysis'
import { useDarkMode } from '@/composables/useDarkMode'
import PageHeader from '@/components/PageHeader.vue'
import { BaseAlert, BaseButton, BaseEmptyState, BaseSpinner } from '@/components'
import VerdictBanner from '@/components/analytics/VerdictBanner.vue'
import BehaviourSection from '@/components/analytics/sections/BehaviourSection.vue'
import CostSection from '@/components/analytics/sections/CostSection.vue'
import FeesSection from '@/components/analytics/sections/FeesSection.vue'
import HoldingsSection from '@/components/analytics/sections/HoldingsSection.vue'
import PlanSection from '@/components/analytics/sections/PlanSection.vue'
import MethodNotes from '@/components/analytics/sections/MethodNotes.vue'
import { useSettingsStore } from '@/stores/settings'

const analysis = useAnalysisStore()
const settingsStore = useSettingsStore()
const { isDark } = useDarkMode()

const gap = computed(() => analysis.data?.investor_gap ?? null)
const bridge = computed(() => analysis.data?.counterfactual ?? null)
const execution = computed(() => analysis.data?.execution ?? null)
const regularity = computed(() => analysis.data?.regularity ?? null)
const depositLag = computed(() => analysis.data?.deposit_lag ?? null)
const conditioning = computed(() => analysis.data?.market_conditioning ?? null)
const concentration = computed(() => analysis.data?.concentration ?? null)
const turnover = computed(() => analysis.data?.turnover ?? null)
const fees = computed(() => analysis.data?.fees ?? null)
const exits = computed(() => analysis.data?.exits ?? null)
const plan = computed(() => analysis.data?.plan ?? null)

/**
 * Each block stands on its own data — the replay blocks need only transactions
 * and prices, so a portfolio whose daily snapshots have not been rebuilt yet
 * must still see them.
 */
const hasAnyBlock = computed(() =>
  Boolean(
    gap.value ||
      bridge.value ||
      execution.value ||
      regularity.value ||
      depositLag.value ||
      conditioning.value ||
      concentration.value ||
      fees.value ||
      exits.value,
  ),
)

/**
 * Repair a stale cache rather than trust whoever changed the setting.
 *
 * The analysis is cached for an hour, and the benchmark is now set from the
 * settings page. Comparing the two on arrival means the page recovers on its own
 * whichever route was taken to change it — including a second tab.
 */
onMounted(async () => {
  await Promise.all([analysis.fetchAnalytics(), settingsStore.fetchSettings()])

  const declared = settingsStore.settings?.benchmark_asset_key
  if (declared && analysis.data && analysis.data.benchmark_asset_key !== declared) {
    await analysis.fetchAnalytics(true)
  }
})
</script>

<template>
  <div>
    <PageHeader
      title="Analyse"
      description="Ce que tes données disent de ton comportement d'investisseur"
    >
      <template #actions>
        <RouterLink :to="{ path: '/settings', query: { tab: 'analyse' } }">
          <BaseButton variant="outline" size="sm">
            <Settings class="h-4 w-4" stroke-width="2" />
            <span class="hidden sm:inline">Indice et plan cible</span>
          </BaseButton>
        </RouterLink>
      </template>
    </PageHeader>

    <div v-if="analysis.isLoading && !analysis.data" class="flex justify-center py-20">
      <BaseSpinner size="lg" label="Analyse en cours..." />
    </div>

    <BaseAlert v-else-if="analysis.error" variant="danger" class="mb-6">
      {{ analysis.error }}
    </BaseAlert>

    <template v-else>
      <BaseEmptyState
        v-if="!hasAnyBlock"
        title="Pas encore assez d'historique"
        description="L'analyse comportementale demande plusieurs mois d'achats pour dire quoi que ce soit d'utile."
      />

      <template v-else>
        <VerdictBanner v-if="analysis.data?.verdict" :verdict="analysis.data.verdict" />

        <BehaviourSection
          :regularity="regularity"
          :deposit-lag="depositLag"
          :conditioning="conditioning"
          :is-dark="isDark"
        />

        <CostSection
          :gap="gap"
          :bridge="bridge"
          :execution="execution"
          :is-dark="isDark"
        />

        <HoldingsSection
          :concentration="concentration"
          :turnover="turnover"
          :is-dark="isDark"
        />

        <FeesSection :fees="fees" :exits="exits" />

        <PlanSection :plan="plan" />

        <MethodNotes :bridge="bridge" />
      </template>
    </template>
  </div>
</template>

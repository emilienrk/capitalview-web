<script setup lang="ts">
/**
 * The behavioural analysis page. Assembly only: every block owns its own
 * rendering, so this file stays readable as blocks are added.
 */
import { computed, onMounted } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'
import { useDarkMode } from '@/composables/useDarkMode'
import PageHeader from '@/components/PageHeader.vue'
import { BaseAlert, BaseCard, BaseEmptyState, BaseSpinner } from '@/components'
import BenchmarkPicker from '@/components/analytics/BenchmarkPicker.vue'
import VerdictBanner from '@/components/analytics/VerdictBanner.vue'
import BehaviourSection from '@/components/analytics/sections/BehaviourSection.vue'
import CostSection from '@/components/analytics/sections/CostSection.vue'
import MethodNotes from '@/components/analytics/sections/MethodNotes.vue'

const analysis = useAnalysisStore()
const { isDark } = useDarkMode()

const gap = computed(() => analysis.data?.investor_gap ?? null)
const bridge = computed(() => analysis.data?.counterfactual ?? null)
const execution = computed(() => analysis.data?.execution ?? null)
const regularity = computed(() => analysis.data?.regularity ?? null)
const depositLag = computed(() => analysis.data?.deposit_lag ?? null)
const conditioning = computed(() => analysis.data?.market_conditioning ?? null)
const benchmarkKey = computed(() => analysis.data?.benchmark_asset_key ?? '')

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
      conditioning.value,
  ),
)

async function reload(): Promise<void> {
  await analysis.fetchAnalytics(true)
}

onMounted(() => analysis.fetchAnalytics())
</script>

<template>
  <div>
    <PageHeader
      title="Analyse"
      description="Ce que tes données disent de ton comportement d'investisseur"
    />

    <div v-if="analysis.isLoading && !analysis.data" class="flex justify-center py-20">
      <BaseSpinner size="lg" label="Analyse en cours..." />
    </div>

    <BaseAlert v-else-if="analysis.error" variant="danger" class="mb-6">
      {{ analysis.error }}
    </BaseAlert>

    <template v-else>
      <BaseCard class="mb-6">
        <BenchmarkPicker :current="benchmarkKey" @changed="reload" />
      </BaseCard>

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

        <MethodNotes :bridge="bridge" />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Everything /analyse needs configured, kept off /analyse itself.
 *
 * The analysis page is for confronting numbers, not for setting them up; the two
 * mental modes do not mix, and a form at the top of the page is read as part of
 * the analysis. The held lines and the plan error come from the analytics
 * response, which the store already caches for an hour.
 */
import { computed, onMounted } from 'vue'
import { BaseCard } from '@/components'
import BenchmarkPicker from '@/components/analytics/BenchmarkPicker.vue'
import InvestmentPlanForm from '@/components/analytics/InvestmentPlanForm.vue'
import { useAnalysisStore } from '@/stores/analysis'
import { useSettingsStore } from '@/stores/settings'

const analysis = useAnalysisStore()
const settingsStore = useSettingsStore()

const benchmarkKey = computed(
  () =>
    (settingsStore.settings?.benchmark_asset_key as string | undefined) ??
    analysis.data?.benchmark_asset_key ??
    '',
)
const held = computed(() => analysis.data?.concentration?.weights ?? [])
const declaredPlan = computed(
  () => (settingsStore.settings?.investment_plan as Record<string, unknown> | null) ?? null,
)

/**
 * Drop the cached analysis so the page recomputes on its next visit. /analyse
 * also repairs itself by comparing the two benchmarks on mount, because a
 * setting can be changed from anywhere.
 */
function onChanged(): void {
  analysis.reset()
}

onMounted(() => {
  settingsStore.fetchSettings()
  analysis.fetchAnalytics()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <BaseCard>
      <h2 class="mb-1 text-base font-semibold text-text-main dark:text-text-dark-main">
        Indice de référence
      </h2>
      <p class="mb-4 text-sm text-text-muted dark:text-text-dark-muted">
        Sert de base à toutes les comparaisons de la page Analyse : l'écart investisseur, le pont
        contrefactuel et le conditionnement au marché.
      </p>
      <BenchmarkPicker :current="benchmarkKey" @changed="onChanged" />
    </BaseCard>

    <BaseCard>
      <InvestmentPlanForm
        :plan="declaredPlan"
        :held="held"
        :error="analysis.data?.plan?.error ?? null"
        @changed="onChanged"
      />
    </BaseCard>
  </div>
</template>

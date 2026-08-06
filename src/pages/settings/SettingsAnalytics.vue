<script setup lang="ts">
/**
 * Everything /analyse needs configured, kept off /analyse itself.
 *
 * The analysis page is for confronting numbers, not for setting them up; the two
 * mental modes do not mix, and a form at the top of the page is read as part of
 * the analysis. The held lines and the plan error come from the analytics
 * response, which the store already caches for an hour; the pickers read the
 * traded lines, which are cheap and available even when the analysis is not.
 */
import { computed, onMounted } from 'vue'
import { ArrowRight } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
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
  analysis.fetchAssets()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h2 class="text-base font-semibold text-text-main dark:text-text-dark-main">
        Réglages de l'analyse
      </h2>
      <p class="mt-1 text-sm text-text-muted dark:text-text-dark-muted">
        Deux réglages, tous deux optionnels. Ils ne changent pas tes données — seulement ce à quoi
        la page Analyse te compare.
        <RouterLink
          to="/analyse"
          class="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
        >
          Ouvrir l'analyse
          <ArrowRight class="h-3 w-3" stroke-width="2.5" />
        </RouterLink>
      </p>
    </div>

    <BaseCard>
      <h3 class="mb-1 text-sm font-semibold text-text-main dark:text-text-dark-main">
        Indice de référence
      </h3>
      <p class="mb-4 text-xs text-text-muted dark:text-text-dark-muted">
        Sert de base à toutes les comparaisons de la page Analyse : l'écart investisseur, le pont
        contrefactuel et le conditionnement au marché.
      </p>
      <BenchmarkPicker :current="benchmarkKey" :assets="analysis.assets" @changed="onChanged" />
    </BaseCard>

    <BaseCard>
      <InvestmentPlanForm
        :plan="declaredPlan"
        :held="held"
        :assets="analysis.assets"
        :error="analysis.data?.plan?.error ?? null"
        @changed="onChanged"
      />
    </BaseCard>
  </div>
</template>

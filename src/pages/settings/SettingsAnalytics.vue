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
import { ArrowRight, Target, Map, Eye } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import SettingsSection from './SettingsSection.vue'
import { BaseToggle } from '@/components'
import { ANALYSIS_SECTIONS, isSectionVisible } from '@/utils/analysisSections'
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

const hiddenSections = computed(() => settingsStore.settings?.analysis_hidden_sections ?? [])

function isVisible(key: string): boolean {
  return isSectionVisible(hiddenSections.value, key)
}

/** Saved on each toggle, like the modules screen — no explicit submit. */
async function setSectionVisible(key: string, visible: boolean): Promise<void> {
  const hidden = new Set(hiddenSections.value)
  if (visible) hidden.delete(key)
  else hidden.add(key)
  await settingsStore.updateSettings({ analysis_hidden_sections: [...hidden] })
}

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
  <div class="space-y-6">
    <SettingsSection
      :icon="Target"
      title="Indice de référence"
      description="Sert de base à toutes les comparaisons de la page Analyse : l'écart investisseur, le pont contrefactuel et le conditionnement au marché."
    >
      <BenchmarkPicker :current="benchmarkKey" :assets="analysis.assets" @changed="onChanged" />
    </SettingsSection>

    <SettingsSection :icon="Map" title="Plan d'investissement">
      <InvestmentPlanForm
        :plan="declaredPlan"
        :held="held"
        :assets="analysis.assets"
        :error="analysis.data?.plan?.error ?? null"
        @changed="onChanged"
      />
    </SettingsSection>

    <SettingsSection
      :icon="Eye"
      title="Blocs affichés"
      description="Ce que la page Analyse montre. Tout est affiché par défaut ; ce que vous décochez disparaît de la page sans cesser d'être calculé."
    >
      <div class="space-y-5">
        <div
          v-for="section in ANALYSIS_SECTIONS"
          :key="section.key"
          class="flex items-center justify-between gap-4"
        >
          <div class="min-w-0">
            <p class="font-medium text-text-main dark:text-text-dark-main">{{ section.label }}</p>
            <p class="text-sm text-text-muted dark:text-text-dark-muted">{{ section.description }}</p>
          </div>
          <BaseToggle
            :model-value="isVisible(section.key)"
            :aria-label="`Afficher « ${section.label} » sur la page Analyse`"
            @update:model-value="setSectionVisible(section.key, $event)"
          />
        </div>
      </div>
    </SettingsSection>

    <RouterLink
      to="/analyse"
      class="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
    >
      Ouvrir l'analyse
      <ArrowRight class="h-3 w-3" stroke-width="2.5" />
    </RouterLink>
  </div>
</template>

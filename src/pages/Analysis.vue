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
import { BaseAlert, BaseButton, BaseCard, BaseEmptyState, BaseSkeleton } from '@/components'
import SignalBoard from '@/components/analytics/SignalBoard.vue'
import BehaviourSection from '@/components/analytics/sections/BehaviourSection.vue'
import CostSection from '@/components/analytics/sections/CostSection.vue'
import FeesSection from '@/components/analytics/sections/FeesSection.vue'
import HoldingsSection from '@/components/analytics/sections/HoldingsSection.vue'
import PlanSection from '@/components/analytics/sections/PlanSection.vue'
import MethodNotes from '@/components/analytics/sections/MethodNotes.vue'
import ProjectionSection from '@/components/analytics/sections/ProjectionSection.vue'
import { useSettingsStore } from '@/stores/settings'
import { isSectionVisible } from '@/utils/analysisSections'

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

/** Hiding a block is a display choice: the analysis is computed either way. */
function shows(key: string): boolean {
  return isSectionVisible(settingsStore.settings?.analysis_hidden_sections, key)
}

/** The section each signal's block is drawn in, so a hidden one takes its line along. */
const SECTION_OF: Record<string, string> = {
  regularity: 'behaviour',
  deposit_lag: 'behaviour',
  market_conditioning: 'behaviour',
  investor_gap: 'cost',
  counterfactual: 'cost',
  execution: 'cost',
  concentration: 'holdings',
  fees: 'fees',
  exits: 'fees',
  plan: 'plan',
}

const signals = computed(() =>
  (analysis.data?.signals ?? []).filter((signal) =>
    shows(SECTION_OF[signal.block] ?? signal.block),
  ),
)

/**
 * Each block stands on its own data — the replay blocks need only transactions
 * and prices, so a portfolio whose daily snapshots have not been rebuilt yet
 * must still see them.
 *
 * Turnover and the plan count too. Leaving them out sent a portfolio that has
 * only those to the empty state, which then hid the very blocks it had.
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
      turnover.value ||
      fees.value ||
      exits.value ||
      plan.value,
  ),
)

/**
 * A plan declared but impossible to score says so here, not only in settings.
 * Otherwise the block simply does not appear and the page reads as though no
 * plan had ever been declared — the one reading that is certainly wrong.
 */
const planError = computed(() => plan.value?.error ?? null)

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
      description="Ce que vos données disent de votre comportement d'investisseur"
    >
      <template #actions>
        <BaseButton
          :to="{ path: '/settings', query: { tab: 'analyse' } }"
          variant="outline"
          size="sm"
          aria-label="Réglages de l'analyse : indice et plan cible"
          title="Réglages de l'analyse : indice et plan cible"
        >
          <Settings class="h-4 w-4" stroke-width="2" />
          <span class="hidden sm:inline">Indice et plan cible</span>
        </BaseButton>
      </template>
    </PageHeader>

    <!-- The first computation takes a while: say what is being worked out, and
         hold the shape of the page rather than a bare spinner. No percentage:
         the server reports none, and a made-up one would be a lie. -->
    <div v-if="analysis.isLoading && !analysis.data" role="status">
      <div
        class="mb-8 rounded-card border border-surface-border bg-surface px-4 py-4 dark:border-surface-dark-border dark:bg-surface-dark"
      >
        <p class="text-sm font-medium text-text-main dark:text-text-dark-main">Calcul de l'analyse…</p>
        <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">
          Votre historique est rejoué, et chaque test confronte vos achats à 5 000 tirages au hasard.
        </p>
        <div class="mt-3 h-1 overflow-hidden rounded-full bg-background-subtle dark:bg-background-dark-subtle">
          <div class="cv-indeterminate h-full w-1/3 rounded-full bg-primary" />
        </div>
      </div>
      <div aria-hidden="true">
        <BaseCard v-for="i in 3" :key="i" class="mb-4">
          <BaseSkeleton width="40%" />
          <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <BaseSkeleton v-for="j in 3" :key="j" variant="rect" height="3.5rem" />
          </div>
        </BaseCard>
      </div>
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
        <SignalBoard v-if="shows('verdict') && signals.length" :signals="signals" />

        <BaseAlert v-if="planError && shows('plan')" variant="warning" class="mb-6">
          Votre plan cible n'est pas évalué : {{ planError }}
          <RouterLink
            :to="{ path: '/settings', query: { tab: 'analyse' } }"
            class="font-medium underline underline-offset-2"
          >
            Le corriger
          </RouterLink>
        </BaseAlert>

        <BehaviourSection
          v-if="shows('behaviour')"
          :regularity="regularity"
          :deposit-lag="depositLag"
          :conditioning="conditioning"
          :is-dark="isDark"
        />

        <CostSection
          v-if="shows('cost')"
          :gap="gap"
          :bridge="bridge"
          :execution="execution"
          :is-dark="isDark"
        />

        <HoldingsSection
          v-if="shows('holdings')"
          :concentration="concentration"
          :turnover="turnover"
          :is-dark="isDark"
        />

        <FeesSection v-if="shows('fees')" :fees="fees" :exits="exits" />

        <PlanSection v-if="shows('plan')" :plan="plan" />

        <MethodNotes v-if="shows('method')" :bridge="bridge" />
      </template>

      <!-- Needs no behavioural history: it stands on the current positions alone. -->
      <ProjectionSection v-if="shows('projection')" :is-dark="isDark" />
    </template>
  </div>
</template>

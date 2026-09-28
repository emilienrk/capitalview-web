<script setup lang="ts">
/**
 * The net worth over time. On a phone the curve alone, at the daily grain; on
 * a desktop the grain can change, where there is room for the control.
 */
import { computed, ref } from 'vue'
import { BaseAlert, BaseCard, BaseEmptyState, BaseSegmentedControl, BaseSkeleton, ChartPerformanceBadge, NetWorthHistoryChart } from '@/components'
import { useDarkMode } from '@/composables/useDarkMode'
import { useHistoryGranularity } from '@/composables/useHistoryGranularity'
import type { GlobalHistorySnapshotResponse } from '@/types'

const props = defineProps<{
  history: GlobalHistorySnapshotResponse[]
  loading: boolean
  error: string | null
  meaningful: boolean
  bankEnabled: boolean
  wealthEnabled: boolean
  /** Shows the grain control. */
  granularityControl?: boolean
}>()

const { isDark } = useDarkMode()
const performance = ref<{ diff: number; percent: number } | null>(null)

const { granularity, granularityOptions, applyGranularity } = useHistoryGranularity(() => props.history)
const chartHistory = computed(() => applyGranularity(props.history))
</script>

<template>
  <BaseCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold text-text-main dark:text-text-dark-main">Évolution du patrimoine</h3>
        <ChartPerformanceBadge :performance="performance" />
      </div>
    </template>

    <div v-if="loading && !history.length" class="h-72">
      <BaseSkeleton variant="rect" width="100%" height="18rem" />
    </div>
    <BaseAlert v-else-if="error" variant="danger">{{ error }}</BaseAlert>
    <NetWorthHistoryChart
      v-else-if="meaningful"
      :history="chartHistory"
      :is-dark="isDark"
      :bank-enabled="bankEnabled"
      :wealth-enabled="wealthEnabled"
      :granularity="granularity"
      show-performance
      @update:performance="performance = $event"
    >
      <template v-if="granularityControl" #leading>
        <BaseSegmentedControl v-model="granularity" :options="granularityOptions" variant="primary" size="sm" />
      </template>
    </NetWorthHistoryChart>
    <BaseEmptyState
      v-else
      title="Pas encore assez de données"
      description="La courbe apparaît après 7 jours de suivi quotidien."
    />
  </BaseCard>
</template>

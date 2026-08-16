<script setup lang="ts">
/**
 * How a pick actually played out since it was made.
 *
 * Renders nothing when the market has no data for the asset: showing "0 %"
 * there would read as a flat call rather than as an unknown one.
 */
import { Target } from 'lucide-vue-next'
import { computed } from 'vue'
import { BaseBadge } from '@/components'
import type { PickResponse } from '@/types'

const props = defineProps<{ pick: PickResponse }>()

const hasPerformance = computed(() => props.pick.performance_pct !== null)

const performanceLabel = computed(() => {
  const value = props.pick.performance_pct
  if (value === null) return ''
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} % depuis le pick`
})

const performanceClass = computed(() =>
  (props.pick.performance_pct ?? 0) >= 0 ? 'text-success' : 'text-danger',
)
</script>

<template>
  <div v-if="hasPerformance || props.pick.target_reached !== null" class="mt-2 flex flex-wrap items-center gap-2">
    <span v-if="hasPerformance" class="text-xs font-semibold tabular-nums" :class="performanceClass">
      {{ performanceLabel }}
    </span>

    <BaseBadge v-if="props.pick.target_reached === true" variant="success">
      <Target class="w-3 h-3 inline-block -mt-px mr-1" :stroke-width="2" />Objectif atteint
    </BaseBadge>
    <BaseBadge v-else-if="props.pick.target_reached === false" variant="secondary">
      Objectif non atteint
    </BaseBadge>
  </div>
</template>

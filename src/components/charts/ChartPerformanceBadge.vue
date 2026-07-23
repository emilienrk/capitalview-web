<script setup lang="ts">
import { computed } from 'vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'

const props = defineProps<{
  performance: { diff: number; percent: number | null } | null
}>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

const diffValue = computed(() => props.performance?.diff ?? 0)
const percentValue = computed(() => props.performance?.percent ?? null)
const isPositive = computed(() => diffValue.value >= 0)
</script>

<template>
  <div v-if="performance" class="flex items-center gap-1.5 sm:gap-2 shrink-0">
    <span
      v-if="percentValue !== null"
      :class="[
        'inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold',
        isPositive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
      ]"
    >
      {{ isPositive ? '▲' : '▼' }}
      {{ percentValue.toFixed(2) }}%
    </span>
    <!-- Not hidden on mobile anymore! -->
    <span :class="['text-[11px] sm:text-xs font-semibold', isPositive ? 'text-success' : 'text-danger']">
      {{ isPositive ? '+' : '' }}{{ maskValue(formatCurrency(diffValue)) }}
    </span>
  </div>
</template>

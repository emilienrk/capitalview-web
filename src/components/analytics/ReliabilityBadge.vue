<script setup lang="ts">
import { computed } from 'vue'
import type { Reliability } from '@/types'

const props = defineProps<{ reliability: Reliability; caveat?: string | null }>()

const label = computed(() => ({
  solide: 'Fiable',
  indicatif: 'Indicatif',
  insuffisant: 'Données insuffisantes',
}[props.reliability]))

const tone = computed(() => ({
  solide: 'bg-success/10 text-success',
  indicatif: 'bg-warning/10 text-warning',
  insuffisant: 'bg-surface-active text-text-muted dark:bg-surface-dark-active dark:text-text-dark-muted',
}[props.reliability]))
</script>

<template>
  <div class="flex flex-col gap-1">
    <span :class="['inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium', tone]">
      {{ label }}
    </span>
    <p v-if="caveat" class="text-xs text-text-muted dark:text-text-dark-muted">{{ caveat }}</p>
  </div>
</template>

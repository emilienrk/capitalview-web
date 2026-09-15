<script setup lang="ts">
/**
 * A word in running text whose definition opens on hover, tap or focus.
 *
 * The dotted underline is the only affordance: an icon after every technical
 * term would break the sentence it sits in. The panel is BaseTooltip's, so the
 * definition is reachable on a phone and never clipped by its section.
 */
import BaseTooltip from './BaseTooltip.vue'

defineProps<{ term: string }>()
</script>

<template>
  <BaseTooltip :label="`Définition : ${term}`">
    <template #trigger>
      <span class="border-b border-dotted border-current">{{ term }}</span>
    </template>
    <slot />
  </BaseTooltip>
</template>

<script setup lang="ts">
/**
 * A block that folds itself away when it has nothing measurable to say.
 *
 * The message of insufficiency is information in its own right — "five sales in
 * three years: that makes you an accumulator, not an arbitrageur" — so the block
 * is never removed. But it does not deserve 300 pixels to say no, and a page of
 * them buries the blocks that do have something.
 *
 * Folding is automatic, derived from the gate the API already applied. There is
 * no checkbox and no stored preference: the reliability of the data decides.
 *
 * While folded the default slot is not mounted at all, so a withheld block
 * cannot render a chart of nothing.
 */
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { BaseCard } from '@/components'

withDefaults(
  defineProps<{
    title?: string
    measurable: boolean
    /** The condensed reason, shown on the folded line. */
    summary?: string | null
  }>(),
  { title: '', summary: null },
)

const isExpanded = ref(false)
</script>

<template>
  <BaseCard v-if="measurable" class="mb-4">
    <h3
      v-if="title"
      class="mb-1 text-sm font-semibold text-text-main dark:text-text-dark-main"
    >
      {{ title }}
    </h3>
    <slot />
  </BaseCard>

  <BaseCard v-else class="mb-4">
    <button
      type="button"
      class="flex w-full items-start gap-3 text-left"
      @click="isExpanded = !isExpanded"
    >
      <ChevronDown
        class="mt-0.5 h-4 w-4 shrink-0 text-text-muted transition-transform dark:text-text-dark-muted"
        :class="isExpanded ? 'rotate-180' : ''"
        stroke-width="2"
      />
      <span class="min-w-0 flex-1">
        <span class="text-sm font-semibold text-text-main dark:text-text-dark-main">
          {{ title }}
        </span>
        <span v-if="summary" class="ml-2 text-xs text-text-muted dark:text-text-dark-muted">
          {{ summary }}
        </span>
      </span>
    </button>

    <div v-if="isExpanded" class="mt-4">
      <slot />
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
/**
 * The "?" beside a block title: what the terms mean and how the figure is built.
 *
 * This content used to live in one 176-line section at the foot of the page. It
 * was never missing — it was just far from what it explained, so nobody read it
 * and the block above kept carrying explanatory sentences in its own body.
 * Attaching it here lets those sentences leave the page without being lost.
 *
 * Closed by default and unmounted while closed: it is reference material, and
 * the block has to read as a figure first.
 */
import { ref } from 'vue'
import { CircleQuestionMark } from 'lucide-vue-next'

const isOpen = ref(false)
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="flex h-6 w-6 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-active hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:text-text-dark-muted dark:hover:bg-surface-dark-active dark:hover:text-text-dark-main"
      :aria-expanded="isOpen"
      aria-label="Méthode et définitions"
      @click="isOpen = !isOpen"
    >
      <CircleQuestionMark class="h-4 w-4" stroke-width="2" />
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 z-20 mt-1 w-[min(22rem,calc(100vw-3rem))] rounded-lg border border-border bg-surface p-3 shadow-card dark:border-border-dark dark:bg-surface-dark"
    >
      <ul
        class="list-disc space-y-2 pl-4 text-xs leading-relaxed text-text-muted dark:text-text-dark-muted"
      >
        <slot />
      </ul>
    </div>
  </div>
</template>

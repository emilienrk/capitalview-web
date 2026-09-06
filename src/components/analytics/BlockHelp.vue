<script setup lang="ts">
/**
 * The "?" beside a block title: what the terms mean and how the figure is built.
 *
 * This content used to live in one 176-line section at the foot of the page. It
 * was never missing — it was just far from what it explained, so nobody read it
 * and the block above kept carrying explanatory sentences in its own body.
 * Attaching it here lets those sentences leave the page without being lost.
 *
 * Nothing but the list shape now: the trigger and the panel are the app-wide
 * BaseHelpPopover, so a fix to either lands everywhere at once.
 */
import { BaseHelpPopover } from '@/components'
</script>

<template>
  <BaseHelpPopover label="Méthode et définitions" width="md">
    <ul class="list-disc space-y-2 pl-4">
      <slot />
    </ul>
  </BaseHelpPopover>
</template>

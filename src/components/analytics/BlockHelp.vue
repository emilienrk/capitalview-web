<script setup lang="ts">
/**
 * The "?" beside a block title: what the terms mean and how the figure is built.
 *
 * Next to what it explains, so the block's body does not have to carry the
 * explanation itself.
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

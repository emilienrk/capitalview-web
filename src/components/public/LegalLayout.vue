<script setup lang="ts">
import PublicFooter from './PublicFooter.vue'
import PublicNav from './PublicNav.vue'
import { legalUpdatedOn } from './siteInfo'

defineProps<{ title: string }>()
</script>

<template>
  <div class="cv-public min-h-dvh flex flex-col bg-background dark:bg-background-dark text-text-body dark:text-text-dark-body">
    <PublicNav />
    <main class="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-20 md:pt-16">
      <div class="max-w-3xl">
        <h1 class="pb-5 border-b-2 border-text-main dark:border-text-dark-main text-4xl sm:text-5xl leading-[1.05] font-semibold text-text-main dark:text-text-dark-main text-balance">
          {{ title }}
        </h1>
        <p class="mt-5 text-lg leading-relaxed text-pretty">
          <slot name="intro" />
        </p>
        <p class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">Mis à jour le {{ legalUpdatedOn }}.</p>
        <div class="mt-12">
          <slot />
        </div>
      </div>
    </main>
    <PublicFooter />
  </div>
</template>

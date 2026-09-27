<script setup lang="ts">
import PublicNav from './PublicNav.vue'

defineProps<{ title: string }>()
</script>

<template>
  <div class="cv-public min-h-dvh bg-background dark:bg-background-dark text-text-body dark:text-text-dark-body">
    <PublicNav />
    <main class="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-20 md:pt-16 grid lg:grid-cols-12 gap-x-12 gap-y-14">
      <div class="lg:col-span-5">
        <h1 class="pb-5 border-b-2 border-text-main dark:border-text-dark-main text-4xl sm:text-5xl leading-[1.05] font-semibold text-text-main dark:text-text-dark-main text-balance">
          {{ title }}
        </h1>
        <p v-if="$slots.intro" class="mt-5 text-lg leading-relaxed text-pretty">
          <slot name="intro" />
        </p>
        <div class="mt-8">
          <slot />
        </div>
      </div>
      <aside v-if="$slots.aside" class="lg:col-start-8 lg:col-span-5 lg:pt-4">
        <slot name="aside" />
      </aside>
    </main>
  </div>
</template>

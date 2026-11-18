<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { focusRing } from '@/components/public/publicStyles'

defineProps<{ homeTo: string; homeLabel: string }>()

const route = useRoute()
const router = useRouter()

// Opened from outside (a bookmark, a pasted link), there is no page to go back to.
const canGoBack = typeof window !== 'undefined' && window.history.state?.back != null
</script>

<template>
  <section class="max-w-xl" aria-labelledby="not-found-title">
    <!-- A series that stops: the address leads to no data. -->
    <figure aria-hidden="true">
      <svg viewBox="0 0 320 96" class="w-full h-auto text-primary overflow-visible">
        <defs>
          <linearGradient id="not-found-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="currentColor" stop-opacity="0.18" />
            <stop offset="1" stop-color="currentColor" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 72 L36 64 L72 68 L108 50 L144 56 L180 36 L180 96 L0 96 Z" fill="url(#not-found-area)" />
        <path
          class="not-found-line"
          d="M0 72 L36 64 L72 68 L108 50 L144 56 L180 36"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          pathLength="1"
        />
        <line
          x1="192" y1="36" x2="320" y2="36"
          class="text-text-muted dark:text-text-dark-muted"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-dasharray="4 6"
          stroke-linecap="round"
        />
        <circle cx="180" cy="36" r="4.5" fill="currentColor" />
      </svg>
    </figure>

    <p class="cv-figure mt-6 text-7xl sm:text-8xl font-semibold leading-none tabular-nums text-text-main dark:text-text-dark-main">404</p>

    <h1 id="not-found-title" class="mt-6 text-2xl sm:text-3xl font-semibold text-text-main dark:text-text-dark-main text-balance">
      Cette page n'existe pas
    </h1>
    <p class="mt-3 leading-relaxed text-text-muted dark:text-text-dark-muted text-pretty">
      Rien ne se trouve à l'adresse
      <code class="font-mono text-[0.9em] text-text-main dark:text-text-dark-main [overflow-wrap:anywhere]">{{ route.path }}</code>.
      Le lien est peut-être ancien, ou l'adresse mal recopiée.
    </p>

    <div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
      <slot name="home" :to="homeTo" :label="homeLabel" />
      <button
        v-if="canGoBack"
        type="button"
        :class="['min-h-11 inline-flex items-center gap-2 rounded-button text-sm font-semibold text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main transition-colors', focusRing]"
        @click="router.back()"
      >
        <ArrowLeft class="w-4 h-4" aria-hidden="true" />
        Page précédente
      </button>
    </div>
  </section>
</template>

<style scoped>
.not-found-line {
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
  animation: not-found-draw 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes not-found-draw {
  from {
    stroke-dashoffset: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .not-found-line {
    animation: none;
  }
}
</style>

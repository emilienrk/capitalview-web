<script setup lang="ts">
import { focusRing } from './publicStyles'
import { contactEmail, sourceRepos } from './siteInfo'

const link = ['min-h-11 inline-flex items-center rounded-button hover:text-text-main dark:hover:text-text-dark-main', focusRing]
</script>

<template>
  <footer class="border-t border-surface-border dark:border-surface-dark-border">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 text-sm text-text-muted dark:text-text-dark-muted">
      <p>&copy; 2026 CapitalView</p>
      <nav aria-label="Informations sur le site" class="flex flex-wrap items-center gap-x-6">
        <router-link to="/mentions-legales" :class="link">Mentions légales</router-link>
        <router-link to="/confidentialite" :class="link">Confidentialité</router-link>
        <a :href="sourceRepos[0].url" :class="link">Code source</a>
        <a :href="`mailto:${contactEmail}`" :class="link">Contact</a>
      </nav>
    </div>
  </footer>
</template>

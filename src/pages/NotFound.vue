<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import BaseButton from '@/components/base/BaseButton.vue'
import NotFoundBody from '@/components/NotFoundBody.vue'
import PublicFooter from '@/components/public/PublicFooter.vue'
import PublicNav from '@/components/public/PublicNav.vue'
import { primaryButton } from '@/components/public/publicStyles'

const auth = useAuthStore()
</script>

<template>
  <div v-if="auth.isAuthenticated" class="py-4 sm:py-12">
    <NotFoundBody home-to="/dashboard" home-label="Revenir au tableau de bord">
      <template #home="{ to, label }">
        <BaseButton :to="to">{{ label }}</BaseButton>
      </template>
    </NotFoundBody>
  </div>

  <div v-else class="cv-public min-h-dvh flex flex-col bg-background dark:bg-background-dark text-text-body dark:text-text-dark-body">
    <PublicNav />
    <main class="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-20 md:pt-20">
      <NotFoundBody home-to="/" home-label="Revenir à l'accueil">
        <template #home="{ to, label }">
          <router-link :to="to" :class="primaryButton">{{ label }}</router-link>
        </template>
      </NotFoundBody>
    </main>
    <PublicFooter />
  </div>
</template>

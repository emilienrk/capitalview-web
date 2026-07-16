<script setup lang="ts">
import { AlertCircle, ArrowLeft, ArrowRight, KeyRound, LoaderCircle, Lock, ShieldCheck, User } from 'lucide-vue-next'

import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter, useRoute } from 'vue-router'

const username = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

// 2FA step state
const step = ref<'credentials' | '2fa'>('credentials')
const pendingToken = ref('')
const twoFaCode = ref('')

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

function redirectAfterLogin() {
  const redirect = (route.query.redirect as string) || '/dashboard'
  router.push(redirect)
}

async function handleLogin() {
  error.value = ''
  isLoading.value = true
  try {
    const outcome = await auth.login({ email: username.value, password: password.value })
    if (outcome.status === 'success') {
      redirectAfterLogin()
    } else if (outcome.status === '2fa') {
      pendingToken.value = outcome.pendingToken
      step.value = '2fa'
      twoFaCode.value = ''
    } else {
      // Show the real backend message (rate-limit, server down…) instead of
      // always claiming the credentials are wrong.
      error.value = outcome.message || 'Identifiants invalides'
    }
  } catch {
    error.value = 'Une erreur est survenue lors de la connexion'
  } finally {
    isLoading.value = false
  }
}

async function handle2fa() {
  error.value = ''
  isLoading.value = true
  try {
    const outcome = await auth.completeLogin2fa(pendingToken.value, twoFaCode.value.trim())
    if (outcome.status === 'success') {
      redirectAfterLogin()
    } else {
      error.value = outcome.status === 'error' ? outcome.message : 'Code de vérification invalide'
    }
  } catch {
    error.value = 'Une erreur est survenue lors de la vérification'
  } finally {
    isLoading.value = false
  }
}

function backToCredentials() {
  step.value = 'credentials'
  twoFaCode.value = ''
  error.value = ''
}
</script>

<template>
  <div class="min-h-dvh flex flex-col items-center justify-center animate-fade-in px-4 py-12">
    <!-- Login Card -->
    <div class="w-full max-w-md bg-surface dark:bg-surface-dark p-8 rounded-card shadow-card border border-surface-border dark:border-surface-dark-border animate-slide-up">

      <!-- Header Section -->
      <div class="text-center mb-10">
        <img src="/capitalview.svg" alt="CapitalView Logo" class="w-16 h-16 mx-auto mb-4" />
        <h1 class="text-3xl font-bold text-text-main dark:text-text-dark-main tracking-tight">Bienvenue</h1>
        <p class="text-text-muted dark:text-text-dark-muted mt-2">Connectez-vous à votre espace CapitalView</p>
      </div>

      <!-- ── STEP 1: Credentials ─────────────────────────── -->
      <form v-if="step === 'credentials'" @submit.prevent="handleLogin" class="space-y-6">
        <div class="space-y-2">
          <label for="username" class="text-sm font-semibold text-text-main dark:text-text-dark-main ml-1">
            Nom d'utilisateur
          </label>
          <div class="relative group">
            <span class="absolute inset-y-0 left-0 pl-4 flex items-center text-text-muted group-focus-within:text-primary transition-colors">
              <User class="w-5 h-5" />
            </span>
            <input
              id="username"
              v-model="username"
              type="email"
              required
              placeholder="email@exemple.com"
              class="w-full pl-11 pr-4 py-3.5 bg-background/50 dark:bg-background-dark-subtle border border-surface-border dark:border-surface-dark-border rounded-input focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-main dark:text-text-dark-main placeholder:text-text-muted/50"
            />
          </div>
        </div>

        <div class="space-y-2">
          <label for="password" class="text-sm font-semibold text-text-main dark:text-text-dark-main ml-1">
            Mot de passe
          </label>
          <div class="relative group">
            <span class="absolute inset-y-0 left-0 pl-4 flex items-center text-text-muted group-focus-within:text-primary transition-colors">
              <Lock class="w-5 h-5" />
            </span>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              placeholder="••••••••"
              class="w-full pl-11 pr-4 py-3.5 bg-background/50 dark:bg-background-dark-subtle border border-surface-border dark:border-surface-dark-border rounded-input focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-main dark:text-text-dark-main placeholder:text-text-muted/50"
            />
          </div>
          <div class="text-right">
            <router-link to="/recover" class="text-xs text-text-muted dark:text-text-dark-muted hover:text-primary transition-colors">
              Mot de passe oublié ?
            </router-link>
          </div>
        </div>

        <!-- Feedback Messages -->
        <transition enter-active-class="animate-fade-in" leave-active-class="opacity-0 transition-opacity">
          <div v-if="error" class="flex items-center gap-3 p-4 bg-danger/10 border border-danger/20 text-danger text-sm rounded-input">
            <AlertCircle class="w-5 h-5 shrink-0" />
            {{ error }}
          </div>
        </transition>

        <!-- Form Submission -->
        <button
          type="submit"
          :disabled="isLoading"
          class="group relative w-full bg-primary hover:bg-primary-hover active:bg-primary-active text-primary-content font-bold py-4 rounded-button transition-all shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
        >
          <span v-if="isLoading" class="flex items-center justify-center gap-2">
            <LoaderCircle class="animate-spin h-5 w-5 text-current" />
            Connexion en cours...
          </span>
          <span v-else class="flex items-center justify-center gap-2">
            Se connecter
            <ArrowRight class="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
      </form>

      <!-- ── STEP 2: Two-factor ──────────────────────────── -->
      <form v-else @submit.prevent="handle2fa" class="space-y-6">
        <div class="flex flex-col items-center text-center gap-2">
          <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck class="w-6 h-6 text-primary" />
          </div>
          <p class="text-sm text-text-body dark:text-text-dark-body">
            Saisissez le code à 6 chiffres de votre application d'authentification.
          </p>
        </div>

        <div class="space-y-2">
          <label for="twofa" class="text-sm font-semibold text-text-main dark:text-text-dark-main ml-1">
            Code de vérification
          </label>
          <div class="relative group">
            <span class="absolute inset-y-0 left-0 pl-4 flex items-center text-text-muted group-focus-within:text-primary transition-colors">
              <KeyRound class="w-5 h-5" />
            </span>
            <input
              id="twofa"
              v-model="twoFaCode"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              autofocus
              required
              placeholder="123456"
              class="w-full pl-11 pr-4 py-3.5 tracking-[0.3em] font-mono bg-background/50 dark:bg-background-dark-subtle border border-surface-border dark:border-surface-dark-border rounded-input focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-main dark:text-text-dark-main placeholder:text-text-muted/50"
            />
          </div>
          <p class="text-xs text-text-muted dark:text-text-dark-muted ml-1">
            Vous pouvez aussi utiliser un de vos codes de secours.
          </p>
        </div>

        <transition enter-active-class="animate-fade-in" leave-active-class="opacity-0 transition-opacity">
          <div v-if="error" class="flex items-center gap-3 p-4 bg-danger/10 border border-danger/20 text-danger text-sm rounded-input">
            <AlertCircle class="w-5 h-5 shrink-0" />
            {{ error }}
          </div>
        </transition>

        <button
          type="submit"
          :disabled="isLoading || !twoFaCode"
          class="group relative w-full bg-primary hover:bg-primary-hover active:bg-primary-active text-primary-content font-bold py-4 rounded-button transition-all shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
        >
          <span v-if="isLoading" class="flex items-center justify-center gap-2">
            <LoaderCircle class="animate-spin h-5 w-5 text-current" />
            Vérification...
          </span>
          <span v-else class="flex items-center justify-center gap-2">
            Vérifier
            <ArrowRight class="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>

        <button
          type="button"
          @click="backToCredentials"
          class="flex items-center justify-center gap-2 w-full text-sm text-text-muted dark:text-text-dark-muted hover:text-primary transition-colors"
        >
          <ArrowLeft class="w-4 h-4" />
          Retour
        </button>
      </form>

      <!-- Footer Branding -->
      <div v-if="step === 'credentials'" class="mt-6 text-center">
        <p class="text-sm text-text-muted dark:text-text-dark-muted">
          Pas encore de compte ?
          <router-link to="/register" class="text-primary hover:text-primary-hover font-semibold transition-colors">
            Créer un compte
          </router-link>
        </p>
      </div>

      <div class="mt-4 text-center">
        <p class="text-xs text-text-muted dark:text-text-dark-muted">
          CapitalView &copy; 2026 — Sécurisé & Privé
        </p>
      </div>
    </div>

    <!-- Background Decoration (Subtle) -->
    <div class="fixed top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-none opacity-20 dark:opacity-10">
      <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary blur-[120px]"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400 blur-[120px]"></div>
    </div>
  </div>
</template>

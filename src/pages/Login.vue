<script setup lang="ts">
import { AlertCircle, ArrowLeft, LoaderCircle } from 'lucide-vue-next'

import { nextTick, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter, useRoute } from 'vue-router'
import AuthLayout from '@/components/public/AuthLayout.vue'
import { fieldHint, fieldInput, fieldLabel, focusRing, primaryButton, textLink } from '@/components/public/publicStyles'

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

// 2FA step state
const step = ref<'credentials' | '2fa'>('credentials')
const pendingToken = ref('')
const twoFaCode = ref('')
const codeInput = ref<HTMLInputElement | null>(null)

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

function redirectAfterLogin() {
  const redirect = (route.query.redirect as string) || '/dashboard'
  router.push(redirect)
}

// The previous error stays up during a retry, so the form doesn't jump twice.
async function handleLogin() {
  isLoading.value = true
  try {
    const outcome = await auth.login({ email: email.value, password: password.value })
    if (outcome.status === 'success') {
      redirectAfterLogin()
    } else if (outcome.status === '2fa') {
      error.value = ''
      pendingToken.value = outcome.pendingToken
      step.value = '2fa'
      twoFaCode.value = ''
      // autofocus only applies on the first page load, not to a field added later.
      await nextTick()
      codeInput.value?.focus()
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
  isLoading.value = true
  try {
    const outcome = await auth.completeLogin2fa(pendingToken.value, twoFaCode.value.trim())
    if (outcome.status === 'success') {
      redirectAfterLogin()
    } else {
      error.value = outcome.status === 'error' ? outcome.message : 'Code de vérification invalide'
      codeInput.value?.select()
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
  <AuthLayout :title="step === 'credentials' ? 'Connexion' : 'Code de vérification'">
    <template v-if="step === '2fa'" #intro>
      Saisissez le code à 6 chiffres de votre application d'authentification. Il reste valable 5 minutes.
    </template>

    <form v-if="step === 'credentials'" class="space-y-6" @submit.prevent="handleLogin">
      <div class="space-y-2">
        <label for="email" :class="fieldLabel">Adresse e-mail</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="username"
          :class="fieldInput"
          @input="error = ''"
        />
      </div>

      <div class="space-y-2">
        <div class="flex items-baseline justify-between gap-4">
          <label for="password" :class="fieldLabel">Mot de passe</label>
          <router-link to="/recover" :class="['text-sm', textLink]">Mot de passe oublié&nbsp;?</router-link>
        </div>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
          :class="fieldInput"
          @input="error = ''"
        />
      </div>

      <p v-if="error" role="alert" class="flex items-start gap-2.5 p-3.5 bg-danger/10 text-danger text-sm rounded-input">
        <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
        {{ error }}
      </p>

      <button type="submit" :disabled="isLoading" :aria-busy="isLoading" :class="['w-full', primaryButton]">
        <LoaderCircle v-if="isLoading" class="animate-spin h-5 w-5" />
        {{ isLoading ? 'Connexion…' : 'Se connecter' }}
      </button>

      <p :class="fieldHint">
        Pas encore de compte&nbsp;?
        <router-link to="/register" :class="textLink">Créer un compte</router-link>
      </p>
    </form>

    <form v-else class="space-y-6 animate-[cv-fade-in_200ms_var(--cv-ease-out)]" @submit.prevent="handle2fa">
      <div class="space-y-2">
        <label for="twofa" :class="fieldLabel">Code</label>
        <input
          id="twofa"
          ref="codeInput"
          v-model="twoFaCode"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          required
          :class="[fieldInput, 'font-mono tracking-[0.3em]']"
          @input="error = ''"
        />
        <p :class="fieldHint">Un code de secours fonctionne aussi.</p>
      </div>

      <p v-if="error" role="alert" class="flex items-start gap-2.5 p-3.5 bg-danger/10 text-danger text-sm rounded-input">
        <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
        {{ error }}
      </p>

      <button type="submit" :disabled="isLoading || !twoFaCode" :aria-busy="isLoading" :class="['w-full disabled:opacity-60', primaryButton]">
        <LoaderCircle v-if="isLoading" class="animate-spin h-5 w-5" />
        {{ isLoading ? 'Vérification…' : 'Vérifier' }}
      </button>

      <button
        type="button"
        :class="['min-h-11 inline-flex items-center gap-2 rounded-button text-sm font-semibold text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main', focusRing]"
        @click="backToCredentials"
      >
        <ArrowLeft class="w-4 h-4" />
        Revenir à l'e-mail et au mot de passe
      </button>
    </form>
  </AuthLayout>
</template>

<script setup lang="ts">
import { AlertCircle, Check, Circle, Eye, EyeOff, LoaderCircle } from 'lucide-vue-next'

import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import AuthLayout from '@/components/public/AuthLayout.vue'
import SecretRevealModal from '@/components/security/SecretRevealModal.vue'
import { fieldHint, fieldInput, fieldLabel, focusRing, primaryButton, textLink } from '@/components/public/publicStyles'
import { passwordRules } from '@/components/public/passwordRules'

const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const confirmTouched = ref(false)
const error = ref('')
const isLoading = ref(false)
const showPassword = ref(false)

const recoveryKey = ref('')
const revealOpen = ref(false)
const recoveryFailed = ref(false)

const auth = useAuthStore()
const router = useRouter()

const rules = computed(() => passwordRules(password.value))

const usernameInvalid = computed(() => username.value.length > 0 && !/^[a-zA-Z0-9_-]+$/.test(username.value))
const passwordsMatch = computed(() => password.value === confirmPassword.value)
// Only flag a mismatch once the user has finished typing the confirmation.
const showMismatch = computed(() =>
  confirmPassword.value.length > 0 && !passwordsMatch.value
  && (confirmTouched.value || confirmPassword.value.length >= password.value.length),
)

async function handleRegister() {
  if (username.value.length < 3 || usernameInvalid.value) {
    error.value = 'Le nom d\'utilisateur doit faire au moins 3 caractères : lettres, chiffres, _ et - uniquement.'
    return
  }
  if (!rules.value.every(rule => rule.met)) {
    error.value = 'Le mot de passe ne respecte pas encore toutes les règles ci-dessus.'
    return
  }
  if (!passwordsMatch.value) {
    confirmTouched.value = true
    error.value = 'Les deux mots de passe ne correspondent pas.'
    return
  }

  isLoading.value = true
  try {
    const success = await auth.register({
      username: username.value,
      email: email.value,
      password: password.value,
    })
    if (!success) {
      error.value = auth.error || 'Erreur lors de l\'inscription'
      return
    }
    // The password is still in memory: the one moment the recovery key can be
    // made without asking for it again.
    try {
      recoveryKey.value = await auth.generateRecoveryKey(password.value)
      revealOpen.value = true
    } catch {
      recoveryFailed.value = true
    }
  } catch {
    error.value = 'Une erreur est survenue lors de l\'inscription'
  } finally {
    isLoading.value = false
  }
}

function finish() {
  revealOpen.value = false
  router.push('/dashboard')
}
</script>

<template>
  <AuthLayout title="Créer un compte">
    <template #intro>
      Vos données seront chiffrées avec une clé que seul votre mot de passe déverrouille.
    </template>

    <div v-if="recoveryFailed" class="space-y-6">
      <p role="alert" class="flex items-start gap-2.5 p-3.5 bg-danger/10 text-danger text-sm rounded-input">
        <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
        Votre compte est créé, mais la clé de récupération n'a pas pu être générée.
      </p>
      <p class="leading-relaxed">
        Générez-la dès maintenant dans Réglages › Sécurité&nbsp;: sans elle, un mot de passe oublié rend vos données illisibles pour de bon.
      </p>
      <router-link :to="{ name: 'settings', query: { tab: 'securite' } }" :class="primaryButton">
        Ouvrir Réglages › Sécurité
      </router-link>
    </div>

    <form v-else class="space-y-6" @submit.prevent="handleRegister">
      <div class="space-y-2">
        <label for="username" :class="fieldLabel">Nom d'utilisateur</label>
        <input
          id="username"
          v-model="username"
          type="text"
          required
          minlength="3"
          maxlength="50"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          aria-describedby="username-hint"
          :aria-invalid="usernameInvalid"
          :class="[fieldInput, usernameInvalid && 'border-danger focus:border-danger focus:ring-danger']"
          @input="error = ''"
        />
        <p id="username-hint" :class="usernameInvalid ? 'text-sm text-danger' : fieldHint">
          Lettres, chiffres, _ et - (pas de point ni d'espace). Visible des autres membres si vous activez la Communauté, modifiable une seule fois.
        </p>
      </div>

      <div class="space-y-2">
        <label for="email" :class="fieldLabel">Adresse e-mail</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          aria-describedby="email-hint"
          :class="fieldInput"
          @input="error = ''"
        />
        <p id="email-hint" :class="fieldHint">
          Elle sert à vous connecter. Aucun e-mail ne vous sera envoyé, et elle ne permet pas de récupérer un mot de passe.
        </p>
      </div>

      <div class="space-y-2">
        <label for="password" :class="fieldLabel">Mot de passe</label>
        <div class="relative">
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            required
            minlength="8"
            maxlength="100"
            autocomplete="new-password"
            aria-describedby="password-rules"
            :class="[fieldInput, 'pr-12']"
            @input="error = ''"
          />
          <button
            type="button"
            :aria-label="showPassword ? 'Masquer les mots de passe' : 'Afficher les mots de passe'"
            :aria-pressed="showPassword"
            :class="['absolute inset-y-0 right-0 w-12 flex items-center justify-center rounded-button text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main', focusRing]"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" class="w-5 h-5" />
            <Eye v-else class="w-5 h-5" />
          </button>
        </div>
        <ul id="password-rules" class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <li
            v-for="rule in rules"
            :key="rule.label"
            class="flex items-center gap-1.5"
            :class="rule.met ? 'text-text-main dark:text-text-dark-main' : 'text-text-muted dark:text-text-dark-muted'"
          >
            <Check v-if="rule.met" class="w-3.5 h-3.5 shrink-0 text-primary" />
            <Circle v-else class="w-3.5 h-3.5 shrink-0" />
            <span>{{ rule.label }}<span class="sr-only">{{ rule.met ? ' : respecté' : ' : manquant' }}</span></span>
          </li>
        </ul>
      </div>

      <div class="space-y-2">
        <label for="confirmPassword" :class="fieldLabel">Confirmer le mot de passe</label>
        <input
          id="confirmPassword"
          v-model="confirmPassword"
          :type="showPassword ? 'text' : 'password'"
          required
          autocomplete="new-password"
          :aria-invalid="showMismatch"
          :class="[fieldInput, showMismatch && 'border-danger focus:border-danger focus:ring-danger']"
          @input="error = ''"
          @blur="confirmTouched = true"
        />
        <p v-if="showMismatch" class="text-sm text-danger">Les deux mots de passe ne correspondent pas.</p>
      </div>

      <p class="py-4 border-y border-surface-border dark:border-surface-dark-border leading-relaxed text-pretty">
        <strong class="font-semibold text-text-main dark:text-text-dark-main">Personne ne pourra réinitialiser ce mot de passe.</strong>
        Juste après l'inscription, une clé de récupération vous sera remise&nbsp;: c'est la seule façon de rouvrir vos données si vous l'oubliez.
      </p>

      <p v-if="error" role="alert" class="flex items-start gap-2.5 p-3.5 bg-danger/10 text-danger text-sm rounded-input">
        <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
        {{ error }}
      </p>

      <button type="submit" :disabled="isLoading" :aria-busy="isLoading" :class="['w-full', primaryButton]">
        <LoaderCircle v-if="isLoading" class="animate-spin h-5 w-5" />
        {{ isLoading ? 'Création du compte…' : 'Créer mon compte' }}
      </button>

      <p :class="fieldHint">
        Déjà un compte&nbsp;?
        <router-link to="/login" :class="textLink">Se connecter</router-link>
      </p>
    </form>

    <template #aside>
      <div class="py-6 border-t border-surface-border dark:border-surface-dark-border">
        <h2 class="text-xl font-semibold text-text-main dark:text-text-dark-main">Votre mot de passe est la serrure</h2>
        <p class="mt-2 leading-relaxed text-pretty">
          Il n'est pas conservé, seulement son empreinte. Il déverrouille la clé qui chiffre vos soldes, vos libellés et vos notes&nbsp;:
          une copie de la base ne révèle rien tant qu'il est solide. Plus il est long, mieux il résiste.
        </p>
      </div>
      <div class="py-6 border-t border-surface-border dark:border-surface-dark-border">
        <h2 class="text-xl font-semibold text-text-main dark:text-text-dark-main">Ensuite</h2>
        <p class="mt-2 leading-relaxed text-pretty">
          Ajoutez vos comptes à votre rythme&nbsp;: import CSV, saisie manuelle, ou connexion bancaire si vous l'activez.
          Rien n'est relié à votre banque sans votre action.
        </p>
      </div>
    </template>

    <SecretRevealModal
      :open="revealOpen"
      title="Votre clé de récupération"
      description="Conservez-la hors ligne : c'est la seule façon de rouvrir vos données si vous oubliez votre mot de passe. Elle n'est affichée qu'une fois."
      :secrets="[recoveryKey]"
      filename="capitalview-cle-recuperation.txt"
      @close="finish"
    />
  </AuthLayout>
</template>

<script setup lang="ts">
import { AlertCircle, ArrowLeft, ArrowRight, LifeBuoy, LoaderCircle } from 'lucide-vue-next'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import SecretRevealModal from '@/components/security/SecretRevealModal.vue'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const recoveryKey = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const totpCode = ref('')

const error = ref('')
const isLoading = ref(false)

const revealOpen = ref(false)
const newRecoveryKey = ref('')

const passwordsMatch = computed(() => newPassword.value === confirmPassword.value)
const canSubmit = computed(() =>
  !!email.value &&
  !!recoveryKey.value &&
  newPassword.value.length >= 8 &&
  passwordsMatch.value,
)

async function handleRecover() {
  error.value = ''
  if (!passwordsMatch.value) {
    error.value = 'Les mots de passe ne correspondent pas.'
    return
  }
  isLoading.value = true
  try {
    newRecoveryKey.value = await auth.recover({
      email: email.value,
      recovery_key: recoveryKey.value.trim(),
      new_password: newPassword.value,
      totp_code: totpCode.value.trim() || undefined,
    })
    revealOpen.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Échec de la récupération.'
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
  <div class="min-h-dvh flex flex-col items-center justify-center animate-fade-in px-4 py-12">
    <div class="w-full max-w-md bg-surface dark:bg-surface-dark p-8 rounded-card shadow-card border border-surface-border dark:border-surface-dark-border animate-slide-up">
      <div class="text-center mb-8">
        <div class="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <LifeBuoy class="w-7 h-7 text-primary" />
        </div>
        <h1 class="text-2xl font-bold text-text-main dark:text-text-dark-main tracking-tight">Récupérer mon compte</h1>
        <p class="text-text-muted dark:text-text-dark-muted mt-2 text-sm">
          Utilisez votre clé de récupération pour définir un nouveau mot de passe sans perdre vos données.
        </p>
      </div>

      <form @submit.prevent="handleRecover" class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-sm font-semibold text-text-main dark:text-text-dark-main ml-1">Adresse email</label>
          <input
            v-model="email"
            type="email"
            required
            placeholder="email@exemple.com"
            class="w-full px-4 py-3 bg-background/50 dark:bg-background-dark-subtle border border-surface-border dark:border-surface-dark-border rounded-input focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-main dark:text-text-dark-main placeholder:text-text-muted/50"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-semibold text-text-main dark:text-text-dark-main ml-1">Clé de récupération</label>
          <input
            v-model="recoveryKey"
            type="text"
            required
            placeholder="XXXX-XXXX-XXXX-XXXX"
            class="w-full px-4 py-3 font-mono tracking-wide bg-background/50 dark:bg-background-dark-subtle border border-surface-border dark:border-surface-dark-border rounded-input focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-main dark:text-text-dark-main placeholder:text-text-muted/50"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-semibold text-text-main dark:text-text-dark-main ml-1">Nouveau mot de passe</label>
          <input
            v-model="newPassword"
            type="password"
            required
            placeholder="••••••••"
            class="w-full px-4 py-3 bg-background/50 dark:bg-background-dark-subtle border border-surface-border dark:border-surface-dark-border rounded-input focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-main dark:text-text-dark-main placeholder:text-text-muted/50"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-semibold text-text-main dark:text-text-dark-main ml-1">Confirmer le mot de passe</label>
          <input
            v-model="confirmPassword"
            type="password"
            required
            placeholder="••••••••"
            class="w-full px-4 py-3 bg-background/50 dark:bg-background-dark-subtle border rounded-input focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-main dark:text-text-dark-main placeholder:text-text-muted/50"
            :class="confirmPassword && !passwordsMatch ? 'border-danger' : 'border-surface-border dark:border-surface-dark-border'"
          />
          <p v-if="confirmPassword && !passwordsMatch" class="text-xs text-danger ml-1">Les mots de passe ne correspondent pas.</p>
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-semibold text-text-main dark:text-text-dark-main ml-1">
            Code 2FA <span class="font-normal text-text-muted">(si la double authentification est activée)</span>
          </label>
          <input
            v-model="totpCode"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="123456"
            class="w-full px-4 py-3 font-mono tracking-wide bg-background/50 dark:bg-background-dark-subtle border border-surface-border dark:border-surface-dark-border rounded-input focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-main dark:text-text-dark-main placeholder:text-text-muted/50"
          />
        </div>

        <transition enter-active-class="animate-fade-in" leave-active-class="opacity-0 transition-opacity">
          <div v-if="error" class="flex items-center gap-3 p-4 bg-danger/10 border border-danger/20 text-danger text-sm rounded-input">
            <AlertCircle class="w-5 h-5 shrink-0" />
            {{ error }}
          </div>
        </transition>

        <button
          type="submit"
          :disabled="isLoading || !canSubmit"
          class="group relative w-full bg-primary hover:bg-primary-hover active:bg-primary-active text-primary-content font-bold py-3.5 rounded-button transition-all shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="isLoading" class="flex items-center justify-center gap-2">
            <LoaderCircle class="animate-spin h-5 w-5 text-current" />
            Récupération...
          </span>
          <span v-else class="flex items-center justify-center gap-2">
            Réinitialiser le mot de passe
            <ArrowRight class="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
      </form>

      <div class="mt-6 text-center">
        <router-link to="/login" class="inline-flex items-center gap-2 text-sm text-text-muted dark:text-text-dark-muted hover:text-primary transition-colors">
          <ArrowLeft class="w-4 h-4" />
          Retour à la connexion
        </router-link>
      </div>
    </div>

    <SecretRevealModal
      :open="revealOpen"
      title="Votre nouvelle clé de récupération"
      description="Votre ancienne clé a été consommée. Conservez cette nouvelle clé hors ligne — elle est affichée une seule fois."
      :secrets="[newRecoveryKey]"
      filename="capitalview-cle-recuperation.txt"
      @close="finish"
    />

    <div class="fixed top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-none opacity-20 dark:opacity-10">
      <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary blur-[120px]"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400 blur-[120px]"></div>
    </div>
  </div>
</template>

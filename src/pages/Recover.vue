<script setup lang="ts">
import { AlertCircle, Check, Circle, LoaderCircle } from 'lucide-vue-next'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AuthLayout from '@/components/public/AuthLayout.vue'
import SecretRevealModal from '@/components/security/SecretRevealModal.vue'
import { fieldHint, fieldInput, fieldLabel, primaryButton, textLink } from '@/components/public/publicStyles'
import { passwordRules } from '@/components/public/passwordRules'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const recoveryKey = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const confirmTouched = ref(false)
const totpCode = ref('')

const error = ref('')
const isLoading = ref(false)

const revealOpen = ref(false)
const newRecoveryKey = ref('')

const rules = computed(() => passwordRules(newPassword.value))
const passwordsMatch = computed(() => newPassword.value === confirmPassword.value)
const showMismatch = computed(() =>
  confirmPassword.value.length > 0 && !passwordsMatch.value
  && (confirmTouched.value || confirmPassword.value.length >= newPassword.value.length),
)

async function handleRecover() {
  if (!rules.value.every(rule => rule.met)) {
    error.value = 'Le nouveau mot de passe ne respecte pas encore toutes les règles.'
    return
  }
  if (!passwordsMatch.value) {
    confirmTouched.value = true
    error.value = 'Les deux mots de passe ne correspondent pas.'
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
  <AuthLayout title="Retrouver l'accès">
    <template #intro>
      Votre clé de récupération permet de choisir un nouveau mot de passe sans perdre vos données.
      <a href="#sans-cle" :class="textLink">Vous n'en avez pas&nbsp;?</a>
    </template>

    <form class="space-y-6" @submit.prevent="handleRecover">
      <div class="space-y-2">
        <label for="recover-email" :class="fieldLabel">Adresse e-mail</label>
        <input id="recover-email" v-model="email" type="email" required autocomplete="username" :class="fieldInput" @input="error = ''" />
      </div>

      <div class="space-y-2">
        <label for="recover-key" :class="fieldLabel">Clé de récupération</label>
        <input
          id="recover-key"
          v-model="recoveryKey"
          type="text"
          required
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          aria-describedby="recover-key-hint"
          :class="[fieldInput, 'font-mono tracking-wide']"
          @input="error = ''"
        />
        <p id="recover-key-hint" :class="fieldHint">8 groupes de 4 caractères, séparés par des tirets.</p>
      </div>

      <div class="space-y-2">
        <label for="recover-password" :class="fieldLabel">Nouveau mot de passe</label>
        <input
          id="recover-password"
          v-model="newPassword"
          type="password"
          required
          autocomplete="new-password"
          aria-describedby="recover-rules"
          :class="fieldInput"
          @input="error = ''"
        />
        <ul id="recover-rules" class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
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
        <label for="recover-confirm" :class="fieldLabel">Confirmer le mot de passe</label>
        <input
          id="recover-confirm"
          v-model="confirmPassword"
          type="password"
          required
          autocomplete="new-password"
          :aria-invalid="showMismatch"
          :class="[fieldInput, showMismatch && 'border-danger focus:border-danger focus:ring-danger']"
          @input="error = ''"
          @blur="confirmTouched = true"
        />
        <p v-if="showMismatch" class="text-sm text-danger">Les deux mots de passe ne correspondent pas.</p>
      </div>

      <div class="space-y-2">
        <label for="recover-totp" :class="fieldLabel">
          Code 2FA <span class="font-normal text-text-muted dark:text-text-dark-muted">(si la double authentification est active)</span>
        </label>
        <input
          id="recover-totp"
          v-model="totpCode"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          :class="[fieldInput, 'font-mono tracking-[0.3em]']"
          @input="error = ''"
        />
      </div>

      <p v-if="error" role="alert" class="flex items-start gap-2.5 p-3.5 bg-danger/10 text-danger text-sm rounded-input">
        <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
        {{ error }}
      </p>

      <button type="submit" :disabled="isLoading" :aria-busy="isLoading" :class="['w-full', primaryButton]">
        <LoaderCircle v-if="isLoading" class="animate-spin h-5 w-5" />
        {{ isLoading ? 'Récupération…' : 'Choisir ce mot de passe' }}
      </button>

      <p :class="fieldHint">
        Le mot de passe vous est revenu&nbsp;?
        <router-link to="/login" :class="textLink">Se connecter</router-link>
      </p>
    </form>

    <template #aside>
      <div id="sans-cle" class="scroll-mt-20 py-6 border-t-2 border-text-main dark:border-text-dark-main">
        <h2 class="text-xl font-semibold text-text-main dark:text-text-dark-main">Sans clé de récupération</h2>
        <p class="mt-2 leading-relaxed text-pretty">
          Vos données ne peuvent pas être rouvertes&nbsp;: elles sont chiffrées avec une clé que seuls votre mot de passe et votre clé de récupération déverrouillent.
          Personne, administrateur compris, ne peut réinitialiser l'accès, et aucun e-mail ne peut le faire.
        </p>
        <p class="mt-3 leading-relaxed text-pretty">
          Si le mot de passe vous revient, reconnectez-vous puis générez une clé dans Réglages › Sécurité.
        </p>
      </div>
    </template>

    <SecretRevealModal
      :open="revealOpen"
      title="Votre nouvelle clé de récupération"
      description="Votre ancienne clé a été consommée. Conservez cette nouvelle clé hors ligne : elle n'est affichée qu'une fois."
      :secrets="[newRecoveryKey]"
      filename="capitalview-cle-recuperation.txt"
      @close="finish"
    />
  </AuthLayout>
</template>

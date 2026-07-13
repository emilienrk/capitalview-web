<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseAlert from '@/components/base/BaseAlert.vue'
import QrCode from '@/components/security/QrCode.vue'
import { useAuthStore } from '@/stores/auth'

interface Props {
  open: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  /** 2FA activated — carries the single-use backup codes. */
  enabled: [codes: string[]]
}>()

const auth = useAuthStore()

type Step = 'password' | 'verify'
const step = ref<Step>('password')
const password = ref('')
const code = ref('')
const secret = ref('')
const otpauthUri = ref('')
const error = ref('')
const isLoading = ref(false)

watch(() => props.open, (open) => {
  if (open) reset()
})

function reset() {
  step.value = 'password'
  password.value = ''
  code.value = ''
  secret.value = ''
  otpauthUri.value = ''
  error.value = ''
  isLoading.value = false
}

async function startSetup() {
  error.value = ''
  isLoading.value = true
  try {
    const res = await auth.setup2fa(password.value)
    secret.value = res.secret
    otpauthUri.value = res.otpauth_uri
    step.value = 'verify'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur lors de la configuration'
  } finally {
    isLoading.value = false
  }
}

async function confirmEnable() {
  error.value = ''
  isLoading.value = true
  try {
    const codes = await auth.enable2fa(code.value.trim())
    emit('enabled', codes)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Code invalide'
  } finally {
    isLoading.value = false
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <BaseModal :open="props.open" title="Activer la double authentification" size="md" @close="handleClose">
    <!-- Step 1: confirm password -->
    <template v-if="step === 'password'">
      <p class="text-sm text-text-body dark:text-text-dark-body mb-4">
        Confirmez votre mot de passe pour démarrer la configuration.
      </p>
      <form @submit.prevent="startSetup" class="space-y-4">
        <BaseInput
          v-model="password"
          type="password"
          label="Mot de passe"
          placeholder="••••••••"
          :disabled="isLoading"
          required
        />
        <BaseAlert v-if="error" variant="danger">{{ error }}</BaseAlert>
      </form>
    </template>

    <!-- Step 2: scan QR + enter code -->
    <template v-else>
      <div class="space-y-5">
        <p class="text-sm text-text-body dark:text-text-dark-body">
          Scannez ce QR code avec votre application d'authentification
          (Google Authenticator, Authy, etc.), puis saisissez le code généré.
        </p>

        <div class="flex justify-center">
          <QrCode :value="otpauthUri" :size="200" />
        </div>

        <div class="text-center">
          <p class="text-xs text-text-muted dark:text-text-dark-muted mb-1">
            Ou saisissez cette clé manuellement :
          </p>
          <code class="text-sm font-mono tracking-wider text-text-main dark:text-text-dark-main break-all select-all">
            {{ secret }}
          </code>
        </div>

        <form @submit.prevent="confirmEnable" class="space-y-4">
          <BaseInput
            v-model="code"
            label="Code de vérification"
            placeholder="123456"
            inputmode="numeric"
            autocomplete="one-time-code"
            :disabled="isLoading"
            required
          />
          <BaseAlert v-if="error" variant="danger">{{ error }}</BaseAlert>
        </form>
      </div>
    </template>

    <template #footer>
      <BaseButton variant="outline" @click="handleClose">Annuler</BaseButton>
      <BaseButton v-if="step === 'password'" :loading="isLoading" :disabled="!password" @click="startSetup">
        Continuer
      </BaseButton>
      <BaseButton v-else :loading="isLoading" :disabled="!code" @click="confirmEnable">
        Activer
      </BaseButton>
    </template>
  </BaseModal>
</template>

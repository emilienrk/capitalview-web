<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseAlert from '@/components/base/BaseAlert.vue'

interface Props {
  open: boolean
  title: string
  description?: string
  submitLabel?: string
  /** Also ask for a 2FA/backup code (default true). */
  requireCode?: boolean
  loading?: boolean
  error?: string
  danger?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  submitLabel: 'Confirmer',
  requireCode: true,
  loading: false,
  error: '',
  danger: false,
})

const emit = defineEmits<{
  close: []
  submit: [payload: { password: string; code: string }]
}>()

const password = ref('')
const code = ref('')

watch(() => props.open, (open) => {
  if (open) {
    password.value = ''
    code.value = ''
  }
})

function submit() {
  emit('submit', { password: password.value, code: code.value.trim() })
}
</script>

<template>
  <BaseModal :open="props.open" :title="props.title" size="sm" @close="emit('close')">
    <form @submit.prevent="submit" class="space-y-4">
      <p v-if="props.description" class="text-sm text-text-body dark:text-text-dark-body">
        {{ props.description }}
      </p>
      <BaseInput
        v-model="password"
        type="password"
        label="Mot de passe"
        placeholder="••••••••"
        :disabled="props.loading"
        required
      />
      <BaseInput
        v-if="props.requireCode"
        v-model="code"
        label="Code 2FA ou code de secours"
        placeholder="123456"
        inputmode="numeric"
        autocomplete="one-time-code"
        :disabled="props.loading"
        required
      />
      <BaseAlert v-if="props.error" variant="danger">{{ props.error }}</BaseAlert>
    </form>

    <template #footer>
      <BaseButton variant="outline" @click="emit('close')">Annuler</BaseButton>
      <BaseButton
        :variant="props.danger ? 'danger' : 'primary'"
        :loading="props.loading"
        :disabled="!password || (props.requireCode && !code)"
        @click="submit"
      >
        {{ props.submitLabel }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

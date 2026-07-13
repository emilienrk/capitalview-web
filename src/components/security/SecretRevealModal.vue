<script setup lang="ts">
import { Check, Copy, Download, ShieldAlert } from 'lucide-vue-next'
import { ref, watch, computed } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'

interface Props {
  open: boolean
  title: string
  description?: string
  /** One or more secrets to reveal (backup codes, or a single recovery key). */
  secrets: string[]
  /** File name used for the "download" action. */
  filename?: string
  /** Require the user to confirm they saved the secrets before closing. */
  requireConfirm?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  filename: 'capitalview-secrets.txt',
  requireConfirm: true,
})

const emit = defineEmits<{ close: [] }>()

const copied = ref(false)
const confirmed = ref(false)

watch(() => props.open, (open) => {
  if (open) {
    copied.value = false
    confirmed.value = false
  }
})

const asText = computed(() => props.secrets.join('\n'))
const canClose = computed(() => !props.requireConfirm || confirmed.value)

async function copyAll() {
  try {
    await navigator.clipboard.writeText(asText.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // clipboard unavailable — no-op, the user can still copy manually
  }
}

function download() {
  const blob = new Blob([asText.value + '\n'], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = props.filename
  a.click()
  URL.revokeObjectURL(url)
}

function handleClose() {
  if (canClose.value) emit('close')
}
</script>

<template>
  <BaseModal :open="props.open" :title="props.title" size="md" @close="handleClose">
    <div class="space-y-4">
      <div class="flex items-start gap-3 p-4 rounded-input border bg-warning/10 border-warning/20 text-warning text-sm">
        <ShieldAlert class="w-5 h-5 shrink-0 mt-0.5" />
        <div class="flex-1">
          <p class="font-medium">Notez ces informations maintenant.</p>
          <p class="mt-0.5 opacity-90">
            {{ props.description || 'Elles ne seront plus jamais affichées. Conservez-les dans un endroit sûr.' }}
          </p>
        </div>
      </div>

      <div
        class="grid gap-2 p-4 rounded-secondary bg-surface-alt dark:bg-surface-dark-alt border border-surface-border dark:border-surface-dark-border"
        :class="props.secrets.length > 1 ? 'grid-cols-2' : 'grid-cols-1'"
      >
        <code
          v-for="(secret, i) in props.secrets"
          :key="i"
          class="text-sm font-mono text-text-main dark:text-text-dark-main tracking-wide text-center py-1 select-all"
        >
          {{ secret }}
        </code>
      </div>

      <div class="flex gap-2">
        <BaseButton variant="outline" size="sm" @click="copyAll">
          <Check v-if="copied" class="w-4 h-4 mr-1.5" />
          <Copy v-else class="w-4 h-4 mr-1.5" />
          {{ copied ? 'Copié' : 'Copier' }}
        </BaseButton>
        <BaseButton variant="outline" size="sm" @click="download">
          <Download class="w-4 h-4 mr-1.5" />
          Télécharger
        </BaseButton>
      </div>

      <label v-if="props.requireConfirm" class="flex items-center gap-2 cursor-pointer pt-1">
        <input
          v-model="confirmed"
          type="checkbox"
          class="w-4 h-4 rounded-sm border-surface-border dark:border-surface-dark-border text-primary focus:ring-primary"
        />
        <span class="text-sm text-text-body dark:text-text-dark-body">
          J'ai sauvegardé ces informations en lieu sûr.
        </span>
      </label>
    </div>

    <template #footer>
      <BaseButton :disabled="!canClose" @click="handleClose">
        J'ai terminé
      </BaseButton>
    </template>
  </BaseModal>
</template>

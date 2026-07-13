<script setup lang="ts">
import QRCode from 'qrcode'
import { ref, watch, onMounted } from 'vue'

interface Props {
  /** The value to encode (e.g. an otpauth:// URI). */
  value: string
  /** Rendered size in pixels. */
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 200,
})

const dataUrl = ref<string>('')
const error = ref<string>('')

async function render() {
  error.value = ''
  if (!props.value) {
    dataUrl.value = ''
    return
  }
  try {
    dataUrl.value = await QRCode.toDataURL(props.value, {
      width: props.size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
  } catch {
    error.value = 'Impossible de générer le QR code'
  }
}

onMounted(render)
watch(() => props.value, render)
</script>

<template>
  <div class="inline-flex items-center justify-center">
    <img
      v-if="dataUrl"
      :src="dataUrl"
      alt="QR code de configuration 2FA"
      :width="props.size"
      :height="props.size"
      class="rounded-secondary bg-white p-2 border border-surface-border dark:border-surface-dark-border"
    />
    <p v-else-if="error" class="text-xs text-danger">{{ error }}</p>
    <div
      v-else
      class="animate-pulse bg-surface-alt dark:bg-surface-dark-alt rounded-secondary"
      :style="{ width: props.size + 'px', height: props.size + 'px' }"
    />
  </div>
</template>

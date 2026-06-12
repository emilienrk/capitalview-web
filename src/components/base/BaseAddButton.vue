<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import BaseButton from './BaseButton.vue'
import type { ButtonSize } from './BaseButton.vue'

export type AddButtonVariant = 'primary' | 'ghost'

interface Props {
  variant?: AddButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
})

defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <BaseButton
    :variant="variant === 'ghost' ? 'ghost' : 'primary'"
    :size="size"
    :disabled="disabled"
    :loading="loading"
    @click="$emit('click', $event)"
  >
    <Plus
      class="w-5 h-5 shrink-0"
      :class="variant === 'ghost' ? 'text-primary' : ''"
    />
    <span v-if="$slots.default" class="hidden sm:inline">
      <slot />
    </span>
  </BaseButton>
</template>

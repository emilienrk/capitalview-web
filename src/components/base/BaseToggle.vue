<script setup lang="ts">
interface Props {
  modelValue: boolean
  disabled?: boolean
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  ariaLabel: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

function toggle(): void {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="props.modelValue"
    :aria-label="props.ariaLabel"
    :disabled="props.disabled"
    :class="[
      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
      props.modelValue ? 'bg-primary' : 'bg-surface-border dark:bg-surface-dark-border',
      props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    ]"
    @click="toggle"
  >
    <span
      :class="[
        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
        props.modelValue ? 'translate-x-6' : 'translate-x-1',
      ]"
    />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type SegmentedControlVariant = 'primary' | 'surface'
type SegmentedControlSize = 'sm' | 'md'

export interface SegmentedControlOption<TValue extends string | number = string> {
  label: string
  value?: TValue
  key?: TValue
}

interface Props {
  modelValue: string | number
  options: SegmentedControlOption[]
  variant?: SegmentedControlVariant
  size?: SegmentedControlSize
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'surface',
  size: 'md',
  fullWidth: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const variantClasses: Record<SegmentedControlVariant, { active: string; inactive: string }> = {
  primary: {
    active: 'bg-primary text-primary-content shadow-sm',
    inactive: 'text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main',
  },
  surface: {
    active: 'bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main shadow-sm ring-1 ring-black/5 dark:ring-white/10',
    inactive: 'text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main',
  },
}

const sizeClasses: Record<SegmentedControlSize, string> = {
  sm: 'px-3 py-1.5 text-xs sm:text-sm',
  md: 'px-4 py-1.5 text-sm',
}

const containerClasses = computed(() => [
  'inline-flex items-center gap-0.5 rounded-button border border-surface-border dark:border-surface-dark-border bg-background-subtle dark:bg-background-dark-subtle p-1',
  props.fullWidth ? 'w-full' : '',
])

function isActive(value: string | number): boolean {
  return props.modelValue === value
}

function selectValue(value: string | number): void {
  emit('update:modelValue', value)
}

function getOptionValue(option: SegmentedControlOption): string | number {
  return option.value ?? option.key ?? option.label
}
</script>

<template>
  <div :class="containerClasses">
    <button
      v-for="option in props.options"
      :key="String(getOptionValue(option))"
      type="button"
      @click="selectValue(getOptionValue(option))"
      :class="[
        'border border-transparent rounded-button font-medium transition-all duration-200',
        sizeClasses[props.size],
        props.fullWidth ? 'flex-1 min-w-0' : '',
        isActive(getOptionValue(option)) ? variantClasses[props.variant].active : variantClasses[props.variant].inactive,
      ]"
    >
      {{ option.label }}
    </button>
  </div>
</template>
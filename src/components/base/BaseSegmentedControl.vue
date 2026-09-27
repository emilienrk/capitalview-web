<script setup lang="ts">
import { MotionConfig, motion } from 'motion-v'
import { computed, useId } from 'vue'

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

const variantClasses: Record<SegmentedControlVariant, { active: string; inactive: string; indicator: string }> = {
  primary: {
    active: 'text-primary-content',
    indicator: 'bg-primary shadow-sm',
    inactive: 'text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main',
  },
  surface: {
    active: 'text-text-main dark:text-text-dark-main',
    indicator: 'bg-surface dark:bg-surface-dark shadow-sm ring-1 ring-black/5 dark:ring-white/10',
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

// One indicator per control slides to the chosen option instead of the
// background jumping between buttons; the id keeps controls on a page apart.
const indicatorId = `segmented-${useId()}`
const INDICATOR_TRANSITION = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const

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
    <MotionConfig reduced-motion="user">
      <button
        v-for="option in props.options"
        :key="String(getOptionValue(option))"
        type="button"
        @click="selectValue(getOptionValue(option))"
        :class="[
          'relative border border-transparent rounded-button font-medium transition-colors duration-200',
          sizeClasses[props.size],
          props.fullWidth ? 'flex-1 min-w-0' : '',
          isActive(getOptionValue(option)) ? variantClasses[props.variant].active : variantClasses[props.variant].inactive,
        ]"
      >
        <motion.span
          v-if="isActive(getOptionValue(option))"
          :layout-id="indicatorId"
          :transition="INDICATOR_TRANSITION"
          :class="['absolute -inset-px rounded-button', variantClasses[props.variant].indicator]"
        />
        <span class="relative">{{ option.label }}</span>
      </button>
    </MotionConfig>
  </div>
</template>

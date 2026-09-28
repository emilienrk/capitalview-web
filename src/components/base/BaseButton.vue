<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { LoaderCircle } from 'lucide-vue-next'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface Props {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  block?: boolean
  icon?: boolean
  /** Renders a link styled as a button: a button wrapped in a link is invalid
   *  and takes two tab stops. */
  to?: RouteLocationRaw
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  type: 'button',
  block: false,
  icon: false,
})

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary hover:bg-primary-hover active:bg-primary-active text-primary-content shadow-sm',
  secondary:
    'bg-secondary hover:bg-secondary-hover text-secondary-content',
  outline:
    'border-2 border-primary text-primary hover:bg-primary/5 dark:hover:bg-primary/10',
  ghost:
    'text-text-body dark:text-text-dark-body hover:bg-surface-active dark:hover:bg-surface-dark-hover',
  danger:
    'bg-danger hover:bg-danger/90 text-danger-content',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-base',
}

const paddingClasses = computed(() => {
  if (props.icon) {
    if (props.size === 'sm') return 'p-1.5'
    if (props.size === 'md') return 'p-2.5'
    if (props.size === 'lg') return 'p-3'
  }
  if (props.size === 'sm') return 'px-3 py-1.5'
  if (props.size === 'md') return 'px-5 py-2.5'
  if (props.size === 'lg') return 'px-6 py-3'
  return ''
})
</script>

<template>
  <!-- :enabled never matches a link, so a link takes the plain press scale. -->
  <component
    :is="props.to ? RouterLink : 'button'"
    :to="props.to"
    :type="props.to ? undefined : props.type"
    :disabled="props.to ? undefined : props.disabled || props.loading"
    :class="[
      'inline-flex items-center justify-center gap-2 font-semibold rounded-button border-2 border-transparent transition duration-150 ease-out',
      'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      variantClasses[props.variant],
      sizeClasses[props.size],
      paddingClasses,
      props.block ? 'w-full' : '',
      props.to
        ? (props.block ? 'active:scale-[0.98]' : 'active:scale-[0.97]')
        : (props.block ? 'enabled:active:scale-[0.98]' : 'enabled:active:scale-[0.97]'),
    ]"
  >
    <slot />
  </component>
</template>

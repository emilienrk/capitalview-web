<script setup lang="ts">
import { X } from 'lucide-vue-next'

import { nextTick, onUnmounted, ref, useId, watch } from 'vue'
import { lockScroll, unlockScroll } from '@/services/scrollLock'

interface Props {
  open: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

const emit = defineEmits<{
  close: []
}>()

const sizeClasses: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

const titleId = useId()
const panelRef = ref<HTMLElement | null>(null)

/** Element focused before the modal opened — restored on close. */
let previouslyFocused: HTMLElement | null = null
let isLocked = false

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function focusInitialElement(): void {
  const panel = panelRef.value
  if (!panel) return
  const focusable = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
  ;(focusable ?? panel).focus()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
    return
  }

  // Minimal focus trap: keep Tab cycling inside the panel.
  if (event.key === 'Tab' && panelRef.value) {
    const focusables = Array.from(
      panelRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
    if (!focusables.length) return

    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!
    const active = document.activeElement

    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

// Lock body scroll while the modal is open (ref-counted, shared with sidebar)
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && !isLocked) {
      lockScroll()
      isLocked = true
      previouslyFocused = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      nextTick(() => focusInitialElement())
    } else if (!isOpen && isLocked) {
      unlockScroll()
      isLocked = false
      previouslyFocused?.focus()
      previouslyFocused = null
    }
  },
  { immediate: true },
)

// If the component unmounts while open, release the lock.
onUnmounted(() => {
  if (isLocked) {
    unlockScroll()
    isLocked = false
  }
})

function onBackdropClick(): void {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="props.open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @keydown="onKeydown"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="onBackdropClick"
        />

        <!-- Modal Panel -->
        <div
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="props.title ? titleId : undefined"
          tabindex="-1"
          :class="[
            'relative w-full bg-surface dark:bg-surface-dark rounded-card shadow-modal border border-surface-border dark:border-surface-dark-border animate-slide-up flex flex-col max-h-[90vh] outline-none',
            sizeClasses[props.size],
          ]"
        >
          <!-- Header -->
          <div
            v-if="props.title || $slots.header"
            class="flex items-center justify-between px-6 py-4 border-b border-surface-border dark:border-surface-dark-border"
          >
            <slot name="header">
              <h2 :id="titleId" class="text-lg font-semibold text-text-main dark:text-text-dark-main">
                {{ props.title }}
              </h2>
            </slot>
            <button
              type="button"
              aria-label="Fermer"
              @click="emit('close')"
              class="p-1.5 rounded-secondary text-text-muted dark:text-text-dark-muted hover:bg-surface-active dark:hover:bg-surface-dark-hover transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 overflow-y-auto flex-1">
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer"
            class="px-6 py-4 border-t border-surface-border dark:border-surface-dark-border flex justify-end gap-3"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

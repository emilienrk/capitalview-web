<script setup lang="ts">
/**
 * A short explanation attached to something, revealed on hover or on tap.
 *
 * Hover alone would hide the content on every phone, so the trigger is a real
 * button: pointer devices open it on hover, touch devices on tap, and a keyboard
 * on focus. That also makes it reachable rather than decorative.
 *
 * It is for secondary reading — a caveat, a definition. Anything a user must see
 * to avoid a wrong conclusion belongs on the page, not in here.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useCanHover } from '@/composables/useMediaQuery'

withDefaults(defineProps<{ label?: string; align?: 'left' | 'right' }>(), {
  label: 'Détail',
  align: 'left',
})

const canHover = useCanHover()
const isOpen = ref(false)
const root = ref<HTMLElement | null>(null)

function open() {
  isOpen.value = true
}

function close() {
  isOpen.value = false
}

function onEnter() {
  if (canHover.value) open()
}

function onLeave() {
  if (canHover.value) close()
}

function toggle() {
  isOpen.value = !isOpen.value
}

/** A tap outside closes it — on touch there is no pointer to leave. */
function onDocumentPointer(event: PointerEvent) {
  if (!isOpen.value || !root.value) return
  if (!root.value.contains(event.target as Node)) close()
}

function onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointer)
  document.addEventListener('keydown', onEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointer)
  document.removeEventListener('keydown', onEscape)
})
</script>

<template>
  <span
    ref="root"
    class="relative inline-flex"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <button
      type="button"
      class="inline-flex cursor-help items-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      :aria-label="label"
      :aria-expanded="isOpen"
      @click="toggle"
      @focus="open"
      @blur="close"
    >
      <slot name="trigger" />
    </button>

    <span
      v-if="isOpen"
      role="tooltip"
      :class="[
        'absolute bottom-full z-20 mb-1 w-56 rounded-lg border border-border bg-surface p-2 text-left text-xs font-normal leading-relaxed text-text-muted shadow-card dark:border-border-dark dark:bg-surface-dark dark:text-text-dark-muted',
        align === 'right' ? 'right-0' : 'left-0',
      ]"
    >
      <slot />
    </span>
  </span>
</template>

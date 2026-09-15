<script setup lang="ts">
/**
 * A short explanation attached to something, revealed on hover or on tap.
 *
 * Hover alone would hide the content on every phone, so the trigger is a real
 * button: pointer devices open it on hover, touch devices on tap, and a keyboard
 * on focus. That also makes it reachable rather than decorative.
 *
 * The panel is teleported to <body> and placed by Floating UI. Positioned
 * inside its trigger's box it used to be clipped by any card with
 * `overflow: hidden`, painted under the fixed sidebar, and cut at the bottom of
 * the screen; out here it flips to whichever side has room and slides back
 * inside the viewport, and follows its trigger on scroll and resize.
 *
 * It is for secondary reading — a caveat, a definition. Anything a user must see
 * to avoid a wrong conclusion belongs on the page, not in here.
 */
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { arrow, autoUpdate, flip, hide, offset, shift, size, useFloating } from '@floating-ui/vue'
import { useCanHover } from '@/composables/useMediaQuery'

const props = withDefaults(
  defineProps<{
    label?: string
    /** 'sm' fits a sentence; 'md' fits a list of definitions. */
    width?: 'sm' | 'md'
    /** The preferred side; the panel flips when that side has no room. */
    placement?: 'top' | 'bottom'
    /**
     * 'span' when the trigger is itself a control (a button that opens a
     * modal): nesting it inside our button would be invalid, and its click
     * belongs to it, not to the tooltip.
     */
    as?: 'button' | 'span'
  }>(),
  {
    label: 'Détail',
    width: 'sm',
    placement: 'top',
    as: 'button',
  },
)

/** Long enough to ignore a pointer crossing a row of triggers, short enough to feel immediate. */
const OPEN_DELAY_MS = 80
/** Lets the pointer travel from the trigger to the panel without it closing. */
const CLOSE_DELAY_MS = 120
const VIEWPORT_PADDING_PX = 8

const canHover = useCanHover()
const panelId = useId()

const reference = ref<HTMLElement | null>(null)
const floating = ref<HTMLElement | null>(null)
const arrowRef = ref<HTMLElement | null>(null)

// Three independent reasons to be open, so that one ending (the pointer
// leaving) does not cancel another (a tap that pinned it).
const hovered = ref(false)
const focused = ref(false)
const pinned = ref(false)
const isOpen = computed(() => hovered.value || focused.value || pinned.value)

const { floatingStyles, middlewareData, placement: resolvedPlacement } = useFloating(reference, floating, {
  open: isOpen,
  placement: () => props.placement,
  strategy: 'fixed',
  middleware: () => [
    offset(8),
    flip({ padding: VIEWPORT_PADDING_PX }),
    shift({ padding: VIEWPORT_PADDING_PX }),
    // A definition list taller than the room left scrolls inside the panel
    // rather than running off the screen.
    size({
      padding: VIEWPORT_PADDING_PX,
      apply({ availableHeight, elements }) {
        elements.floating.style.setProperty('--tooltip-max-height', `${Math.max(0, availableHeight)}px`)
      },
    }),
    arrow({ element: arrowRef, padding: 10 }),
    hide(),
  ],
  whileElementsMounted: autoUpdate,
})

const side = computed(() => resolvedPlacement.value.split('-')[0] as 'top' | 'bottom' | 'left' | 'right')

const arrowStyles = computed(() => {
  const data = middlewareData.value.arrow
  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side.value]
  return {
    left: data?.x != null ? `${data.x}px` : '',
    top: data?.y != null ? `${data.y}px` : '',
    [opposite]: '-5px',
  }
})

/** The trigger scrolled out of its container: a panel pointing at nothing is worse than none. */
const referenceHidden = computed(() => middlewareData.value.hide?.referenceHidden ?? false)

let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined

function clearTimers() {
  clearTimeout(openTimer)
  clearTimeout(closeTimer)
}

function onPointerEnter() {
  if (!canHover.value) return
  clearTimers()
  if (isOpen.value) hovered.value = true
  else openTimer = setTimeout(() => (hovered.value = true), OPEN_DELAY_MS)
}

function onPointerLeave() {
  if (!canHover.value) return
  clearTimers()
  closeTimer = setTimeout(() => (hovered.value = false), CLOSE_DELAY_MS)
}

/** Keyboard focus only: a tap focuses too, and would then be undone by its own click. */
function onFocusIn(event: FocusEvent) {
  if ((event.target as HTMLElement).matches(':focus-visible')) focused.value = true
}

function onFocusOut() {
  focused.value = false
}

function onClick(event: MouseEvent) {
  // A help trigger sits inside clickable cards: opening it must not also
  // navigate away.
  event.stopPropagation()
  pinned.value = !pinned.value
}

function close() {
  clearTimers()
  hovered.value = false
  focused.value = false
  pinned.value = false
}

/** A tap outside closes it — on touch there is no pointer to leave. */
function onDocumentPointer(event: PointerEvent) {
  const target = event.target as Node
  if (reference.value?.contains(target) || floating.value?.contains(target)) return
  close()
}

/** Captured, so that inside a modal the first Escape closes the tooltip rather than the modal. */
function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  close()
}

// Listening only while open: a page of reliability badges would otherwise
// register a pair of document listeners per badge.
watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('pointerdown', onDocumentPointer)
    document.addEventListener('keydown', onEscape, true)
  } else {
    document.removeEventListener('pointerdown', onDocumentPointer)
    document.removeEventListener('keydown', onEscape, true)
  }
})

onBeforeUnmount(() => {
  clearTimers()
  document.removeEventListener('pointerdown', onDocumentPointer)
  document.removeEventListener('keydown', onEscape, true)
})
</script>

<template>
  <span
    ref="reference"
    class="inline-flex"
    @mouseenter="onPointerEnter"
    @mouseleave="onPointerLeave"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <button
      v-if="as === 'button'"
      type="button"
      class="inline-flex cursor-help items-center rounded text-left [text-transform:inherit] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      :aria-label="label"
      :aria-expanded="isOpen"
      :aria-describedby="isOpen ? panelId : undefined"
      @click="onClick"
    >
      <slot name="trigger" />
    </button>
    <slot v-else name="trigger" />

    <Teleport to="body">
      <Transition
        enter-active-class="motion-safe:transition-opacity motion-safe:duration-100"
        enter-from-class="opacity-0"
        leave-active-class="motion-safe:transition-opacity motion-safe:duration-75"
        leave-to-class="opacity-0"
      >
        <!-- z-index above every modal: their stacking counts up from 50. -->
        <div
          v-if="isOpen"
          :id="panelId"
          ref="floating"
          role="tooltip"
          :style="[floatingStyles, { visibility: referenceHidden ? 'hidden' : undefined }]"
          :class="[
            'z-1000 rounded-secondary border border-surface-border bg-surface text-left text-xs font-normal leading-relaxed text-text-body shadow-card dark:border-surface-dark-border dark:bg-surface-dark dark:text-text-dark-body',
            width === 'md' ? 'w-[min(22rem,calc(100vw-1rem))]' : 'w-max max-w-[min(16rem,calc(100vw-1rem))]',
          ]"
          @mouseenter="onPointerEnter"
          @mouseleave="onPointerLeave"
        >
          <!-- Scrolls on its own so the arrow, outside it, is never clipped. -->
          <div
            :class="[
              'max-h-[calc(var(--tooltip-max-height,100vh)-2px)] overflow-y-auto overscroll-contain',
              width === 'md' ? 'p-3' : 'px-3 py-2',
            ]"
          >
            <slot />
          </div>
          <!-- The arrow shares the panel's border on its two outer edges only,
               so it reads as part of the panel rather than a square on top. -->
          <span
            ref="arrowRef"
            aria-hidden="true"
            :style="arrowStyles"
            :class="[
              'absolute h-2.5 w-2.5 rotate-45 border-surface-border bg-surface dark:border-surface-dark-border dark:bg-surface-dark',
              {
                top: 'border-b border-r',
                bottom: 'border-l border-t',
                left: 'border-r border-t',
                right: 'border-b border-l',
              }[side],
            ]"
          />
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

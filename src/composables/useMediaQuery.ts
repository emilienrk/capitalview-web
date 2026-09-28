import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Reactive `matchMedia`, following the pattern `useDarkMode` already uses.
 *
 * Server-safe: with no `window` it reports false and never listens, so a
 * component rendered outside a browser gets the narrow layout rather than
 * throwing.
 *
 * @example
 * ```ts
 * const canHover = useMediaQuery('(hover: hover) and (pointer: fine)')
 * ```
 */
export function useMediaQuery(query: string) {
  // Read at once rather than on mount, so a layout chosen by it is right on the
  // first render instead of drawing the other one for a frame.
  const matches = ref(typeof window !== 'undefined' && !!window.matchMedia?.(query).matches)
  let media: MediaQueryList | null = null

  function sync(event: MediaQueryList | MediaQueryListEvent) {
    matches.value = event.matches
  }

  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    media = window.matchMedia(query)
    sync(media)
    media.addEventListener('change', sync)
  })

  onBeforeUnmount(() => {
    media?.removeEventListener('change', sync)
    media = null
  })

  return matches
}

/**
 * True on a device that can actually hover — a mouse or a trackpad.
 *
 * Deliberately not a width breakpoint: a touchscreen laptop is wide and cannot
 * hover, and hiding something behind a hover there would hide it for good.
 */
export function useCanHover() {
  return useMediaQuery('(hover: hover) and (pointer: fine)')
}

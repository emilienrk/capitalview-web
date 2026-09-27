import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * Turns true once `target` rises past the bottom 15% of the viewport, and stays
 * true. A margin rather than a ratio, so a tall block fires as soon as it shows.
 */
export function useSeenOnce(target: Ref<HTMLElement | null>): Ref<boolean> {
  const seen = ref(false)
  let observer: IntersectionObserver | undefined

  onMounted(() => {
    if (!target.value || typeof IntersectionObserver === 'undefined') {
      seen.value = true
      return
    }
    observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return
      seen.value = true
      observer?.disconnect()
    }, { rootMargin: '0px 0px -15% 0px' })
    observer.observe(target.value)
  })

  onBeforeUnmount(() => observer?.disconnect())

  return seen
}

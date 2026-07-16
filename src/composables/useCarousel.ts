import { computed, ref, type ComputedRef, type Ref } from 'vue'

export interface CarouselSlide<K extends string = string> {
  key: K
  label: string
}

export interface SwipeHandlers {
  onTouchStart: (e: TouchEvent) => void
  onTouchEnd: (e: TouchEvent) => void
}

export interface UseCarouselReturn<K extends string> {
  current: Ref<K>
  currentLabel: ComputedRef<string>
  next: () => void
  prev: () => void
  swipeHandlers: SwipeHandlers
}

/**
 * Cyclic slide navigation shared by the chart carousels (Crypto, Stock,
 * Dashboard). Includes lightweight touch-swipe handlers that don't block
 * page scroll (horizontal threshold 60px, max vertical drift 60px).
 */
export function useCarousel<K extends string>(
  slides: ReadonlyArray<CarouselSlide<K>>,
): UseCarouselReturn<K> {
  const current = ref(slides[0]!.key) as Ref<K>

  const currentLabel = computed<string>(() => {
    return slides.find((slide) => slide.key === current.value)?.label ?? slides[0]!.label
  })

  function shift(offset: number): void {
    if (!slides.length) return
    const idx = slides.findIndex((slide) => slide.key === current.value)
    const normalizedIdx = idx >= 0 ? idx : 0
    const nextSlide = slides[(normalizedIdx + offset + slides.length) % slides.length]
    if (nextSlide) current.value = nextSlide.key
  }

  const next = () => shift(1)
  const prev = () => shift(-1)

  const THRESHOLD = 60
  const MAX_VERTICAL = 60
  let startX = 0
  let startY = 0

  const swipeHandlers: SwipeHandlers = {
    onTouchStart(e: TouchEvent) {
      const t = e.touches[0]
      if (!t) return
      startX = t.clientX
      startY = t.clientY
    },
    onTouchEnd(e: TouchEvent) {
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - startX
      const dy = Math.abs(t.clientY - startY)
      if (dy > MAX_VERTICAL) return
      if (dx > THRESHOLD) prev()
      else if (dx < -THRESHOLD) next()
    },
  }

  return { current, currentLabel, next, prev, swipeHandlers }
}

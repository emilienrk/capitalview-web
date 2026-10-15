import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { toastWhileSet, useToast } from '@/composables/useToast'

const { toasts, show, dismiss, pause, resume, act } = useToast()

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  for (const toast of toasts.value) dismiss(toast.id)
  vi.useRealTimers()
})

describe('useToast', () => {
  it('lets what went well leave on its own, and keeps an error until closed', () => {
    show('Enregistré.')
    show('Impossible.', { variant: 'danger' })
    vi.advanceTimersByTime(10_000)
    expect(toasts.value.map((toast) => toast.parts)).toEqual([['Impossible.']])
  })

  it('holds a toast while it is hovered', () => {
    const id = show('Enregistré.')
    pause(id)
    vi.advanceTimersByTime(10_000)
    expect(toasts.value).toHaveLength(1)
    resume(id)
    vi.advanceTimersByTime(5_000)
    expect(toasts.value).toHaveLength(0)
  })

  it('closes as its action runs, without calling onDismiss', () => {
    const run = vi.fn()
    const onDismiss = vi.fn()
    show('Comptée.', { action: { label: 'Annuler', run }, onDismiss })
    act(toasts.value[0]!)
    expect(run).toHaveBeenCalledOnce()
    expect(onDismiss).not.toHaveBeenCalled()
    expect(toasts.value).toHaveLength(0)
  })

  it('keeps the three latest', () => {
    for (const message of ['a', 'b', 'c', 'd']) show(message, { variant: 'danger' })
    expect(toasts.value.map((toast) => toast.parts[0])).toEqual(['b', 'c', 'd'])
  })
})

describe('toastWhileSet', () => {
  it('follows its ref, and clears it when closed', async () => {
    const error = ref<string | null>(null)
    const scope = effectScope()
    scope.run(() => toastWhileSet(error))

    error.value = 'Impossible.'
    await nextTick()
    error.value = 'Toujours impossible.'
    await nextTick()
    expect(toasts.value.map((toast) => toast.parts)).toEqual([['Toujours impossible.']])

    dismiss(toasts.value[0]!.id)
    expect(error.value).toBeNull()

    error.value = 'Encore.'
    await nextTick()
    scope.stop()
    expect(toasts.value).toHaveLength(0)
    expect(error.value).toBe('Encore.')
  })
})

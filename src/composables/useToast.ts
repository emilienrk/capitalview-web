import { onScopeDispose, ref, watch, type Ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import type { AlertVariant } from '@/components/base/BaseAlert.vue'

/** A piece of a toast's text: words, or a link to where what it speaks of lives. */
export type ToastPart = string | { label: string; to: RouteLocationRaw }

export interface ToastOptions {
  variant?: AlertVariant
  /** One button after the text, such as "Annuler": the toast closes as it runs. */
  action?: { label: string; run: () => void }
  /** Called when the user closes it, or when it closes on its own. */
  onDismiss?: () => void
}

export interface Toast extends Required<Pick<ToastOptions, 'variant'>>, Omit<ToastOptions, 'variant'> {
  id: number
  parts: ToastPart[]
}

/** How long what went well stays; what went wrong waits for the user. */
const DURATION = 5000
const DURATION_WITH_ACTION = 8000
const LIMIT = 3

// Module-level singleton, like useConfirm: one stack, mounted in the layout, serves every page.
const toasts = ref<Toast[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let nextId = 0

function lasts(toast: Toast): number | null {
  if (toast.variant === 'danger' || toast.variant === 'warning') return null
  return toast.action ? DURATION_WITH_ACTION : DURATION
}

function remove(id: number): Toast | undefined {
  clearTimeout(timers.get(id))
  timers.delete(id)
  const toast = toasts.value.find((item) => item.id === id)
  toasts.value = toasts.value.filter((item) => item.id !== id)
  return toast
}

function dismiss(id: number): void {
  remove(id)?.onDismiss?.()
}

function resume(id: number): void {
  const toast = toasts.value.find((item) => item.id === id)
  const duration = toast && lasts(toast)
  if (!duration) return
  clearTimeout(timers.get(id))
  timers.set(id, setTimeout(() => dismiss(id), duration))
}

/** Held while the pointer or focus is on it, so a toast being read does not leave. */
function pause(id: number): void {
  clearTimeout(timers.get(id))
  timers.delete(id)
}

function show(message: string | ToastPart[], options: ToastOptions = {}): number {
  const id = nextId++
  toasts.value = [...toasts.value, { ...options, id, variant: options.variant ?? 'success', parts: [message].flat() }]
  while (toasts.value.length > LIMIT) dismiss(toasts.value[0]!.id)
  resume(id)
  return id
}

function act(toast: Toast): void {
  remove(toast.id)
  toast.action?.run()
}

/**
 * Feedback on what the user just did, at the foot of the screen — saved,
 * deleted, "Annuler", or why it failed. What a page is (an empty list, a load
 * that failed) and a form's own errors stay where they are.
 */
export function useToast() {
  return { toasts, show, dismiss, pause, resume, act }
}

/**
 * Says a message a page or a store keeps in a ref, for as long as it holds
 * one: set again, it replaces its toast; closed, it clears the ref. The toast
 * leaves with the page that shows it.
 */
export function toastWhileSet(source: Ref<string | null>, variant: AlertVariant = 'danger'): void {
  let id: number | null = null
  watch(source, (message) => {
    if (id !== null) remove(id)
    id = message
      ? show(message, { variant, onDismiss: () => { id = null; source.value = null } })
      : null
  }, { immediate: true })
  onScopeDispose(() => { if (id !== null) remove(id) })
}

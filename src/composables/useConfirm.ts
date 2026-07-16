import { ref } from 'vue'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
}

interface ConfirmState extends Required<ConfirmOptions> {
  open: boolean
}

// Module-level singleton: one dialog instance (mounted in App.vue) serves
// the whole app, styled with the design system instead of window.confirm().
const state = ref<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirmer',
  cancelLabel: 'Annuler',
  variant: 'danger',
})

let resolver: ((confirmed: boolean) => void) | null = null

/**
 * Promise-based replacement for window.confirm().
 *
 * @example
 * const { confirmDialog } = useConfirm()
 * if (await confirmDialog({ title: 'Supprimer', message: 'Supprimer ce compte ?' })) { … }
 */
export function useConfirm() {
  function confirmDialog(options: ConfirmOptions): Promise<boolean> {
    // A pending dialog is cancelled by a newer one (should not happen in practice).
    resolver?.(false)

    state.value = {
      open: true,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Confirmer',
      cancelLabel: options.cancelLabel ?? 'Annuler',
      variant: options.variant ?? 'danger',
    }

    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  function settle(confirmed: boolean): void {
    state.value.open = false
    resolver?.(confirmed)
    resolver = null
  }

  return { confirmState: state, confirmDialog, settle }
}

// Class strings shared by the logged-out pages (landing, login, register, recover).

export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

export const primaryButton = `min-h-12 inline-flex items-center justify-center gap-2 px-6 rounded-button bg-primary hover:bg-primary-hover text-primary-content font-semibold transition-[background-color,scale] duration-150 ease-out not-disabled:active:scale-[0.98] disabled:cursor-not-allowed ${focusRing}`

export const textLink = `rounded-button font-semibold text-primary underline-offset-4 hover:underline ${focusRing}`

export const fieldLabel = 'block text-sm font-semibold text-text-main dark:text-text-dark-main'

export const fieldInput = 'block w-full min-h-12 px-3.5 bg-surface dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border rounded-input text-text-main dark:text-text-dark-main outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary'

export const fieldHint = 'text-sm text-text-muted dark:text-text-dark-muted'

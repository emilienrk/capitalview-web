/**
 * Reference-counted body scroll lock, shared by modals and the mobile
 * sidebar so they don't fight over `document.body.style.overflow`
 * (closing one no longer unlocks scroll while another is still open).
 */
let lockCount = 0

export function lockScroll(): void {
  lockCount += 1
  if (lockCount === 1) {
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }
}

export function unlockScroll(): void {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = ''
    document.documentElement.style.overflow = ''
  }
}

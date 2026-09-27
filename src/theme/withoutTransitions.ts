/**
 * Apply a theme change (dark mode, style, palette) in one frame. Otherwise
 * inputs and buttons fade to the new palette over their own transition while
 * the page background snaps, flashing the old colors.
 */
export function withoutTransitions(apply: () => void): void {
  const style = document.createElement('style')
  style.textContent = '*, *::before, *::after { transition: none !important; }'
  document.head.appendChild(style)
  apply()
  // Flush styles so the new colors land before transitions come back.
  void window.getComputedStyle(document.body).opacity
  setTimeout(() => style.remove(), 1)
}

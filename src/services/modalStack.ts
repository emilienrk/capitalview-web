/**
 * Reference-counted stacking order for modals, taken when one *opens* rather
 * than when it mounts.
 *
 * Every modal teleports to <body>, so at an equal z-index the DOM order decides
 * which one paints on top — and that order is the mount order, which has
 * nothing to do with the order the user opens them in. The confirm dialog
 * mounted in App.vue sits earlier in <body> than any lazy-loaded page's modal,
 * so it used to open *underneath* the very modal that asked for it. Counting
 * from the opening makes the last one opened the visible one, whatever was
 * mounted first.
 *
 * Lives here rather than in BaseModal because `<script setup>` runs per
 * instance: a counter declared there would be duplicated, not shared — the same
 * reason `scrollLock` is its own module.
 */

/** Floor of the range, matching the `z-50` modals used to carry. */
export const BASE_MODAL_Z_INDEX = 50

let openModals = 0
let nextZIndex = BASE_MODAL_Z_INDEX

export function acquireModalZIndex(): number {
  openModals += 1
  nextZIndex += 1
  return nextZIndex
}

export function releaseModalZIndex(): void {
  openModals = Math.max(0, openModals - 1)
  // Back to the floor once nothing is open, so a long session cannot drift the
  // counter upward without bound.
  if (openModals === 0) {
    nextZIndex = BASE_MODAL_Z_INDEX
  }
}

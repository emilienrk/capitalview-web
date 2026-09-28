import { ref } from 'vue'
import { withoutTransitions } from './withoutTransitions'

/**
 * Per-user look: a style (type, corners, depth) and a palette (colors), each
 * mapped to a data attribute on <html> that theme.css keys off. The defaults
 * are the base :root look and set no attribute. 'current', which the server
 * still answers for accounts that never chose, meant the retired original
 * style and palette; it now reads as the defaults.
 *
 * The server-side user settings are the source of truth (synced by the
 * settings store via applyServerAppearance). localStorage is only a boot cache,
 * which index.html's inline script puts on <html> before the first paint.
 * Every style's typeface is declared in index.html too, so none arrives late.
 */

export interface StyleOption {
  id: string
  label: string
  description: string
}

export interface PaletteOption {
  id: string
  label: string
  swatches: [string, string, string]
}

export const STYLE_OPTIONS: StyleOption[] = [
  { id: 'soft', label: 'Doux', description: 'Police très lisible, coins arrondis' },
  { id: 'editorial', label: 'Éditorial', description: 'Titres en serif, filets fins, sans ombre' },
  { id: 'swiss', label: 'Suisse', description: 'Une seule police, angles droits' },
  { id: 'precise', label: 'Précis', description: 'Police nette, montants à chasse fixe' },
]

const DEFAULT_STYLE = 'soft'

export const PALETTE_OPTIONS: PaletteOption[] = [
  { id: 'prune', label: 'Prune', swatches: ['#fbf9f7', '#1d1713', '#812a5a'] },
  { id: 'encre', label: 'Encre', swatches: ['#f8fafc', '#151b24', '#1b4ba9'] },
  { id: 'graphite', label: 'Graphite', swatches: ['#f9f9f9', '#141414', '#181818'] },
  { id: 'petrole', label: 'Pétrole', swatches: ['#f6fafb', '#111d20', '#006074'] },
]

const DEFAULT_PALETTE = 'prune'

const STORAGE_KEY = 'appearance'

export const activeStyle = ref(DEFAULT_STYLE)
export const activePalette = ref(DEFAULT_PALETTE)
// Bumped on every switch so chart options recompute from the new tokens.
export const appearanceRevision = ref(0)

// While a public page pins its look, the user's choice is kept but not shown.
let pinned = false

function findStyle(id: string | null | undefined): StyleOption {
  return STYLE_OPTIONS.find(s => s.id === id) ?? STYLE_OPTIONS.find(s => s.id === DEFAULT_STYLE)!
}

function findPalette(id: string | null | undefined): PaletteOption {
  return PALETTE_OPTIONS.find(p => p.id === id) ?? PALETTE_OPTIONS.find(p => p.id === DEFAULT_PALETTE)!
}

/** Put a look on <html>, in one frame, only if it is not already there. */
function show(style: string, palette: string): void {
  const root = document.documentElement
  const nextStyle = style === DEFAULT_STYLE ? null : style
  const nextPalette = palette === DEFAULT_PALETTE ? null : palette
  if (root.getAttribute('data-style') === nextStyle && root.getAttribute('data-palette') === nextPalette) return
  withoutTransitions(() => {
    if (nextStyle) root.setAttribute('data-style', nextStyle)
    else root.removeAttribute('data-style')
    if (nextPalette) root.setAttribute('data-palette', nextPalette)
    else root.removeAttribute('data-palette')
  })
  appearanceRevision.value++
  // Fonts arrive after the attribute flips; charts measure text, so redraw once they land.
  document.fonts?.ready.then(() => { appearanceRevision.value++ })
}

/** Set the look locally (the caller is responsible for saving it server-side). */
export function setAppearance(style: string, palette: string): void {
  activeStyle.value = findStyle(style).id
  activePalette.value = findPalette(palette).id
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ style: activeStyle.value, palette: activePalette.value }))
  } catch {
    // Private mode: the boot cache just won't survive a reload.
  }
  if (!pinned) show(activeStyle.value, activePalette.value)
}

/**
 * Show a fixed look on a public page, whatever the boot cache holds (it
 * survives logout, so a visitor would otherwise inherit the last user's look).
 * The user's choice is left untouched until releaseAppearance.
 */
export function pinAppearance(style: string, palette: string): void {
  pinned = true
  show(findStyle(style).id, findPalette(palette).id)
}

/** Back in the app: show the user's look again, wherever the page booted. */
export function releaseAppearance(): void {
  pinned = false
  show(activeStyle.value, activePalette.value)
}

/** Align the local look with the server value (server wins). */
export function applyServerAppearance(style: string | null | undefined, palette: string | null | undefined): void {
  const nextStyle = findStyle(style).id
  const nextPalette = findPalette(palette).id
  if (nextStyle === activeStyle.value && nextPalette === activePalette.value) return
  setAppearance(nextStyle, nextPalette)
}

/**
 * Read the boot cache without touching <html>: the inline script already put
 * the look there, and on a public page it put the public one, which applying
 * the cache here would flash over until the router pins it back.
 */
export function initAppearance(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    activeStyle.value = findStyle(saved?.style).id
    activePalette.value = findPalette(saved?.palette).id
  } catch {
    // Corrupt cache: start from the default look until /settings answers.
  }
  // Charts measure text: redraw once the typeface has landed.
  document.fonts?.ready.then(() => { appearanceRevision.value++ })
}

import { ref } from 'vue'
import { withoutTransitions } from './withoutTransitions'

/**
 * Per-user look: a style (type, corners, depth) and a palette (colors), each
 * mapped to a data attribute on <html> that theme.css keys off. 'current' is
 * the original look and sets no attribute.
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
  { id: 'current', label: 'Classique', description: 'Le style d\'origine' },
  { id: 'editorial', label: 'Éditorial', description: 'Titres en serif, filets fins, sans ombre' },
  { id: 'swiss', label: 'Suisse', description: 'Une seule police, angles droits' },
  { id: 'soft', label: 'Doux', description: 'Police très lisible, coins arrondis' },
]

export const PALETTE_OPTIONS: PaletteOption[] = [
  { id: 'current', label: 'Classique', swatches: ['#f9fafb', '#111827', '#4f46e5'] },
  { id: 'encre', label: 'Encre', swatches: ['#f8fafc', '#151b24', '#1b4ba9'] },
  { id: 'graphite', label: 'Graphite', swatches: ['#f9f9f9', '#141414', '#181818'] },
  { id: 'petrole', label: 'Pétrole', swatches: ['#f6fafb', '#111d20', '#006074'] },
  { id: 'prune', label: 'Prune', swatches: ['#fbf9f7', '#1d1713', '#812a5a'] },
]

const STORAGE_KEY = 'appearance'

export const activeStyle = ref('current')
export const activePalette = ref('current')
// Bumped on every switch so chart options recompute from the new tokens.
export const appearanceRevision = ref(0)

function findStyle(id: string | null | undefined): StyleOption {
  return STYLE_OPTIONS.find(s => s.id === id) ?? STYLE_OPTIONS[0]!
}

function findPalette(id: string | null | undefined): PaletteOption {
  return PALETTE_OPTIONS.find(p => p.id === id) ?? PALETTE_OPTIONS[0]!
}

function setAttribute(name: string, value: string): void {
  if (value === 'current') document.documentElement.removeAttribute(name)
  else document.documentElement.setAttribute(name, value)
}

function applyToDocument(): void {
  withoutTransitions(() => {
    setAttribute('data-style', activeStyle.value)
    setAttribute('data-palette', activePalette.value)
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
  applyToDocument()
}

/**
 * Show a fixed look on a public page, whatever the boot cache holds (it
 * survives logout, so a visitor would otherwise inherit the last user's look).
 * The user's choice is left untouched; call the returned function to restore it.
 */
export function pinAppearance(style: string, palette: string): () => void {
  withoutTransitions(() => {
    setAttribute('data-style', findStyle(style).id)
    setAttribute('data-palette', findPalette(palette).id)
  })
  return applyToDocument
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
    // Corrupt cache: start from the original look until /settings answers.
  }
  // Charts measure text: redraw once the typeface has landed.
  document.fonts?.ready.then(() => { appearanceRevision.value++ })
}

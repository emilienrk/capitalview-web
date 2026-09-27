import { ref } from 'vue'

/**
 * Per-user look: a style (type, corners, depth) and a palette (colors), each
 * mapped to a data attribute on <html> that theme.css keys off. 'current' is
 * the original look and sets no attribute.
 *
 * The server-side user settings are the source of truth (synced by the
 * settings store via applyServerAppearance). localStorage is only a boot cache
 * so the first render uses the right look before /settings loads.
 */

export interface StyleOption {
  id: string
  label: string
  description: string
  fontsHref?: string
}

export interface PaletteOption {
  id: string
  label: string
  swatches: [string, string, string]
}

export const STYLE_OPTIONS: StyleOption[] = [
  { id: 'current', label: 'Classique', description: 'Le style d\'origine' },
  {
    id: 'editorial',
    label: 'Éditorial',
    description: 'Titres en serif, filets fins, sans ombre',
    fontsHref: 'https://fonts.googleapis.com/css2?family=Brygada+1918:wght@400..700&family=Schibsted+Grotesk:wght@400..800&display=swap',
  },
  {
    id: 'swiss',
    label: 'Suisse',
    description: 'Une seule police, angles droits',
    fontsHref: 'https://fonts.googleapis.com/css2?family=Archivo:wght@300..800&display=swap',
  },
  {
    id: 'soft',
    label: 'Doux',
    description: 'Police très lisible, coins arrondis',
    fontsHref: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@300..800&display=swap',
  },
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

export function loadStyleFonts(style: StyleOption): void {
  if (!style.fontsHref) return
  const id = `fonts-${style.id}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = style.fontsHref
  document.head.appendChild(link)
}

function setAttribute(name: string, value: string): void {
  if (value === 'current') document.documentElement.removeAttribute(name)
  else document.documentElement.setAttribute(name, value)
}

function applyToDocument(): void {
  loadStyleFonts(findStyle(activeStyle.value))
  setAttribute('data-style', activeStyle.value)
  setAttribute('data-palette', activePalette.value)
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
  const pinned = findStyle(style)
  loadStyleFonts(pinned)
  setAttribute('data-style', pinned.id)
  setAttribute('data-palette', findPalette(palette).id)
  return applyToDocument
}

/** Align the local look with the server value (server wins). */
export function applyServerAppearance(style: string | null | undefined, palette: string | null | undefined): void {
  const nextStyle = findStyle(style).id
  const nextPalette = findPalette(palette).id
  if (nextStyle === activeStyle.value && nextPalette === activePalette.value) return
  setAppearance(nextStyle, nextPalette)
}

export function initAppearance(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    activeStyle.value = findStyle(saved?.style).id
    activePalette.value = findPalette(saved?.palette).id
  } catch {
    // Corrupt cache: start from the original look until /settings answers.
  }
  applyToDocument()
}

import { ref } from 'vue'

// Dev-only switcher to compare styles and palettes on real pages before one
// gets baked into :root. 'current' means "no attribute": the incumbent tokens.

export interface StyleOption {
  id: string
  label: string
  hint: string
  fontsHref?: string
}

export interface PaletteOption {
  id: string
  label: string
  swatches: [string, string, string]
}

export const STYLE_OPTIONS: StyleOption[] = [
  { id: 'current', label: 'Actuel', hint: 'Inter, arrondis, ombres' },
  {
    id: 'editorial',
    label: 'Éditorial',
    hint: 'Serif Brygada + Schibsted Grotesk, filets',
    fontsHref: 'https://fonts.googleapis.com/css2?family=Brygada+1918:wght@400..700&family=Schibsted+Grotesk:wght@400..800&display=swap',
  },
  {
    id: 'swiss',
    label: 'Suisse',
    hint: 'Archivo seule, angles droits',
    fontsHref: 'https://fonts.googleapis.com/css2?family=Archivo:wght@300..800&display=swap',
  },
  {
    id: 'soft',
    label: 'Doux',
    hint: 'Atkinson Hyperlegible, arrondis modérés',
    fontsHref: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@300..800&display=swap',
  },
]

export const PALETTE_OPTIONS: PaletteOption[] = [
  { id: 'current', label: 'Actuel', swatches: ['#f9fafb', '#111827', '#4f46e5'] },
  { id: 'encre', label: 'Encre', swatches: ['#f8fafc', '#151b24', '#1b4ba9'] },
  { id: 'graphite', label: 'Graphite', swatches: ['#f9f9f9', '#141414', '#181818'] },
  { id: 'petrole', label: 'Pétrole', swatches: ['#f6fafb', '#111d20', '#006074'] },
  { id: 'prune', label: 'Prune', swatches: ['#fbf9f7', '#1d1713', '#812a5a'] },
]

const STORAGE_KEY = 'cv-theme-lab'

export const activeStyle = ref('current')
export const activePalette = ref('current')
// Bumped on every switch so chart options recompute from the new tokens.
export const themeRevision = ref(0)

function loadFonts(style: StyleOption): void {
  if (!style.fontsHref) return
  const id = `cv-fonts-${style.id}`
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

function apply(): void {
  const style = STYLE_OPTIONS.find(s => s.id === activeStyle.value) ?? STYLE_OPTIONS[0]!
  loadFonts(style)
  setAttribute('data-style', style.id)
  setAttribute('data-palette', activePalette.value)
  themeRevision.value++
  // Fonts arrive after the attribute flips; charts measure text, so redraw once they land.
  document.fonts?.ready.then(() => { themeRevision.value++ })
}

export function setThemeLab(style: string, palette: string): void {
  activeStyle.value = style
  activePalette.value = palette
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ style, palette }))
  } catch {
    // Private mode: the choice just won't survive a reload.
  }
  apply()
}

export function initThemeLab(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && STYLE_OPTIONS.some(s => s.id === saved.style)) activeStyle.value = saved.style
    if (saved && PALETTE_OPTIONS.some(p => p.id === saved.palette)) activePalette.value = saved.palette
  } catch {
    // Corrupt entry: fall back to the incumbent look.
  }
  apply()
}

import { it, expect } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import ReadingScale from '@/components/analytics/ReadingScale.vue'
import type { ReadingOut } from '@/types'

;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0,
} as Storage

const bands: ReadingOut['bands'] = [
  { up_to: '25', label: 'léger', tone: 'good' },
  { up_to: '75', label: 'visible', tone: 'watch' },
  { up_to: null, label: 'lourd', tone: 'bad' },
]

const render = (active: number | null) =>
  renderToString(
    createSSRApp(ReadingScale, {
      reading: { value: '20', format: 'bps', active, tone: null, bands },
    }),
  )

it('met en avant la bande que l’API désigne', async () => {
  const under = await render(0)
  // La bande active est la seule à pleine opacité.
  expect(under.match(/opacity-100/g)?.length).toBe(1)
  expect(under.split('opacity-100')[0]).toContain('bg-success')

  const over = await render(2)
  expect(over.split('opacity-100')[0]).toContain('bg-danger')
})

it('affiche les plafonds dans l’unité de la lecture, en pourcentage pour les bps', async () => {
  const html = await render(0)
  expect(html).toContain('0,25')
  expect(html).not.toContain('bps')
})

it('sans valeur, l’échelle reste lisible et aucune bande n’est active', async () => {
  expect(await render(null)).not.toContain('opacity-100')
})

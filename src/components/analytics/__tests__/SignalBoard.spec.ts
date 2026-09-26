import { it, expect } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import type { SignalOut } from '@/types'

;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0,
} as Storage

const signals: SignalOut[] = [
  { block: 'counterfactual', label: 'Cash non investi', tone: 'bad', value: null, format: null, eur: '-900' },
  { block: 'counterfactual', label: 'Face au robot indexé', tone: 'bad', value: null, format: null, eur: '-300' },
  { block: 'execution', label: "Prix d'achat", tone: 'neutral', value: '12', format: 'bps', eur: null },
  { block: 'deposit_lag', label: 'Délai virement → achat', tone: 'good', value: '1', format: 'days', eur: null },
]

it('garde l’ordre de l’API et proportionne les barres aux euros', async () => {
  const { default: SignalBoard } = await import('@/components/analytics/SignalBoard.vue')
  const html = await renderToString(createSSRApp(SignalBoard, { signals }))

  expect(html.indexOf('Cash non investi')).toBeLessThan(html.indexOf('Face au robot'))
  // La plus grosse perte remplit la barre ; l'autre en fait le tiers.
  expect(html).toContain('width:100%')
  expect(html).toContain('width:33.')
  // Sans euros, la valeur s'affiche dans son unité, et le hasard est nommé.
  expect(html).toContain('0,12 % · hasard')
  expect(html).toContain('1 j')
})

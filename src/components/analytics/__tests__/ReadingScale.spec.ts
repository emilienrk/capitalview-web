import { it, expect } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import ReadingScale from '@/components/analytics/ReadingScale.vue'

it('place la valeur dans la bonne bande', async () => {
  const bands = [
    { upTo: 25, label: 'sous la cible', tone: 'good' as const },
    { upTo: 75, label: 'ça se voit', tone: 'watch' as const },
    { label: 'ça pèse', tone: 'bad' as const },
  ]
  const render = (value: number | null) =>
    renderToString(createSSRApp(ReadingScale, { value, bands, format: (n: number) => `${n} bps` }))

  const under = await render(20)
  expect(under).toContain('20 bps')
  // La bande active est la seule à pleine opacité.
  expect(under.match(/opacity-100/g)?.length).toBe(1)
  expect(under.split('opacity-100')[0]).toContain('bg-success')

  const over = await render(120)
  expect(over.split('opacity-100')[0]).toContain('bg-danger')

  // Sans valeur, l'échelle reste lisible et n'affiche aucun repère personnel.
  expect(await render(null)).not.toContain('Toi :')
})

/**
 * index.html puts the look on <html> before the app loads. It cannot import
 * the router, so it keeps its own copy of the public paths and of the public
 * look: these must match the router's, or a page boots in one look and
 * switches to another once the router runs.
 */
import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import routerSource from '../router/index.ts?raw'

const bootScript = indexHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''

function quoted(list: string): string[] {
  return [...list.matchAll(/'([^']*)'/g)].map(m => m[1] ?? '')
}

describe('boot appearance', () => {
  it('treats exactly the routes open without an account as public', () => {
    const routerPublic = routerSource
      .split(/\n  \{\n/)
      .filter(block => /requiresAuth: false/.test(block))
      .map(block => block.match(/path: '([^']*)'/)?.[1])
    const bootPublic = quoted(bootScript.match(/publicPaths = \[([^\]]*)\]/)?.[1] ?? '')

    expect(routerPublic.length).toBeGreaterThan(0)
    expect(bootPublic.sort()).toEqual([...routerPublic].sort())
  })

  it('pins public pages to the look the router pins them to', () => {
    const [, style, palette] = routerSource.match(/pinAppearance\('([^']*)', '([^']*)'\)/) ?? []
    expect(style).toBeTruthy()
    expect(bootScript).toContain(`{ style: '${style}', palette: '${palette}' }`)
  })
})

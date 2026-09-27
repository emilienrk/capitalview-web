/**
 * index.html puts the look on <html> before the app loads. It cannot import
 * the router or the appearance module, so it keeps its own copy of the public
 * paths, of the pages that send a signed-in user to the app, of the public
 * look and of the default style: these must match, or a page boots in one
 * look and switches to another once the app runs.
 */
import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import routerSource from '../router/index.ts?raw'
import appearanceSource from '../theme/appearance.ts?raw'

const bootScript = indexHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''

function quoted(list: string): string[] {
  return [...list.matchAll(/'([^']*)'/g)].map(m => m[1] ?? '')
}

const routeBlocks = routerSource.split(/\n  \{\n/)

function pathOf(name: string): string | undefined {
  return routeBlocks.find(block => block.includes(`name: '${name}'`))?.match(/path: '([^']*)'/)?.[1]
}

describe('boot appearance', () => {
  it('treats exactly the routes open without an account as public', () => {
    const routerPublic = routeBlocks
      .filter(block => /requiresAuth: false/.test(block))
      .map(block => block.match(/path: '([^']*)'/)?.[1])
    const bootPublic = quoted(bootScript.match(/publicPaths = \[([^\]]*)\]/)?.[1] ?? '')

    expect(routerPublic.length).toBeGreaterThan(0)
    expect(bootPublic.sort()).toEqual([...routerPublic].sort())
  })

  it('boots the pages that redirect a signed-in user in that user\'s look', () => {
    const guard = routerSource.slice(routerSource.indexOf('router.beforeEach'), routerSource.indexOf('router.afterEach'))
    const redirected = [...guard.matchAll(/to\.name === '([^']*)'[^\n]*/g)]
      .filter(m => m[0].includes('auth.isAuthenticated'))
      .flatMap(m => [...m[0].matchAll(/to\.name === '([^']*)'/g)].map(n => pathOf(n[1] ?? '')))
    const bootRedirected = quoted(bootScript.match(/signedInRedirects = \[([^\]]*)\]/)?.[1] ?? '')

    expect(redirected.length).toBeGreaterThan(0)
    expect(bootRedirected.sort()).toEqual([...redirected].sort())
  })

  it('leaves the default style to the base tokens', () => {
    const defaultStyle = appearanceSource.match(/const DEFAULT_STYLE = '([^']*)'/)?.[1]
    expect(defaultStyle).toBeTruthy()
    expect(bootScript).toContain(`var defaultStyle = '${defaultStyle}'`)
  })

  it('pins public pages to the look the router pins them to', () => {
    const [, style, palette] = routerSource.match(/pinAppearance\('([^']*)', '([^']*)'\)/) ?? []
    expect(style).toBeTruthy()
    expect(bootScript).toContain(`{ style: '${style}', palette: '${palette}' }`)
  })

  describe('boot script', () => {
    function boot(path: string, storage: Record<string, string>): Record<string, string> {
      const attributes: Record<string, string> = {}
      const documentElement = {
        setAttribute: (name: string, value: string) => { attributes[name] = value },
        classList: { add: () => {}, remove: () => {} },
      }
      const localStorage = { ...storage, getItem: (key: string) => storage[key] ?? null }
      const window = { matchMedia: () => ({ matches: false }) }
      new Function('document', 'location', 'localStorage', 'window', bootScript)(
        { documentElement }, { pathname: path }, localStorage, window,
      )
      return attributes
    }
    const cached = { appearance: JSON.stringify({ style: 'swiss', palette: 'encre' }) }

    it('shows the public look on public pages when signed out', () => {
      expect(boot('/', cached)).toEqual({ 'data-style': 'editorial', 'data-palette': 'prune' })
      expect(boot('/login/', cached)).toEqual({ 'data-style': 'editorial', 'data-palette': 'prune' })
    })

    it('shows the cached look in the app', () => {
      expect(boot('/dashboard', cached)).toEqual({ 'data-style': 'swiss', 'data-palette': 'encre' })
    })

    it('shows the cached look where a signed-in user gets redirected to the app', () => {
      const signedIn = { ...cached, 'signed-in': '1' }
      expect(boot('/', signedIn)).toEqual({ 'data-style': 'swiss', 'data-palette': 'encre' })
      expect(boot('/mentions-legales', signedIn)).toEqual({ 'data-style': 'editorial', 'data-palette': 'prune' })
    })

    it('leaves the default style and the retired one to the base tokens', () => {
      expect(boot('/dashboard', { appearance: JSON.stringify({ style: 'soft', palette: 'current' }) })).toEqual({})
      expect(boot('/dashboard', { appearance: JSON.stringify({ style: 'current', palette: 'prune' }) })).toEqual({ 'data-palette': 'prune' })
      expect(boot('/dashboard', {})).toEqual({})
    })
  })
})

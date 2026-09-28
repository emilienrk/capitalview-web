import { beforeEach, describe, expect, it, vi } from 'vitest'

// Just enough of a document for appearance.ts and withoutTransitions.
function stubDocument(): Record<string, string> {
  const attributes: Record<string, string> = {}
  vi.stubGlobal('document', {
    documentElement: {
      getAttribute: (name: string) => attributes[name] ?? null,
      setAttribute: (name: string, value: string) => { attributes[name] = value },
      removeAttribute: (name: string) => { delete attributes[name] },
    },
    createElement: () => ({ textContent: '', remove: () => {} }),
    head: { appendChild: () => {} },
    body: {},
  })
  vi.stubGlobal('window', { getComputedStyle: () => ({ opacity: '1' }) })
  return attributes
}

function stubStorage(entries: Record<string, string>): void {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries[key] ?? null,
    setItem: (key: string, value: string) => { entries[key] = value },
  })
}

describe('appearance', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('keeps the public look while pinned and shows the account\'s once released', async () => {
    const attributes = stubDocument()
    stubStorage({ appearance: JSON.stringify({ style: 'swiss', palette: 'encre' }) })
    const appearance = await import('../appearance')
    appearance.initAppearance()

    appearance.pinAppearance('editorial', 'prune')
    expect(attributes).toEqual({ 'data-style': 'editorial' })

    // The account's settings land while still on the sign-in page.
    appearance.applyServerAppearance('precise', 'petrole')
    expect(attributes).toEqual({ 'data-style': 'editorial' })

    appearance.releaseAppearance()
    expect(attributes).toEqual({ 'data-style': 'precise', 'data-palette': 'petrole' })
  })

  it('reads the retired original style and palette as the defaults', async () => {
    const attributes = stubDocument()
    stubStorage({})
    const appearance = await import('../appearance')
    appearance.initAppearance()

    appearance.applyServerAppearance('swiss', 'encre')
    expect(attributes).toEqual({ 'data-style': 'swiss', 'data-palette': 'encre' })
    appearance.applyServerAppearance('current', 'current')
    expect([appearance.activeStyle.value, appearance.activePalette.value]).toEqual(['soft', 'prune'])
    expect(attributes).toEqual({})
  })
})

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import nginxConf from '../../nginx.conf?raw'

describe('Content-Security-Policy', () => {
  it('allows every inline script of index.html by its hash', () => {
    const inline = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1] ?? '')
    expect(inline.length).toBeGreaterThan(0)
    for (const script of inline) {
      const hash = createHash('sha256').update(script).digest('base64')
      expect(nginxConf).toContain(`'sha256-${hash}'`)
    }
  })
})

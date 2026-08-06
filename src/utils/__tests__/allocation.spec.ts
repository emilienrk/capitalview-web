import { describe, it, expect } from 'vitest'
import { balancedShares, normalisedShares } from '@/utils/allocation'

describe('normalisedShares', () => {
  it('rend des points entiers qui font exactement 100', () => {
    // Arrondis naïfs : 33 + 33 + 33 = 99, et la sauvegarde échoue au premier essai.
    const shares = normalisedShares([
      { key: 'A', weight: 1 / 3 },
      { key: 'B', weight: 1 / 3 },
      { key: 'C', weight: 1 / 3 },
    ])

    expect(shares.reduce((sum, line) => sum + line.share, 0)).toBe(100)
  })

  it('renormalise sur les lignes retenues, pas sur le portefeuille entier', () => {
    // Le formulaire ne pré-remplit que les plus grosses lignes : les autres ne
    // doivent pas laisser un trou dans le total.
    const shares = normalisedShares([
      { key: 'A', weight: 0.5 },
      { key: 'B', weight: 0.2 },
    ])

    expect(shares).toEqual([
      { key: 'A', share: 71 },
      { key: 'B', share: 29 },
    ])
  })

  it('pose le reste sur la plus grosse ligne', () => {
    const shares = normalisedShares([
      { key: 'A', weight: 0.9 },
      { key: 'B', weight: 0.0501 },
      { key: 'C', weight: 0.0499 },
    ])

    expect(shares.reduce((sum, line) => sum + line.share, 0)).toBe(100)
    expect(shares[0]?.key).toBe('A')
  })

  it('écarte les lignes qui arrondissent à zéro', () => {
    const shares = normalisedShares([
      { key: 'A', weight: 0.999 },
      { key: 'MIETTE', weight: 0.001 },
    ])

    expect(shares.map((line) => line.key)).toEqual(['A'])
    expect(shares[0]?.share).toBe(100)
  })

  it('ne rend rien sans poids exploitable', () => {
    expect(normalisedShares([])).toEqual([])
    expect(normalisedShares([{ key: 'A', weight: 0 }])).toEqual([])
  })
})

describe('balancedShares', () => {
  it('ramène un total à 100 sans toucher aux autres lignes', () => {
    const shares = balancedShares([
      { key: 'A', weight: 60 },
      { key: 'B', weight: 30 },
    ])

    expect(shares).toEqual([
      { key: 'A', share: 70 },
      { key: 'B', share: 30 },
    ])
  })

  it('retranche le surplus de la plus grosse ligne', () => {
    const shares = balancedShares([
      { key: 'A', weight: 80 },
      { key: 'B', weight: 30 },
    ])

    expect(shares[0]?.share).toBe(70)
    expect(shares.reduce((sum, line) => sum + line.share, 0)).toBe(100)
  })

  it('ne descend jamais une ligne sous zéro', () => {
    const shares = balancedShares([
      { key: 'A', weight: 10 },
      { key: 'B', weight: 5 },
    ])

    expect(shares.every((line) => line.share >= 0)).toBe(true)
  })
})

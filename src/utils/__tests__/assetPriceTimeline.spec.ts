import { describe, it, expect } from 'vitest'
import {
  MARKER_SIZE_RANGE,
  MIN_MARKER_SIZE,
  buildCostBasisSeries,
  buildTimelineDates,
  largestTradeTotal,
  markerSize,
} from '@/utils/assetPriceTimeline'
import type { AssetTimelineEvent } from '@/types'

function trade(
  date: string,
  total: number,
  costBasisAfter: number | null = 100,
): AssetTimelineEvent {
  return {
    date,
    type: total < 0 ? 'BUY' : 'SELL',
    quantity: 1,
    price: 100,
    total,
    cost_basis_after: costBasisAfter,
  }
}

describe('buildTimelineDates', () => {
  it("garde un jour d'opération que le marché n'a jamais coté", () => {
    const dates = buildTimelineDates(
      [{ date: '2024-01-10', price: 100 }, { date: '2024-01-12', price: 110 }],
      // Le 11 est férié : aucun cours, mais l'achat doit rester visible.
      [trade('2024-01-11', -500)],
    )

    expect(dates).toEqual(['2024-01-10', '2024-01-11', '2024-01-12'])
  })

  it('dédoublonne et trie, quel que soit l\'ordre reçu', () => {
    const dates = buildTimelineDates(
      [{ date: '2024-03-01', price: 1 }, { date: '2024-01-01', price: 1 }],
      [trade('2024-03-01', -1), trade('2024-02-01', -1)],
    )

    expect(dates).toEqual(['2024-01-01', '2024-02-01', '2024-03-01'])
  })
})

describe('markerSize', () => {
  it("suit l'aire du disque, pas son diamètre", () => {
    // Un quart du montant maximal ⇒ la moitié de l'amplitude, pas le quart.
    expect(markerSize(250, 1000)).toBeCloseTo(MIN_MARKER_SIZE + MARKER_SIZE_RANGE * 0.5, 6)
    expect(markerSize(1000, 1000)).toBeCloseTo(MIN_MARKER_SIZE + MARKER_SIZE_RANGE, 6)
  })

  it('traite les sorties comme les entrées : seule la taille compte', () => {
    expect(markerSize(-400, 1000)).toBeCloseTo(markerSize(400, 1000), 6)
  })

  it('reste lisible quand il n\'y a rien à comparer', () => {
    expect(markerSize(0, 0)).toBeGreaterThanOrEqual(MIN_MARKER_SIZE)
    expect(markerSize(Number.NaN, 1000)).toBeGreaterThanOrEqual(MIN_MARKER_SIZE)
  })

  it('plafonne un montant au-delà du maximum annoncé', () => {
    expect(markerSize(5000, 1000)).toBeCloseTo(MIN_MARKER_SIZE + MARKER_SIZE_RANGE, 6)
  })
})

describe('largestTradeTotal', () => {
  it('compare des valeurs absolues', () => {
    expect(largestTradeTotal([trade('2024-01-01', -900), trade('2024-02-01', 300)])).toBe(900)
  })

  it('renvoie 0 sans opération', () => {
    expect(largestTradeTotal([])).toBe(0)
  })
})

describe('buildCostBasisSeries', () => {
  const dates = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05']

  it('ne commence qu\'au premier achat et reporte la valeur ensuite', () => {
    const series = buildCostBasisSeries(dates, [
      trade('2024-01-02', -200, 100),
      trade('2024-01-04', -400, 150),
    ])

    // Avant le premier achat il n'y a pas de prix de revient à montrer.
    expect(series).toEqual([null, 100, 100, 150, 150])
  })

  it('coupe la ligne quand la position est entièrement soldée', () => {
    const series = buildCostBasisSeries(dates, [
      trade('2024-01-02', -200, 100),
      trade('2024-01-04', 500, null),
    ])

    expect(series).toEqual([null, 100, 100, null, null])
  })

  it('rend une série vide sans opération', () => {
    expect(buildCostBasisSeries(dates, [])).toEqual([null, null, null, null, null])
  })
})

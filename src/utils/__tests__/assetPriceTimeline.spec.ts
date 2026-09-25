import { describe, it, expect } from 'vitest'
import {
  MAX_MARKER_SIZE,
  MIN_MARKER_SIZE,
  SMALL_SCREEN_MAX_MARKER_SIZE,
  buildCostBasisSeries,
  buildMarkers,
  buildTimelineDates,
  closeLookup,
  largestTradeTotal,
  markerSize,
  nearestMarker,
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
    // Un quart du montant maximal ⇒ la moitié du diamètre, pas le quart.
    expect(markerSize(250, 1000)).toBeCloseTo(MAX_MARKER_SIZE * 0.5, 6)
    expect(markerSize(1000, 1000)).toBeCloseTo(MAX_MARKER_SIZE, 6)
  })

  it("se mesure depuis le plus gros achat, sans marge ajoutée à chacun", () => {
    // Moitié du montant ⇒ moitié de l'aire : le rapport des diamètres vaut √½.
    expect(markerSize(500, 1000) / markerSize(1000, 1000)).toBeCloseTo(Math.SQRT1_2, 6)
  })

  it('garde un plancher pour les poussières', () => {
    expect(markerSize(1, 10_000)).toBe(MIN_MARKER_SIZE)
  })

  it('traite les sorties comme les entrées : seule la taille compte', () => {
    expect(markerSize(-400, 1000)).toBeCloseTo(markerSize(400, 1000), 6)
  })

  it('reste lisible quand il n\'y a rien à comparer', () => {
    expect(markerSize(0, 0)).toBeGreaterThanOrEqual(MIN_MARKER_SIZE)
    expect(markerSize(Number.NaN, 1000)).toBeGreaterThanOrEqual(MIN_MARKER_SIZE)
  })

  it('plafonne un montant au-delà du maximum annoncé', () => {
    expect(markerSize(5000, 1000)).toBeCloseTo(MAX_MARKER_SIZE, 6)
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

describe('markerSize sur petit écran', () => {
  it('plafonne plus bas, sans toucher au minimum', () => {
    expect(markerSize(1000, 1000, SMALL_SCREEN_MAX_MARKER_SIZE))
      .toBeCloseTo(SMALL_SCREEN_MAX_MARKER_SIZE, 6)
    expect(markerSize(1000, 1000, SMALL_SCREEN_MAX_MARKER_SIZE))
      .toBeLessThan(markerSize(1000, 1000))
    expect(markerSize(1, 10_000, SMALL_SCREEN_MAX_MARKER_SIZE)).toBe(MIN_MARKER_SIZE)
  })
})

describe('closeLookup', () => {
  const closeOn = closeLookup([
    { date: '2024-01-12', price: 110 },
    { date: '2024-01-10', price: 100 },
  ])

  it('lit le cours du jour quand il existe', () => {
    expect(closeOn('2024-01-10')).toBe(100)
  })

  it("reprend le dernier cours connu pour un jour non coté", () => {
    // Le 11 n'a pas de cotation : c'est le cours du 10 qui s'appliquait.
    expect(closeOn('2024-01-11')).toBe(100)
    expect(closeOn('2024-02-01')).toBe(110)
  })

  it('se rabat sur le premier cours avant tout historique', () => {
    expect(closeOn('2023-06-01')).toBe(100)
  })

  it("renvoie null sans aucun cours", () => {
    expect(closeLookup([])('2024-01-01')).toBeNull()
  })
})

describe('buildMarkers', () => {
  const closeOn = closeLookup([{ date: '2024-01-10', price: 2300 }])

  function event(overrides: Partial<AssetTimelineEvent>): AssetTimelineEvent {
    return {
      date: '2024-01-10',
      type: 'BUY',
      quantity: 1,
      price: 2300,
      total: -2300,
      cost_basis_after: 2300,
      ...overrides,
    }
  }

  it("place un achat normal à son prix d'exécution", () => {
    const [marker] = buildMarkers([event({ price: 2250 })], closeOn)
    expect(marker!.y).toBe(2250)
    expect(marker!.offMarket).toBe(false)
    expect(marker!.close).toBe(2300)
  })

  it('pose une vente aberrante sur la courbe au lieu de tirer l\'axe à zéro', () => {
    // Le cas vu sur Ethereum : une vente saisie à 3 € un jour où l'ETH valait 2 300 €.
    const [marker] = buildMarkers([event({ type: 'SELL', price: 3, total: 3 })], closeOn)
    expect(marker!.offMarket).toBe(true)
    expect(marker!.y).toBe(2300)
  })

  it('tolère un écart réel en journée', () => {
    // 30 % sous la clôture : un vrai creux intraday, pas une erreur de saisie.
    const [marker] = buildMarkers([event({ price: 1610 })], closeOn)
    expect(marker!.offMarket).toBe(false)
  })

  it("ne soupçonne jamais un revenu, qui n'a pas de prix à lui", () => {
    const [marker] = buildMarkers([event({ type: 'INCOME', price: 5 })], closeOn)
    expect(marker!.offMarket).toBe(false)
  })

  it('écarte les opérations sans prix et trie par date', () => {
    const markers = buildMarkers(
      [
        event({ date: '2024-03-01' }),
        event({ date: '2024-02-01', price: null }),
        event({ date: '2024-01-15' }),
      ],
      closeOn,
    )
    expect(markers.map((m) => m.event.date)).toEqual(['2024-01-15', '2024-03-01'])
  })
})

describe('nearestMarker', () => {
  const positions = [{ x: 10, y: 10 }, null, { x: 40, y: 10 }]

  it('choisit le point le plus proche dans le rayon', () => {
    expect(nearestMarker(positions, { x: 34, y: 12 }, 28)).toBe(2)
  })

  it('ignore les points hors du graphe', () => {
    expect(nearestMarker([null, { x: 100, y: 100 }], { x: 99, y: 99 }, 28)).toBe(1)
  })

  it('ne sélectionne rien hors de portée du doigt', () => {
    expect(nearestMarker(positions, { x: 200, y: 200 }, 28)).toBe(-1)
  })
})

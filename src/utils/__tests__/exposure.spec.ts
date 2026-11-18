import { describe, it, expect } from 'vitest'
import { breakdownRows, countryName, sectorName, SECTOR_LABELS } from '@/utils/exposure'

describe('countryName', () => {
  it('nomme les pays en français', () => {
    expect(countryName('US')).toBe('États-Unis')
    expect(countryName('KR')).toBe('Corée du Sud')
    expect(countryName('GB')).toBe('Royaume-Uni')
  })

  it('prend la forme courte quand c’est un nom, jamais une abréviation', () => {
    // CLDR : « R.A.S. chinoise de Hong Kong » en long, « É.-U. » en court.
    expect(countryName('HK')).toBe('Hong Kong')
    expect(countryName('US')).not.toContain('.')
  })

  it('rend le code tel quel plutôt que de planter', () => {
    expect(countryName('XX')).toBe('XX')
    expect(countryName('usa')).toBe('usa')
  })
})

describe('sectorName', () => {
  it('couvre les onze secteurs GICS de l’API', () => {
    // services/fund_exposure.SECTORS
    expect(Object.keys(SECTOR_LABELS).sort()).toEqual(
      [
        'communication',
        'consumer_discretionary',
        'consumer_staples',
        'energy',
        'financials',
        'health_care',
        'industrials',
        'materials',
        'real_estate',
        'technology',
        'utilities',
      ].sort(),
    )
  })

  it('montre une clé inconnue telle quelle', () => {
    expect(sectorName('crypto')).toBe('crypto')
  })
})

describe('breakdownRows', () => {
  const breakdown = {
    weights: [
      { label: 'US', weight: '0.40' },
      { label: 'FR', weight: '0.10' },
    ],
    other: '0.05',
    unknown: '0.45',
    coverage: '0.55',
    as_of: '2026-10-30',
  }

  it('garde « Autre » et « Non renseigné » à part, sans les répartir', () => {
    const { named, rest } = breakdownRows(breakdown, countryName)
    // Les poids connus restent ceux du portefeuille entier.
    expect(named.map((row) => [row.label, row.value])).toEqual([
      ['États-Unis', '0.40'],
      ['France', '0.10'],
    ])
    expect(rest).toEqual([
      { label: 'Autre', value: '0.05', emphasis: false },
      { label: 'Non renseigné', value: '0.45', emphasis: false },
    ])
  })

  it('n’ajoute pas de ligne vide', () => {
    const { rest } = breakdownRows({ ...breakdown, other: '0.0000', unknown: '0.0000' }, countryName)
    expect(rest).toEqual([])
  })
})

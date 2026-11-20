import { describe, it, expect } from 'vitest'
import { benchmarkName } from '@/utils/benchmarks'
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

describe('breakdownRows face à un indice', () => {
  const portfolio = {
    weights: [
      { label: 'US', weight: '0.44' },
      { label: 'TW', weight: '0.09' },
      { label: 'GB', weight: '0.06' },
      { label: 'IN', weight: '0.04' },
    ],
    other: '0.07',
    unknown: '0.30',
    coverage: '0.70',
    as_of: '2026-09-28',
  }
  const index = {
    weights: [
      { label: 'US', weight: '0.72' },
      { label: 'JP', weight: '0.056' },
      { label: 'GB', weight: '0.035' },
    ],
    other: '0.189',
    unknown: '0',
    coverage: '1',
    as_of: '2026-11-17',
  }

  it('montre ce que l’indice détient et pas le portefeuille, au rang de sa part', () => {
    const { named } = breakdownRows(portfolio, (code) => code, index)
    // L'ordre du portefeuille, et le Japon glissé là où l'indice le pèse.
    expect(named.map((row) => row.label)).toEqual(['US', 'TW', 'GB', 'JP', 'IN'])
  })

  it('ne prétend pas un 0 % qu’aucune source ne dit', () => {
    const { named } = breakdownRows(portfolio, (code) => code, index)
    const row = (label: string) => named.find((r) => r.label === label)
    // Absent de la liste du portefeuille, mais sa part peut être dans « Autre ».
    expect(row('JP')).toMatchObject({ value: null, reference: '0.056' })
    expect(row('TW')).toMatchObject({ value: '0.09', reference: null })
  })

  it('écrit 0 quand un côté détaille tout de lui-même', () => {
    const complete = { ...index, other: '0', unknown: '0' }
    const { named } = breakdownRows(portfolio, (code) => code, complete)
    expect(named.find((r) => r.label === 'TW')).toMatchObject({ value: '0.09', reference: 0 })
  })

  it('garde « Autre » et « Non renseigné » des deux côtés', () => {
    const { rest } = breakdownRows(portfolio, (code) => code, index)
    expect(rest).toEqual([
      { label: 'Autre', value: '0.07', reference: '0.189', emphasis: false },
      { label: 'Non renseigné', value: '0.30', reference: '0', emphasis: false },
    ])
  })
})

describe('benchmarkName', () => {
  it('nomme un indice de la liste par l’indice et son fonds', () => {
    // Le nom du fournisseur de cours est tronqué et en capitales.
    expect(
      benchmarkName({ asset_key: 'IE00B4L5Y983', symbol: 'IWDA.L', name: 'ISHARES III PLC ISHRS CORE MSCI' }),
    ).toBe('MSCI World (IWDA)')
    expect(benchmarkName({ asset_key: 'LU1681043599', symbol: 'MEUD.PA', name: 'AMUNDI MSCI EUROPE' })).toBe(
      'MSCI Europe',
    )
  })

  it('nomme un autre indice par son libellé de marché', () => {
    expect(
      benchmarkName({ asset_key: 'FR0011871110', symbol: 'PUST.PA', name: 'Amundi PEA Nasdaq-100' }),
    ).toBe('Amundi PEA Nasdaq-100 (PUST.PA)')
  })
})

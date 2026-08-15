/**
 * Les hypothèses de projection, dans les deux sens.
 *
 * Le risque du panneau tient dans une seule conversion : l'API stocke un taux
 * en décimal, le formulaire l'affiche en pourcent. Se tromper de sens donne une
 * courbe fausse d'un facteur cent sans qu'aucune erreur ne soit levée.
 */
import { describe, it, expect } from 'vitest'
import {
  basisLabel,
  draftsToAssets,
  isDirty,
  measuredDrafts,
  toNumber,
  warningLabel,
} from '@/utils/projectionAssumptions'

const PARAMETERS_USED = {
  months_to_project: 120,
  assets: {
    STOCK: { monthly_injection: 412.5, return_rate: 0.076 },
    CRYPTO: { monthly_injection: 80, return_rate: 0.12 },
    BANK: { monthly_injection: 0, return_rate: 0.02 },
  },
}

describe('projectionAssumptions', () => {
  it('montre le taux en pourcent, pas en décimal', () => {
    const drafts = measuredDrafts(PARAMETERS_USED)

    expect(drafts.STOCK).toEqual({ monthly: '412.5', rate: '7.6' })
    expect(drafts.BANK).toEqual({ monthly: '0', rate: '2' })
  })

  it('rend un taux décimal à l’API', () => {
    const assets = draftsToAssets({
      STOCK: { monthly: '600', rate: '5' },
      CRYPTO: { monthly: '80', rate: '12' },
      BANK: { monthly: '0', rate: '2' },
    })

    expect(assets.STOCK).toEqual({ monthly_injection: 600, return_rate: 0.05 })
    expect(assets.CRYPTO).toEqual({ monthly_injection: 80, return_rate: 0.12 })
  })

  it('fait l’aller-retour sans dériver', () => {
    const assets = draftsToAssets(measuredDrafts(PARAMETERS_USED))

    expect(assets.STOCK?.return_rate).toBeCloseTo(0.076, 10)
    expect(assets.STOCK?.monthly_injection).toBe(412.5)
  })

  it('accepte la virgule du clavier français', () => {
    expect(toNumber('7,6')).toBe(7.6)
    expect(toNumber('')).toBeNull()
    expect(toNumber('abc')).toBeNull()
  })

  it('laisse un champ vide remonter en null plutôt qu’en zéro', () => {
    // Zéro serait une hypothèse ; null rend la main au défaut mesuré.
    const assets = draftsToAssets({ STOCK: { monthly: '', rate: '' } })

    expect(assets.STOCK).toEqual({ monthly_injection: null, return_rate: null })
  })

  it('ne se déclare modifié que lorsqu’une valeur change', () => {
    const measured = measuredDrafts(PARAMETERS_USED)

    expect(isDirty(structuredClone(measured), measured)).toBe(false)
    expect(isDirty({ ...measured, STOCK: { monthly: '600', rate: '7.6' } }, measured)).toBe(true)
  })
})

describe('valeurs telles que BaseInput les rend', () => {
  it('accepte un nombre là où le champ en émet un', () => {
    // BaseInput émet un number dès que type="number" parvient à parser.
    expect(toNumber(351.69)).toBe(351.69)
    expect(toNumber(0)).toBe(0)
    expect(toNumber(null)).toBeNull()
  })

  it('ne déclare pas modifié un champ que le champ a juste retypé', () => {
    const measured = measuredDrafts(PARAMETERS_USED)
    const retyped = { ...measured, STOCK: { monthly: 412.5, rate: 7.6 } }

    expect(isDirty(retyped, measured)).toBe(false)
  })

  it('convertit un taux numérique en décimal sans planter', () => {
    const assets = draftsToAssets({ STOCK: { monthly: 600, rate: 5 } })

    expect(assets.STOCK).toEqual({ monthly_injection: 600, return_rate: 0.05 })
  })
})

describe('ce qui part réellement à l’API', () => {
  it('n’envoie que la catégorie modifiée', () => {
    const measured = measuredDrafts(PARAMETERS_USED)
    const edited = { ...measured, STOCK: { monthly: '600', rate: '7.6' } }

    const assets = draftsToAssets(edited, measured)

    expect(Object.keys(assets)).toEqual(['STOCK'])
    expect(assets.STOCK?.monthly_injection).toBe(600)
  })

  it('n’envoie rien quand rien n’a bougé', () => {
    const measured = measuredDrafts(PARAMETERS_USED)

    // Sinon une mesure deviendrait un paramètre figé, et un recalcul ultérieur
    // ignorerait des snapshots plus récents.
    expect(draftsToAssets(structuredClone(measured), measured)).toEqual({})
  })
})

describe('provenance et réserves', () => {
  it('dit sur quoi le rendement a été mesuré', () => {
    expect(
      basisLabel({
        contribution: 'net_external_flows',
        contribution_months: 48,
        contribution_total: 19800,
        return: 'annualised_twr',
        return_days: 1460,
        warnings: [],
      }),
    ).toBe('mesuré sur 1460 j — rendement time-weighted annualisé')
  })

  it('retombe sur les versements quand aucun taux n’a pu être mesuré', () => {
    expect(
      basisLabel({
        contribution: 'net_external_flows',
        contribution_months: 6,
        contribution_total: 3000,
        return: 'unavailable',
        return_days: 200,
        warnings: [],
      }),
    ).toBe('versements mesurés sur 6 mois')
  })

  it('écrit ses propres phrases à partir des codes du serveur', () => {
    expect(warningLabel({ code: 'insufficient_history', values: { days: 200 } })).toContain('200 j')
    expect(warningLabel({ code: 'extreme_rate', values: { annual_rate: 0.4523 } })).toContain('45.2 %/an')
    expect(warningLabel({ code: 'unaligned_flows', values: { share: 0.12 } })).toContain('12 %')
  })

  it('montre un code inconnu au lieu de l’avaler', () => {
    expect(warningLabel({ code: 'something_new', values: {} })).toBe('something_new')
  })
})

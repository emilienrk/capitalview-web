/**
 * Les hypothèses de projection, dans les deux sens.
 *
 * Le risque du panneau tient dans une seule conversion : l'API stocke un taux
 * en décimal, le formulaire l'affiche en pourcent. Se tromper de sens donne une
 * courbe fausse d'un facteur cent sans qu'aucune erreur ne soit levée.
 */
import { describe, it, expect } from 'vitest'
import {
  draftsToAssets,
  isDirty,
  measuredDrafts,
  toNumber,
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

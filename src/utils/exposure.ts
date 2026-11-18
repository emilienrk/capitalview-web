/**
 * The words of the exposure block: the API sends GICS sector keys and ISO
 * country codes, the page shows French names.
 *
 * What the sources leave undetailed and what no source covers each keep a row
 * of their own. Spreading either over the known labels would show a partial
 * picture as the whole one.
 */
import type { BreakdownOut } from '@/types'

/** The API's eleven GICS keys (services/fund_exposure.SECTORS). */
export const SECTOR_LABELS: Record<string, string> = {
  technology: 'Technologie',
  communication: 'Communication',
  health_care: 'Santé',
  financials: 'Finance',
  real_estate: 'Immobilier',
  consumer_discretionary: 'Conso. discrétionnaire',
  consumer_staples: 'Conso. de base',
  industrials: 'Industrie',
  materials: 'Matériaux',
  energy: 'Énergie',
  utilities: 'Services publics',
}

const regionNames = new Intl.DisplayNames(['fr'], { type: 'region' })
const shortRegionNames = new Intl.DisplayNames(['fr'], { type: 'region', style: 'short' })

export function sectorName(key: string): string {
  return SECTOR_LABELS[key] ?? key
}

/**
 * "États-Unis", "Hong Kong". The short form only where it is a name rather than
 * an abbreviation: CLDR shortens the United States to "É.-U.", but Hong Kong
 * from "R.A.S. chinoise de Hong Kong".
 */
export function countryName(code: string): string {
  try {
    const long = regionNames.of(code) ?? code
    const short = shortRegionNames.of(code) ?? long
    return short.length < long.length && !short.includes('.') ? short : long
  } catch {
    return code
  }
}

export interface ExposureRow {
  label: string
  value: number | string
  /** True for a sector or a country; false for the parts that are neither. */
  emphasis: boolean
}

export const OTHER_LABEL = 'Autre'
export const UNKNOWN_LABEL = 'Non renseigné'

/** The named shares, in the API's order, then the undetailed and the uncovered parts. */
export function breakdownRows(
  breakdown: BreakdownOut,
  name: (label: string) => string,
): { named: ExposureRow[]; rest: ExposureRow[] } {
  const named = breakdown.weights.map((share) => ({
    label: name(share.label),
    value: share.weight,
    emphasis: true,
  }))
  const rest: ExposureRow[] = []
  if (Number(breakdown.other) > 0) {
    rest.push({ label: OTHER_LABEL, value: breakdown.other, emphasis: false })
  }
  if (Number(breakdown.unknown) > 0) {
    rest.push({ label: UNKNOWN_LABEL, value: breakdown.unknown, emphasis: false })
  }
  return { named, rest }
}

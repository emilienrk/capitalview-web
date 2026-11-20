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
  /** Null when this side's list does not detail the label. */
  value: number | string | null
  /** The benchmark's share, when the list is set against it. */
  reference?: number | string | null
  /** True for a sector or a country; false for the parts that are neither. */
  emphasis: boolean
}

export const OTHER_LABEL = 'Autre'
export const UNKNOWN_LABEL = 'Non renseigné'

/**
 * A label missing from one side's list is 0 only when that side details all
 * of itself. Otherwise its share, if any, sits in « Autre » or in the
 * uncovered part, and printing 0 would state what nobody measured.
 */
function missingShare(breakdown: BreakdownOut): number | null {
  return Number(breakdown.other) === 0 && Number(breakdown.unknown) === 0 ? 0 : null
}

/**
 * The named shares, then the undetailed and the uncovered parts.
 *
 * Against a benchmark the labels are those of either side: a country the index
 * holds and the portfolio does not is what the comparison is for. They keep the
 * portfolio's order, and a label only the index lists ranks at the index's share.
 */
export function breakdownRows(
  breakdown: BreakdownOut,
  name: (label: string) => string,
  benchmark?: BreakdownOut | null,
): { named: ExposureRow[]; rest: ExposureRow[] } {
  if (!benchmark) {
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

  const own = new Map(breakdown.weights.map((share) => [share.label, share.weight]))
  const theirs = new Map(benchmark.weights.map((share) => [share.label, share.weight]))
  const rank = (label: string) => Number(own.get(label) ?? theirs.get(label) ?? 0)
  const named = [...new Set([...own.keys(), ...theirs.keys()])]
    .sort((a, b) => rank(b) - rank(a))
    .map((label) => ({
      label: name(label),
      value: own.get(label) ?? missingShare(breakdown),
      reference: theirs.get(label) ?? missingShare(benchmark),
      emphasis: true,
    }))
  const rest: ExposureRow[] = []
  if (Number(breakdown.other) > 0 || Number(benchmark.other) > 0) {
    rest.push({ label: OTHER_LABEL, value: breakdown.other, reference: benchmark.other, emphasis: false })
  }
  if (Number(breakdown.unknown) > 0 || Number(benchmark.unknown) > 0) {
    rest.push({ label: UNKNOWN_LABEL, value: breakdown.unknown, reference: benchmark.unknown, emphasis: false })
  }
  return { named, rest }
}

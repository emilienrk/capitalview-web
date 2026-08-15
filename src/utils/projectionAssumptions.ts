/**
 * Reading and writing the assumptions a projection was computed under.
 *
 * The API stores a return as a decimal (0.076) and nobody reads one that way,
 * so the form shows a percentage and converts back on the way out. That
 * conversion is the whole risk of the panel: get it wrong in one direction and
 * the curve is off by a factor of a hundred without anything raising an error.
 */
import type {
  ProjectionAssetParameters,
  ProjectionCategory,
  ProjectionResponse,
} from '@/types'

export const PROJECTION_ROWS: { key: ProjectionCategory; label: string }[] = [
  { key: 'STOCK', label: 'Actions' },
  { key: 'CRYPTO', label: 'Crypto' },
  { key: 'BANK', label: 'Banque' },
]

/** One row of the form. Strings, because a half-typed "0." is not a number. */
export interface AssumptionDraft {
  monthly: string
  rate: string
}

export type AssumptionDrafts = Record<string, AssumptionDraft>

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Turn what the API used into what the form shows: euros, and percent. */
export function measuredDrafts(
  parametersUsed: ProjectionResponse['parameters_used'] | null,
): AssumptionDrafts {
  return PROJECTION_ROWS.reduce<AssumptionDrafts>((drafts, row) => {
    const used = parametersUsed?.assets?.[row.key]
    drafts[row.key] = {
      monthly: String(round(used?.monthly_injection ?? 0, 2)),
      rate: String(round((used?.return_rate ?? 0) * 100, 2)),
    }
    return drafts
  }, {})
}

/** Parse a typed figure, tolerating the comma a French keyboard produces. */
export function toNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/** Turn the form back into API parameters: euros, and a decimal rate. */
export function draftsToAssets(
  drafts: AssumptionDrafts,
): Partial<Record<ProjectionCategory, ProjectionAssetParameters>> {
  const assets: Partial<Record<ProjectionCategory, ProjectionAssetParameters>> = {}
  for (const row of PROJECTION_ROWS) {
    const draft = drafts[row.key]
    const rate = toNumber(draft?.rate ?? '')
    assets[row.key] = {
      monthly_injection: toNumber(draft?.monthly ?? ''),
      return_rate: rate === null ? null : rate / 100,
    }
  }
  return assets
}

/** Whether the form still says exactly what the API reported. */
export function isDirty(drafts: AssumptionDrafts, measured: AssumptionDrafts): boolean {
  return PROJECTION_ROWS.some(
    (row) =>
      drafts[row.key]?.monthly !== measured[row.key]?.monthly ||
      drafts[row.key]?.rate !== measured[row.key]?.rate,
  )
}

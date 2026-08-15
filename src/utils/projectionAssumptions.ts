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

/**
 * One row of the form.
 *
 * Typed as both, because BaseInput hands back a `number` once `type="number"`
 * parses what was typed, but keeps emitting the raw string for the in-between
 * states ("0.", "-") a decimal field goes through. Assuming either one alone is
 * what silently broke the recalculate button.
 */
export interface AssumptionDraft {
  monthly: string | number
  rate: string | number
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
export function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value === null || value === undefined) return null

  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Turn the form back into API parameters: euros, and a decimal rate.
 *
 * Only the categories that actually differ from the measurement are sent.
 * Passing a measured value back as a parameter would freeze it into an
 * override, and a later recalculation would keep using it long after fresher
 * snapshots had moved the real figure. What the user did not touch stays
 * measured.
 */
export function draftsToAssets(
  drafts: AssumptionDrafts,
  measured: AssumptionDrafts = {},
): Partial<Record<ProjectionCategory, ProjectionAssetParameters>> {
  const assets: Partial<Record<ProjectionCategory, ProjectionAssetParameters>> = {}
  for (const row of PROJECTION_ROWS) {
    const draft = drafts[row.key]
    if (!draft) continue

    const monthly = toNumber(draft.monthly)
    const rate = toNumber(draft.rate)
    const reference = measured[row.key]
    const untouched =
      reference !== undefined &&
      monthly === toNumber(reference.monthly) &&
      rate === toNumber(reference.rate)

    if (untouched) continue

    assets[row.key] = {
      monthly_injection: monthly,
      return_rate: rate === null ? null : rate / 100,
    }
  }
  return assets
}

/**
 * Whether the form still says exactly what the API reported.
 *
 * Compared as numbers: the measured side is built as strings while the edited
 * side comes back from the input as a number, so `'351.69' !== 351.69` would
 * report every untouched form as modified.
 */
export function isDirty(drafts: AssumptionDrafts, measured: AssumptionDrafts): boolean {
  return PROJECTION_ROWS.some(
    (row) =>
      toNumber(drafts[row.key]?.monthly) !== toNumber(measured[row.key]?.monthly) ||
      toNumber(drafts[row.key]?.rate) !== toNumber(measured[row.key]?.rate),
  )
}

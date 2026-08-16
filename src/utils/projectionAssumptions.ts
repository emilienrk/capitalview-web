/**
 * Reading and writing the assumptions a projection was computed under.
 *
 * The API stores a return as a decimal (0.076) and nobody reads one that way,
 * so the form shows a percentage and converts back on the way out. That
 * conversion is the whole risk of the panel: get it wrong in one direction and
 * the curve is off by a factor of a hundred without anything raising an error.
 */
import type {
  ProjectionAssetBasis,
  ProjectionAssetParameters,
  ProjectionBasisWarning,
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

/**
 * What a measured default rests on, in one line.
 *
 * The server sends codes and figures, never sentences: the wording belongs to
 * whoever displays it, and a translation must not hinge on matching a string
 * produced by the API.
 */
export function basisLabel(basis: ProjectionAssetBasis | null | undefined): string | null {
  if (!basis) return null
  // Not a reservation about a figure but the reason there is none — it belongs
  // with the provenance, in grey, rather than flagged in every single render.
  if (basis.warnings?.some((warning) => warning.code === 'not_measured')) {
    return 'non déduit : les soldes suivent vos revenus et dépenses'
  }
  if (basis.return === 'annualised_twr') {
    return `mesuré sur ${basis.return_days} j — rendement time-weighted annualisé`
  }
  if (basis.contribution === 'net_external_flows') {
    return `versements mesurés sur ${basis.contribution_months} mois`
  }
  return null
}

/** A reservation, spelled out. Unknown codes are shown rather than swallowed. */
export function warningLabel(warning: ProjectionBasisWarning): string {
  const days = warning.values?.days ?? 0
  const share = Math.round((warning.values?.share ?? 0) * 100)
  const rate = Math.round((warning.values?.annual_rate ?? 0) * 1000) / 10

  switch (warning.code) {
    case 'no_contribution_found':
      return 'Aucun versement trouvé dans votre journal : projeté sans apport.'
    case 'insufficient_history':
      return `Moins d'un an d'historique (${days} j) : aucun rendement n'est déduit, la projection reste plate.`
    case 'unaligned_flows':
      return `${share} % des versements tombent un jour sans valorisation : le rendement serait surestimé, il n'est pas déduit.`
    case 'weak_annualisation':
      return `Rendement annualisé sur ${days} j seulement : statistiquement fragile.`
    case 'extreme_rate':
      return `Rendement de ${rate} %/an : peu susceptible de tenir sur toute la durée projetée.`
    case 'not_measured':
      return 'Les soldes bancaires bougent avec vos revenus et dépenses, pas avec une performance : rien n’est déduit ici.'
    default:
      return warning.code
  }
}

/**
 * The reservation in two or three words, for a row that has no space for more.
 *
 * A generic "à nuancer" forces a hover just to learn *what* is uncertain, which
 * is the one thing worth reading at a glance. The full sentence stays in the
 * tooltip.
 */
export function shortWarningLabel(warnings: ProjectionBasisWarning[]): string {
  const first = warnings[0]
  if (!first) return ''

  const short: Record<string, string> = {
    no_contribution_found: 'aucun versement trouvé',
    insufficient_history: 'historique trop court',
    unaligned_flows: 'versements non valorisés',
    weak_annualisation: 'historique court',
    extreme_rate: 'rendement élevé',
  }
  const label = short[first.code] ?? first.code
  return warnings.length > 1 ? `${label} +${warnings.length - 1}` : label
}

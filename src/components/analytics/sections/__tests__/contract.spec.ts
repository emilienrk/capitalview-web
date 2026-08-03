/**
 * Each section, rendered against the payload the API really sends.
 *
 * Three times now the front has consumed a field the API never declared. FastAPI
 * strips anything missing from the response_model, the template dereferences
 * `undefined`, and Vue swaps the whole component for a comment node — the
 * section vanishes in silence, with nothing but a console error. That is how the
 * contribution calendar disappeared for a month.
 *
 * These fixtures are written from the Pydantic DTOs, field for field. A test
 * failing here means the two repositories have drifted apart again.
 *
 * No DOM is needed: `@vue/server-renderer` ships with vue and renders in Node.
 * Two globals have to exist before the components are imported, which is why the
 * imports below are dynamic — `usePrivacyMode` reads localStorage at import time
 * and `api/client` reads window.location.
 */
import { describe, it, expect } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'

;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0,
} as Storage
;(globalThis as unknown as { window: unknown }).window = {
  location: { hostname: 'localhost', protocol: 'http:' },
}

const metric = (value: number | null = 1) => ({
  value,
  unit: 'ratio',
  sample_size: 400,
  reliability: 'solide',
  caveat: null,
})

const label = (key: string) => ({ asset_key: key, symbol: key, name: key })

/** RegularityResponse. */
const regularity = {
  monthly: [
    { year: 2025, month: 1, amount: '500' },
    { year: 2025, month: 2, amount: '500' },
  ],
  months_total: 31,
  months_invested: 28,
  purchase_count: 77,
  deployment_gap: metric(0.12),
  cadence_label: 'achats autour du 6 du mois',
  median_gap_days: 30,
  invested_share: metric(0.9),
  variation_coefficient: metric(0.2),
  longest_gap_months: metric(1),
  temporal_hhi: metric(0.05),
  equivalent_monthly_purchases: metric(18.5),
  day_of_month_spread: metric(3),
  median_day_of_month: 6,
  verdict: 'Un verdict.',
}

/** DepositLagResponse. */
const depositLag = {
  median_days: metric(4),
  q1_days: metric(2),
  q3_days: metric(9),
  p90_days: metric(14),
  matched_eur: '9000',
  unmatched_eur: '1000',
  unmatched_share: '0.1',
  never_invested_eur: '250',
  unpaired_deposits_eur: '250',
  deposit_variation: metric(0.3),
  purchase_variation: metric(0.2),
  idle_cash_opportunity: '12',
  verdict: 'Un verdict.',
}

/** FeesResponse. */
const fees = {
  total_fees: metric(52),
  fee_share: metric(0.005),
  annual_bps: metric(20),
  threshold_order_size: metric(272),
  avoidable: false,
  orders_below_threshold: 77,
  cost_below_threshold: '52',
  invested_below_threshold: '4000',
  average_fee: '0.68',
  average_order: '120',
  order_count: 77,
  projection_eur: '900',
  projection_note: 'Une note.',
  ter_note: 'Une note.',
  verdict: 'Un verdict.',
}

/** ConcentrationResponse. */
const concentration = {
  lines: 5,
  effective_positions: metric(4.4),
  independent_bets: metric(1.1),
  weights: [{ ...label('FR0000120073'), weight: '0.6' }],
  correlations: [
    {
      left: 'FR0000120073',
      right: 'FR0011550185',
      value: '0.42',
      left_symbol: 'AIR.PA',
      right_symbol: 'CW8.PA',
      left_name: 'Air Liquide',
      right_name: 'Amundi MSCI World',
    },
  ],
  max_correlation: '0.42',
  overlap: 400,
  dropped: [{ asset_key: 'FR0011550193', symbol: 'PAEEM', name: 'Amundi PEA Emergents' }],
  verdict: 'Un verdict.',
}

/** PlanResponse. */
const plan = {
  monthly_target: '500',
  since: '2024-01-01',
  periods: [
    { since: '2024-01-01', monthly_target: '500', allocation: { FR0000120073: '100' } },
  ],
  months: [{ year: 2025, month: 1, target: '500', invested: '500' }],
  total_target: '15000',
  total_invested: '14000',
  adherence_ratio: metric(0.93),
  average_monthly: metric(470),
  drift: [{ asset_key: 'FR0000120073', symbol: 'AIR.PA', name: 'Air Liquide', target: '100', actual: '98' }],
  drift_l1: metric(2),
  rebalance_eur: '120',
  under_invested_months: 3,
  error: null,
  verdict: 'Un verdict.',
}

async function render(component: string, props: Record<string, unknown>) {
  const loaded = await import(`@/components/analytics/sections/${component}.vue`)
  return renderToString(createSSRApp(loaded.default, { isDark: true, ...props }))
}

describe('les sections rendues contre le contrat réel de l’API', () => {
  it('BehaviourSection rend le calendrier des versements', async () => {
    const html = await render('BehaviourSection', {
      regularity,
      depositLag: null,
      conditioning: null,
    })
    expect(html).toContain('Rythme réel des achats')
    // Le conteneur du heatmap : c'est lui qui avait disparu.
    expect(html).toContain('touch-action:pan-y')
    expect(html).toContain('achats autour du 6 du mois')
  })

  it('BehaviourSection rend le bloc délai de dépôt', async () => {
    const html = await render('BehaviourSection', {
      regularity: null,
      depositLag,
      conditioning: null,
    })
    // L'apostrophe sort échappée par le rendu SSR.
    expect(html).toContain('Entre le virement et l&#39;investissement')
    // Sans le symbole : le format français glisse une espace insécable devant.
    expect(html).toContain('250,00')
  })

  it('FeesSection rend sans le message de calibrage quand les frais comptent', async () => {
    const html = await render('FeesSection', { fees: { ...fees, avoidable: true }, exits: null })
    expect(html).not.toContain('information de calibrage')
  })

  it('FeesSection montre le message de calibrage quand la charge reste sous la cible', async () => {
    const html = await render('FeesSection', { fees, exits: null })
    expect(html).toContain('information de calibrage')
  })

  it('HoldingsSection rend la matrice avec des noms, pas des ISIN', async () => {
    const html = await render('HoldingsSection', { concentration, turnover: null })
    // Les axes vivent dans le canvas ECharts, absent du rendu serveur. Le nom des
    // lignes écartées est du texte, et c'est lui qui affichait "undefined".
    expect(html).toContain('Amundi PEA Emergents')
    expect(html).not.toContain('undefined')
  })

  it('PlanSection rend le plan déclaré', async () => {
    const html = await render('PlanSection', { plan })
    expect(html).toContain('Air Liquide')
  })
})

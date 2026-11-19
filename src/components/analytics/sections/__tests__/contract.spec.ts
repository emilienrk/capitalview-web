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

/** ReadingOut, with the bands the API sends for the fee load. */
const feeReading = {
  value: '20',
  format: 'bps',
  active: 0,
  tone: 'good',
  bands: [
    { up_to: '25', label: 'léger', tone: 'good' },
    { up_to: '75', label: 'visible', tone: 'watch' },
    { up_to: null, label: 'lourd', tone: 'bad' },
  ],
}

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
  orders_with_fee: 77,
  fee_coverage: '1',
  recorded_fees: '52',
  is_estimated: false,
  model: 'fixe',
  fee_rate: '0.0056',
  projection_eur: '900',
  projection_note: 'Une note.',
  ter_note: 'Une note.',
  reading: feeReading,
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
  reading: {
    value: '1.1',
    format: 'decimal',
    active: 0,
    tone: 'bad',
    bands: [
      { up_to: '1.5', label: 'un seul pari', tone: 'bad' },
      { up_to: '2.5', label: 'deux directions', tone: 'watch' },
      { up_to: null, label: 'réparti', tone: 'good' },
    ],
  },
  verdict: 'Un verdict.',
}

/** ExposureResponse : les quatre fonds du PEA de data/fund_exposure.toml, à leurs poids du 17/11. */
const share = (label: string, weight: string) => ({ label, weight })
const exposure = {
  sectors: {
    weights: [
      share('technology', '0.3679'),
      share('financials', '0.1451'),
      share('consumer_discretionary', '0.0891'),
      share('industrials', '0.0837'),
      share('communication', '0.0830'),
      share('health_care', '0.0714'),
      share('consumer_staples', '0.0592'),
      share('materials', '0.0347'),
      share('energy', '0.0310'),
      share('utilities', '0.0236'),
      share('real_estate', '0.0100'),
    ],
    other: '0.0014',
    unknown: '0.0000',
    coverage: '1.0000',
    as_of: '2026-10-30',
  },
  countries: {
    weights: [
      share('US', '0.4406'),
      share('TW', '0.0926'),
      share('CN', '0.0643'),
      share('KR', '0.0630'),
      share('GB', '0.0560'),
      share('IN', '0.0373'),
      share('CH', '0.0320'),
      share('FR', '0.0318'),
      share('DE', '0.0287'),
      share('NL', '0.0205'),
      share('BR', '0.0125'),
      share('ES', '0.0123'),
      share('IT', '0.0118'),
      share('SE', '0.0107'),
      share('DK', '0.0059'),
      share('BE', '0.0042'),
      share('IE', '0.0022'),
    ],
    other: '0.0737',
    unknown: '0.0000',
    coverage: '1.0000',
    as_of: '2026-09-28',
  },
  fund_fees: { annual_eur: '39.08', weighted_ter: '0.002479', coverage: '1.0000' },
  lines: [
    { asset_key: 'FR0013412020', symbol: 'PAEEM.PA', name: 'Amundi PEA Emergent', weight: '0.3200', ter: '0.003000', sectors_as_of: '2026-10-30', countries_as_of: '2026-10-30' },
    { asset_key: 'FR0011871110', symbol: 'PUST.PA', name: 'Amundi PEA Nasdaq-100', weight: '0.2860', ter: '0.003000', sectors_as_of: '2026-11-17', countries_as_of: '2026-09-28' },
    { asset_key: 'FR0011550193', symbol: 'ETSZ.DE', name: 'BNP Paribas Easy Stoxx Europe 600', weight: '0.2190', ter: '0.001900', sectors_as_of: '2026-11-17', countries_as_of: '2026-10-30' },
    { asset_key: 'FR0011550185', symbol: 'ESE.PA', name: 'BNP Paribas Easy S&P 500', weight: '0.1750', ter: '0.001400', sectors_as_of: '2026-11-17', countries_as_of: '2026-09-30' },
  ],
}

/** La même, avec une action détenue en direct que le fichier ne décrit pas. */
const airLiquide = {
  asset_key: 'FR0000120073',
  symbol: 'AI.PA',
  name: 'Air Liquide',
  weight: '0.1200',
  ter: null,
  sectors_as_of: null,
  countries_as_of: null,
}
const partialExposure = {
  ...exposure,
  sectors: { ...exposure.sectors, unknown: '0.1200', coverage: '0.8800' },
  countries: { ...exposure.countries, unknown: '0.1200', coverage: '0.8800' },
  fund_fees: { annual_eur: '34.39', weighted_ter: '0.002479', coverage: '0.8800' },
  lines: [...exposure.lines, airLiquide],
}

/**
 * BenchmarkExposureOut : IWDA avec ses neuf premiers pays seulement, comme l'indice dont la fiche ne
 * détaille qu'une partie ; libellé de marché du dump.
 */
const benchmark = {
  asset_key: 'IE00B4L5Y983',
  symbol: 'IWDA.L',
  name: 'ISHARES III PLC ISHRS CORE MSCI',
  sectors: {
    weights: [
      share('technology', '0.2781'),
      share('financials', '0.1662'),
      share('industrials', '0.1083'),
      share('health_care', '0.1043'),
      share('consumer_discretionary', '0.0914'),
      share('communication', '0.0744'),
      share('consumer_staples', '0.0562'),
      share('energy', '0.0425'),
      share('materials', '0.0315'),
      share('utilities', '0.0254'),
      share('real_estate', '0.0164'),
    ],
    other: '0.0053',
    unknown: '0.0000',
    coverage: '1.0000',
    as_of: '2026-11-17',
  },
  countries: {
    weights: [
      share('US', '0.7221'),
      share('JP', '0.0557'),
      share('GB', '0.0353'),
      share('CA', '0.0341'),
      share('CH', '0.0236'),
      share('FR', '0.0233'),
      share('DE', '0.0215'),
      share('AU', '0.0154'),
      share('NL', '0.0126'),
    ],
    other: '0.0564',
    unknown: '0.0000',
    coverage: '1.0000',
    as_of: '2026-11-17',
  },
}
const compared = { ...exposure, benchmark }

/** Le texte d'une ligne de barres, de son libellé à la ligne suivante ; `last` pour la liste des pays. */
function rowOf(html: string, label: string, last = false): string {
  const start = last ? html.lastIndexOf(`title="${label}"`) : html.indexOf(`title="${label}"`)
  const end = html.indexOf('title="', start + 1)
  return html.slice(start, end === -1 ? undefined : end)
}

/** PlanResponse. */
const plan = {
  monthly_target: '500',
  since: '2024-01-01',
  periods: [
    {
      since: '2024-01-01',
      until: null,
      monthly_target: '500',
      allocation: { FR0000120073: '100' },
      months: 30,
      target_eur: '15000',
      invested_eur: '14000',
      adherence_ratio: '0.93',
      flow_drift_l1: '0',
      flows: [
        { asset_key: 'FR0000120073', symbol: 'AIR.PA', name: 'Air Liquide', target: '100', actual: '100' },
      ],
    },
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
  under_in_down_months: 1,
  error: null,
  verdict: 'Un verdict.',
}

/** Le même plan, révisé une fois : 200 €/mois en 50/50, puis 600 €/mois en 25/75. */
const splitPlan = {
  ...plan,
  monthly_target: '600',
  periods: [
    {
      since: '2024-01-01',
      until: '2025-06-01',
      monthly_target: '200',
      allocation: { FR0000120073: '50', IE00B4L5Y983: '50' },
      months: 17,
      target_eur: '3400',
      invested_eur: '3400',
      adherence_ratio: '1',
      flow_drift_l1: '0',
      flows: [],
    },
    {
      since: '2025-06-01',
      until: null,
      monthly_target: '600',
      allocation: { FR0000120073: '25', IE00B4L5Y983: '75' },
      months: 6,
      target_eur: '3600',
      invested_eur: '3600',
      // Le montant a suivi, la répartition non : 50/50 au lieu de 25/75.
      adherence_ratio: '1',
      flow_drift_l1: '50',
      flows: [],
    },
  ],
}

/** RiskResponse. */
const risk = {
  sessions: 800,
  volatility: metric(0.18),
  benchmark_volatility: metric(0.14),
  volatility_ratio: metric(1.3),
  beta: metric(1.2),
  correlation: metric(0.9),
  tracking_error: metric(0.06),
  max_drawdown: { depth: '-0.23', peak: '2022-01-05', trough: '2022-10-12', recovered: '2023-06-01' },
  benchmark_max_drawdown: { depth: '-0.18', peak: '2022-01-05', trough: '2022-10-12', recovered: null },
  excess_return: metric(0.012),
  p_value: '0.42',
  is_detectable: false,
  years_to_conclude: '38.2',
  return_per_risk: metric(0.4),
  benchmark_return_per_risk: metric(0.5),
  reading: {
    value: '1.3',
    format: 'times',
    active: 1,
    tone: 'watch',
    bands: [
      { up_to: '1.15', label: "comme l'indice", tone: 'good' },
      { up_to: '1.5', label: 'plus nerveux', tone: 'watch' },
      { up_to: null, label: 'bien plus nerveux', tone: 'bad' },
    ],
  },
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

  it('BehaviourSection replie le délai de dépôt quand rien n’attend', async () => {
    const settled = {
      ...depositLag,
      median_days: metric(1),
      p90_days: metric(3),
      never_invested_eur: '40',
      reading: { value: '1', format: 'days', active: 0, tone: 'good', bands: [] },
      verdict: 'La moitié de vos euros est investie en 1 jour(s) ou moins.',
    }
    const html = await render('BehaviourSection', {
      regularity: null,
      depositLag: settled,
      conditioning: null,
    })
    expect(html).toContain('Entre le virement et l&#39;investissement')
    expect(html).toContain('investie en 1 jour(s) ou moins')
    expect(html).not.toContain('Délai médian')
  })

  it('FeesSection juge la charge par sa couleur et son échelle, sans phrase de conseil', async () => {
    const html = await render('FeesSection', { fees, exits: null })
    // Le coût annuel en pourcentage, pas en bps, coloré par sa bande.
    expect(html).toContain('0,20 %')
    expect(html).toContain('text-success')
    expect(html).toContain('léger')
    expect(html).not.toContain('bps')
    expect(html).not.toContain('calibrage, pas')
  })

  it('FeesSection annonce l’extrapolation quand les frais sont partiels', async () => {
    // Un frais non saisi a quand même été payé : on l'estime, et on le dit.
    const partial = {
      ...fees,
      orders_with_fee: 8,
      fee_coverage: '0.1039',
      recorded_fees: '52',
      is_estimated: true,
      total_fees: { ...metric(500), reliability: 'estimé', caveat: 'Estimé : 8 sur 77.' },
    }
    const html = await render('FeesSection', { fees: partial, exits: null })

    // Une étiquette à côté du titre, la phrase complète derrière.
    expect(html).toContain('Estimé · frais saisis sur 8/77 ordres')
    // Et la tuile porte son propre marqueur, comme les autres fiabilités.
    expect(html).toContain('aria-label="Estimé"')
  })

  it('FeesSection n’annonce rien quand tous les ordres portent leurs frais', async () => {
    const html = await render('FeesSection', { fees, exits: null })
    expect(html).not.toContain('Estimé ·')
  })

  it('FeesSection remplace le seuil par le tarif sur une commission proportionnelle', async () => {
    // Sous un pourcentage, aucune taille d'ordre ne fait passer sous la cible :
    // le seuil n'est pas un plus petit nombre, c'est une question sans objet.
    const pct = { ...fees, model: 'proportionnel', fee_rate: '0.005' }
    const html = await render('FeesSection', { fees: pct, exits: null })

    expect(html).toContain('Tarif par ordre')
    expect(html).toContain('0,50 %')
    expect(html).not.toContain('Ordre minimum rentable')
    // Et le décompte d'ordres sous le seuil disparaît avec lui.
    expect(html).not.toContain('sont sous le seuil')
  })

  it('RiskSection montre l’amplitude sur son échelle et date la pire chute', async () => {
    const html = await render('RiskSection', { risk })
    expect(html).toContain('1,3×')
    expect(html).toContain('plus nerveux')
    expect(html).toContain('text-warning')
    expect(html).toContain('-23,00 %')
    expect(html).toContain('pas encore rattrapée')
    // Un écart non significatif dit combien d'années il faudrait, jamais « vous battez l'indice ».
    expect(html).toContain('≈ 38 ans')
    expect(html).toContain('Hasard')
    expect(html).not.toContain('undefined')
  })

  it('RiskSection se replie sous un an de séances', async () => {
    const thin = { ...risk, volatility_ratio: metric(null), reading: { ...risk.reading, value: null, active: null, tone: null } }
    const html = await render('RiskSection', { risk: thin })
    expect(html).not.toContain('Bêta')
  })

  it('HoldingsSection rend la matrice avec des noms, pas des ISIN', async () => {
    const html = await render('HoldingsSection', { concentration, turnover: null })
    // Les axes vivent dans le canvas ECharts, absent du rendu serveur. Le nom des
    // lignes écartées est du texte, et c'est lui qui affichait "undefined".
    expect(html).toContain('Amundi PEA Emergents')
    expect(html).not.toContain('undefined')
  })

  it('HoldingsSection montre l’échelle des paris sous le chiffre, hors du « ? »', async () => {
    const html = await render('HoldingsSection', { concentration, turnover: null })
    expect(html).toContain('un seul pari')
    expect(html).toContain('text-danger')
  })

  it('une métrique fiable ne porte aucun marqueur', async () => {
    const html = await render('HoldingsSection', { concentration, turnover: null })
    expect(html).not.toContain('Fiable')
    expect(html).not.toContain('role="tooltip"')
  })

  it('une métrique dégradée porte un marqueur, et sa phrase reste hors du flux', async () => {
    const degraded = {
      ...concentration,
      independent_bets: {
        ...metric(1.1),
        reliability: 'indicatif',
        caveat: 'Deux ans de rendements journaliers font une estimation bruitée.',
      },
    }
    const html = await render('HoldingsSection', { concentration: degraded, turnover: null })
    // Le marqueur est un bouton accessible, nommé par son niveau de fiabilité.
    expect(html).toContain('aria-label="Indicatif"')
    // La phrase n'encombre plus la page : elle attend le survol ou le tap.
    expect(html).not.toContain('estimation bruitée')
  })

  it('chaque bloc porte un « ? », dont le contenu reste replié', async () => {
    const html = await render('HoldingsSection', { concentration, turnover: null })
    expect(html).toContain('aria-label="Méthode et définitions"')
    // Fermé par défaut : la prose ne pèse pas sur la page tant qu'on ne l'ouvre pas.
    expect(html).not.toContain('propriété de la mesure de Meucci')
  })

  it('HoldingsSection montre secteurs et pays en français, datés, selon l’indice suivi', async () => {
    const html = await render('HoldingsSection', { concentration, exposure, turnover: null })
    expect(html).toContain('Exposition par secteur et par pays')
    expect(html).toContain('Selon l&#39;indice suivi par chaque fonds')
    expect(html).toContain('Technologie')
    expect(html).toContain('36,8 %')
    expect(html).toContain('Conso. discrétionnaire')
    // Des noms de pays, pas des codes ISO.
    expect(html).toContain('États-Unis')
    expect(html).toContain('Corée du Sud')
    expect(html).toContain('44,1 %')
    // Chaque liste porte la date de sa source la plus ancienne.
    expect(html).toContain('au 30 oct. 2026')
    expect(html).toContain('au 28 sept. 2026')
    expect(html).not.toContain('undefined')
  })

  it('la part que la source ne détaille pas reste « Autre », sans gonfler les pays connus', async () => {
    const html = await render('HoldingsSection', { concentration, exposure, turnover: null })
    expect(html).toContain('title="Autre"')
    expect(html).toContain('7,4 %')
    expect(html).toContain('44,1 %')
    // Tout est couvert : ni ligne « Non renseigné », ni étiquette de couverture.
    expect(html).not.toContain('Non renseigné')
    expect(html).not.toContain('Données pour')
  })

  it('une couverture partielle s’annonce, et sa part reste « Non renseigné »', async () => {
    const html = await render('HoldingsSection', {
      concentration,
      exposure: partialExposure,
      turnover: null,
    })
    expect(html).toContain('Données pour 88 % du portefeuille')
    expect(html).toContain('Non renseigné')
    expect(html).toContain('12,0 %')
    // Les pays connus gardent leur poids dans le portefeuille entier.
    expect(html).toContain('44,1 %')
  })

  it('les pays au-delà des dix premiers se replient en une ligne qui garde leur total', async () => {
    const html = await render('HoldingsSection', { concentration, exposure, turnover: null })
    expect(html).toContain('Pays-Bas')
    expect(html).toContain('+ 7 pays')
    expect(html).toContain('6,0 %')
    expect(html).toContain('Afficher les 17 pays')
    expect(html).not.toContain('Belgique')
  })

  it('sans exposition, le bloc n’apparaît pas et le reste de la section tient', async () => {
    for (const absent of [null, undefined]) {
      const html = await render('HoldingsSection', { concentration, exposure: absent, turnover: null })
      expect(html).toContain('Paris réellement indépendants')
      expect(html).not.toContain('Exposition par secteur')
    }
  })

  it('couverte à 0 %, l’exposition se replie sur sa phrase sans tracer de barre', async () => {
    const uncovered = {
      sectors: { weights: [], other: '0.0000', unknown: '1.0000', coverage: '0.0000', as_of: null },
      countries: { weights: [], other: '0.0000', unknown: '1.0000', coverage: '0.0000', as_of: null },
      fund_fees: { annual_eur: null, weighted_ter: null, coverage: '0.0000' },
      lines: [{ ...airLiquide, weight: '1.0000' }],
    }
    const html = await render('HoldingsSection', { concentration, exposure: uncovered, turnover: null })
    expect(html).toContain('Exposition par secteur et par pays')
    expect(html).toContain('Aucune de vos lignes n&#39;a de répartition')
    expect(html).not.toContain('Non renseigné')
  })

  it('FeesSection chiffre les frais des fonds à côté du courtage, déjà dans le cours', async () => {
    const html = await render('FeesSection', { fees, exits: null, exposure })
    expect(html).toContain('Frais de gestion des fonds')
    expect(html).toContain('39,08')
    expect(html).toContain('0,25 %')
    // Jamais présentés comme un coût à retrancher de la performance.
    expect(html).toContain('Déjà prélevés dans le cours des fonds')
    expect(html).not.toContain('Calculés sur')
    // Le courtage, lui, ne bouge pas.
    expect(html.indexOf('Frais de courtage')).toBeLessThan(html.indexOf('Frais de gestion des fonds'))
  })

  it('FeesSection dit sur quelle part du portefeuille les frais des fonds sont calculés', async () => {
    const html = await render('FeesSection', { fees, exits: null, exposure: partialExposure })
    expect(html).toContain('Calculés sur 88 % du portefeuille')
    // Une action détenue en direct n'a pas de TER : elle n'est pas décrite, ses frais ne sont pas « inconnus ».
    expect(html).not.toContain('Frais connus')
    expect(html).toContain('34,39')
  })

  it('FeesSection replie les frais des fonds quand aucune ligne n’en a', async () => {
    const unknownFees = { ...exposure, fund_fees: { annual_eur: null, weighted_ter: null, coverage: '0.0000' } }
    const html = await render('FeesSection', { fees, exits: null, exposure: unknownFees })
    expect(html).toContain('Aucune de vos lignes n&#39;a de frais de gestion dans la table de référence des fonds.')
    expect(html).not.toContain('TER moyen pondéré')
  })

  it('le mode confidentialité masque les frais des fonds en euros, pas les pourcentages', async () => {
    const { usePrivacyMode } = await import('@/composables/usePrivacyMode')
    const { privacyMode } = usePrivacyMode()
    privacyMode.value = true
    try {
      const fees_ = await render('FeesSection', { fees: null, exits: null, exposure })
      expect(fees_).toContain('••••••')
      expect(fees_).not.toContain('39,08')
      expect(fees_).toContain('0,25 %')

      const holdings = await render('HoldingsSection', { concentration, exposure, turnover: null })
      expect(holdings).toContain('44,1 %')
    } finally {
      privacyMode.value = false
    }
  })

  it('face à l’indice, chaque ligne porte sa part et celle de l’indice, nommé et daté', async () => {
    const html = await render('HoldingsSection', { concentration, exposure: compared, turnover: null })
    expect(html).toContain('Comparé à')
    // Le nom de la liste des indices, pas le libellé tronqué du fournisseur de cours.
    expect(html).toContain('MSCI World (IWDA)')
    expect(html).not.toContain('ISHARES III')
    expect(html).toContain('répartition au 17 nov. 2026')
    expect(html).toMatch(/>\s*Indice\s*</)
    const us = rowOf(html, 'États-Unis')
    expect(us).toContain('44,1 %')
    expect(us).toContain('72,2 %')
    const tech = rowOf(html, 'Technologie')
    expect(tech).toContain('36,8 %')
    expect(tech).toContain('27,8 %')
  })

  it('un pays de l’indice absent du portefeuille apparaît, sans 0 % inventé', async () => {
    const html = await render('HoldingsSection', { concentration, exposure: compared, turnover: null })
    // Le Japon pèse 5,6 % de l'indice : il remonte parmi les dix premiers, replié ou non.
    const japan = rowOf(html, 'Japon')
    expect(japan).toContain('—')
    expect(japan).toContain('5,6 %')
    expect(japan).not.toContain('0,0 %')
    expect(html.indexOf('title="Japon"')).toBeLessThan(html.indexOf('title="Inde"'))
    expect(html).toContain('title="Canada"')
    // Et l'inverse : Taïwan n'est pas dans la liste détaillée de l'indice.
    expect(rowOf(html, 'Taïwan')).toContain('—')
    // La queue repliée garde ses totaux, et « Autre » reste des deux côtés.
    expect(html).toContain('+ 10 pays')
    expect(html).toContain('Afficher les 20 pays')
    const other = rowOf(html, 'Autre', true)
    expect(other).toContain('7,4 %')
    expect(other).toContain('5,6 %')
  })

  it('face à un indice décrit en entier, un pays qu’il ne détient pas vaut 0 %, pas un tiret', async () => {
    const complete = { ...benchmark, countries: { ...benchmark.countries, other: '0.0000' } }
    const html = await render('HoldingsSection', {
      concentration,
      exposure: { ...exposure, benchmark: complete },
      turnover: null,
    })
    const taiwan = rowOf(html, 'Taïwan')
    expect(taiwan).toContain('9,3 %')
    expect(taiwan).toContain('0,0 %')
    expect(taiwan).not.toContain('—')
  })

  it('sans indice décrit, la répartition s’affiche seule et sans bruit', async () => {
    const html = await render('HoldingsSection', {
      concentration,
      exposure: { ...exposure, benchmark: null },
      turnover: null,
    })
    expect(html).toContain('États-Unis')
    expect(html).not.toContain('Comparé à')
    expect(html).not.toMatch(/>\s*Indice\s*</)
    expect(html).not.toContain('Japon')
  })

  it('un indice décrit sur un seul axe ne compare que celui-là', async () => {
    const sectorsOnly = {
      ...benchmark,
      countries: { weights: [], other: '0.0000', unknown: '1.0000', coverage: '0.0000', as_of: null },
    }
    const html = await render('HoldingsSection', {
      concentration,
      exposure: { ...exposure, benchmark: sectorsOnly },
      turnover: null,
    })
    expect(html).toContain('(secteurs seulement)')
    expect(rowOf(html, 'Technologie')).toContain('27,8 %')
    // Côté pays, rien n'est comparé : ni colonne, ni pays de l'indice.
    expect(html.match(/>\s*Indice\s*</g)).toHaveLength(1)
    expect(html).not.toContain('Japon')
    expect(rowOf(html, 'États-Unis')).not.toContain('72,2 %')
  })

  it('PlanSection rend le plan déclaré', async () => {
    const html = await render('PlanSection', { plan })
    expect(html).toContain('Air Liquide')
    // Un mois lisible, pas la date ISO que renvoie l'API.
    expect(html).toContain('janv. 2024')
    // Une seule période ne mérite pas une liste de périodes.
    expect(html).not.toContain('en cours')
  })

  it('PlanSection énumère les périodes avec leur intervalle', async () => {
    const html = await render('PlanSection', { plan: splitPlan })
    // Chaque période porte la tranche qu'elle couvre, la dernière étant en cours.
    expect(html).toContain('janv. 2024 → juin 2025')
    expect(html).toContain('Depuis juin 2025')
    expect(html).toContain('en cours')
    // Chaque période est jugée sur son propre montant.
    expect(html).toContain('tenu à 100')
  })

  it('PlanSection signale la période dont la répartition a dérivé', async () => {
    const html = await render('PlanSection', { plan: splitPlan })
    // Le montant a suivi la révision, la répartition non — et seule la période
    // concernée porte la phrase.
    expect(html).toContain('50 points de la cible')
    expect(html.match(/points de la cible/g)).toHaveLength(1)
  })

  it('le tableau de dérive défile dans sa boîte plutôt que de pousser la page', async () => {
    const html = await render('PlanSection', { plan })
    expect(html).toContain('overflow-x-auto')
  })
  it('YearlySection sépare le versé du gagné et met l’indice en face', async () => {
    const pocket = (gain: string, twr: string | null) => ({
      start: '2025-12-31',
      end: '2026-09-29',
      value_start: '1000',
      value_end: '1500',
      net_contributions: '400',
      gain,
      time_weighted_return: twr,
      notes: [],
    })
    const yearly = {
      benchmark_asset_key: 'IE00B4L5Y983',
      benchmark_name: 'iShares Core MSCI World',
      years: [
        {
          year: 2025,
          start: '2024-12-31',
          end: '2025-12-31',
          covered_from: '2025-01-01',
          complete: true,
          stocks: pocket('120', '0.12'),
          crypto: null,
          placements: null,
          gain: '120',
          net_contributions: '1000',
          benchmark_return: '0.08',
          benchmark_start: '2024-12-31',
          benchmark_end: '2025-12-31',
        },
        {
          year: 2026,
          start: '2025-12-31',
          end: '2026-09-29',
          covered_from: '2026-01-01',
          complete: false,
          stocks: pocket('100', '0.05'),
          crypto: pocket('-20', '-0.1'),
          placements: null,
          gain: '80',
          net_contributions: '400',
          benchmark_return: '0.07',
          benchmark_start: '2025-12-31',
          benchmark_end: '2026-09-29',
        },
      ],
    }
    const html = await render('YearlySection', { yearly })

    expect(html).toContain('iShares Core MSCI World')
    expect(html).toContain('+12,00 %')
    expect(html).toContain('+8,00 %')
    expect(html).toContain('+4 pts')
    expect(html).toContain('-2 pts')
    expect(html).toContain('au 29 sept.')
    expect(html).toContain('Crypto')
    expect(html).not.toContain('undefined')
    // L'année en cours d'abord.
    expect(html.indexOf('2026')).toBeLessThan(html.indexOf('2025'))
  })
})

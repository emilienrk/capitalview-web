<script setup lang="ts">
/**
 * A year of the real cashflow: monthly figures by type against the year
 * before, where the money went, the months side by side, the savings rate and
 * the safety net, and who it came from and went to.
 */
import { computed } from 'vue'
import { ArrowDown, ArrowUp, PiggyBank, Scale, ShieldCheck, Sparkles, TrendingUp } from 'lucide-vue-next'

import { BaseCard, BaseSegmentedControl, BaseSelect } from '@/components'
import CashflowMonthsBarChart from '@/components/charts/CashflowMonthsBarChart.vue'
import CashflowSankeyChart from '@/components/charts/CashflowSankeyChart.vue'
import RealCashflowCounterparts from '@/components/cashflow/RealCashflowCounterparts.vue'
import RealCashflowNotices from '@/components/cashflow/RealCashflowNotices.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { exploreLink } from '@/utils/ledger'
import {
  changePercent, monthlyFigures, type MonthlyStatistic,
} from '@/utils/realCashflow'
import type { CashflowType, RealCashflowTotals, RealCashflowYear } from '@/types'

const props = defineProps<{
  data: RealCashflowYear
  statistic: MonthlyStatistic
  isDark?: boolean
}>()

const emit = defineEmits<{
  'update:statistic': [value: MonthlyStatistic]
  'select-year': [year: number]
  'select-month': [period: string]
}>()

const { formatCurrency } = useFormatters()
const { maskValue, privacyMode } = usePrivacyMode()

function amount(value: number): string {
  return maskValue(formatCurrency(Number(value), props.data.currency))
}

function percent(value: number | null): string {
  if (value === null) return '—'
  return `${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
}

const yearOptions = computed(() =>
  [...props.data.years_available].reverse().map((year) => ({ label: String(year), value: year })),
)

const statisticOptions = [
  { label: 'Moyenne', value: 'mean' },
  { label: 'Médiane', value: 'median' },
]

const monthly = computed(() => monthlyFigures(props.data, props.statistic))
// Taken off the two figures as shown, so the parts add up to the total to the
// cent: each mean rounded apart could miss it by one.
const cents = (value: number) => Math.round(Number(value) * 100) / 100

/**
 * What comes back of the income and of the expenses, and the running figure
 * behind it. An API older than recurring income sends none of its fields.
 */
const splits = computed<Partial<Record<AmountKey, { recurring: number; oneOff: number; running: number | null }>>>(() => ({
  income: {
    recurring: monthly.value.recurring_income,
    oneOff: cents(monthly.value.income) - cents(monthly.value.recurring_income),
    running: props.data.running_recurring_income ?? null,
  },
  expenses: {
    recurring: monthly.value.recurring,
    oneOff: cents(monthly.value.expenses) - cents(monthly.value.recurring),
    running: props.data.running_recurring ?? null,
  },
}))
const isCurrentYear = computed(() => props.data.year === new Date().getFullYear())

/** The months the year covers so far, for the links into the Explorer. */
const range = computed(() => ({
  from: `${props.data.year}-01`,
  to: props.data.months[props.data.months.length - 1]?.period ?? `${props.data.year}-12`,
}))

type AmountKey = 'income' | 'expenses' | 'cashflow' | 'saving' | 'investment'
const cards: Array<{ label: string; key: AmountKey; type: CashflowType | null; icon: typeof ArrowUp; tone: string }> = [
  { label: 'Entrées', key: 'income', type: 'INCOME', icon: ArrowUp, tone: 'bg-success/10 text-success' },
  { label: 'Dépenses', key: 'expenses', type: 'EXPENSE', icon: ArrowDown, tone: 'bg-danger/10 text-danger' },
  { label: 'Cashflow', key: 'cashflow', type: null, icon: Scale, tone: 'bg-background-subtle dark:bg-background-dark-subtle text-text-main dark:text-text-dark-main' },
  { label: 'Épargne', key: 'saving', type: 'SAVING', icon: PiggyBank, tone: 'bg-primary/10 text-primary' },
  { label: 'Investissement', key: 'investment', type: 'INVESTMENT', icon: TrendingUp, tone: 'bg-info/10 text-info' },
]

/** The detail behind a tile, on hover: the year's total, and what comes back. */
function detail(key: AmountKey): string {
  const lines = [`${amount(props.data.totals[key])} sur l'année`]
  const split = splits.value[key]
  if (split && Number(split.recurring)) {
    lines.push(`${amount(split.recurring)} / mois qui reviennent`)
    if (props.statistic === 'mean') lines.push(`${amount(split.oneOff)} / mois ponctuels`)
    if (split.running !== null) lines.push(`Récurrents en cours : ${amount(split.running)} / mois`)
  }
  return lines.join('\n')
}

/** The change against last year, told without a verdict: the colour stays neutral. */
function comparison(key: keyof RealCashflowTotals): string | null {
  const previous = props.data.previous_year_to_date
  const change = changePercent(Number(props.data.totals[key]), previous ? Number(previous[key]) : null)
  if (change === null || !Number.isFinite(change)) return null
  const sign = change >= 0 ? '+' : '−'
  const label = isCurrentYear.value ? `vs ${props.data.year - 1} à date` : `vs ${props.data.year - 1}`
  return `${sign}${Math.abs(change).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} % ${label}`
}

function cardLink(type: CashflowType | null) {
  const filters = { preset: 'custom' as const, from: range.value.from, to: range.value.to }
  return {
    name: 'cashflow',
    query: type ? exploreLink({ ...filters, types: [type] }, { by: 'group' }) : exploreLink(filters, { by: 'month' }),
  }
}

const rate = computed(() => props.data.totals.savings_rate)
/** The gauge fills with the rate, capped at a full bar past 50 %. */
const rateWidth = computed(() => `${Math.min(100, Math.max(0, Number(rate.value ?? 0) * 2))}%`)

const net = computed(() => props.data.safety_net)

/** Which months the figures stand on: the one in progress is never among them. */
const basis = computed(() => {
  const months = props.data.covered_months
  const what = props.statistic === 'median' ? 'Médiane' : 'Moyenne'
  return `${what} sur ${months} mois terminé${months > 1 ? 's' : ''}${isCurrentYear.value ? ', mois en cours exclu' : ''}`
})

/** The year's money from its main sources to what it became. */
const sankey = computed(() => {
  const links: Array<{ source: string; target: string; value: number }> = []
  const nodeLabels: Record<string, string> = {
    'hub:revenus': 'Entrées',
    'hub:epargne': 'Épargne',
    'hub:external': "Pris sur l'existant",
    'outflow:expenses': 'Dépenses',
    'outflow:recurring': 'Récurrentes',
    'outflow:one_off': 'Ponctuelles',
    'outflow:investment': 'Investissement',
    'outflow:rest': 'Reste',
  }
  const nodeGroups: Record<string, string> = {
    'hub:revenus': 'hub:revenus',
    'hub:epargne': 'hub:epargne',
    'hub:external': 'hub:external',
    'outflow:expenses': 'outflow:expenses',
    'outflow:recurring': 'outflow:recurring',
    'outflow:one_off': 'outflow:one_off',
    'outflow:investment': 'outflow:investment',
    'outflow:rest': 'outflow:rest',
  }
  const totals = props.data.totals
  const income = Number(totals.income)
  const listed = props.data.top_sources.slice(0, 4)
  let named = 0
  for (const source of listed) {
    const id = `inflow:${source.group_key}`
    nodeLabels[id] = source.name
    nodeGroups[id] = id
    const value = Math.min(Number(source.amount), income - named)
    named += value
    links.push({ source: id, target: 'hub:revenus', value })
  }
  if (income - named > 0) {
    nodeLabels['inflow:others'] = 'Autres entrées'
    nodeGroups['inflow:others'] = 'inflow:others'
    links.push({ source: 'inflow:others', target: 'hub:revenus', value: income - named })
  }
  const expenses = Number(totals.expenses)
  links.push({ source: 'hub:revenus', target: 'outflow:expenses', value: expenses })
  // Split from the expenses themselves, so the two branches always add up to them.
  const recurring = Math.min(Number(totals.recurring), expenses)
  links.push({ source: 'outflow:expenses', target: 'outflow:recurring', value: recurring })
  links.push({ source: 'outflow:expenses', target: 'outflow:one_off', value: expenses - recurring })
  links.push({ source: 'hub:revenus', target: 'hub:epargne', value: Number(totals.saving) })
  links.push({ source: 'hub:revenus', target: 'outflow:investment', value: Number(totals.investment) })
  if (Number(totals.net) > 0) links.push({ source: 'hub:revenus', target: 'outflow:rest', value: Number(totals.net) })
  else if (Number(totals.net) < 0) links.push({ source: 'hub:external', target: 'hub:revenus', value: -Number(totals.net) })
  return { links: links.filter((link) => link.value > 0), nodeLabels, nodeGroups }
})

function monthName(period: string): string {
  const [year, month] = period.split('-').map(Number)
  return new Date(year!, month! - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="w-32">
        <BaseSelect
          :model-value="data.year"
          :options="yearOptions"
          aria-label="Année"
          @update:model-value="(year) => year !== undefined && emit('select-year', Number(year))"
        />
      </div>
      <BaseSegmentedControl
        :model-value="statistic"
        :options="statisticOptions"
        size="sm"
        @update:model-value="(value) => emit('update:statistic', value as MonthlyStatistic)"
      />
    </div>

    <p v-if="!data.covered_months" class="text-sm text-text-muted dark:text-text-dark-muted">
      Aucun mois terminé de {{ data.year }} ne porte d'opération.
    </p>

    <template v-else>
      <RealCashflowNotices
        :count="data.open_questions"
        :amount="data.open_amount"
        :currency="data.currency"
        :gaps="data.coverage_gaps"
        :year="data.year"
      />

      <div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
          <router-link
            v-for="card in cards"
            :key="card.key"
            :to="cardLink(card.type)"
            class="group rounded-card bg-surface dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border p-5 shadow-soft transition-colors hover:border-primary/40"
            :title="detail(card.key)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-text-muted dark:text-text-dark-muted">{{ card.label }}</p>
                <p class="mt-1.5 text-2xl font-bold tabular-nums text-text-main dark:text-text-dark-main truncate">
                  {{ amount(monthly[card.key]) }}<span class="ml-1 text-sm font-medium text-text-muted dark:text-text-dark-muted">/ mois</span>
                </p>
              </div>
              <div :class="['w-10 h-10 shrink-0 rounded-full flex items-center justify-center', card.tone]">
                <component :is="card.icon" class="w-5 h-5" />
              </div>
            </div>
            <p v-if="comparison(card.key)" class="mt-1 text-xs font-medium tabular-nums text-text-muted dark:text-text-dark-muted">
              {{ comparison(card.key) }}
            </p>
          </router-link>
        </div>
        <p
          class="mt-2 text-xs text-text-muted dark:text-text-dark-muted"
          :title="Number(data.totals.neutral) ? `Hors ${amount(data.totals.neutral)} déplacés entre vos comptes, remboursés ou annulés.` : undefined"
        >
          {{ basis }}.
        </p>
        <p v-for="other in data.other_currencies" :key="other.currency" class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">
          En {{ other.currency }}, à part faute de taux : {{ maskValue(formatCurrency(other.outflow, other.currency)) }} en sortie,
          {{ maskValue(formatCurrency(other.inflow, other.currency)) }} en entrée.
        </p>
      </div>

      <BaseCard v-if="!privacyMode && sankey.links.length" title="Ce que sont devenues les entrées" :subtitle="`${data.year}, mois terminés`">
        <CashflowSankeyChart
          :links="sankey.links"
          :node-labels="sankey.nodeLabels"
          :node-groups="sankey.nodeGroups"
          :hide-node-labels="['hub:revenus']"
          :is-dark="isDark"
        />
      </BaseCard>

      <BaseCard title="Mois par mois" subtitle="Cliquez un mois pour le détailler">
        <CashflowMonthsBarChart :months="data.months" :format="amount" :is-dark="isDark" @select="emit('select-month', $event)" />
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="m in data.months"
            :key="m.period"
            type="button"
            :disabled="!m.operation_count"
            :class="[
              'px-3 py-1.5 rounded-button text-xs font-medium capitalize disabled:opacity-40 disabled:cursor-not-allowed',
              m.atypical
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'bg-background-subtle dark:bg-background-dark-subtle text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main',
            ]"
            :title="m.atypical ? 'Mois inhabituel : dépenses bien au-dessus des autres mois' : undefined"
            @click="emit('select-month', m.period)"
          >
            {{ monthName(m.period) }}
          </button>
        </div>
      </BaseCard>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BaseCard>
          <p class="text-sm font-medium text-text-muted dark:text-text-dark-muted">Taux d'épargne</p>
          <p class="mt-1.5 text-3xl font-bold tabular-nums text-text-main dark:text-text-dark-main">{{ percent(rate) }}</p>
          <div class="mt-3 h-2 rounded-full bg-background-subtle dark:bg-background-dark-subtle overflow-hidden">
            <div class="h-full rounded-full bg-primary" :style="{ width: rateWidth }" />
          </div>
          <p v-if="data.totals.placed_rate !== null" class="mt-2 text-sm text-text-muted dark:text-text-dark-muted">
            Dont {{ percent(data.totals.placed_rate) }} mis de côté ou investis
          </p>
          <p
            v-if="data.previous_year_to_date?.savings_rate !== null && data.previous_year_to_date?.savings_rate !== undefined"
            class="mt-1 text-xs text-text-muted dark:text-text-dark-muted"
          >
            {{ percent(data.previous_year_to_date.savings_rate) }} {{ isCurrentYear ? `en ${data.year - 1} à date` : `en ${data.year - 1}` }}
          </p>
        </BaseCard>

        <BaseCard v-if="net">
          <p class="flex items-center gap-1.5 text-sm font-medium text-text-muted dark:text-text-dark-muted">
            <ShieldCheck class="w-4 h-4" /> Matelas de sécurité
          </p>
          <p
            class="mt-1.5 text-3xl font-bold tabular-nums text-text-main dark:text-text-dark-main"
            :title="`${amount(net.available)} disponibles pour ${amount(net.monthly_expenses)} dépensés un mois médian`"
          >
            {{ net.months === null ? '—' : `${Number(net.months).toLocaleString('fr-FR')} mois` }}
          </p>
          <p class="mt-2 text-sm text-text-muted dark:text-text-dark-muted">
            {{ amount(net.available) }} disponibles<template v-if="net.savings_months !== null">,
              dont {{ Number(net.savings_months).toLocaleString('fr-FR') }} mois sur les livrets</template>
          </p>
          <p v-if="net.stale_accounts.length" class="mt-1 text-xs text-warning">
            Solde peut-être daté : {{ net.stale_accounts.join(', ') }}
          </p>
        </BaseCard>

        <BaseCard v-if="data.projection">
          <p class="flex items-center gap-1.5 text-sm font-medium text-text-muted dark:text-text-dark-muted">
            <Sparkles class="w-4 h-4" /> Cashflow fin d'année estimé
          </p>
          <p
            class="mt-1.5 text-3xl font-bold tabular-nums text-text-main dark:text-text-dark-main"
            :title="`${amount(data.projection.income)} d'entrées, ${amount(data.projection.expenses)} de dépenses`"
          >
            {{ amount(data.projection.cashflow) }}
          </p>
          <p class="mt-2 text-sm text-text-muted dark:text-text-dark-muted">
            Si les mois à venir ressemblent au mois médian
          </p>
        </BaseCard>
      </div>

      <RealCashflowCounterparts
        :sources="data.top_sources"
        :destinations="data.top_destinations"
        :expenses="data.top_expenses"
        :currency="data.currency"
        :range="range"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Block 3 of the design — "what I actually hold": how many lines, how many
 * effective positions, how many genuinely independent bets, and which sectors
 * and countries the funds stand for.
 */
import { computed, ref } from 'vue'
import CollapsibleBlock from '@/components/analytics/CollapsibleBlock.vue'
import ComparisonBars from '@/components/analytics/ComparisonBars.vue'
import FigureTile from '@/components/analytics/FigureTile.vue'
import MetricTile from '@/components/analytics/MetricTile.vue'
import NoteChip from '@/components/analytics/NoteChip.vue'
import CorrelationMatrix from '@/components/analytics/CorrelationMatrix.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useReadingFormat } from '@/composables/useReadingFormat'
import { benchmarkName } from '@/utils/benchmarks'
import { breakdownRows, countryName, sectorName } from '@/utils/exposure'
import type {
  BreakdownOut,
  ConcentrationResponse,
  ExposureLineOut,
  ExposureResponse,
  TurnoverOut,
} from '@/types'

const props = defineProps<{
  concentration: ConcentrationResponse | null
  /** Optional: a payload stored before the API computed it has none. */
  exposure?: ExposureResponse | null
  turnover: TurnoverOut | null
  isDark?: boolean
}>()

const { formatCurrency, formatDate } = useFormatters()
const { maskValue } = usePrivacyMode()
const { formatReading } = useReadingFormat()

function eur(value: number | string): string {
  return maskValue(formatCurrency(Number(value)))
}

function share(value: number | string): string {
  return formatReading(value, 'pct', true)
}

/** An axis the benchmark's source does not describe is not compared at all. */
function described(breakdown: BreakdownOut | undefined): BreakdownOut | null {
  return breakdown && Number(breakdown.coverage) > 0 ? breakdown : null
}

const against = computed(() => ({
  sectors: described(props.exposure?.benchmark?.sectors),
  countries: described(props.exposure?.benchmark?.countries),
}))

const COLUMNS: [string, string] = ['Vous', 'Indice']

/** Which index, and as of when: the column only says "Indice". */
const benchmarkLine = computed(() => {
  const benchmark = props.exposure?.benchmark
  const { sectors, countries } = against.value
  if (!benchmark || (!sectors && !countries)) return null
  const oldest = [sectors?.as_of, countries?.as_of]
    .filter((day): day is string => Boolean(day))
    .sort()[0]
  const only = sectors && countries ? '' : sectors ? ' (secteurs seulement)' : ' (pays seulement)'
  return {
    name: benchmarkName(benchmark),
    detail: `${only}${oldest ? `, répartition au ${formatDate(oldest)}` : ''}`,
  }
})

const sectors = computed(() =>
  props.exposure ? breakdownRows(props.exposure.sectors, sectorName, against.value.sectors) : null,
)
const countries = computed(() =>
  props.exposure
    ? breakdownRows(props.exposure.countries, countryName, against.value.countries)
    : null,
)

const hasExposure = computed(
  () =>
    Number(props.exposure?.sectors.coverage ?? 0) > 0 ||
    Number(props.exposure?.countries.coverage ?? 0) > 0,
)

// An index can list twenty countries or more. The tail folds into one row that
// keeps its totals, on both sides, so the list still adds up while folded.
const SHOWN_COUNTRIES = 10
const showAllCountries = ref(false)

// Folding two or three rows would hide more than it saves.
const foldsCountries = computed(
  () => (countries.value?.named.length ?? 0) > SHOWN_COUNTRIES + 2,
)

const countryItems = computed(() => {
  if (!countries.value) return []
  const { named, rest } = countries.value
  if (!foldsCountries.value || showAllCountries.value) return [...named, ...rest]
  const tail = named.slice(SHOWN_COUNTRIES)
  return [
    ...named.slice(0, SHOWN_COUNTRIES),
    {
      label: `+ ${tail.length} pays`,
      value: total(tail.map((row) => row.value)),
      reference: total(tail.map((row) => row.reference)),
      emphasis: false,
    },
    ...rest,
  ]
})

/** Over the figures a side does print; a dash when it prints none of them. */
function total(values: (number | string | null | undefined)[]): number | null {
  const printed = values.filter((value) => value !== null && value !== undefined)
  return printed.length ? printed.reduce((sum: number, value) => sum + Number(value), 0) : null
}

function missing(lines: ExposureLineOut[], dated: 'sectors_as_of' | 'countries_as_of'): string {
  return lines
    .filter((line) => !line[dated])
    .map((line) => `${line.name || line.symbol} (${share(line.weight)})`)
    .join(', ')
}

/** Said beside the title only while part of the portfolio has no breakdown. */
const coverage = computed(() => {
  if (!props.exposure) return null
  const bySector = Number(props.exposure.sectors.coverage)
  const byCountry = Number(props.exposure.countries.coverage)
  if (bySector >= 1 && byCountry >= 1) return null
  return {
    label:
      bySector === byCountry
        ? `Données pour ${share(bySector)} du portefeuille`
        : `Secteurs pour ${share(bySector)} · pays pour ${share(byCountry)} du portefeuille`,
    sectors: missing(props.exposure.lines, 'sectors_as_of'),
    countries: missing(props.exposure.lines, 'countries_as_of'),
  }
})
</script>

<template>
  <section v-if="concentration || exposure || turnover" class="mt-8">
    <h2 class="mb-3 text-base font-semibold text-text-main dark:text-text-dark-main">
      Ce qui est réellement détenu
    </h2>

    <CollapsibleBlock
      v-if="concentration"
      id="analyse-concentration"
      class="scroll-mt-20"
      title="Paris réellement indépendants"
      :measurable="concentration.effective_positions.value !== null"
      :summary="concentration.effective_positions.caveat"
    >
      <template v-if="concentration.dropped.length" #badge>
        <NoteChip
          :label="`Hors calcul : ${concentration.dropped.map((line) => line.name).join(', ')}`"
        >
          Ces lignes n'ont pas assez d'historique de cours pour entrer dans les corrélations.
        </NoteChip>
      </template>
      <template #help>
        <li>
          <strong>Comment le lire.</strong> On décompose la variance du portefeuille en
          composantes indépendantes, puis on compte combien pèsent réellement. Deux lignes qui
          corrèlent au-delà de 0,9 sont pratiquement les mêmes.
        </li>
        <li>
          <strong>La mesure discrimine peu</strong> entre deux portefeuilles actions long-only : la
          première composante y porte 98 à 99 % de la variance, et elle sort presque toujours entre
          1 et 1,5. C'est une propriété de la mesure de Meucci, pas un défaut du portefeuille.
        </li>
        <li>
          Ce n'est pas une analyse de la composition des ETF : la mesure porte sur la redondance de
          comportement, à quel point les lignes bougent ensemble. Ce que les fonds représentent se
          lit dans l'exposition par secteur et par pays.
        </li>
      </template>
      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FigureTile label="Lignes détenues">{{ concentration.lines }}</FigureTile>
        <MetricTile
          label="Positions effectives"
          :metric="concentration.effective_positions"
          kind="count"
        />
        <MetricTile
          label="Paris indépendants"
          :metric="concentration.independent_bets"
          :reading="concentration.reading"
          kind="count"
        />
      </div>

      <CorrelationMatrix
        v-if="concentration.correlations.length"
        :correlations="concentration.correlations"
        :is-dark="isDark"
      />

      <p class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">
        {{ concentration.verdict }}
      </p>
    </CollapsibleBlock>

    <CollapsibleBlock
      v-if="exposure && sectors && countries"
      id="analyse-exposure"
      class="scroll-mt-20"
      title="Exposition par secteur et par pays"
      :measurable="hasExposure"
      summary="Aucune de vos lignes n'a de répartition par secteur ou par pays renseignée."
    >
      <template #badge>
        <NoteChip label="Selon l'indice suivi par chaque fonds">
          Chaque fonds compte pour la répartition de l'indice qu'il réplique, au poids qu'il a dans
          votre portefeuille — pas pour les titres qu'il détient.
        </NoteChip>
        <NoteChip v-if="coverage" :label="coverage.label">
          <template v-if="coverage.sectors === coverage.countries">
            Lignes non décrites : {{ coverage.sectors }}.
          </template>
          <template v-else>
            <template v-if="coverage.sectors">Non décrites pour les secteurs : {{ coverage.sectors }}. </template>
            <template v-if="coverage.countries">Non décrites pour les pays : {{ coverage.countries }}.</template>
          </template>
          Cette part reste «&nbsp;Non renseigné&nbsp;» : elle n'est jamais répartie sur les
          secteurs ou les pays connus.
        </NoteChip>
      </template>
      <template #help>
        <li>
          <strong>D'où viennent les chiffres.</strong> Pour chaque fonds, la répartition de l'indice
          qu'il suit, relevée à la main sur une fiche publique (celle de l'indice, ou d'un ETF
          physique qui le réplique) et datée. Chaque ligne y pèse son poids dans votre portefeuille :
          les pourcentages sont ceux du portefeuille entier.
        </li>
        <li>
          <strong>Pourquoi pas les titres du fonds.</strong> Un ETF synthétique — c'est le cas des ETF
          éligibles au PEA sur un indice américain ou émergent — détient un panier de substitution et
          reçoit la performance de son indice par un swap. Ses titres réels feraient d'un fonds
          Nasdaq-100 un fonds européen.
        </li>
        <li>
          <strong>Autre</strong> : la part que la fiche de l'indice ne détaille pas, par exemple les
          pays au-delà des premiers. <strong>Non renseigné</strong> : les lignes non décrites sur
          cet axe. Ni l'une ni l'autre n'est répartie sur les secteurs ou les pays connus.
        </li>
        <template v-if="benchmarkLine">
          <li>
            <strong>Indice</strong> : la même répartition pour votre indice de référence, choisi dans
            les réglages, relevée sur sa propre fiche comme s'il formait tout le portefeuille.
          </li>
          <li>
            Un tiret : le secteur ou le pays manque à la liste détaillée de ce côté-là ; sa part
            éventuelle est comprise dans «&nbsp;Autre&nbsp;» ou «&nbsp;Non renseigné&nbsp;».
          </li>
        </template>
        <li v-else>
          Votre indice de référence n'est pas décrit : la répartition s'affiche sans comparaison.
        </li>
        <li>
          Les secteurs sont les onze secteurs GICS. La date de chaque liste est celle de sa source la
          plus ancienne.
        </li>
      </template>

      <p v-if="benchmarkLine" class="mb-3 text-xs text-text-muted dark:text-text-dark-muted">
        Comparé à
        <span class="font-medium text-text-main dark:text-text-dark-main">{{ benchmarkLine.name }}</span>{{ benchmarkLine.detail }}.
      </p>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div class="mb-1.5 flex items-baseline justify-between gap-2">
            <p
              class="text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
            >
              Secteurs
            </p>
            <p v-if="exposure.sectors.as_of" class="text-[11px] text-text-muted dark:text-text-dark-muted">
              au {{ formatDate(exposure.sectors.as_of) }}
            </p>
          </div>
          <ComparisonBars
            format="pct"
            wide-labels
            :columns="against.sectors ? COLUMNS : undefined"
            :items="[...sectors.named, ...sectors.rest]"
          />
        </div>
        <div>
          <div class="mb-1.5 flex items-baseline justify-between gap-2">
            <p
              class="text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
            >
              Pays
            </p>
            <p v-if="exposure.countries.as_of" class="text-[11px] text-text-muted dark:text-text-dark-muted">
              au {{ formatDate(exposure.countries.as_of) }}
            </p>
          </div>
          <ComparisonBars
            format="pct"
            wide-labels
            :columns="against.countries ? COLUMNS : undefined"
            :items="countryItems"
          />
          <button
            v-if="foldsCountries"
            type="button"
            class="mt-2 text-xs font-medium text-primary hover:underline"
            :aria-expanded="showAllCountries"
            @click="showAllCountries = !showAllCountries"
          >
            {{ showAllCountries ? 'Afficher moins' : `Afficher les ${countries.named.length} pays` }}
          </button>
        </div>
      </div>
    </CollapsibleBlock>

    <CollapsibleBlock
      v-if="turnover"
      class="scroll-mt-20"
      title="Rotation du portefeuille"
      :measurable="turnover.annual_rate.value !== null"
      :summary="turnover.annual_rate.caveat"
    >
      <template #help>
        <li>
          Le <strong>taux de rotation</strong> retient le plus petit des deux côtés, achats ou
          ventes : accumuler n'est pas tourner son portefeuille. C'est la variable que Barber &amp;
          Odean (2000) trouvent corrélée à la sous-performance.
        </li>
      </template>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricTile label="Rotation annuelle" :metric="turnover.annual_rate" kind="pct" />
        <FigureTile label="Acheté">{{ eur(turnover.purchases_eur) }}</FigureTile>
        <FigureTile label="Vendu">{{ eur(turnover.sales_eur) }}</FigureTile>
      </div>
    </CollapsibleBlock>
  </section>
</template>

<script setup lang="ts">
/**
 * The target plan: a monthly amount, an allocation, and the month it starts.
 *
 * The starting month matters more than it looks. Without it a plan declared
 * today is scored backwards over years during which no plan existed, and the
 * page hands out a damning adherence figure about months the user never
 * promised anything for.
 *
 * A plan also changes — income changes, and the allocation changes with it — so
 * it is a list of periods, each in force until the next begins. That is not an
 * advanced mode hidden behind a text link: a plan that never moved in three
 * years is the exception, not the rule. The two modes are a visible switch, and
 * the periods carry their own date ranges so the page can be read rather than
 * reconstructed.
 *
 * Nothing here asks for an ISIN. Lines are picked from what has actually been
 * traded; the key is shown as confirmation, never as the question.
 */
import { computed, ref, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { BaseButton, BaseInput, BaseSegmentedControl } from '@/components'
import AssetKeyPicker from '@/components/analytics/AssetKeyPicker.vue'
import { useSettingsStore } from '@/stores/settings'
import { balancedShares, normalisedShares } from '@/utils/allocation'
import type { AnalysedAsset, InvestmentPlanPeriodInput, WeightOut } from '@/types'

const props = defineProps<{
  plan: Record<string, unknown> | null
  /** Current portfolio weights — what a new period is pre-filled from. */
  held: WeightOut[]
  /** Every line ever traded, held or sold: what the pickers offer. */
  assets: AnalysedAsset[]
  error?: string | null
}>()
const emit = defineEmits<{ changed: [] }>()

const settingsStore = useSettingsStore()

interface Line {
  asset_key: string
  share: string | number
}

interface Period {
  since: string | number
  monthly_target: string | number
  lines: Line[]
}

/** BaseInput emits a number for type="number", so nothing here may assume a string. */
function text(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

const isOpen = ref(false)
const isSaving = ref(false)
const localError = ref<string | null>(null)
const isSplit = ref(false)
const periods = ref<Period[]>([])

const MODES = [
  { value: 'fixed', label: "N'a pas changé" },
  { value: 'split', label: 'A changé au fil du temps' },
]

/**
 * A new period opens on the current portfolio, rounded to whole points that
 * still add up to 100 — a naive round of four weights lands on 99 or 101 and
 * trips the validation on the very first save, which reads as the form being
 * broken.
 */
function defaultLines(): Line[] {
  const shares = normalisedShares(
    props.held.slice(0, 6).map((weight) => ({
      key: weight.asset_key,
      weight: Number(weight.weight),
    })),
  )
  if (!shares.length) return [{ asset_key: '', share: '' }]
  return shares.map((line) => ({ asset_key: line.key, share: String(line.share) }))
}

function toPeriod(raw: Record<string, unknown>): Period {
  const allocation = (raw.allocation ?? {}) as Record<string, string>
  const entries = Object.entries(allocation)
  return {
    since: String(raw.since ?? ''),
    monthly_target: String(raw.monthly_target ?? ''),
    lines: entries.length
      ? entries.map(([asset_key, share]) => ({ asset_key, share: String(share) }))
      : defaultLines(),
  }
}

function load(): void {
  const plan = props.plan ?? {}
  const stored = plan.periods as Record<string, unknown>[] | undefined
  periods.value = stored?.length ? stored.map(toPeriod) : [toPeriod(plan)]
  isSplit.value = periods.value.length > 1
}

watch(() => props.plan, load, { immediate: true })

const hasPlan = computed(() => Boolean(props.plan && Object.keys(props.plan).length))

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

/** "2025-06" → "juin 2025". A raw ISO month is not a date anyone reads. */
function monthLabel(value: string | number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(text(value))
  if (!match) return ''
  const month = MONTHS[Number(match[2]) - 1]
  return month ? `${month} ${match[1]}` : ''
}

/**
 * The stretch a period actually covers, which is the thing the analysis scores
 * and the thing the old form left the reader to work out from two start dates.
 */
function periodRange(index: number): string {
  const period = periods.value[index]
  const next = periods.value[index + 1]
  const from = monthLabel(period?.since ?? '')
  if (!from) return isSplit.value ? 'Mois de départ à renseigner' : ''
  const to = monthLabel(next?.since ?? '')
  return to ? `De ${from} à ${to}` : `Depuis ${from} — en cours`
}

function allocationTotal(period: Period): number {
  return period.lines.reduce((sum, line) => sum + (Number(line.share) || 0), 0)
}

function isBalanced(period: Period): boolean {
  const filled = period.lines.filter((line) => text(line.asset_key) && text(line.share))
  return !filled.length || Math.abs(allocationTotal(period) - 100) <= 1
}

/** Give the remainder to the largest line rather than making the user hunt for it. */
function balance(period: Period): void {
  const filled = period.lines.filter((line) => text(line.asset_key))
  if (!filled.length) return
  const balanced = balancedShares(
    filled.map((line) => ({ key: text(line.asset_key), weight: Number(line.share) || 0 })),
  )
  filled.forEach((line, index) => {
    line.share = String(balanced[index]?.share ?? line.share)
  })
}

function addLine(period: Period): void {
  period.lines.push({ asset_key: '', share: '' })
}

function removeLine(period: Period, index: number): void {
  period.lines.splice(index, 1)
}

/** The month after the last period starts: a new period cannot begin before it. */
function nextMonth(value: string | number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(text(value))
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`
}

function addPeriod(): void {
  const last = periods.value[periods.value.length - 1]
  periods.value.push({
    since: nextMonth(last?.since ?? ''),
    monthly_target: last?.monthly_target ?? '',
    lines: last ? last.lines.map((line) => ({ ...line })) : defaultLines(),
  })
  isSplit.value = true
}

function removePeriod(index: number): void {
  periods.value.splice(index, 1)
  if (periods.value.length <= 1) isSplit.value = false
}

function setMode(mode: string | number): void {
  const split = mode === 'split'
  if (split === isSplit.value) return
  if (split) {
    addPeriod()
    return
  }
  // Collapsing keeps the current period: it is the one in force.
  periods.value = periods.value.slice(-1)
  isSplit.value = false
}

/** Validate and shape a period, or return the reason it cannot be saved. */
function serialise(period: Period, index: number): InvestmentPlanPeriodInput | string {
  const label = isSplit.value ? `Période ${index + 1} : ` : ''
  const amount = Number(period.monthly_target)
  if (!amount || amount <= 0) {
    return `${label}indique un montant mensuel supérieur à zéro.`
  }
  if (isSplit.value && !/^\d{4}-\d{2}$/.test(text(period.since))) {
    return `${label}indique le mois de départ.`
  }

  const filled = period.lines.filter((line) => text(line.asset_key) && text(line.share))
  if (filled.length && Math.abs(allocationTotal(period) - 100) > 1) {
    return `${label}ton allocation fait ${allocationTotal(period)} % au lieu de 100 %.`
  }

  const keys = filled.map((line) => text(line.asset_key).toUpperCase())
  if (new Set(keys).size !== keys.length) {
    return `${label}la même ligne apparaît deux fois dans l'allocation.`
  }

  const allocation: Record<string, string> = {}
  filled.forEach((line) => {
    allocation[text(line.asset_key).toUpperCase()] = text(line.share)
  })
  return { since: text(period.since), monthly_target: text(period.monthly_target), allocation }
}

async function save(): Promise<void> {
  localError.value = null

  const shaped: InvestmentPlanPeriodInput[] = []
  for (const [index, period] of periods.value.entries()) {
    const result = serialise(period, index)
    if (typeof result === 'string') {
      localError.value = result
      return
    }
    shaped.push(result)
  }

  const months = shaped.map((period) => period.since).filter(Boolean)
  if (new Set(months).size !== months.length) {
    localError.value = 'Deux périodes démarrent le même mois.'
    return
  }

  // A single period keeps the original flat shape: the storage says which mode
  // the plan is in, so nothing extra has to be remembered.
  const first = shaped[0]
  if (!first) {
    localError.value = 'Indique au moins une période.'
    return
  }
  const payload =
    shaped.length > 1
      ? { periods: shaped }
      : {
          monthly_target: first.monthly_target,
          allocation: first.allocation,
          ...(first.since ? { since: first.since } : {}),
        }

  isSaving.value = true
  const ok = await settingsStore.updateSettings({ investment_plan: payload })
  isSaving.value = false
  if (ok) {
    isOpen.value = false
    emit('changed')
  } else {
    // The API validates the plan too, and its reason is the specific one.
    localError.value = settingsStore.error
  }
}

async function clear(): Promise<void> {
  isSaving.value = true
  // An empty object is the delete: the API turns it back into "no plan".
  const ok = await settingsStore.updateSettings({ investment_plan: {} })
  isSaving.value = false
  if (ok) {
    isOpen.value = false
    emit('changed')
  }
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm font-medium text-text-main dark:text-text-dark-main">Plan cible</p>
        <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">
          <template v-if="hasPlan">
            {{ periods[periods.length - 1]?.monthly_target }} €/mois investis
            <template v-if="periods.length > 1">
              — {{ periods.length }} périodes depuis {{ monthLabel(periods[0]?.since ?? '') }}
            </template>
            <template v-else-if="periods[0]?.since">
              depuis {{ monthLabel(periods[0].since) }}
            </template>
          </template>
          <template v-else>
            Optionnel. Sans plan, tout le reste de la page fonctionne — avec, une comparaison de
            plus : ce que tu avais écrit contre ce que tu as fait.
          </template>
        </p>
      </div>
      <BaseButton variant="secondary" size="sm" @click="isOpen = !isOpen">
        {{ isOpen ? 'Fermer' : hasPlan ? 'Modifier' : 'Déclarer un plan' }}
      </BaseButton>
    </div>

    <p v-if="error" class="mt-2 text-xs text-warning">{{ error }}</p>

    <div v-if="isOpen" class="mt-5 flex flex-col gap-5">
      <!-- The mode is a switch, not a link at the foot of the form. A plan that
           changed is the common case for anyone whose income moved. -->
      <div class="flex flex-col gap-2">
        <p class="text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted">
          Mon plan
        </p>
        <BaseSegmentedControl
          :model-value="isSplit ? 'split' : 'fixed'"
          :options="MODES"
          size="sm"
          @update:model-value="setMode"
        />
      </div>

      <div
        v-for="(period, pIndex) in periods"
        :key="pIndex"
        :class="
          isSplit
            ? 'rounded-card border border-surface-border p-4 dark:border-surface-dark-border'
            : ''
        "
      >
        <div v-if="isSplit" class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div class="min-w-0">
            <p class="text-xs font-semibold text-text-main dark:text-text-dark-main">
              Période {{ pIndex + 1 }}
            </p>
            <!-- The range, spelled out: the analysis scores months, and two start
                 dates are not a range until someone works it out. -->
            <p class="text-[11px] text-text-muted dark:text-text-dark-muted">
              {{ periodRange(pIndex) }}
            </p>
          </div>
          <button
            v-if="periods.length > 1"
            type="button"
            class="shrink-0 rounded-button p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50 dark:text-text-dark-muted"
            :disabled="isSaving"
            title="Retirer cette période"
            @click="removePeriod(pIndex)"
          >
            <Trash2 class="h-4 w-4" stroke-width="2" />
          </button>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BaseInput
            :id="`plan-monthly-${pIndex}`"
            v-model="period.monthly_target"
            type="number"
            label="Montant mensuel à investir (€)"
            placeholder="500"
            :disabled="isSaving"
          />
          <!-- A month picker rather than a format to obey: "AAAA-MM" typed by
               hand was one more way to be silently wrong. -->
          <BaseInput
            :id="`plan-since-${pIndex}`"
            v-model="period.since"
            type="month"
            :label="pIndex === 0 && !isSplit ? 'À partir de (optionnel)' : 'À partir de'"
            :disabled="isSaving"
          />
        </div>

        <div class="mt-4">
          <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p
              class="text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
            >
              Allocation cible
            </p>
            <span
              v-if="period.lines.length"
              :class="[
                'text-xs tabular-nums',
                isBalanced(period) ? 'text-text-muted dark:text-text-dark-muted' : 'text-warning',
              ]"
            >
              Total : {{ allocationTotal(period) }} %
              <button
                v-if="!isBalanced(period)"
                type="button"
                class="ml-1 underline"
                @click="balance(period)"
              >
                ajuster à 100
              </button>
            </span>
          </div>

          <!-- Stacked on a phone. Side by side, a 375px row leaves the picker
               about 140px and the fund name — the only readable identifier —
               truncates to "iShares C…", which defeats the whole point. -->
          <div
            v-for="(line, index) in period.lines"
            :key="index"
            class="mb-3 flex flex-col gap-2 sm:mb-2 sm:flex-row sm:items-center"
          >
            <div class="min-w-0 sm:flex-1">
              <AssetKeyPicker
                :id="`plan-asset-${pIndex}-${index}`"
                v-model="line.asset_key"
                :assets="assets"
                :disabled="isSaving"
              />
            </div>
            <div class="flex items-center gap-2">
              <div class="w-24 shrink-0">
                <BaseInput
                  :id="`plan-share-${pIndex}-${index}`"
                  v-model="line.share"
                  type="number"
                  placeholder="%"
                  :disabled="isSaving"
                />
              </div>
              <span class="text-sm text-text-muted dark:text-text-dark-muted sm:hidden">
                % de l'allocation
              </span>
              <button
                type="button"
                class="ml-auto shrink-0 rounded-button p-2 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50 dark:text-text-dark-muted sm:ml-0"
                :disabled="isSaving"
                title="Retirer cette ligne"
                @click="removeLine(period, index)"
              >
                <Trash2 class="h-4 w-4" stroke-width="2" />
              </button>
            </div>
          </div>

          <button
            type="button"
            class="mt-1 flex items-center gap-1.5 rounded-button px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5 disabled:opacity-50 dark:hover:bg-primary/10"
            :disabled="isSaving"
            @click="addLine(period)"
          >
            <Plus class="h-3.5 w-3.5" stroke-width="2.5" />
            Ajouter une ligne
          </button>
        </div>
      </div>

      <!-- self-start: inside a column flex it would otherwise stretch full width
           and outweigh Enregistrer, which is the primary action here. -->
      <div v-if="isSplit" class="self-start">
        <BaseButton variant="secondary" size="sm" :disabled="isSaving" @click="addPeriod">
          <Plus class="h-4 w-4" stroke-width="2.5" />
          Ajouter une période
        </BaseButton>
      </div>

      <p v-if="localError" class="text-xs text-danger">{{ localError }}</p>

      <div class="flex flex-wrap items-center gap-3">
        <BaseButton :disabled="isSaving" :loading="isSaving" @click="save">Enregistrer</BaseButton>
        <BaseButton v-if="hasPlan" variant="secondary" :disabled="isSaving" @click="clear">
          Supprimer le plan
        </BaseButton>
      </div>
    </div>
  </div>
</template>

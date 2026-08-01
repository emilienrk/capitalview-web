<script setup lang="ts">
/**
 * The target plan: a monthly amount, an allocation by asset key, and the month
 * it starts from.
 *
 * The starting month matters more than it looks. Without it a plan declared
 * today is scored backwards over years during which no plan existed, and the
 * page hands out a damning adherence figure about months the user never
 * promised anything for.
 *
 * A plan can also change — income changes, and plans change with it — so it is
 * optionally split into periods, each with its own amount and allocation. Fixed
 * is the default because it is the common case; the mode is read off the shape
 * of what is stored rather than persisted as one more setting to keep in sync.
 */
import { computed, ref, watch } from 'vue'
import { BaseButton, BaseInput } from '@/components'
import { useSettingsStore } from '@/stores/settings'
import type { InvestmentPlanPeriodInput, WeightOut } from '@/types'

const props = defineProps<{
  plan: Record<string, unknown> | null
  held: WeightOut[]
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

function defaultLines(): Line[] {
  return props.held.slice(0, 4).map((weight) => ({
    asset_key: weight.asset_key,
    share: (Number(weight.weight) * 100).toFixed(0),
  }))
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

/** Held lines by key, so a typed ISIN can be echoed back as a readable name. */
const heldNames = computed(() =>
  Object.fromEntries(props.held.map((weight) => [weight.asset_key, weight.name])),
)

function nameFor(assetKey: string | number): string {
  return heldNames.value[text(assetKey).toUpperCase()] ?? ''
}

function allocationTotal(period: Period): number {
  return period.lines.reduce((sum, line) => sum + (Number(line.share) || 0), 0)
}

function addLine(period: Period): void {
  period.lines.push({ asset_key: '', share: '' })
}

function removeLine(period: Period, index: number): void {
  period.lines.splice(index, 1)
}

function addPeriod(): void {
  const last = periods.value[periods.value.length - 1]
  periods.value.push({
    since: '',
    monthly_target: last?.monthly_target ?? '',
    lines: last ? last.lines.map((line) => ({ ...line })) : defaultLines(),
  })
  isSplit.value = true
}

function removePeriod(index: number): void {
  periods.value.splice(index, 1)
  if (periods.value.length <= 1) isSplit.value = false
}

function toggleSplit(): void {
  if (isSplit.value) {
    // Collapsing keeps the current period: it is the one in force.
    periods.value = periods.value.slice(-1)
    isSplit.value = false
  } else {
    addPeriod()
  }
}

/** Validate and shape a period, or return the reason it cannot be saved. */
function serialise(period: Period, index: number): InvestmentPlanPeriodInput | string {
  const label = isSplit.value ? `Période ${index + 1} : ` : ''
  const amount = Number(period.monthly_target)
  if (!amount || amount <= 0) {
    return `${label}indique un montant mensuel supérieur à zéro.`
  }
  if (isSplit.value && !/^\d{4}-\d{2}$/.test(text(period.since))) {
    return `${label}indique un mois de départ au format AAAA-MM.`
  }

  const filled = period.lines.filter((line) => text(line.asset_key) && text(line.share))
  if (filled.length && Math.abs(allocationTotal(period) - 100) > 1) {
    return `${label}ton allocation fait ${allocationTotal(period)} % au lieu de 100 %.`
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
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p class="text-sm font-medium text-text-main dark:text-text-dark-main">Plan cible</p>
        <p class="text-xs text-text-muted dark:text-text-dark-muted">
          <template v-if="hasPlan">
            {{ periods[periods.length - 1]?.monthly_target }} €/mois investis
            <template v-if="periods.length > 1"> — {{ periods.length }} périodes</template>
            <template v-else-if="periods[0]?.since"> depuis {{ periods[0].since }}</template>
          </template>
          <template v-else>
            Optionnel. Sans plan, tout le reste de la page fonctionne — avec, une comparaison de
            plus : ce que tu avais écrit contre ce que tu as fait.
          </template>
        </p>
      </div>
      <BaseButton variant="secondary" @click="isOpen = !isOpen">
        {{ isOpen ? 'Fermer' : hasPlan ? 'Modifier' : 'Déclarer un plan' }}
      </BaseButton>
    </div>

    <p v-if="error" class="mt-2 text-xs text-warning">{{ error }}</p>

    <div v-if="isOpen" class="mt-4 flex flex-col gap-4">
      <div
        v-for="(period, pIndex) in periods"
        :key="pIndex"
        :class="
          isSplit
            ? 'rounded-card border border-surface-border p-3 dark:border-surface-dark-border'
            : ''
        "
      >
        <div v-if="isSplit" class="mb-2 flex items-center justify-between">
          <p class="text-xs font-semibold text-text-main dark:text-text-dark-main">
            Période {{ pIndex + 1 }}
          </p>
          <BaseButton
            v-if="periods.length > 1"
            variant="secondary"
            :disabled="isSaving"
            @click="removePeriod(pIndex)"
          >
            Retirer la période
          </BaseButton>
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
          <BaseInput
            :id="`plan-since-${pIndex}`"
            v-model="period.since"
            label="À partir de (AAAA-MM)"
            placeholder="2025-01"
            :disabled="isSaving"
          />
        </div>

        <div class="mt-4">
          <p
            class="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
          >
            Allocation cible, par ISIN
          </p>
          <div
            v-for="(line, index) in period.lines"
            :key="index"
            class="mb-2 flex items-end gap-2"
          >
            <div class="flex-1">
              <BaseInput
                :id="`plan-asset-${pIndex}-${index}`"
                v-model="line.asset_key"
                label="ISIN"
                placeholder="IE00B4L5Y983"
                :disabled="isSaving"
              />
              <p
                v-if="nameFor(line.asset_key)"
                class="mt-1 text-[11px] text-text-muted dark:text-text-dark-muted"
              >
                {{ nameFor(line.asset_key) }}
              </p>
            </div>
            <div class="w-28">
              <BaseInput
                :id="`plan-share-${pIndex}-${index}`"
                v-model="line.share"
                type="number"
                label="%"
                placeholder="80"
                :disabled="isSaving"
              />
            </div>
            <BaseButton variant="secondary" :disabled="isSaving" @click="removeLine(period, index)">
              Retirer
            </BaseButton>
          </div>
          <div class="flex items-center gap-3">
            <BaseButton variant="secondary" :disabled="isSaving" @click="addLine(period)">
              Ajouter une ligne
            </BaseButton>
            <span
              v-if="period.lines.length"
              :class="[
                'text-xs',
                Math.abs(allocationTotal(period) - 100) > 1
                  ? 'text-warning'
                  : 'text-text-muted dark:text-text-dark-muted',
              ]"
            >
              Total : {{ allocationTotal(period) }} %
            </span>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="text-xs text-text-muted underline dark:text-text-dark-muted"
          @click="toggleSplit"
        >
          {{ isSplit ? 'Revenir à un plan fixe' : 'Mon plan a changé au fil du temps' }}
        </button>
        <BaseButton v-if="isSplit" variant="secondary" :disabled="isSaving" @click="addPeriod">
          Ajouter une période
        </BaseButton>
      </div>

      <p v-if="localError" class="text-xs text-danger">{{ localError }}</p>

      <div class="flex flex-wrap items-center gap-3">
        <BaseButton :disabled="isSaving" @click="save">Enregistrer</BaseButton>
        <BaseButton v-if="hasPlan" variant="secondary" :disabled="isSaving" @click="clear">
          Supprimer le plan
        </BaseButton>
      </div>
    </div>
  </div>
</template>

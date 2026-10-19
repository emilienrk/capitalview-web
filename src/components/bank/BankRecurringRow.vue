<script setup lang="ts">
/**
 * One recurring payment, or income, in the Récurrent tab: what it costs or
 * brings and when it is due, opened on its history and on what can be said
 * about it.
 */
import { computed, ref, watch } from 'vue'
import { ChevronDown, TrendingDown, TrendingUp, X } from 'lucide-vue-next'

import { BaseBadge, BaseButton, BaseInput, BaseSelect, BaseSkeleton } from '@/components'
import BankAnswerButton from '@/components/bank/BankAnswerButton.vue'
import RecurringMonthsChart from '@/components/charts/RecurringMonthsChart.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useBankStore } from '@/stores/bank'
import { useCashflowTypesStore } from '@/stores/cashflowTypes'
import { useRecurringStore } from '@/stores/recurring'
import { RULES_PAGE, answerLabel, ruleTitle } from '@/utils/cashflowTypes'
import { CADENCE_LABELS, CADENCE_PER, NATURES, NATURE_LABELS, isCounted, roleNote } from '@/utils/recurring'
import type { BankRecurringItem, BankTransactionItem, RecurringDecisionKind, RecurringNature } from '@/types'

const props = defineProps<{
  item: BankRecurringItem
  /** What it can be merged with: the others of its list, of its direction. */
  others?: BankRecurringItem[]
  /** Listed under its category's title, which already says its nature. */
  inCategory?: boolean
}>()

const emit = defineEmits<{
  failed: [message: string]
  /** Yes or no, a name given with the yes: the row moves at once, so the list says a failure. */
  answer: [decision: RecurringDecisionKind, name?: string]
}>()

const store = useRecurringStore()
const bank = useBankStore()
const types = useCashflowTypesStore()
const { formatCurrency, formatDate } = useFormatters()
const { maskValue } = usePrivacyMode()

function money(value: number, currency = props.item.currency): string {
  return maskValue(formatCurrency(Number(value), currency))
}

const income = computed(() => props.item.direction === 'income')
const counted = computed(() => isCounted(props.item))
const ended = computed(() => props.item.status === 'ended')
const lastChange = computed(() => props.item.price_changes[props.item.price_changes.length - 1] ?? null)

const meta = computed(() => {
  const parts: Array<{ text: string; italic?: boolean }> = []
  if (!props.inCategory) {
    parts.push(props.item.nature ? { text: NATURE_LABELS[props.item.nature] } : { text: 'À classer', italic: true })
  }
  const cadence = CADENCE_LABELS[props.item.cadence]
  parts.push({ text: parts.length ? cadence : cadence.charAt(0).toUpperCase() + cadence.slice(1) })
  parts.push({ text: props.item.accounts.join(', ') })
  return parts
})

/**
 * Kept, but a rule the user wrote types its payments as something else: the
 * rule is the later word, so it is named rather than overruled.
 */
const retyped = computed(() => (counted.value && !ended.value ? props.item.retyped : null))
const retypedNote = computed(() => {
  const found = retyped.value
  if (!found) return null
  const rule = types.rules?.find((known) => known.id === found.rule_id)
  return `Ne compte plus dans vos ${income.value ? 'revenus' : 'paiements'} récurrents : `
    + `${rule ? `la règle ${ruleTitle(rule)}` : 'une règle'} classe ses opérations en ${answerLabel(found.type, income.value)}.`
})

/** Where it stands, said once beside its name; nothing when it simply runs. */
const statusBadge = computed(() => {
  const item = props.item
  if (item.ended_on) {
    return { variant: 'secondary' as const, text: `${income.value ? 'Terminé' : 'Résilié'} le ${formatDate(item.ended_on)}` }
  }
  if (retyped.value) return { variant: 'secondary' as const, text: 'Hors du total' }
  if (item.status === 'late') return { variant: 'warning' as const, text: 'En retard' }
  if (item.status === 'stale' && item.covered_until) {
    return { variant: 'secondary' as const, text: `À jour au ${formatDate(item.covered_until)}` }
  }
  return null
})

// ── Details ─────────────────────────────────────────────────

const open = ref(false)
const operations = ref<BankTransactionItem[] | null>(null)
const loadFailed = ref(false)

async function loadOperations(): Promise<void> {
  loadFailed.value = false
  try {
    operations.value = await store.fetchOperations(props.item)
  } catch {
    loadFailed.value = true
  }
}

async function toggle(): Promise<void> {
  open.value = !open.value
  // Which rule it is only the list of rules says.
  if (open.value && retyped.value && !types.rules) types.fetchRules().catch(() => {})
  if (open.value && !operations.value) await loadOperations()
}

// A merge brings another series' operations in: an open row reads them again
// with the list, instead of keeping the ones it first read.
watch(() => bank.dataRevision, () => {
  if (open.value) void loadOperations()
})

const SHOWN_OPERATIONS = 5
const allOperations = ref(false)
const shownOperations = computed(() =>
  allOperations.value ? operations.value ?? [] : (operations.value ?? []).slice(0, SHOWN_OPERATIONS),
)

const facts = computed(() => {
  const item = props.item
  const facts: Array<{ label: string; value: string; hint?: string }> = [
    { label: item.since_at_least ? 'Au moins depuis' : 'Depuis', value: formatDate(item.first_date) },
    {
      label: 'Échéances',
      value: item.extra_count ? `${item.occurrence_count} + ${item.extra_count}` : String(item.occurrence_count),
      hint: item.extra_count ? `${item.extra_count} hors échéance` : undefined,
    },
    { label: 'Sur 12 mois', value: money(item.paid_last_12_months) },
    { label: 'Par an', value: `≈ ${money(item.annual_estimate)}` },
    { label: 'En tout', value: money(item.paid_total) },
  ]
  if (item.refunds.items.length) {
    const count = item.refunds.items.length
    facts.push({
      label: income.value ? 'Repris' : 'Remboursé',
      value: money(item.refunds.total),
      hint: `${count} ${income.value ? 'débit' : 'crédit'}${count > 1 ? 's' : ''}`,
    })
  }
  return facts
})

function signed(tx: BankTransactionItem): string {
  return money(tx.is_credit ? Number(tx.amount) : -Number(tx.amount), tx.currency)
}

// ── Actions ─────────────────────────────────────────────────

const busy = ref(false)
const renaming = ref(false)
const name = ref('')

function fail(e: unknown): void {
  emit('failed', e instanceof Error ? e.message : "Impossible d'enregistrer ce choix.")
}

/** Whether the write went through: a caller showing what it wrote needs to know. */
async function act(action: () => Promise<unknown>): Promise<boolean> {
  busy.value = true
  try {
    await action()
    return true
  } catch (e) {
    fail(e)
    return false
  } finally {
    busy.value = false
  }
}

function decide(decision: RecurringDecisionKind): void {
  emit('answer', decision)
}

function decisionId(): Promise<string> {
  return store.decisionId(props.item)
}

function startRename(): void {
  name.value = props.item.name
  renaming.value = true
}

async function saveName(): Promise<void> {
  const next = name.value.trim()
  renaming.value = false
  if (!next || next === props.item.name) return
  // A name given with the yes is kept with it, in one write.
  if (!props.item.id) {
    emit('answer', 'confirm', next)
    return
  }
  try {
    await store.rename(props.item, next)
  } catch (e) {
    fail(e)
  }
}

async function setEnded(endedOn: string | null): Promise<void> {
  await act(async () => store.update(await decisionId(), { ended_on: endedOn }))
}

const natureOptions = computed(() =>
  NATURES[props.item.direction].map((nature) => ({ label: NATURE_LABELS[nature], value: nature })),
)

// The select shows what is stored, never what a failed write attempted.
const natureChoice = ref<RecurringNature | undefined>(props.item.nature ?? undefined)
watch(() => props.item.nature, (nature) => { natureChoice.value = nature ?? undefined })

/** Filing what it is for settles the yes too: only a kept one has a nature. */
async function setNature(nature: string | number | undefined): Promise<void> {
  if (!nature || nature === props.item.nature) return
  natureChoice.value = nature as RecurringNature
  if (!await act(async () => store.update(await decisionId(), { nature: nature as RecurringNature }))) {
    natureChoice.value = props.item.nature ?? undefined
  }
}

/** Out of the series for good: the detection will not take it back. */
async function detach(operation: BankTransactionItem): Promise<void> {
  if (!await act(async () => store.correct(await decisionId(), operation.id, 'exclude'))) return
  operations.value = operations.value?.filter((kept) => kept.id !== operation.id) ?? null
}

const mergeOptions = computed(() =>
  (props.others ?? [])
    .filter((other) => other.key !== props.item.key && other.state !== 'refused')
    .map((other) => ({ label: other.name, value: other.key })),
)

/** The other one's operations join this one, which keeps its name, or takes the other's when it has none. */
async function mergeWith(key: string | number | undefined): Promise<void> {
  const other = props.others?.find((candidate) => candidate.key === key)
  if (!other) return
  await act(async () => store.merge(await decisionId(), other))
}

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <li class="px-4 sm:px-6 py-3">
    <div class="flex items-center gap-3">
      <button type="button" class="min-w-0 flex-1 text-left" :aria-expanded="open" @click="toggle">
        <p class="flex items-center gap-1.5 text-sm font-medium text-text-main dark:text-text-dark-main">
          <span class="truncate" :title="item.name">{{ item.name }}</span>
          <ChevronDown :class="['w-3.5 h-3.5 shrink-0 text-text-muted dark:text-text-dark-muted transition-transform', open ? 'rotate-180' : '']" />
        </p>
        <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted dark:text-text-dark-muted">
          <!-- Each part carries the dot after it: a wrapped line never starts on one. -->
          <span>
            <template v-for="(part, index) in meta" :key="index">
              <span :class="['whitespace-nowrap', part.italic ? 'italic' : '']">{{ part.text }}{{ index < meta.length - 1 ? ' ·' : '' }}</span>{{ index < meta.length - 1 ? ' ' : '' }}
            </template>
          </span>
          <BaseBadge v-if="statusBadge" :variant="statusBadge.variant">{{ statusBadge.text }}</BaseBadge>
          <!-- The arrow carries the direction; no colour, which would call a rise bad. -->
          <span
            v-if="lastChange"
            class="inline-flex items-center gap-0.5 font-medium"
            :title="`${money(lastChange.before)} → ${money(lastChange.after)} le ${formatDate(lastChange.date)}`"
          >
            <component :is="Number(lastChange.percent) > 0 ? TrendingUp : TrendingDown" class="w-3.5 h-3.5" />
            {{ Number(lastChange.percent) > 0 ? '+' : '' }}{{ Number(lastChange.percent).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }} %
          </span>
        </div>
      </button>
      <div class="shrink-0 text-right">
        <!-- Out of the total, its amount reads as set aside, like the badge says. -->
        <p
          :class="[
            'text-sm font-semibold tabular-nums',
            retyped ? 'text-text-muted dark:text-text-dark-muted' : 'text-text-main dark:text-text-dark-main',
          ]"
        >
          <template v-if="item.variable">≈ </template>{{ money(item.amount) }}
          <span class="text-xs font-normal text-text-muted dark:text-text-dark-muted">{{ CADENCE_PER[item.cadence] }}</span>
        </p>
        <p class="text-xs text-text-muted dark:text-text-dark-muted tabular-nums">
          <template v-if="ended || item.ended_on">dernier le {{ formatDate(item.last_date) }}</template>
          <template v-else>{{ item.status === 'late' ? 'attendu le' : 'prochain le' }} {{ formatDate(item.next_date) }}</template>
        </p>
      </div>
    </div>

    <!-- A found series not counted yet: the same yes or no as on its operation. -->
    <div v-if="item.state === 'candidate'" class="mt-2 flex items-center gap-1.5 text-xs">
      <span class="text-warning font-medium">C'est un {{ income ? 'revenu' : 'paiement' }} récurrent ?</span>
      <BankAnswerButton :disabled="busy" @click="decide('confirm')">
        Oui
      </BankAnswerButton>
      <BankAnswerButton :disabled="busy" @click="decide('refuse')">
        Non
      </BankAnswerButton>
    </div>

    <Transition name="cv-expand">
      <div v-if="open">
        <div>
          <div class="pt-3 space-y-3 text-xs text-text-muted dark:text-text-dark-muted">
            <p v-if="retypedNote" class="text-sm text-text-main dark:text-text-dark-main">
              {{ retypedNote }}
              <router-link :to="RULES_PAGE" class="font-medium text-primary hover:underline">Voir les règles</router-link>
            </p>
            <dl class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2">
              <div v-for="fact in facts" :key="fact.label" :title="fact.hint">
                <dt>{{ fact.label }}</dt>
                <dd class="mt-0.5 text-sm font-medium tabular-nums text-text-main dark:text-text-dark-main">{{ fact.value }}</dd>
              </div>
            </dl>

            <!-- Price changes and pauses read off the bars; the tooltip gives each month. -->
            <RecurringMonthsChart
              v-if="item.paid_by_month.length > 1"
              compact
              :series="[{ name: item.name, months: item.paid_by_month }]"
              :format="(value) => money(value)"
            />

            <p v-if="item.renamed.length" class="flex flex-wrap items-center gap-1.5">
              Anciens noms
              <BaseBadge v-for="rename in item.renamed" :key="rename.date" variant="secondary">{{ rename.before }}</BaseBadge>
            </p>

            <ul class="rounded-button bg-background-subtle dark:bg-background-dark-subtle divide-y divide-surface-border dark:divide-surface-dark-border">
              <template v-if="operations">
                <li v-for="operation in shownOperations" :key="operation.id" class="group flex items-baseline gap-2 px-2.5 py-1.5">
                  <span class="shrink-0 tabular-nums">{{ formatDate(operation.operation_date) }}</span>
                  <span class="truncate" :title="operation.label ?? undefined">{{ operation.label }}</span>
                  <span
                    v-if="operation.recurring && roleNote(operation.recurring.role, item.direction)"
                    class="shrink-0 text-text-muted/80 dark:text-text-dark-muted/80"
                  >
                    {{ roleNote(operation.recurring.role, item.direction) }}
                  </span>
                  <span class="ml-auto shrink-0 font-medium tabular-nums text-text-main dark:text-text-dark-main">
                    {{ signed(operation) }}
                  </span>
                  <button
                    v-if="item.state !== 'refused'"
                    type="button"
                    :disabled="busy"
                    class="shrink-0 self-center rounded p-0.5 hover:text-danger disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                    :aria-label="`Retirer cette opération de ${item.name}`"
                    :title="`N'en fait pas partie : ${income ? 'ce revenu' : 'ce paiement'} ne la reprendra plus.`"
                    @click="detach(operation)"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </li>
                <li v-if="operations.length > SHOWN_OPERATIONS">
                  <button
                    type="button"
                    class="w-full px-2.5 py-1.5 text-left font-medium text-primary hover:underline"
                    @click="allOperations = !allOperations"
                  >
                    {{ allOperations ? 'Voir les dernières seulement' : `Voir les ${operations.length} opérations` }}
                  </button>
                </li>
              </template>
              <li v-else-if="loadFailed" class="px-2.5 py-1.5 text-danger">Impossible de charger ces opérations.</li>
              <li v-for="n in 3" v-else :key="n" class="px-2.5 py-1.5"><BaseSkeleton variant="text" width="100%" /></li>
            </ul>

            <form v-if="renaming" class="flex items-center gap-2" @submit.prevent="saveName">
              <div class="flex-1"><BaseInput v-model="name" :aria-label="income ? 'Nom du revenu récurrent' : 'Nom du paiement récurrent'" /></div>
              <BaseButton size="sm" type="submit" :loading="busy">Enregistrer</BaseButton>
              <BaseButton size="sm" variant="ghost" @click="renaming = false">Annuler</BaseButton>
            </form>
            <div v-else class="flex flex-wrap items-center gap-2">
              <div v-if="item.state !== 'refused'" class="w-40">
                <BaseSelect
                  :model-value="natureChoice"
                  :options="natureOptions"
                  placeholder="À classer"
                  :disabled="busy"
                  :aria-label="income ? 'Ce revenu vient de' : 'Ce paiement sert à'"
                  @update:model-value="setNature"
                />
              </div>
              <BaseButton v-if="item.state !== 'refused'" size="sm" variant="outline" :disabled="busy" @click="startRename">
                Renommer
              </BaseButton>
              <template v-if="counted">
                <BaseButton v-if="item.ended_on" size="sm" variant="outline" :disabled="busy" @click="setEnded(null)">
                  {{ income ? 'Pas terminé' : 'Pas résilié' }}
                </BaseButton>
                <BaseButton v-else-if="!ended" size="sm" variant="outline" :disabled="busy" @click="setEnded(today())">
                  {{ income ? "Il s'est arrêté" : "Je l'ai résilié" }}
                </BaseButton>
                <BaseButton size="sm" variant="ghost" :disabled="busy" @click="decide('refuse')">
                  {{ income ? "Ce n'est pas un revenu récurrent" : "Ce n'est pas récurrent" }}
                </BaseButton>
              </template>
              <!-- A contract that changed hands, an allowance paid by another office:
                   one series, which the detection saw as two. -->
              <div v-if="item.state !== 'refused' && mergeOptions.length" class="w-48">
                <BaseSelect
                  :model-value="undefined"
                  :options="mergeOptions"
                  placeholder="Fusionner avec…"
                  :disabled="busy"
                  :aria-label="`Fusionner ${item.name} avec un autre ${income ? 'revenu' : 'paiement'} récurrent`"
                  @update:model-value="mergeWith"
                />
              </div>
              <BaseButton
                v-if="item.state === 'refused' && item.id"
                size="sm" variant="outline" :disabled="busy"
                @click="act(() => store.remove(item.id!))"
              >
                Annuler le refus
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </li>
</template>

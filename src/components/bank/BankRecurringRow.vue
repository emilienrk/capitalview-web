<script setup lang="ts">
/**
 * One recurring payment in the Récurrent tab: what it costs and when it is due,
 * opened on its history and on what can be said about it.
 */
import { computed, ref, watch } from 'vue'
import { ChevronDown, TrendingDown, TrendingUp } from 'lucide-vue-next'

import { BaseBadge, BaseButton, BaseInput, BaseSelect, BaseSkeleton } from '@/components'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useRecurringStore } from '@/stores/recurring'
import { OPERATION_TYPE_LABELS } from '@/utils/cashflowTypes'
import { CADENCE_LABELS, CADENCE_PER, NATURES, NATURE_LABELS, ROLE_NOTES, isCounted } from '@/utils/recurring'
import type { BankRecurringItem, BankTransactionItem, RecurringDecisionKind, RecurringNature } from '@/types'

const props = defineProps<{ item: BankRecurringItem }>()

const emit = defineEmits<{ failed: [message: string] }>()

const store = useRecurringStore()
const { formatCurrency, formatDate } = useFormatters()
const { maskValue } = usePrivacyMode()

function money(value: number, currency = props.item.currency): string {
  return maskValue(formatCurrency(Number(value), currency))
}

const counted = computed(() => isCounted(props.item))
const ended = computed(() => props.item.status === 'ended')
const lastChange = computed(() => props.item.price_changes[props.item.price_changes.length - 1] ?? null)
const means = computed(() =>
  props.item.payment_method === 'UNKNOWN' ? null : OPERATION_TYPE_LABELS[props.item.payment_method],
)

/** Where it stands, said once beside its name; nothing when it simply runs. */
const statusBadge = computed(() => {
  const item = props.item
  if (item.ended_on) return { variant: 'secondary' as const, text: `Résilié le ${formatDate(item.ended_on)}` }
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

async function toggle(): Promise<void> {
  open.value = !open.value
  if (!open.value || operations.value) return
  loadFailed.value = false
  try {
    operations.value = await store.fetchOperations(props.item)
  } catch {
    loadFailed.value = true
  }
}

function signed(tx: BankTransactionItem): string {
  return money(tx.is_credit ? Number(tx.amount) : -Number(tx.amount), tx.currency)
}

// ── Actions ─────────────────────────────────────────────────

const busy = ref(false)
const renaming = ref(false)
const name = ref('')

/** Whether the write went through: a caller showing what it wrote needs to know. */
async function act(action: () => Promise<unknown>): Promise<boolean> {
  busy.value = true
  try {
    await action()
    return true
  } catch (e) {
    emit('failed', e instanceof Error ? e.message : "Impossible d'enregistrer ce choix.")
    return false
  } finally {
    busy.value = false
  }
}

async function decide(decision: RecurringDecisionKind): Promise<void> {
  await act(() => store.decide(props.item.transaction_id, decision))
}

/** One counted without asking has no decision yet to edit: saying yes makes it. */
async function decisionId(): Promise<string> {
  if (props.item.id) return props.item.id
  const decided = await store.decide(props.item.transaction_id, 'confirm')
  if (!decided?.id) throw new Error("Impossible d'enregistrer ce choix.")
  return decided.id
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
  if (!props.item.id) await act(() => store.decide(props.item.transaction_id, 'confirm', next))
  else await act(async () => store.update(await decisionId(), { name: next }))
}

async function setEnded(endedOn: string | null): Promise<void> {
  await act(async () => store.update(await decisionId(), { ended_on: endedOn }))
}

const natureOptions = NATURES.map((nature) => ({ label: NATURE_LABELS[nature], value: nature }))

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
          <span :class="item.nature ? '' : 'italic'">
            {{ item.nature ? NATURE_LABELS[item.nature] : 'À classer' }}
          </span>
          <span>· <span class="first-letter:uppercase">{{ CADENCE_LABELS[item.cadence] }}</span></span>
          <span v-if="means">· {{ means }}</span>
          <span>· {{ item.accounts.join(', ') }}</span>
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
        <p class="text-sm font-semibold tabular-nums text-text-main dark:text-text-dark-main">
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
      <span class="text-warning font-medium">C'est un paiement récurrent ?</span>
      <button
        type="button" :disabled="busy"
        class="px-3 py-1.5 sm:px-2 sm:py-0.5 rounded-button bg-warning/10 text-warning font-medium hover:bg-warning/20 disabled:opacity-50"
        @click="decide('confirm')"
      >
        Oui
      </button>
      <button
        type="button" :disabled="busy"
        class="px-3 py-1.5 sm:px-2 sm:py-0.5 rounded-button bg-warning/10 text-warning font-medium hover:bg-warning/20 disabled:opacity-50"
        @click="decide('refuse')"
      >
        Non
      </button>
    </div>

    <div v-if="open" class="mt-3 space-y-3 text-xs text-text-muted dark:text-text-dark-muted">
      <p>
        {{ item.since_at_least ? 'Au moins depuis' : 'Depuis' }} le {{ formatDate(item.first_date) }} ·
        {{ item.occurrence_count }} échéance{{ item.occurrence_count > 1 ? 's' : '' }}<template v-if="item.extra_count">
          et {{ item.extra_count }} hors échéance</template> ·
        {{ money(item.paid_last_12_months) }} payés sur 12 mois · ≈ {{ money(item.annual_estimate) }} par an
      </p>
      <p v-if="item.price_changes.length">
        Prix :
        <template v-for="(change, index) in item.price_changes" :key="change.date">
          {{ index ? ', ' : '' }}{{ money(change.before) }} → {{ money(change.after) }} le {{ formatDate(change.date) }}
        </template>
      </p>
      <p v-if="item.episodes.length > 1">
        Interrompu {{ item.episodes.length - 1 }} fois :
        <template v-for="(episode, index) in item.episodes" :key="episode.start">
          {{ index ? ', ' : '' }}{{ formatDate(episode.start) }} → {{ formatDate(episode.end) }}
        </template>
      </p>
      <p v-if="item.renamed.length">
        Anciens noms : {{ item.renamed.map((rename) => rename.before).join(', ') }}
      </p>
      <p v-if="item.refunds.items.length">
        {{ money(item.refunds.total) }} remboursés ({{ item.refunds.items.length }} crédit{{ item.refunds.items.length > 1 ? 's' : '' }})
      </p>

      <ul class="max-h-72 overflow-y-auto rounded-button bg-background-subtle dark:bg-background-dark-subtle divide-y divide-surface-border dark:divide-surface-dark-border">
        <template v-if="operations">
          <li v-for="operation in operations" :key="operation.id" class="flex items-baseline gap-2 px-2.5 py-1.5">
            <span class="shrink-0 tabular-nums">{{ formatDate(operation.operation_date) }}</span>
            <span class="truncate" :title="operation.label ?? undefined">{{ operation.label }}</span>
            <span
              v-if="operation.recurring && ROLE_NOTES[operation.recurring.role]"
              class="shrink-0 text-text-muted/80 dark:text-text-dark-muted/80"
            >
              {{ ROLE_NOTES[operation.recurring.role] }}
            </span>
            <span class="ml-auto shrink-0 font-medium tabular-nums text-text-main dark:text-text-dark-main">
              {{ signed(operation) }}
            </span>
          </li>
        </template>
        <li v-else-if="loadFailed" class="px-2.5 py-1.5 text-danger">Impossible de charger ces opérations.</li>
        <li v-for="n in 3" v-else :key="n" class="px-2.5 py-1.5"><BaseSkeleton variant="text" width="100%" /></li>
      </ul>

      <form v-if="renaming" class="flex items-center gap-2" @submit.prevent="saveName">
        <div class="flex-1"><BaseInput v-model="name" aria-label="Nom du paiement récurrent" /></div>
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
            aria-label="Ce paiement sert à"
            @update:model-value="setNature"
          />
        </div>
        <BaseButton v-if="item.state !== 'refused'" size="sm" variant="outline" :disabled="busy" @click="startRename">
          Renommer
        </BaseButton>
        <template v-if="counted">
          <BaseButton v-if="item.ended_on" size="sm" variant="outline" :disabled="busy" @click="setEnded(null)">
            Pas résilié
          </BaseButton>
          <BaseButton v-else-if="!ended" size="sm" variant="outline" :disabled="busy" @click="setEnded(today())">
            Je l'ai résilié
          </BaseButton>
          <BaseButton size="sm" variant="ghost" :disabled="busy" @click="decide('refuse')">
            Ce n'est pas récurrent
          </BaseButton>
        </template>
        <BaseButton
          v-if="item.state === 'refused' && item.id"
          size="sm" variant="outline" :disabled="busy"
          @click="act(() => store.remove(item.id!))"
        >
          Annuler le refus
        </BaseButton>
      </div>
    </div>
  </li>
</template>

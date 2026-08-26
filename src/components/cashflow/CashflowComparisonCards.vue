<script setup lang="ts">
import { CheckCircle2, CircleSlash, Copy, HelpCircle, TrendingUp } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useCashflowStore } from '@/stores/cashflow'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { BaseAlert, BaseButton, BaseSkeleton } from '@/components'
import type { CashflowComparison } from '@/types'

const cashflow = useCashflowStore()
const { formatCurrency, formatDate } = useFormatters()
const { maskValue } = usePrivacyMode()

const rows = ref<CashflowComparison[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const busyId = ref<string | null>(null)

async function load(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    rows.value = await cashflow.fetchComparison()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Comparaison indisponible.'
  } finally {
    isLoading.value = false
  }
}
void load()

/** Replaces the one row in place: reloading would scroll the user away. */
async function setMatch(row: CashflowComparison, pattern: string | null): Promise<void> {
  busyId.value = row.cashflow_id
  error.value = null
  try {
    const updated = await cashflow.updateMatch(row.cashflow_id, pattern)
    const index = rows.value.findIndex((r) => r.cashflow_id === row.cashflow_id)
    if (index !== -1) rows.value[index] = updated
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Enregistrement impossible.'
  } finally {
    busyId.value = null
  }
}

/** Aligning the declared amount on what is actually being paid. */
async function adoptObserved(row: CashflowComparison): Promise<void> {
  if (row.observed_amount == null) return
  busyId.value = row.cashflow_id
  error.value = null
  try {
    await cashflow.updateCashflow(row.cashflow_id, { amount: row.observed_amount })
    const updated = await cashflow.updateMatch(row.cashflow_id, row.match_pattern)
    const index = rows.value.findIndex((r) => r.cashflow_id === row.cashflow_id)
    if (index !== -1) rows.value[index] = updated
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Mise à jour impossible.'
  } finally {
    busyId.value = null
  }
}

async function deactivate(row: CashflowComparison): Promise<void> {
  busyId.value = row.cashflow_id
  try {
    await cashflow.updateCashflow(row.cashflow_id, { is_active: false })
    rows.value = rows.value.filter((r) => r.cashflow_id !== row.cashflow_id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Désactivation impossible.'
  } finally {
    busyId.value = null
  }
}

const STATUS = {
  drifted: { label: 'Écart', klass: 'text-warning bg-warning/10', icon: TrendingUp },
  missing: { label: 'Ne passe plus', klass: 'text-danger bg-danger/10', icon: CircleSlash },
  duplicated: { label: 'Passé deux fois', klass: 'text-danger bg-danger/10', icon: Copy },
  unmatched: { label: 'À relier', klass: 'text-text-muted bg-surface-border/40', icon: HelpCircle },
  on_track: { label: 'Conforme', klass: 'text-success bg-success/10', icon: CheckCircle2 },
} as const

// Whatever needs a decision first; the conforming ones sink to the bottom.
const ORDER = ['drifted', 'duplicated', 'missing', 'unmatched', 'on_track']
const sorted = computed(() =>
  [...rows.value].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)),
)
const needsAttention = computed(
  () => rows.value.filter((r) => r.status !== 'on_track' && r.status !== 'unmatched').length,
)

function gap(row: CashflowComparison): number | null {
  return row.observed_amount == null ? null : row.observed_amount - row.declared_amount
}
</script>

<template>
  <section class="mt-8">
    <div class="flex items-baseline justify-between gap-3 mb-1">
      <h2 class="text-lg font-semibold text-text-main dark:text-text-dark-main">
        Prévu contre réel
      </h2>
      <span v-if="needsAttention" class="text-sm text-warning">
        {{ needsAttention }} à regarder
      </span>
    </div>
    <p class="text-sm text-text-muted dark:text-text-dark-muted mb-4">
      Chaque flux déclaré, face aux mouvements qui lui correspondent vraiment.
    </p>

    <div v-if="isLoading" class="space-y-3">
      <BaseSkeleton v-for="i in 3" :key="i" variant="rect" height="7rem" />
    </div>

    <BaseAlert v-else-if="error" variant="danger">{{ error }}</BaseAlert>

    <BaseAlert v-else-if="!rows.length" variant="info">
      Aucun flux déclaré à comparer. Créez-en un depuis la vue « Prévu ».
    </BaseAlert>

    <ul v-else class="space-y-3">
      <li
        v-for="row in sorted"
        :key="row.cashflow_id"
        class="rounded-card bg-surface dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border p-4 shadow-soft"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-medium text-text-main dark:text-text-dark-main">{{ row.name }}</p>
            <p class="text-xs text-text-muted dark:text-text-dark-muted">{{ row.category }}</p>
          </div>
          <span
            :class="['inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-secondary shrink-0', STATUS[row.status].klass]"
          >
            <component :is="STATUS[row.status].icon" class="w-3.5 h-3.5" />
            {{ STATUS[row.status].label }}
            <template v-if="row.status === 'drifted' && gap(row) !== null">
              {{ (gap(row) ?? 0) > 0 ? '+' : '' }}{{ maskValue(formatCurrency(gap(row) ?? 0)) }}
            </template>
          </span>
        </div>

        <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt class="text-text-muted dark:text-text-dark-muted">Prévu</dt>
          <dd class="text-right text-text-main dark:text-text-dark-main">
            {{ maskValue(formatCurrency(row.declared_amount)) }}
          </dd>
          <template v-if="row.observed_amount !== null">
            <dt class="text-text-muted dark:text-text-dark-muted">Observé</dt>
            <dd class="text-right text-text-main dark:text-text-dark-main">
              {{ maskValue(formatCurrency(row.observed_amount)) }}
            </dd>
          </template>
        </dl>

        <p v-if="row.recent.length" class="mt-2 text-xs text-text-muted dark:text-text-dark-muted">
          Derniers passages :
          <span v-for="(o, i) in row.recent" :key="o.day">
            <template v-if="i">, </template>{{ maskValue(formatCurrency(o.amount)) }} le {{ formatDate(o.day) }}
          </span>
        </p>
        <p v-else-if="row.last_seen" class="mt-2 text-xs text-text-muted dark:text-text-dark-muted">
          Dernier passage le {{ formatDate(row.last_seen) }}.
        </p>

        <!-- Never linked: the app proposes a shortlist, the user settles it. -->
        <template v-if="row.status === 'unmatched'">
          <p v-if="row.candidates.length" class="mt-3 text-sm text-text-body dark:text-text-dark-body">
            À quoi correspond ce flux ?
          </p>
          <p v-else class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">
            Aucun mouvement récurrent ne ressemble à ce flux pour l'instant.
          </p>
          <ul v-if="row.candidates.length" class="mt-2 space-y-1.5">
            <li v-for="c in row.candidates" :key="c.pattern">
              <button
                type="button"
                :disabled="busyId === row.cashflow_id"
                class="w-full flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-left px-3 py-2 rounded-card border border-surface-border dark:border-surface-dark-border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                @click="setMatch(row, c.pattern)"
              >
                <span class="font-mono text-xs text-text-main dark:text-text-dark-main">{{ c.pattern }}</span>
                <span class="text-xs text-text-muted dark:text-text-dark-muted">
                  {{ maskValue(formatCurrency(c.observed_amount)) }} · {{ c.occurrences }} fois · dernier le {{ formatDate(c.last_seen) }}
                </span>
              </button>
            </li>
          </ul>
        </template>

        <div v-else class="mt-3 flex flex-wrap items-center gap-2">
          <BaseButton
            v-if="row.status === 'drifted'"
            size="sm"
            :loading="busyId === row.cashflow_id"
            @click="adoptObserved(row)"
          >
            Mettre le prévu à {{ maskValue(formatCurrency(row.observed_amount ?? 0)) }}
          </BaseButton>
          <BaseButton
            v-if="row.status === 'missing'"
            size="sm"
            variant="outline"
            :loading="busyId === row.cashflow_id"
            @click="deactivate(row)"
          >
            Désactiver ce flux
          </BaseButton>
          <span v-if="row.status === 'duplicated'" class="text-xs text-text-muted dark:text-text-dark-muted">
            Deux passages ce mois-ci — à vérifier auprès de votre banque.
          </span>
          <BaseButton
            size="sm"
            variant="ghost"
            :loading="busyId === row.cashflow_id"
            @click="setMatch(row, null)"
          >
            Ce n'est pas ça
          </BaseButton>
        </div>
      </li>
    </ul>
  </section>
</template>

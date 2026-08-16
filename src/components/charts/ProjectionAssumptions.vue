<script setup lang="ts">
/**
 * The assumptions a projection rests on, shown and editable.
 *
 * A curve without them reads as a prediction. The API measures both figures
 * from the account's own history — contributions from real deposits, return
 * from the annualised time-weighted return — so what is displayed here is what
 * was actually used, and editing a field asks for the same curve under a
 * different premise rather than correcting an error.
 */
import { AlertTriangle, SlidersHorizontal } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { BaseButton, BaseInput, BaseModal, BaseTooltip } from '@/components'
import {
  PROJECTION_ROWS,
  draftsToAssets,
  isDirty as draftsDiffer,
  basisLabel,
  measuredDrafts,
  shortWarningLabel,
  warningLabel,
  type AssumptionDrafts,
} from '@/utils/projectionAssumptions'
import type {
  ProjectionAssetParameters,
  ProjectionCategory,
  ProjectionResponse,
} from '@/types'

const props = defineProps<{
  parametersUsed: ProjectionResponse['parameters_used'] | null
  /** Categories the current chart shows — the others would be noise here. */
  categories?: ProjectionCategory[]
  loading?: boolean
}>()

const emit = defineEmits<{
  apply: [assets: Partial<Record<ProjectionCategory, ProjectionAssetParameters>>]
  reset: []
}>()

const isOpen = ref(false)
const draft = ref<AssumptionDrafts>(measuredDrafts(props.parametersUsed))

/**
 * Whether the user has edited anything.
 *
 * Tracked rather than inferred from a value comparison: the form is built
 * before the projection has loaded, so its zeros differ from the measurement
 * that arrives a moment later. Reading that difference as "the user typed
 * something" is what left every field showing 0.
 */
const touched = ref(false)

const measured = computed(() => measuredDrafts(props.parametersUsed))
const isDirty = computed(() => draftsDiffer(draft.value, measured.value))

// Adopt fresh figures until the user takes over, so a recalculation — or the
// first load — fills the form without wiping what they were typing.
watch(
  measured,
  (next) => {
    if (!touched.value) draft.value = structuredClone(next)
  },
  { immediate: true, deep: true },
)

/**
 * Rows paired with their editable values, so the template needs no fallback.
 *
 * Filtered to the chart being shown, but the draft keeps all three: a figure
 * set on the crypto slide must survive a trip through the stock one.
 */
const editableRows = computed(() =>
  PROJECTION_ROWS.filter((row) => !props.categories || props.categories.includes(row.key)).flatMap(
    (row) => {
      const values = draft.value[row.key]
      if (!values) return []
      const basis = props.parametersUsed?.assets?.[row.key]?.basis ?? null
      const warnings = (basis?.warnings ?? []).filter((w) => w.code !== 'not_measured')
      return [
        {
          ...row,
          values,
          warnings,
          provenance: basisLabel(basis),
        },
      ]
    },
  ),
)

/** Any reservation at all, on any pocket shown — what the closed button signals. */
const hasWarnings = computed(() => editableRows.value.some((row) => row.warnings.length > 0))

function apply(): void {
  emit('apply', draftsToAssets(draft.value, measured.value))
  isOpen.value = false
}

function restore(): void {
  draft.value = structuredClone(measured.value)
  touched.value = false
  emit('reset')
}
</script>

<template>
  <!-- Icon only, and it lives in the card header: the form is a detour from
       reading the chart, not part of it. -->
  <BaseTooltip align="left">
    <template #trigger>
      <button
        type="button"
        class="relative flex h-8 w-8 items-center justify-center rounded-button text-text-muted transition-colors hover:bg-surface-hover hover:text-text-main dark:text-text-dark-muted dark:hover:bg-surface-dark-hover dark:hover:text-text-dark-main"
        aria-label="Paramétrage de la projection"
        @click="isOpen = true"
      >
        <SlidersHorizontal class="h-4 w-4" />
        <!-- A closed panel would otherwise hide the reason a curve is flat. -->
        <span
          v-if="hasWarnings"
          class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-warning"
        />
      </button>
    </template>
    {{ hasWarnings ? 'Paramétrage — une hypothèse mérite une réserve' : 'Paramétrage de la projection' }}
  </BaseTooltip>

  <BaseModal :open="isOpen" title="Paramétrage de la projection" @close="isOpen = false">
    <div class="space-y-3">
      <!-- Units belong in the header: a placeholder disappears as soon as the
           field is filled, which is exactly when the two columns stop being
           distinguishable. -->
      <div
        class="grid grid-cols-[5rem_1fr_1fr] gap-2 text-xs text-text-muted dark:text-text-dark-muted"
      >
        <span aria-hidden="true"></span>
        <span>Versement (€/mois)</span>
        <span>Rendement (%/an)</span>
      </div>

      <div v-for="row in editableRows" :key="row.key" class="space-y-1">
        <div class="grid grid-cols-[5rem_1fr_1fr] items-center gap-2">
          <span class="text-sm text-text-muted dark:text-text-dark-muted">{{ row.label }}</span>
          <BaseInput
            :id="`projection-monthly-${row.key}`"
            v-model="row.values.monthly"
            type="number"
            @update:model-value="touched = true"
            :aria-label="`Versement mensuel ${row.label} en euros`"
            placeholder="€/mois"
          />
          <BaseInput
            :id="`projection-rate-${row.key}`"
            v-model="row.values.rate"
            type="number"
            @update:model-value="touched = true"
            :aria-label="`Rendement annuel ${row.label} en pourcent`"
            placeholder="%/an"
          />
        </div>

        <!-- One slot, two states: a reservation hides its sentence behind an
             icon to keep the row short, and where there is none the provenance
             takes the space instead. Never both, never nothing. -->
        <div class="pl-[5.5rem] text-xs text-text-muted dark:text-text-dark-muted">
          <BaseTooltip v-if="row.warnings.length" align="left">
            <template #trigger>
              <span class="inline-flex items-center gap-1 text-warning">
                <AlertTriangle class="w-3.5 h-3.5" />
                {{ shortWarningLabel(row.warnings) }}
              </span>
            </template>
            <span v-for="(warning, index) in row.warnings" :key="index" class="block">
              {{ warningLabel(warning) }}
            </span>
          </BaseTooltip>
          <span v-else-if="row.provenance">{{ row.provenance }}</span>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2">
        <BaseButton
          v-if="isDirty"
          variant="outline"
          size="sm"
          :disabled="loading"
          @click="restore"
        >
          Valeurs mesurées
        </BaseButton>
        <BaseButton size="sm" :disabled="loading || !isDirty" @click="apply">
          Recalculer
        </BaseButton>
      </div>
    </div>
  </BaseModal>
</template>

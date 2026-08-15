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
import { computed, ref, watch } from 'vue'
import { BaseButton, BaseInput } from '@/components'
import {
  PROJECTION_ROWS,
  draftsToAssets,
  isDirty as draftsDiffer,
  measuredDrafts,
  type AssumptionDrafts,
} from '@/utils/projectionAssumptions'
import type {
  ProjectionAssetParameters,
  ProjectionCategory,
  ProjectionResponse,
} from '@/types'

const props = defineProps<{
  parametersUsed: ProjectionResponse['parameters_used'] | null
  loading?: boolean
}>()

const emit = defineEmits<{
  apply: [assets: Partial<Record<ProjectionCategory, ProjectionAssetParameters>>]
  reset: []
}>()

const isOpen = ref(false)
const draft = ref<AssumptionDrafts>(measuredDrafts(props.parametersUsed))

const measured = computed(() => measuredDrafts(props.parametersUsed))
const isDirty = computed(() => draftsDiffer(draft.value, measured.value))

// Only adopt fresh figures the user has not started editing, so a recalculation
// landing mid-edit does not wipe what they were typing.
watch(measured, (next) => {
  if (!isDirty.value) draft.value = structuredClone(next)
})

/** Rows paired with their editable values, so the template needs no fallback. */
const editableRows = computed(() =>
  PROJECTION_ROWS.flatMap((row) => {
    const values = draft.value[row.key]
    return values ? [{ ...row, values }] : []
  }),
)

function apply(): void {
  emit('apply', draftsToAssets(draft.value))
}

function restore(): void {
  draft.value = structuredClone(measured.value)
  emit('reset')
}
</script>

<template>
  <div class="border-t border-surface-border dark:border-surface-dark-border pt-3 mt-3">
    <button
      type="button"
      class="flex w-full items-center justify-between text-sm font-medium text-text-main dark:text-text-dark-main"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <span>Hypothèses</span>
      <span class="text-text-muted dark:text-text-dark-muted">{{ isOpen ? '▴' : '▾' }}</span>
    </button>

    <p v-if="!isOpen" class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">
      Versements et rendements déduits de votre historique — modifiables.
    </p>

    <div v-else class="mt-3 space-y-3">
      <div
        v-for="row in editableRows"
        :key="row.key"
        class="grid grid-cols-[5rem_1fr_1fr] items-center gap-2"
      >
        <span class="text-sm text-text-muted dark:text-text-dark-muted">{{ row.label }}</span>
        <BaseInput
          :id="`projection-monthly-${row.key}`"
          v-model="row.values.monthly"
          type="number"
          :aria-label="`Versement mensuel ${row.label} en euros`"
          placeholder="€/mois"
        />
        <BaseInput
          :id="`projection-rate-${row.key}`"
          v-model="row.values.rate"
          type="number"
          :aria-label="`Rendement annuel ${row.label} en pourcent`"
          placeholder="%/an"
        />
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BaseSelect } from '@/components'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{ current: string }>()
const emit = defineEmits<{ changed: [] }>()

const settingsStore = useSettingsStore()
const isSaving = ref(false)

/**
 * Accumulating ETFs only. This is a correctness constraint, not a taste: a
 * distributing share class pays dividends out, so its quoted price is not a
 * total-return series and every comparison against it would understate the
 * index. The app stores no per-asset dividend history to correct for it.
 */
const BENCHMARKS = [
  { value: 'IE00B4L5Y983', label: 'MSCI World — iShares Core (IWDA, Acc)' },
  { value: 'IE00BK5BQT80', label: 'FTSE All-World — Vanguard (VWCE, Acc)' },
  { value: 'IE00B5BMR087', label: 'S&P 500 — iShares Core (CSPX, Acc)' },
  { value: 'IE00BKM4GZ66', label: 'MSCI Emerging Markets — iShares Core (EIMI, Acc)' },
  { value: 'LU1681043599', label: 'MSCI Europe — Amundi (Acc)' },
]

const selected = ref(props.current)

watch(
  () => props.current,
  (value) => {
    selected.value = value
  },
)

const options = computed(() => {
  const known = BENCHMARKS.map((b) => ({ value: b.value, label: b.label }))
  // A benchmark set elsewhere must stay visible rather than silently snap back.
  if (selected.value && !known.some((o) => o.value === selected.value)) {
    known.push({ value: selected.value, label: `${selected.value} (personnalisé)` })
  }
  return known
})

const isCustom = computed(() => !BENCHMARKS.some((b) => b.value === selected.value))

async function onChange(value: string | number | undefined): Promise<void> {
  const key = String(value ?? '')
  if (!key || key === props.current) return

  isSaving.value = true
  const ok = await settingsStore.updateSettings({ benchmark_asset_key: key })
  isSaving.value = false
  if (ok) emit('changed')
}
</script>

<template>
  <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
    <div class="w-full sm:max-w-md">
      <BaseSelect
        id="benchmark"
        label="Comparé à"
        :model-value="selected"
        :options="options"
        :disabled="isSaving"
        @update:model-value="onChange"
      />
    </div>
    <p
      v-if="isCustom"
      class="text-xs text-warning"
    >
      Indice personnalisé : vérifie qu'il est capitalisant et qu'il couvre tout ton historique,
      sinon les comparaisons seront fausses ou tronquées.
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * The index everything on /analyse is compared against.
 *
 * Two ways in. The curated list is the answer for almost everyone; below it,
 * the same picker the plan uses, over the lines actually traded — because a
 * benchmark that is not in the list is usually one already held, and asking for
 * an ISIN was asking the one question nobody can answer from memory.
 */
import { computed, ref, watch } from 'vue'
import { BaseSelect } from '@/components'
import AssetKeyPicker from '@/components/analytics/AssetKeyPicker.vue'
import { useSettingsStore } from '@/stores/settings'
import type { AnalysedAsset } from '@/types'

const props = withDefaults(
  defineProps<{ current: string; assets?: AnalysedAsset[] }>(),
  { assets: () => [] },
)
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

/** A benchmark set elsewhere must stay visible rather than silently snap back. */
const options = computed(() => {
  const known = BENCHMARKS.map((b) => ({ value: b.value, label: b.label }))
  if (selected.value && !known.some((o) => o.value === selected.value)) {
    const traded = props.assets.find(
      (asset) => asset.asset_key.toUpperCase() === selected.value.toUpperCase(),
    )
    known.push({
      value: selected.value,
      label: traded ? `${traded.name} (personnalisé)` : `${selected.value} (personnalisé)`,
    })
  }
  return known
})

const isCustom = computed(() => !BENCHMARKS.some((b) => b.value === selected.value))

async function apply(key: string): Promise<void> {
  if (!key || key === props.current) return

  isSaving.value = true
  const ok = await settingsStore.updateSettings({ benchmark_asset_key: key })
  isSaving.value = false
  if (ok) emit('changed')
}

async function onChange(value: string | number | undefined): Promise<void> {
  await apply(String(value ?? ''))
}

const customKey = ref('')
const showCustom = ref(false)

async function onCustomPicked(key: string): Promise<void> {
  customKey.value = key
  if (!key) return
  selected.value = key
  await apply(key)
  customKey.value = ''
  showCustom.value = false
}
</script>

<template>
  <div>
    <div class="flex flex-col gap-2">
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
      <p v-if="isCustom" class="text-xs text-warning">
        Indice personnalisé : vérifiez qu'il est capitalisant et qu'il couvre tout votre historique,
        sinon les comparaisons seront fausses ou tronquées.
      </p>
    </div>

    <div class="mt-3">
      <button
        v-if="!showCustom"
        type="button"
        class="text-xs font-medium text-primary underline-offset-2 hover:underline"
        @click="showCustom = true"
      >
        Utiliser un autre indice
      </button>

      <div v-else class="flex flex-col gap-2">
        <div class="w-full sm:max-w-md">
          <AssetKeyPicker
            id="custom-benchmark"
            :model-value="customKey"
            :assets="assets"
            label="Indice de référence"
            :disabled="isSaving"
            @update:model-value="onCustomPicked"
          />
        </div>
        <p class="text-xs text-warning">
          Deux risques à vérifier vous-même : un ETF <strong>distribuant</strong> donnerait des
          comparaisons fausses (son cours n'inclut pas les dividendes versés), et un ETF lancé
          après votre premier achat tronquerait la comparaison — dans ce cas la page indique à
          partir de quand elle démarre.
        </p>
        <button
          type="button"
          class="self-start text-xs text-text-muted underline dark:text-text-dark-muted"
          @click="showCustom = false"
        >
          Annuler
        </button>
      </div>
    </div>
  </div>
</template>

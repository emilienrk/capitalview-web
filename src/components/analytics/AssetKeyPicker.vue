<script setup lang="ts">
/**
 * Pick a line by its name. The ISIN is what gets stored, never what gets typed.
 *
 * The analysis settings used to ask for an ISIN outright. That is the wrong
 * question: nobody recognises IE00B4L5Y983, and getting it wrong fails in
 * silence — the plan scores an allocation against a line the portfolio does not
 * contain, and nothing on the page says so. Here the choice comes from what has
 * actually been traded, held or sold, and the key stays visible underneath as
 * confirmation rather than as the input.
 *
 * Free entry survives, one click away. A plan is a statement about the future
 * and may legitimately name a line never bought yet — but that is the rare case,
 * so it is the one that costs the extra click.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { Check, ChevronDown, Search, X } from 'lucide-vue-next'
import type { AnalysedAsset } from '@/types'

const props = withDefaults(
  defineProps<{
    modelValue: string
    assets: AnalysedAsset[]
    id?: string
    label?: string
    disabled?: boolean
  }>(),
  { id: undefined, label: '', disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const isOpen = ref(false)
const query = ref('')
const isFreeEntry = ref(false)
const searchRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)

const byKey = computed(
  () => new Map(props.assets.map((asset) => [asset.asset_key.toUpperCase(), asset])),
)
const selected = computed(() => byKey.value.get(props.modelValue.toUpperCase()) ?? null)

/** Search on the name, the ticker and the key at once — all three identify a line. */
const matches = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return props.assets
  return props.assets.filter((asset) =>
    [asset.name, asset.symbol, asset.asset_key].some((field) =>
      String(field).toLowerCase().includes(needle),
    ),
  )
})

function open(): void {
  if (props.disabled) return
  isOpen.value = true
  query.value = ''
  nextTick(() => searchRef.value?.focus())
}

function choose(assetKey: string): void {
  emit('update:modelValue', assetKey.toUpperCase())
  isOpen.value = false
  isFreeEntry.value = false
}

function onFreeEntry(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value.toUpperCase())
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    isOpen.value = false
    return
  }
  // Enter on a search that narrowed to one line picks it: typing three letters
  // of a fund name and confirming is the whole interaction.
  if (event.key === 'Enter' && matches.value.length >= 1) {
    event.preventDefault()
    const first = matches.value[0]
    if (first) choose(first.asset_key)
  }
}

/** A click anywhere else closes the list; the field keeps whatever was chosen. */
function onFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget as Node | null
  if (next && rootRef.value?.contains(next)) return
  isOpen.value = false
}

watch(
  () => props.assets.length,
  () => {
    // A key already stored that turns out to be unknown is left in free entry
    // rather than blanked: it is the user's data, not ours to discard.
    if (props.modelValue && !selected.value) isFreeEntry.value = true
  },
  { immediate: true },
)
</script>

<template>
  <div ref="rootRef" class="relative" @focusout="onFocusOut">
    <label
      v-if="label"
      :for="id"
      class="mb-1.5 block text-sm font-medium text-text-main dark:text-text-dark-main"
    >
      {{ label }}
    </label>

    <!-- Free entry: the escape hatch for a line never traded, plainly marked. -->
    <div v-if="isFreeEntry" class="flex items-center gap-2">
      <input
        :id="id"
        :value="modelValue"
        :disabled="disabled"
        type="text"
        placeholder="IE00B4L5Y983"
        autocomplete="off"
        spellcheck="false"
        class="w-full rounded-input border border-surface-border bg-surface px-4 py-2.5 font-mono text-sm uppercase text-text-main transition-all duration-150 placeholder:font-sans placeholder:normal-case placeholder:text-text-muted/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:border-surface-dark-border dark:bg-surface-dark dark:text-text-dark-main"
        @input="onFreeEntry"
      />
      <button
        v-if="assets.length"
        type="button"
        class="shrink-0 rounded-button p-2.5 text-text-muted transition-colors hover:bg-surface-active hover:text-text-main dark:text-text-dark-muted dark:hover:bg-surface-dark-hover dark:hover:text-text-dark-main"
        title="Choisir dans mes lignes"
        @click="isFreeEntry = false"
      >
        <Search class="h-4 w-4" stroke-width="2" />
      </button>
    </div>

    <template v-else>
      <button
        :id="id"
        type="button"
        :disabled="disabled"
        class="flex w-full items-center gap-2 rounded-input border border-surface-border bg-surface px-4 py-2.5 text-left transition-all duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:border-surface-dark-border dark:bg-surface-dark"
        @click="isOpen ? (isOpen = false) : open()"
      >
        <span class="min-w-0 flex-1">
          <!-- The name is the answer; the key is the receipt underneath it. -->
          <span
            v-if="selected"
            class="block truncate text-sm text-text-main dark:text-text-dark-main"
          >
            {{ selected.name }}
          </span>
          <span v-else-if="modelValue" class="block truncate font-mono text-sm text-text-main dark:text-text-dark-main">
            {{ modelValue }}
          </span>
          <span v-else class="block truncate text-sm text-text-muted dark:text-text-dark-muted">
            Choisir une ligne…
          </span>
          <span
            v-if="selected"
            class="mt-0.5 block truncate font-mono text-[11px] text-text-muted dark:text-text-dark-muted"
          >
            {{ selected.symbol }} · {{ selected.asset_key }}
          </span>
        </span>
        <ChevronDown
          class="h-4 w-4 shrink-0 text-text-muted transition-transform dark:text-text-dark-muted"
          :class="isOpen ? 'rotate-180' : ''"
          stroke-width="2"
        />
      </button>

      <div
        v-if="isOpen"
        class="absolute z-30 mt-1 w-full overflow-hidden rounded-card border border-surface-border bg-surface shadow-lg dark:border-surface-dark-border dark:bg-surface-dark"
      >
        <div class="border-b border-surface-border p-2 dark:border-surface-dark-border">
          <div class="relative">
            <Search
              class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-text-muted dark:text-text-dark-muted"
              stroke-width="2"
            />
            <input
              ref="searchRef"
              v-model="query"
              type="text"
              placeholder="Nom, ticker ou ISIN…"
              autocomplete="off"
              class="w-full rounded-input border border-surface-border bg-background-subtle py-2 pl-8 pr-2 text-sm text-text-main focus:border-primary focus:outline-none dark:border-surface-dark-border dark:bg-background-dark-subtle dark:text-text-dark-main"
              @keydown="onKeydown"
            />
          </div>
        </div>

        <ul v-if="matches.length" class="max-h-64 overflow-y-auto py-1">
          <li v-for="asset in matches" :key="asset.asset_key">
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-active dark:hover:bg-surface-dark-hover"
              @click="choose(asset.asset_key)"
            >
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1.5">
                  <span class="truncate text-sm text-text-main dark:text-text-dark-main">
                    {{ asset.name }}
                  </span>
                  <!-- A line sold to zero stays offered: a plan may name what is
                       being wound down. It just says so. -->
                  <span
                    v-if="!asset.held"
                    class="shrink-0 rounded-full bg-background-subtle px-1.5 py-0.5 text-[10px] text-text-muted dark:bg-background-dark-subtle dark:text-text-dark-muted"
                  >
                    vendue
                  </span>
                </span>
                <span
                  class="mt-0.5 block truncate font-mono text-[11px] text-text-muted dark:text-text-dark-muted"
                >
                  {{ asset.symbol }} · {{ asset.asset_key }}
                </span>
              </span>
              <Check
                v-if="asset.asset_key.toUpperCase() === modelValue.toUpperCase()"
                class="h-4 w-4 shrink-0 text-primary"
                stroke-width="2"
              />
            </button>
          </li>
        </ul>

        <p v-else class="px-3 py-4 text-center text-xs text-text-muted dark:text-text-dark-muted">
          {{ assets.length ? 'Aucune ligne ne correspond.' : "Tu n'as encore acheté aucune ligne." }}
        </p>

        <div class="border-t border-surface-border p-2 dark:border-surface-dark-border">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-button px-2 py-1.5 text-left text-xs text-text-muted transition-colors hover:bg-surface-active hover:text-text-main dark:text-text-dark-muted dark:hover:bg-surface-dark-hover dark:hover:text-text-dark-main"
            @click="
              () => {
                isFreeEntry = true
                isOpen = false
              }
            "
          >
            <X class="h-3.5 w-3.5 shrink-0" stroke-width="2" />
            Saisir un ISIN que je ne détiens pas encore
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

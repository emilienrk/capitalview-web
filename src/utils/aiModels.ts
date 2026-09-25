import type { SelectOption } from '@/components/base/BaseSelect.vue'
import type { AIModelOption } from '@/types'

/** Stands for selected_model = null in the select, which has no null value. */
export const AUTO_MODEL = '__auto__'

/**
 * The model select's options: "automatic" first, naming what it calls, then
 * the models the key reaches, narrowed by `filter`. The chosen model always
 * stays listed, and one the key no longer reaches says so rather than leaving
 * the select blank.
 */
export function modelSelectOptions(
  models: AIModelOption[],
  recommended: string | null,
  selected: string | null,
  { filter = '', flagTextOnly = false }: { filter?: string; flagTextOnly?: boolean } = {},
): SelectOption[] {
  const byId = new Map(models.map((model) => [model.id, model]))
  const recommendedLabel = recommended ? (byId.get(recommended)?.label ?? recommended) : null
  const options: SelectOption[] = [
    {
      value: AUTO_MODEL,
      label: recommendedLabel ? `Automatique — ${recommendedLabel}` : 'Automatique',
    },
  ]

  const query = filter.trim().toLowerCase()
  for (const model of models) {
    const matches =
      !query || model.label.toLowerCase().includes(query) || model.id.toLowerCase().includes(query)
    if (!matches && model.id !== selected) continue
    options.push({
      value: model.id,
      label: `${model.label}${flagTextOnly && !model.vision ? ' (sans images)' : ''}`,
    })
  }

  if (selected && !byId.has(selected)) {
    options.push({ value: selected, label: `${selected} (introuvable avec cette clé)` })
  }
  return options
}

/**
 * Whether the model a provider will call reads images: the chosen one, or the
 * one "automatic" stands for. Null while the list is unknown.
 */
export function callsAModelThatReadsImages(
  models: AIModelOption[],
  recommended: string | null,
  selected: string | null,
): boolean | null {
  const id = selected ?? recommended
  const model = models.find((candidate) => candidate.id === id)
  return model ? model.vision : null
}

import type { SelectOption } from '@/components/base/BaseSelect.vue'
import type { AIModelOption } from '@/types'

/** Stands for selected_model = null in the select, which has no null value. */
export const AUTO_MODEL = '__auto__'

/**
 * The model select's options: "automatic" first, naming what it calls, then
 * the models the key reaches, narrowed by `filter`. `visionOnly` keeps to the
 * models that read images, for the photo import's select. The chosen model
 * always stays listed, and one the key no longer reaches says so rather than
 * leaving the select blank.
 */
export function modelSelectOptions(
  models: AIModelOption[],
  recommended: string | null,
  selected: string | null,
  { filter = '', visionOnly = false }: { filter?: string; visionOnly?: boolean } = {},
): SelectOption[] {
  const byId = new Map(models.map((model) => [model.id, model]))
  const recommendedLabel = recommended ? (byId.get(recommended)?.label ?? recommended) : null
  const options: SelectOption[] = [
    {
      value: AUTO_MODEL,
      label: recommendedLabel
        ? `Automatique — ${recommendedLabel}`
        : visionOnly ? 'Automatique — aucun modèle ne lit les images' : 'Automatique',
    },
  ]

  const query = filter.trim().toLowerCase()
  for (const model of models) {
    if (visionOnly && !model.vision && model.id !== selected) continue
    const matches =
      !query || model.label.toLowerCase().includes(query) || model.id.toLowerCase().includes(query)
    if (!matches && model.id !== selected) continue
    options.push({
      value: model.id,
      label: `${model.label}${visionOnly && !model.vision ? ' (sans images)' : ''}`,
    })
  }

  if (selected && !byId.has(selected)) {
    options.push({ value: selected, label: `${selected} (introuvable avec cette clé)` })
  }
  return options
}

/**
 * Whether the model a provider calls for the photo import reads images: the
 * chosen one, or the one "automatic" stands for there (none when the key
 * reaches no model that reads images). Null for a model missing from the list.
 */
export function callsAModelThatReadsImages(
  models: AIModelOption[],
  recommendedVision: string | null,
  selectedVision: string | null,
): boolean | null {
  const id = selectedVision ?? recommendedVision
  if (id === null) return false
  const model = models.find((candidate) => candidate.id === id)
  return model ? model.vision : null
}

import { describe, expect, it } from 'vitest'
import { AUTO_MODEL, callsAModelThatReadsImages, modelSelectOptions } from '../aiModels'

const models = [
  { id: 'google/gemini-3.5-flash', label: 'Google: Gemini 3.5 Flash', vision: true },
  { id: 'qwen/qwen3-max', label: 'Qwen: Qwen3 Max', vision: false },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Anthropic: Claude Sonnet 4.6', vision: true },
]

describe('modelSelectOptions', () => {
  it('puts automatic first, naming the model it calls', () => {
    const options = modelSelectOptions(models, 'google/gemini-3.5-flash', null)

    expect(options[0]).toEqual({ value: AUTO_MODEL, label: 'Automatique — Google: Gemini 3.5 Flash' })
    expect(options.map((o) => o.value).slice(1)).toEqual(models.map((m) => m.id))
  })

  it('says plainly automatic when nothing is recommended', () => {
    expect(modelSelectOptions([], null, null)).toEqual([{ value: AUTO_MODEL, label: 'Automatique' }])
  })

  it('narrows by label or id, keeping the chosen model', () => {
    const options = modelSelectOptions(models, null, 'qwen/qwen3-max', { filter: 'claude' })

    expect(options.map((o) => o.value)).toEqual([
      AUTO_MODEL,
      'qwen/qwen3-max',
      'anthropic/claude-sonnet-4.6',
    ])
  })

  it('flags models that read no images when asked', () => {
    const options = modelSelectOptions(models, null, null, { flagTextOnly: true })

    expect(options.find((o) => o.value === 'qwen/qwen3-max')?.label).toBe('Qwen: Qwen3 Max (sans images)')
    expect(options.find((o) => o.value === 'google/gemini-3.5-flash')?.label).toBe('Google: Gemini 3.5 Flash')
  })

  it('keeps a chosen model the key no longer reaches, flagged', () => {
    const options = modelSelectOptions(models, null, 'gemini-1.5-pro')

    expect(options.at(-1)).toEqual({
      value: 'gemini-1.5-pro',
      label: 'gemini-1.5-pro (introuvable avec cette clé)',
    })
  })
})

describe('callsAModelThatReadsImages', () => {
  it('reads the chosen model, else the recommended one', () => {
    expect(callsAModelThatReadsImages(models, 'google/gemini-3.5-flash', 'qwen/qwen3-max')).toBe(false)
    expect(callsAModelThatReadsImages(models, 'google/gemini-3.5-flash', null)).toBe(true)
  })

  it('does not know a model missing from the list', () => {
    expect(callsAModelThatReadsImages(models, null, 'gone/model')).toBeNull()
  })
})

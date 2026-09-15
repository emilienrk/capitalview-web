import { computed, ref } from 'vue'

import { categoryAssignment } from '@/utils/bankCategories'
import type { BankCategoryAssign } from '@/types'

/**
 * The picker's choices, apart from its markup: which category, whether the
 * operations like this one follow, and which words the rule requires.
 */
export function useCategoryPicker() {
  const categoryId = ref<string | null>(null)
  /** On by default: correcting one operation is nearly always about all of its kind. */
  const applyToSimilar = ref(true)
  const words = ref<string[]>([])
  const selectedWords = ref<Set<string>>(new Set())

  function reset(): void {
    categoryId.value = null
    applyToSimilar.value = true
    words.value = []
    selectedWords.value = new Set()
  }

  /** The label's words, rarest first, with the proposed ones selected. */
  function setWords(all: string[], proposed: string[]): void {
    words.value = all
    selectedWords.value = new Set(proposed)
  }

  function toggleWord(word: string): void {
    const next = new Set(selectedWords.value)
    if (next.has(word)) next.delete(word)
    else next.add(word)
    selectedWords.value = next
  }

  const tokens = computed(() => words.value.filter((word) => selectedWords.value.has(word)))

  function payload(): BankCategoryAssign {
    return categoryAssignment(categoryId.value, applyToSimilar.value, tokens.value)
  }

  return { categoryId, applyToSimilar, words, selectedWords, tokens, reset, setWords, toggleWord, payload }
}

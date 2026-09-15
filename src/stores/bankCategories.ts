import { defineStore } from 'pinia'
import { ref } from 'vue'

import { apiClient } from '@/api/client'
import { invalidateCachePrefix } from '@/services/cache'
import { useBankStore } from '@/stores/bank'
import type {
  AvailableCategory,
  BankAICategorizeResult,
  BankCategory,
  BankCategoryAssign,
  BankCategoryAssignResult,
  BankCategoryRule,
  BankRuleWords,
  BankUncategorizedResponse,
  CategoryNature,
  CategoryScope,
} from '@/types'

/** Where a run of AI categorisation stands, batch after batch. */
export interface AiRunProgress {
  running: boolean
  batches: number
  processed: number
  rulesCreated: number
  categoriesCreated: number
  remaining: number | null
  error: string | null
}

const QUEUE_LIMIT = 100

function idleProgress(): AiRunProgress {
  return { running: false, batches: 0, processed: 0, rulesCreated: 0, categoriesCreated: 0, remaining: null, error: null }
}

export const useBankCategoriesStore = defineStore('bankCategories', () => {
  const bank = useBankStore()

  const categories = ref<BankCategory[]>([])
  const rules = ref<BankCategoryRule[]>([])
  const available = ref<AvailableCategory[]>([])
  const queue = ref<BankUncategorizedResponse | null>(null)
  const queueLoading = ref(false)
  const aiProgress = ref<AiRunProgress>(idleProgress())
  let aiStopRequested = false

  async function fetchCategories(): Promise<void> {
    categories.value = await apiClient.get<BankCategory[]>('/banking/categories')
  }

  async function fetchRules(): Promise<void> {
    rules.value = await apiClient.get<BankCategoryRule[]>('/banking/category-rules')
  }

  async function fetchAvailable(scope: CategoryScope = 'bank'): Promise<AvailableCategory[]> {
    const offered = await apiClient.get<AvailableCategory[]>(`/banking/categories/available?scope=${scope}`)
    if (scope === 'bank') available.value = offered
    return offered
  }

  async function fetchQueue(): Promise<void> {
    queueLoading.value = true
    try {
      queue.value = await apiClient.get<BankUncategorizedResponse>(`/banking/uncategorized?limit=${QUEUE_LIMIT}`)
    } finally {
      queueLoading.value = false
    }
  }

  async function fetchRuleWords(transactionId: string): Promise<BankRuleWords> {
    return apiClient.get<BankRuleWords>(`/banking/transactions/${encodeURIComponent(transactionId)}/rule-tokens`)
  }

  /**
   * Every filing moves what the observed flows and the month's operations show:
   * their cache goes, and the Banque tabs listening to `dataRevision` reload.
   */
  function afterWrite(): void {
    invalidateCachePrefix('bank:flows:')
    bank.dataRevision += 1
  }

  async function createCategory(name: string, nature: CategoryNature): Promise<BankCategory> {
    const category = await apiClient.post<BankCategory>('/banking/categories', { name, nature })
    void fetchCategories()
    return category
  }

  /** A declared cashflow's category, turned into a Banque category the first time it is picked. */
  async function materializeCashflowCategory(name: string): Promise<BankCategory> {
    const category = await apiClient.post<BankCategory>('/banking/categories', { name, from_cashflow: true })
    void fetchCategories()
    return category
  }

  async function updateCategory(id: string, changes: { name?: string; nature?: CategoryNature }): Promise<void> {
    await apiClient.patch<BankCategory>(`/banking/categories/${encodeURIComponent(id)}`, changes)
    await fetchCategories()
    afterWrite()
  }

  async function deleteCategory(id: string): Promise<void> {
    await apiClient.delete(`/banking/categories/${encodeURIComponent(id)}`)
    await Promise.all([fetchCategories(), fetchRules()])
    afterWrite()
  }

  async function deleteRule(id: string): Promise<void> {
    await apiClient.delete(`/banking/category-rules/${encodeURIComponent(id)}`)
    await Promise.all([fetchCategories(), fetchRules()])
    afterWrite()
  }

  async function assignCategory(transactionId: string, body: BankCategoryAssign): Promise<BankCategoryAssignResult> {
    const result = await apiClient.put<BankCategoryAssignResult>(
      `/banking/transactions/${encodeURIComponent(transactionId)}/category`,
      body,
    )
    afterWrite()
    if (body.apply_to_similar) void Promise.all([fetchCategories(), fetchRules()])
    return result
  }

  /**
   * Files the heaviest groups left batch by batch, until the API says nothing
   * remains, a batch fails, or the user stops it. One request per batch rather
   * than a background job: the Master Key never outlives a request.
   */
  async function runAiCategorization(): Promise<void> {
    if (aiProgress.value.running) return
    aiStopRequested = false
    aiProgress.value = { ...idleProgress(), running: true }
    let skip = 0
    try {
      while (!aiStopRequested) {
        const batch = await apiClient.post<BankAICategorizeResult>(`/banking/categorize/ai?skip=${skip}`)
        const progress = aiProgress.value
        progress.batches += 1
        progress.processed += batch.processed
        progress.rulesCreated += batch.rules_created
        progress.categoriesCreated += batch.categories_created
        progress.remaining = batch.remaining
        skip = batch.skip
        // A batch that tried nothing would be asked again forever.
        if (batch.remaining <= 0 || batch.processed === 0) break
      }
    } catch (e) {
      aiProgress.value.error = e instanceof Error ? e.message : 'La catégorisation par IA a échoué.'
    } finally {
      aiProgress.value.running = false
      afterWrite()
      void Promise.all([fetchCategories(), fetchRules(), fetchQueue()]).catch(() => undefined)
    }
  }

  function stopAiCategorization(): void {
    aiStopRequested = true
  }

  function reset(): void {
    categories.value = []
    rules.value = []
    available.value = []
    queue.value = null
    aiProgress.value = idleProgress()
  }

  return {
    categories,
    rules,
    available,
    queue,
    queueLoading,
    aiProgress,
    fetchCategories,
    fetchRules,
    fetchAvailable,
    fetchQueue,
    fetchRuleWords,
    createCategory,
    materializeCashflowCategory,
    updateCategory,
    deleteCategory,
    deleteRule,
    assignCategory,
    runAiCategorization,
    stopAiCategorization,
    reset,
  }
})

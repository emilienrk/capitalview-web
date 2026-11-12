import { ref } from 'vue'

import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useCashflowTypesStore } from '@/stores/cashflowTypes'
import { separationMessage } from '@/utils/cashflowTypes'

/**
 * Separates the label of an operation (docs/bank-sorting.md in the API, R54):
 * said before it is done, with the rule it withdraws; taken back from the
 * toast or the Règles tab.
 */
export function useLabelSeparation() {
  const types = useCashflowTypesStore()
  const { confirmDialog } = useConfirm()
  const toast = useToast()
  const separating = ref(false)

  async function separate(transactionId: string, label: string | null): Promise<void> {
    separating.value = true
    try {
      const preview = await types.previewSeparation(transactionId)
      const confirmed = await confirmDialog({
        title: 'Séparer ce libellé',
        message: separationMessage(preview, label),
        confirmLabel: 'Séparer',
        variant: 'primary',
      })
      if (!confirmed) return
      const separation = await types.separateLabel(transactionId)
      toast.show('Libellé séparé : chaque opération pose sa question seule.', {
        action: {
          label: 'Annuler',
          run: () => void types.regroupLabel(separation.id).catch((e: unknown) => {
            toast.show(e instanceof Error ? e.message : 'Impossible de regrouper ce libellé.', { variant: 'danger' })
          }),
        },
      })
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Impossible de séparer ce libellé.', { variant: 'danger' })
    } finally {
      separating.value = false
    }
  }

  return { separating, separate }
}

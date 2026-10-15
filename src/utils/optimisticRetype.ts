/**
 * A type chosen from an operation's badge, known before the API confirms it:
 * the answer a question gets, given to any operation, asking or not.
 */
import type { BankTransactionItem, CashflowType, TypeScope } from '@/types'
import { typeAnswerEffect, type AnswerEffect } from '@/utils/optimisticAnswers'

/**
 * This operation alone, or its label through a rule. The month shows a label's
 * question on one operation only, often another than the one retyped: the
 * rule types that one too, so its question closes with it.
 */
export function retypeEffect(
  tx: BankTransactionItem, type: CashflowType, scope: TypeScope, neighbours: BankTransactionItem[] = [],
): AnswerEffect {
  const effect = typeAnswerEffect(tx, type, scope, [tx.id], [], neighbours)
  if (scope !== 'label') return effect
  for (const other of neighbours) {
    if (other.id !== tx.id && other.flow_question && effect.operations[other.id]) {
      effect.settled.push({ ids: [other.id], day: other.operation_date })
    }
  }
  return effect
}

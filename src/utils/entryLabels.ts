import type { BankLedger } from '@/types'

/**
 * Whether a label holds a word as the API reads one: two letters or more, no
 * digit (services/banking/labels.py). A label without any asks no question and
 * carries no rule (docs/bank-sorting.md, R24).
 */
export function hasWords(label: string): boolean {
  return (label.normalize('NFKD').match(/[\p{L}\p{N}]+/gu) ?? []).some((run) => run.length >= 2 && !/\d/.test(run))
}

/**
 * The labels already on this account in this direction, the most used first:
 * taking one as it is files the entry with its kin — one group, the same rules.
 */
export function labelSuggestions(ledger: BankLedger | null, accountId: string, isCredit: boolean, limit = 50): string[] {
  if (!ledger) return []
  const index = ledger.accounts.findIndex((account) => account.id === accountId)
  if (index < 0) return []
  const seen = new Map<string, { count: number; last: string }>()
  for (const row of ledger.rows) {
    if (row.account !== index || row.is_credit !== isCredit || !row.label || !hasWords(row.label)) continue
    const known = seen.get(row.label)
    const day = row.day ?? ''
    seen.set(row.label, { count: (known?.count ?? 0) + 1, last: known && known.last > day ? known.last : day })
  }
  return [...seen.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, limit)
    .map(([label]) => label)
}

import type { AccountHistorySnapshotResponse } from '@/types'

/** Below this an account's line adds nothing but a stretch of axis down to zero. */
export const NEGLIGIBLE_ACCOUNT_VALUE = 10

type AccountLine = { name: string; history: AccountHistorySnapshotResponse[] }

function latestValue(line: AccountLine): number {
  return Number(line.history[line.history.length - 1]?.total_value ?? 0)
}

/**
 * Starts hidden an account now worth next to nothing while another holds more:
 * its line pins the axis to zero and flattens the ones that matter. It stays in
 * the legend, a touch away.
 */
export function hideNegligibleAccounts<T extends AccountLine>(lines: T[]): Array<T & { hidden: boolean }> {
  const highest = Math.max(0, ...lines.map(latestValue))
  return lines.map((line) => {
    const value = latestValue(line)
    return { ...line, hidden: value < NEGLIGIBLE_ACCOUNT_VALUE && value < highest }
  })
}

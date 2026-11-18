/**
 * The curated benchmarks, shared by the settings picker and the page that
 * names the benchmark it compares against.
 *
 * Accumulating ETFs only. This is a correctness constraint, not a taste: a
 * distributing share class pays dividends out, so its quoted price is not a
 * total-return series and every comparison against it would understate the
 * index. The app stores no per-asset dividend history to correct for it.
 */
import type { AssetLabelOut } from '@/types'

export interface Benchmark {
  value: string
  label: string
  /** What the index is called, before the fund that replicates it. */
  index: string
  ticker: string | null
}

export const BENCHMARKS: Benchmark[] = [
  { value: 'IE00B4L5Y983', label: 'MSCI World — iShares Core (IWDA, Acc)', index: 'MSCI World', ticker: 'IWDA' },
  { value: 'IE00BK5BQT80', label: 'FTSE All-World — Vanguard (VWCE, Acc)', index: 'FTSE All-World', ticker: 'VWCE' },
  { value: 'IE00B5BMR087', label: 'S&P 500 — iShares Core (CSPX, Acc)', index: 'S&P 500', ticker: 'CSPX' },
  { value: 'IE00BKM4GZ66', label: 'MSCI Emerging Markets — iShares Core (EIMI, Acc)', index: 'MSCI Emerging Markets', ticker: 'EIMI' },
  { value: 'LU1681043599', label: 'MSCI Europe — Amundi (Acc)', index: 'MSCI Europe', ticker: null },
]

/**
 * "MSCI World (IWDA)" for a curated benchmark. Any other one is named by its
 * market label: the quote provider's name is often a truncated capitalised
 * string, which is why the curated ones carry their own.
 */
export function benchmarkName(asset: AssetLabelOut): string {
  const known = BENCHMARKS.find((b) => b.value === asset.asset_key.toUpperCase())
  if (known) return known.ticker ? `${known.index} (${known.ticker})` : known.index
  return asset.symbol && asset.symbol !== asset.name ? `${asset.name} (${asset.symbol})` : asset.name
}

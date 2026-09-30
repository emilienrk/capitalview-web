import type { TransactionResponse } from '@/types'
import { isFiatSymbol } from '@/utils/cryptoTransactionTypes'

export type CryptoOperationKind =
  | 'buy'
  | 'swap'
  | 'sell'
  | 'crypto_deposit'
  | 'transfer_in'
  | 'send'
  | 'reward'
  | 'fee'
  | 'fiat_deposit'
  | 'fiat_withdraw'
  | 'other'

export interface CryptoAmount {
  asset: string
  amount: number
}

/** One thing the user did, rebuilt from the rows the API wrote for it. */
export interface CryptoOperation {
  key: string
  kind: CryptoOperationKind
  executedAt: string
  incoming: CryptoAmount | null
  outgoing: CryptoAmount | null
  /** The euro value the app booked for it, or null when it books none (a reward, a send). */
  eurValue: number | null
  fees: CryptoAmount[]
  legs: TransactionResponse[]
  /** Crypto assets it touches, to filter the history by asset. */
  assets: string[]
}

export const CRYPTO_OPERATION_LABELS: Record<CryptoOperationKind, string> = {
  buy: 'Achat',
  swap: 'Échange',
  sell: 'Vente',
  crypto_deposit: 'Dépôt de crypto',
  transfer_in: 'Transfert reçu',
  send: 'Envoi',
  reward: 'Récompense',
  fee: 'Frais réseau',
  fiat_deposit: 'Dépôt',
  fiat_withdraw: 'Retrait',
  other: 'Opération',
}

const LEG_ORDER: Record<string, number> = {
  REWARD: 0,
  BUY: 1,
  DEPOSIT: 2,
  TRANSFER: 3,
  SPEND: 4,
  WITHDRAW: 5,
  FEE: 6,
  ANCHOR: 7,
}

const amountOf = (tx: TransactionResponse): CryptoAmount => ({ asset: tx.asset_key, amount: Number(tx.amount) })
const eurOf = (tx: TransactionResponse): number => Number(tx.amount) * Number(tx.price_per_unit)

/**
 * Names an operation from the shape of its group. The API stores atomic rows
 * only (see create_composite_transaction): a purchase is BUY + SPEND of euros,
 * a swap adds an ANCHOR holding its euro value, a sale is SPEND + DEPOSIT of
 * euros, a crypto deposit funds itself with DEPOSIT + SPEND of euros, and a
 * transfer lands in the receiving wallet as BUY + ANCHOR.
 */
function classify(legs: TransactionResponse[]): Omit<CryptoOperation, 'key' | 'executedAt' | 'legs' | 'assets'> {
  const fees = legs.filter((tx) => tx.type === 'FEE')
  const core = legs.filter((tx) => tx.type !== 'FEE')
  const of = (type: string, fiat?: boolean) =>
    core.filter((tx) => tx.type === type && (fiat === undefined || isFiatSymbol(tx.asset_key) === fiat))
  const buys = of('BUY')
  const fiatSpends = of('SPEND', true)
  const cryptoSpends = of('SPEND', false)
  const fiatDeposits = of('DEPOSIT', true)
  const anchor = of('ANCHOR')[0]
  const feeAmounts = fees.map(amountOf)
  const result = (kind: CryptoOperationKind, rest: Partial<CryptoOperation> = {}) => ({
    kind,
    incoming: null,
    outgoing: null,
    eurValue: null,
    fees: feeAmounts,
    ...rest,
  })

  if (!core.length && fees.length === 1) {
    const fee = fees[0]!
    return result('fee', { outgoing: amountOf(fee), eurValue: eurOf(fee) || null, fees: [] })
  }
  if (core.length && core.every((tx) => tx.type === 'REWARD')) {
    const reward = core[0]!
    return result('reward', { incoming: amountOf(reward), eurValue: eurOf(reward) || null })
  }
  if (buys.length === 1 && core.length === buys.length + fiatSpends.length + cryptoSpends.length + fiatDeposits.length + (anchor ? 1 : 0)) {
    const buy = buys[0]!
    if (fiatDeposits.length === 1 && fiatSpends.length === 1 && !cryptoSpends.length) {
      return result('crypto_deposit', { incoming: amountOf(buy), eurValue: eurOf(fiatSpends[0]!) })
    }
    if (cryptoSpends.length === 1 && !fiatSpends.length && !fiatDeposits.length) {
      return result('swap', { incoming: amountOf(buy), outgoing: amountOf(cryptoSpends[0]!), eurValue: anchor ? eurOf(anchor) : null })
    }
    if (fiatSpends.length === 1 && !cryptoSpends.length && !fiatDeposits.length) {
      const spend = fiatSpends[0]!
      return result('buy', { incoming: amountOf(buy), outgoing: amountOf(spend), eurValue: anchor ? eurOf(anchor) : eurOf(spend) })
    }
    if (!fiatSpends.length && !cryptoSpends.length && !fiatDeposits.length) {
      if (anchor) return result('transfer_in', { incoming: amountOf(buy), eurValue: eurOf(anchor) })
      // A purchase stored before composite operations carries its own price.
      return result('buy', { incoming: amountOf(buy), eurValue: eurOf(buy) || null })
    }
  }
  if (cryptoSpends.length === 1 && core.length === 1 + fiatDeposits.length && fiatDeposits.length <= 1) {
    const proceeds = fiatDeposits[0]
    return result('sell', {
      outgoing: amountOf(cryptoSpends[0]!),
      incoming: proceeds ? amountOf(proceeds) : null,
      eurValue: proceeds ? eurOf(proceeds) : null,
    })
  }
  if (core.length === 1) {
    const only = core[0]!
    const fiat = isFiatSymbol(only.asset_key)
    if (only.type === 'TRANSFER' || (only.type === 'WITHDRAW' && !fiat)) return result('send', { outgoing: amountOf(only) })
    if (only.type === 'DEPOSIT' && fiat) return result('fiat_deposit', { incoming: amountOf(only), eurValue: eurOf(only) })
    if (only.type === 'WITHDRAW' && fiat) return result('fiat_withdraw', { outgoing: amountOf(only), eurValue: eurOf(only) })
    if (only.type === 'DEPOSIT') return result('crypto_deposit', { incoming: amountOf(only) })
  }
  return result('other')
}

/** Groups the account's rows into operations, most recent first. */
export function buildCryptoOperations(transactions: TransactionResponse[]): CryptoOperation[] {
  const groups = new Map<string, TransactionResponse[]>()
  for (const tx of transactions) {
    const key = tx.group_uuid ?? tx.id
    const legs = groups.get(key)
    if (legs) legs.push(tx)
    else groups.set(key, [tx])
  }

  const operations = [...groups.entries()].map(([key, rows]): CryptoOperation => {
    const legs = [...rows].sort((a, b) => (LEG_ORDER[a.type] ?? 99) - (LEG_ORDER[b.type] ?? 99))
    const assets = [...new Set(legs.map((tx) => tx.asset_key).filter((asset) => !isFiatSymbol(asset)))]
    const executedAt = legs.reduce((latest, tx) => (tx.executed_at > latest ? tx.executed_at : latest), legs[0]!.executed_at)
    return { key, executedAt, legs, assets, ...classify(legs) }
  })

  return operations.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
}

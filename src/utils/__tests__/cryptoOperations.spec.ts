import { describe, expect, it, vi } from 'vitest'
import { buildCryptoOperations } from '../cryptoOperations'
import type { TransactionResponse } from '@/types'

// isFiatSymbol reads the currency list, whose module imports the API client.
vi.mock('@/api/client', () => ({ apiClient: { get: vi.fn() } }))

let seq = 0
function leg(type: string, asset: string, amount: number, price = 0, group: string | null = 'g', at = '2026-09-20T10:00:00Z'): TransactionResponse {
  seq += 1
  return {
    id: `t${seq}`, name: null, symbol: asset, asset_key: asset, exchange: null, type, amount,
    price_per_unit: price, fees: 0, executed_at: at, notes: null, currency: 'EUR', total_cost: 0,
    fees_percentage: 0, group_uuid: group, current_price: null, current_value: null,
    profit_loss: null, profit_loss_percentage: null,
  }
}

const only = (legs: TransactionResponse[]) => {
  const ops = buildCryptoOperations(legs)
  expect(ops).toHaveLength(1)
  return ops[0]!
}

describe('buildCryptoOperations', () => {
  it('lit un achat en euros sur la dépense en euros', () => {
    const op = only([leg('BUY', 'BTC', 0.0041), leg('SPEND', 'EUR', 250, 1)])
    expect(op.kind).toBe('buy')
    expect(op.incoming).toEqual({ asset: 'BTC', amount: 0.0041 })
    expect(op.eurValue).toBe(250)
  })

  it('lit un échange sur son ancre, frais à part', () => {
    const op = only([leg('SPEND', 'USDC', 160), leg('ANCHOR', 'EUR', 148, 1), leg('BUY', 'SOL', 1.2), leg('FEE', 'SOL', 0.0005, 139)])
    expect(op.kind).toBe('swap')
    expect(op.outgoing).toEqual({ asset: 'USDC', amount: 160 })
    expect(op.incoming).toEqual({ asset: 'SOL', amount: 1.2 })
    expect(op.eurValue).toBe(148)
    expect(op.fees).toEqual([{ asset: 'SOL', amount: 0.0005 }])
    expect(op.assets.sort()).toEqual(['SOL', 'USDC'])
    expect(op.legs.map((tx) => tx.type)).toEqual(['BUY', 'SPEND', 'FEE', 'ANCHOR'])
  })

  it('lit une vente sur les euros reçus', () => {
    const op = only([leg('SPEND', 'SOL', 1.5), leg('DEPOSIT', 'EUR', 210, 1)])
    expect(op.kind).toBe('sell')
    expect(op.eurValue).toBe(210)
  })

  it('distingue un dépôt de crypto de son financement automatique', () => {
    const op = only([leg('DEPOSIT', 'EUR', 900, 1), leg('BUY', 'ETH', 0.4), leg('SPEND', 'EUR', 900, 1)])
    expect(op.kind).toBe('crypto_deposit')
    expect(op.eurValue).toBe(900)
  })

  it('reconnaît un transfert reçu d’un autre portefeuille', () => {
    expect(only([leg('ANCHOR', 'EUR', 700, 1), leg('BUY', 'ETH', 0.3)]).kind).toBe('transfer_in')
  })

  it('reconnaît un envoi, une récompense et des mouvements d’euros', () => {
    expect(only([leg('TRANSFER', 'ETH', 0.3), leg('FEE', 'ETH', 0.001)]).kind).toBe('send')
    const reward = only([leg('REWARD', 'ETH', 0.0031)])
    expect(reward.kind).toBe('reward')
    expect(reward.eurValue).toBeNull()
    expect(only([leg('DEPOSIT', 'EUR', 500, 1, null)]).kind).toBe('fiat_deposit')
    expect(only([leg('WITHDRAW', 'EUR', 300, 1, null)]).kind).toBe('fiat_withdraw')
  })

  it('garde un achat ancien sans groupe à son propre prix', () => {
    const op = only([leg('BUY', 'BTC', 0.01, 30000, null)])
    expect(op.kind).toBe('buy')
    expect(op.eurValue).toBe(300)
  })

  it('ne devine pas une forme inconnue', () => {
    expect(only([leg('BUY', 'BTC', 0.01), leg('BUY', 'ETH', 0.1)]).kind).toBe('other')
  })

  it('range les opérations de la plus récente à la plus ancienne', () => {
    const ops = buildCryptoOperations([
      leg('DEPOSIT', 'EUR', 500, 1, null, '2026-09-02T09:00:00Z'),
      leg('BUY', 'BTC', 0.0041, 0, 'a', '2026-09-28T09:00:00Z'),
      leg('SPEND', 'EUR', 250, 1, 'a', '2026-09-28T09:00:00Z'),
    ])
    expect(ops.map((op) => op.kind)).toEqual(['buy', 'fiat_deposit'])
  })
})

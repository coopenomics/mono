import type { Mutations } from '@coopenomics/sdk'
import { api } from '../api'

// Типы строго из SDK
export type IPaySubscriptionsInput = Mutations.Billing.Pay.IInput['input']
export type IPaySubscriptionsOutput =
  Mutations.Billing.Pay.IOutput[typeof Mutations.Billing.Pay.name]

/**
 * Списание стоимости подписок с биллинг-кошелька пайщика (Epic 12, billing::pay).
 *
 * ОТКРЫТО: `username` — пайщик-плательщик, чей USER_SHARED-кошелёк `w.wal.bill`
 * дебетуется. Реестр оператора не знает плательщика целевого коопа автоматически,
 * поэтому он указывается явно (та же конфиг-точка, что BILLING_CRON_PAYER в coopback).
 */
export function usePaySubscriptions() {
  const pay = async (input: IPaySubscriptionsInput): Promise<IPaySubscriptionsOutput> => {
    return await api.paySubscriptions(input)
  }

  return { pay }
}

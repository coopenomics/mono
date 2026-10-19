import type { Mutations } from '@coopenomics/sdk'
import { api } from '../api'

// Типы строго из SDK
export type IPaySubscriptionsInput = Mutations.Billing.Pay.IInput['input']
export type IPaySubscriptionsOutput =
  Mutations.Billing.Pay.IOutput[typeof Mutations.Billing.Pay.name]

/**
 * Списание стоимости подписок с биллинг-кошелька пайщика (Epic 12, billing::pay).
 *
 * Семантика (решение @ant 2026-06-11): `coopname` — кооператив-оператор (его
 * леджер, на хабе = текущий узел), `username` — пайщик-плательщик, чей
 * USER_SHARED-разрез `w.wal.bill` дебетуется; для кооперативов-спиц
 * username = их coopname. Подписывает мутацию оператор (бэкенд-релей).
 */
export function usePaySubscriptions() {
  const pay = async (input: IPaySubscriptionsInput): Promise<IPaySubscriptionsOutput> => {
    return await api.paySubscriptions(input)
  }

  return { pay }
}

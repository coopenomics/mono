import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

/**
 * Индивидуальная цена услуги для кооператива у оператора (28.10.2026):
 * назначена заранее, действует на витрину, новые и живые подписки.
 */
export const rawCoopPriceSelector = {
  subscription_type_id: true,
  code: true,
  name: true,
  amount_per_month: true,
  list_price_per_month: true,
  reason: true,
  created_by: true,
  updated_at: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CoopPrice']> = rawCoopPriceSelector

export const coopPriceSelector = Selector('CoopPrice')(rawCoopPriceSelector)

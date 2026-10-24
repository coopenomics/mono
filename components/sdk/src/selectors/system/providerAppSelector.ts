import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

/** Приложение каталога на столе подключения: предложение и подписка кооператива. */
export const rawProviderAppSelector = {
  package_id: true,
  title: true,
  price: true,
  period_days: true,
  subscription: {
    status: true,
    amount_per_period: true,
    started_at: true,
    expires_at: true,
  },
}

const _validate: MakeAllFieldsRequired<ValueTypes['ProviderApp']> = rawProviderAppSelector

export const providerAppSelector = Selector('ProviderApp')(rawProviderAppSelector)

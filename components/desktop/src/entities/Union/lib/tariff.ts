import { t } from 'src/shared/i18n'
import type { ICooperativeRegistryItem } from '../model'

/**
 * Тариф заявки в реестре кооперативов (16.10.2026). До решения совета у
 * кооператива одна подписка — обязательный документооборот; сервер, поддержка
 * и приложение заводятся при поставке. Поэтому совет видит тариф целиком и у
 * каждой строки — заведена ли она уже.
 */

type RegistrySubscription = ICooperativeRegistryItem['subscriptions'][number]

export interface ITariffLine {
  /** Код типа подписки провайдера — по нему строка связана с подпиской. */
  code: 'hosting' | 'support' | 'app' | 'docflow'
  label: string
  detail: string
  /** Цена строки в месяц, ₽. */
  monthlyPrice: number
  /** Подписка провайдера по этой строке; нет — заведётся при поставке. */
  subscription?: RegistrySubscription
}

const formatRub = (value: number): string =>
  `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`

/** Цена тарифа за выбранный период: «7 500 ₽ в месяц» / «68 400 ₽ в год». */
export const tariffPriceLabel = (item: ICooperativeRegistryItem): string => {
  const tariff = item.tariff
  if (!tariff) return ''
  if (item.tariff_billing_period === 'year' && tariff.annual_total != null) {
    return t('union.tariff.pricePerYear', { price: formatRub(tariff.annual_total) })
  }
  return t('union.tariff.pricePerMonth', { price: formatRub(tariff.monthly_total) })
}

/** Строки состава тарифа с подписками, которые уже заведены. */
export const tariffLines = (item: ICooperativeRegistryItem): ITariffLine[] => {
  const tariff = item.tariff
  if (!tariff) return []
  const byCode = new Map((item.subscriptions ?? []).map((s) => [s.subscription_type_code, s]))
  const lines: ITariffLine[] = [
    {
      code: 'hosting',
      label: t('union.tariff.server'),
      detail: t('union.tariff.serverDetail', { cpu: tariff.server.cpu, ram: tariff.server.ram_gb }),
      monthlyPrice: tariff.server.price,
    },
    {
      code: 'support',
      label: t('union.tariff.support'),
      detail: t('union.tariff.supportDetail', { response: tariff.support.response }),
      monthlyPrice: tariff.support.price,
    },
    { code: 'app', label: t('union.tariff.app'), detail: '', monthlyPrice: tariff.app_price },
    {
      code: 'docflow',
      label: t('union.tariff.docflow'),
      detail: t('union.tariff.docflowDetail'),
      monthlyPrice: tariff.docflow_price,
    },
  ]
  return lines.map((line) => ({ ...line, subscription: byCode.get(line.code) }))
}

/** Подписки вне состава тарифа (подключены до тарифной сетки). */
export const extraSubscriptions = (item: ICooperativeRegistryItem): RegistrySubscription[] => {
  if (!item.tariff) return item.subscriptions ?? []
  const codes = new Set(['hosting', 'support', 'app', 'docflow'])
  return (item.subscriptions ?? []).filter((s) => !codes.has(String(s.subscription_type_code ?? '')))
}

export { formatRub }

import { ref, computed } from 'vue'

/**
 * Период оплаты подписок: 1 / 3 / 6 / 12 месяцев. Composable хранит выбранный
 * период и вычисляет итоговую сумму по базовой месячной цене.
 *
 * Используется в:
 * - widgets/Billing/SubscriptionsManagement (кнопка «Оплатить за период»);
 * - онбординг-визард (выбор первичного периода после trial_days).
 *
 * Список периодов — фиксирован, согласовано с provider'ом (он принимает
 * period_days в кратных 30; иные значения отклоняются).
 */
export type SubscriptionPeriodMonths = 1 | 3 | 6 | 12

export interface SubscriptionPeriodOption {
  months: SubscriptionPeriodMonths
  days: number
  label: string
  discountPercent: number
}

export const SUBSCRIPTION_PERIOD_OPTIONS: SubscriptionPeriodOption[] = [
  { months: 1,  days: 30,  label: '1 месяц',     discountPercent: 0 },
  { months: 3,  days: 90,  label: '3 месяца',    discountPercent: 0 },
  { months: 6,  days: 180, label: '6 месяцев',   discountPercent: 0 },
  { months: 12, days: 365, label: '12 месяцев',  discountPercent: 0 },
]

export function usePickSubscriptionPeriod(initialMonths: SubscriptionPeriodMonths = 1) {
  const selectedMonths = ref<SubscriptionPeriodMonths>(initialMonths)

  const selectedOption = computed<SubscriptionPeriodOption>(() => {
    return (
      SUBSCRIPTION_PERIOD_OPTIONS.find((o) => o.months === selectedMonths.value)
      ?? SUBSCRIPTION_PERIOD_OPTIONS[0]!
    )
  })

  const computeTotal = (baseMonthlyAmount: number): number => {
    const opt = selectedOption.value
    const gross = baseMonthlyAmount * opt.months
    return Math.round(gross * (1 - opt.discountPercent / 100) * 100) / 100
  }

  return {
    selectedMonths,
    selectedOption,
    options: SUBSCRIPTION_PERIOD_OPTIONS,
    computeTotal,
  }
}

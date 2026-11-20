import { MarketContract } from 'cooptypes'
import { t } from 'src/shared/i18n'
import type { IWorkingHours } from '../model/types'

/**
 * Режим работы пункта выдачи для показа пайщику: «Пн–Пт 09:00–18:00»,
 * «Сб 10:00–15:00», «Вс выходной». Группировка дней — общая с уведомлениями
 * узла (`MarketContract.WorkingHours`), подписи — из словаря стола.
 */
export function formatWorkingHours(hours: IWorkingHours | null | undefined): string[] {
  return MarketContract.WorkingHours.formatWorkingHours(hours, {
    day: (day) => t(`marketplaceDetailKU.marketplaceDetailKUDialog.day.${day}`),
    breakWord: t('marketplace.workingHours.break'),
    dayOff: t('marketplace.workingHours.dayOff'),
  })
}

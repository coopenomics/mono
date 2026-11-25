import { Zeus } from '@coopenomics/sdk'
import type { BaseBadgeVariant } from 'src/shared/ui/base'
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates'
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units'
import { t } from 'src/shared/i18n'
import type { MarketplaceInventoryItemView } from '../model'

/**
 * Показ позиции склада — общий для склада ПВЗ, склада стола администратора
 * и карточки «Имущество на складе»: одна позиция читается одинаково везде.
 */

/** Заказчик: ФИО (резолвит узел), иначе аккаунт. */
export function inventoryOrdererName(row: MarketplaceInventoryItemView): string {
  return row.orderer_name?.trim() || row.orderer_account_snapshot
}

/** Количество с единицей отпуска: «10 упак. 1 л», «2,5 кг». */
export function inventoryQuantityLabel(row: MarketplaceInventoryItemView): string {
  const saleUnit = marketplaceOrderSaleUnit(row.quantity_per_label, row.unit_of_measure, row.package_size)
  return `${saleUnit.units} ${saleUnit.unitLabel}`
}

export function inventoryStatusLabel(status: string): string {
  switch (status) {
    case Zeus.MarketplaceInventoryStatus.RECEIVED:
      return t('marketplace.inventory.status.received')
    case Zeus.MarketplaceInventoryStatus.LABELED:
      return t('marketplace.inventory.status.labeled')
    case Zeus.MarketplaceInventoryStatus.ISSUED:
      return t('marketplace.inventory.status.issued')
    case Zeus.MarketplaceInventoryStatus.RETURNED:
      return t('marketplace.inventory.status.returned')
    case Zeus.MarketplaceInventoryStatus.WRITTEN_OFF:
      return t('marketplace.inventory.status.writtenOff')
    default:
      return status
  }
}

export function inventoryStatusVariant(status: string): BaseBadgeVariant {
  switch (status) {
    case Zeus.MarketplaceInventoryStatus.LABELED:
      return 'info'
    case Zeus.MarketplaceInventoryStatus.ISSUED:
      return 'pos'
    case Zeus.MarketplaceInventoryStatus.RETURNED:
      return 'warn'
    case Zeus.MarketplaceInventoryStatus.WRITTEN_OFF:
      return 'neg'
    default:
      return 'neutral'
  }
}

/** Дата и время в поясе кооператива; пусто — прочерк. */
export function inventoryDateTime(value: unknown): string {
  return formatDateToLocalTimezone(value, 'DD.MM.YYYY HH:mm') || '—'
}

/** Дата без времени (срок годности); пусто — прочерк. */
export function inventoryDate(value: unknown): string {
  return formatDateToLocalTimezone(value, 'DD.MM.YYYY') || '—'
}

/** Срок годности истёк — пора списывать. */
export function isInventoryExpired(value: unknown): boolean {
  if (value === null || value === undefined) return false
  const time = new Date(String(value)).getTime()
  return Number.isFinite(time) && time < Date.now()
}

/** Дата в миллисекундах для сортировки таблицы; пусто — в конец. */
export function inventoryTime(value: unknown): number {
  if (value === null || value === undefined) return 0
  const time = new Date(String(value)).getTime()
  return Number.isFinite(time) ? time : 0
}

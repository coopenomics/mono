import { Zeus } from '@coopenomics/sdk'

/**
 * Состояния имущества, которое физически лежит на складе участка: принятое,
 * промаркированное и вернувшееся из выдачи. Выданное пайщику и списанное на
 * складе уже не лежит — по нему не считают ни остаток, ни занятость бокса.
 *
 * Список общий: по нему и запрашивают склад участка, и отбирают содержимое
 * тары на столах администратора и ПВЗ.
 */
export const MARKETPLACE_ON_WAREHOUSE_STATUSES = [
  Zeus.MarketplaceInventoryStatus.RECEIVED,
  Zeus.MarketplaceInventoryStatus.LABELED,
  Zeus.MarketplaceInventoryStatus.RETURNED,
] as const

/** Лежит ли позиция на складе прямо сейчас. */
export function isOnWarehouse(status: Zeus.MarketplaceInventoryStatus | string): boolean {
  return (MARKETPLACE_ON_WAREHOUSE_STATUSES as readonly string[]).includes(status)
}

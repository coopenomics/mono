import type { Queries } from '@coopenomics/sdk'

type RawInventoryItem =
  Queries.Marketplace.ListInventory.IOutput['marketplaceListInventory'][number]

/**
 * Позиция склада КУ. Zeus маппит скаляр `ID` в `unknown` — сужаем до строки:
 * идентификаторы идут в `:key`, в `slice` и в аргументы мутаций.
 */
export type MarketplaceInventoryItemView = Omit<
  RawInventoryItem,
  'id' | 'container_id' | 'cell_id'
> & {
  id: string
  container_id: string | null
  cell_id: string | null
}

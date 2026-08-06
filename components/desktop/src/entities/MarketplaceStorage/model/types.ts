import type { Queries } from '@coopenomics/sdk'

/**
 * Вью-типы адресного хранения. Zeus маппит скаляр `ID` в `unknown`, поэтому
 * идентификаторы сужаем до строки — они идут в `:key`, в сравнения и в аргументы
 * мутаций.
 */

type RawStorageCell =
  Queries.Marketplace.ListStorageCells.IOutput['marketplaceListStorageCells'][number]

export type MarketplaceStorageCellView = Omit<RawStorageCell, 'id'> & { id: string }

type RawContainer =
  Queries.Marketplace.ListContainers.IOutput['marketplaceListContainers'][number]

export type MarketplaceContainerView = Omit<RawContainer, 'id' | 'container_type_id' | 'cell_id'> & {
  id: string
  container_type_id: string
  cell_id: string | null
}

type RawContainerType =
  Queries.Marketplace.ListContainerTypes.IOutput['marketplaceListContainerTypes'][number]

export type MarketplaceContainerTypeView = Omit<RawContainerType, 'id'> & { id: string }

/**
 * Место хранения позиции: ровно одно из двух. Бокс — основной путь, ячейка
 * напрямую — для негабарита, который в тару не влезает. Ячейка позиции, лежащей
 * в боксе, выводится из самого бокса и здесь не дублируется.
 */
export interface MarketplacePlacement {
  container_id: string | null
  cell_id: string | null
}

/** Настройки складского контура кооператива (три независимых флага). */
export interface MarketplaceWarehouseSettings {
  containers_enabled: boolean
  cells_enabled: boolean
  posting_on_reception_required: boolean
}

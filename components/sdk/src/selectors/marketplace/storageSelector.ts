import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

// Эпик 19: адресное хранение на складе кооперативного участка — ячейки с
// координатами «секция × ярус», боксы и их типы.

const rawStorageCellSelector = {
  id: true,
  braname: true,
  section: true,
  level: true,
  code: true,
  label: true,
  is_active: true,
}

const _validateStorageCell: MakeAllFieldsRequired<ValueTypes['MarketplaceStorageCell']> =
  rawStorageCellSelector

export const marketplaceStorageCellSelector = Selector('MarketplaceStorageCell')(
  rawStorageCellSelector,
)

const rawContainerSelector = {
  id: true,
  braname: true,
  code: true,
  label: true,
  container_type_id: true,
  cell_id: true,
  is_active: true,
}

const _validateContainer: MakeAllFieldsRequired<ValueTypes['MarketplaceContainer']> =
  rawContainerSelector

export const marketplaceContainerSelector = Selector('MarketplaceContainer')(rawContainerSelector)

const rawContainerTypeSelector = {
  id: true,
  name: true,
  length_mm: true,
  width_mm: true,
  height_mm: true,
  volume_liters: true,
  max_weight_kg: true,
  is_active: true,
}

const _validateContainerType: MakeAllFieldsRequired<ValueTypes['MarketplaceContainerType']> =
  rawContainerTypeSelector

export const marketplaceContainerTypeSelector = Selector('MarketplaceContainerType')(
  rawContainerTypeSelector,
)

import { Mutations, Queries } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'

// Zeus маппит скаляр ID в `unknown`; идентификатор переопределяем на строку
// (используется как :key и для slice в UI).
type _RawInventoryItem =
  Queries.Marketplace.ListInventory.IOutput['marketplaceListInventory'][number]
export type MarketplaceInventoryItemView = Omit<_RawInventoryItem, 'id'> & { id: string }

export type IListInventoryInput = Queries.Marketplace.ListInventory.IInput['data']
export type IAssignPlacementInput = Mutations.Marketplace.AssignInventoryPlacement.IInput['data']
export type ISplitInventoryInput = Mutations.Marketplace.SplitInventory.IInput['data']
export type IGenerateLabelInput = Mutations.Marketplace.GenerateInventoryLabel.IInput['data']
export type IBindBarcodeInput = Mutations.Marketplace.BindInventoryBarcode.IInput['data']
export type IClearLabelInput = Mutations.Marketplace.ClearInventoryLabel.IInput['data']

export async function fetchInventoryByBraname(braname: string): Promise<MarketplaceInventoryItemView[]> {
  const { [Queries.Marketplace.ListInventory.name]: result } = await client.Query(
    Queries.Marketplace.ListInventory.query,
    { variables: { data: { braname } } },
  )
  // Zeus отдаёт ID как unknown; сужаем идентификатор до строки во view-типе.
  return result as MarketplaceInventoryItemView[]
}

/** Положить позицию в бокс либо в ячейку напрямую (негабарит); ровно одно из двух. */
export async function assignInventoryPlacement(
  data: IAssignPlacementInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.AssignInventoryPlacement.name]: result } = await client.Mutation(
    Mutations.Marketplace.AssignInventoryPlacement.mutation,
    { variables: { data } },
  )
  return result.inventory as MarketplaceInventoryItemView[]
}

export async function splitInventory(
  data: ISplitInventoryInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.SplitInventory.name]: result } = await client.Mutation(
    Mutations.Marketplace.SplitInventory.mutation,
    { variables: { data } },
  )
  return result.inventory as MarketplaceInventoryItemView[]
}

export async function generateInventoryLabel(
  data: IGenerateLabelInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.GenerateInventoryLabel.name]: result } = await client.Mutation(
    Mutations.Marketplace.GenerateInventoryLabel.mutation,
    { variables: { data } },
  )
  return result.inventory as MarketplaceInventoryItemView[]
}

export async function bindInventoryBarcode(
  data: IBindBarcodeInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.BindInventoryBarcode.name]: result } = await client.Mutation(
    Mutations.Marketplace.BindInventoryBarcode.mutation,
    { variables: { data } },
  )
  return result.inventory as MarketplaceInventoryItemView[]
}

export async function clearInventoryLabel(
  data: IClearLabelInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.ClearInventoryLabel.name]: result } = await client.Mutation(
    Mutations.Marketplace.ClearInventoryLabel.mutation,
    { variables: { data } },
  )
  return result.inventory as MarketplaceInventoryItemView[]
}

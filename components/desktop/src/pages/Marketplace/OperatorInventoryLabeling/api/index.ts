import { Mutations, Queries } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'

// Zeus маппит скаляр ID в `unknown`; идентификатор переопределяем на строку
// (используется как :key и для slice в UI).
type _RawInventoryItem =
  Queries.Marketplace.ListInventory.IOutput['marketplaceListInventory'][number]
export type MarketplaceInventoryItemView = Omit<_RawInventoryItem, 'id'> & { id: string }

export type IListInventoryInput = Queries.Marketplace.ListInventory.IInput['data']
export type IAssignShelfInput = Mutations.Marketplace.AssignInventoryShelf.IInput['data']
export type ISplitInventoryInput = Mutations.Marketplace.SplitInventory.IInput['data']
export type IGenerateLabelInput = Mutations.Marketplace.GenerateInventoryLabel.IInput['data']

export async function fetchInventoryByBraname(braname: string): Promise<MarketplaceInventoryItemView[]> {
  const { [Queries.Marketplace.ListInventory.name]: result } = await client.Query(
    Queries.Marketplace.ListInventory.query,
    { variables: { data: { braname } } },
  )
  // Zeus отдаёт ID как unknown; сужаем идентификатор до строки во view-типе.
  return result as MarketplaceInventoryItemView[]
}

export async function assignInventoryShelf(
  data: IAssignShelfInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.AssignInventoryShelf.name]: result } = await client.Mutation(
    Mutations.Marketplace.AssignInventoryShelf.mutation,
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

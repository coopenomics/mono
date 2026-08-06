import { Mutations, Queries } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'
import type { MarketplaceInventoryItemView } from '../model/types'

/**
 * Позиции склада кооперативного участка. Список и назначение места нужны
 * раскладке, столу «Боксы», складу участка и окну закрывающей подписи — то есть
 * это общий слой, а не приватный api одной страницы.
 */

export type IListInventoryInput = Queries.Marketplace.ListInventory.IInput['data']

export async function listInventory(
  data?: IListInventoryInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Queries.Marketplace.ListInventory.name]: result } = await client.Query(
    Queries.Marketplace.ListInventory.query,
    { variables: { data: data ?? null } },
  )
  // Zeus отдаёт скаляр ID как unknown; сужаем идентификаторы во вью-типе.
  return result as MarketplaceInventoryItemView[]
}

export type IAssignPlacementInput =
  Mutations.Marketplace.AssignInventoryPlacement.IInput['data']

/**
 * Положить позицию в бокс либо в ячейку напрямую (негабарит). Ровно одно из
 * двух: ячейка позиции, лежащей в боксе, выводится из самого бокса.
 */
export async function assignInventoryPlacement(
  data: IAssignPlacementInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.AssignInventoryPlacement.name]: result } = await client.Mutation(
    Mutations.Marketplace.AssignInventoryPlacement.mutation,
    { variables: { data } },
  )
  return result.inventory as MarketplaceInventoryItemView[]
}

export const api = { listInventory, assignInventoryPlacement }

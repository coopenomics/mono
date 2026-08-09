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

export type ISplitInventoryInput = Mutations.Marketplace.SplitInventory.IInput['data']

/** Разбить позицию по количеству на несколько мест (или собрать обратно в одно). */
export async function splitInventory(
  data: ISplitInventoryInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.SplitInventory.name]: result } = await client.Mutation(
    Mutations.Marketplace.SplitInventory.mutation,
    { variables: { data } },
  )
  return result.inventory as MarketplaceInventoryItemView[]
}

// ─── Маркировка: штрих-код на единице имущества ───
// Штрих-код опционален и живёт отдельно от места хранения: он отвечает на
// вопрос «что это», а место — на вопрос «где это».

export type IGenerateLabelInput = Mutations.Marketplace.GenerateInventoryLabel.IInput['data']

export async function generateInventoryLabel(
  data: IGenerateLabelInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.GenerateInventoryLabel.name]: result } = await client.Mutation(
    Mutations.Marketplace.GenerateInventoryLabel.mutation,
    { variables: { data } },
  )
  return result.inventory as MarketplaceInventoryItemView[]
}

export type IBindBarcodeInput = Mutations.Marketplace.BindInventoryBarcode.IInput['data']

export async function bindInventoryBarcode(
  data: IBindBarcodeInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.BindInventoryBarcode.name]: result } = await client.Mutation(
    Mutations.Marketplace.BindInventoryBarcode.mutation,
    { variables: { data } },
  )
  return result.inventory as MarketplaceInventoryItemView[]
}

export type IClearLabelInput = Mutations.Marketplace.ClearInventoryLabel.IInput['data']

export async function clearInventoryLabel(
  data: IClearLabelInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.ClearInventoryLabel.name]: result } = await client.Mutation(
    Mutations.Marketplace.ClearInventoryLabel.mutation,
    { variables: { data } },
  )
  return result.inventory as MarketplaceInventoryItemView[]
}

export const api = {
  listInventory,
  assignInventoryPlacement,
  splitInventory,
  generateInventoryLabel,
  bindInventoryBarcode,
  clearInventoryLabel,
}

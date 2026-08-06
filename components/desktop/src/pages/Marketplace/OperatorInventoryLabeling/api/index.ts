import { Mutations } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'
import type { MarketplaceInventoryItemView } from 'src/entities/MarketplaceInventory'

/**
 * Маркировка имущества — операции, которые есть только на этом столе. Список
 * позиций и назначение места живут в `entities/MarketplaceInventory`: ими
 * пользуются и склад участка, и стол «Боксы», и окно закрывающей подписи.
 */

export type ISplitInventoryInput = Mutations.Marketplace.SplitInventory.IInput['data']
export type IGenerateLabelInput = Mutations.Marketplace.GenerateInventoryLabel.IInput['data']
export type IBindBarcodeInput = Mutations.Marketplace.BindInventoryBarcode.IInput['data']
export type IClearLabelInput = Mutations.Marketplace.ClearInventoryLabel.IInput['data']

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

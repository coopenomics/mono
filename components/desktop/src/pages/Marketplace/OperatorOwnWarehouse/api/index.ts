import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceInventoryItemView =
  Queries.Marketplace.ListInventory.IOutput['marketplaceListInventory'][number];

export type IListInventoryInput = Queries.Marketplace.ListInventory.IInput['data'];

export async function listInventory(
  data: IListInventoryInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Queries.Marketplace.ListInventory.name]: result } = await client.Query(
    Queries.Marketplace.ListInventory.query,
    { variables: { data } },
  );
  return result;
}

// ─── Инлайн-действия оператора над позицией склада ───
// Все мутации возвращают затронутые позиции — страница точечно обновляет строки.

export type IAssignShelfInput = Mutations.Marketplace.AssignInventoryShelf.IInput['data'];

export async function assignInventoryShelf(
  data: IAssignShelfInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.AssignInventoryShelf.name]: result } = await client.Mutation(
    Mutations.Marketplace.AssignInventoryShelf.mutation,
    { variables: { data } },
  );
  return result.inventory;
}

export type IGenerateLabelInput = Mutations.Marketplace.GenerateInventoryLabel.IInput['data'];

export async function generateInventoryLabel(
  data: IGenerateLabelInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.GenerateInventoryLabel.name]: result } = await client.Mutation(
    Mutations.Marketplace.GenerateInventoryLabel.mutation,
    { variables: { data } },
  );
  return result.inventory;
}

export type IBindBarcodeInput = Mutations.Marketplace.BindInventoryBarcode.IInput['data'];

export async function bindInventoryBarcode(
  data: IBindBarcodeInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.BindInventoryBarcode.name]: result } = await client.Mutation(
    Mutations.Marketplace.BindInventoryBarcode.mutation,
    { variables: { data } },
  );
  return result.inventory;
}

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

export type IAssignPlacementInput =
  Mutations.Marketplace.AssignInventoryPlacement.IInput['data'];

/** Положить позицию в бокс либо в ячейку напрямую (негабарит); ровно одно из двух. */
export async function assignInventoryPlacement(
  data: IAssignPlacementInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Mutations.Marketplace.AssignInventoryPlacement.name]: result } = await client.Mutation(
    Mutations.Marketplace.AssignInventoryPlacement.mutation,
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

// ─── Остаток кооператива (requirement 76): публикация в каталог ───

/** Позиция обезличенного остатка склада КУ (то же представление, что у инвентаря). */
export async function listStock(braname?: string | null): Promise<MarketplaceInventoryItemView[]> {
  const { [Queries.Marketplace.ListStock.name]: result } = await client.Query(
    Queries.Marketplace.ListStock.query,
    { variables: { braname: braname ?? null } },
  );
  return result as MarketplaceInventoryItemView[];
}

export type IPublishStockInput = Mutations.Marketplace.PublishStock.IInput['data'];

export async function publishStock(data: IPublishStockInput): Promise<number> {
  const { [Mutations.Marketplace.PublishStock.name]: result } = await client.Mutation(
    Mutations.Marketplace.PublishStock.mutation,
    { variables: { data } },
  );
  return result.length;
}

export type IUnpublishStockInput = Mutations.Marketplace.UnpublishStock.IInput['data'];

export async function unpublishStock(data: IUnpublishStockInput): Promise<number> {
  const { [Mutations.Marketplace.UnpublishStock.name]: result } = await client.Mutation(
    Mutations.Marketplace.UnpublishStock.mutation,
    { variables: { data } },
  );
  return result.affected;
}

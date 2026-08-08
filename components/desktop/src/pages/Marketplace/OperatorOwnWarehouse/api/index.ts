import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { MarketplaceInventoryItemView } from 'src/entities/MarketplaceInventory';

/**
 * Остаток кооператива (requirement 76): обезличенные позиции, оставшиеся после
 * недовыдач и отказов, и их публикация в каталог предложением от кооператива.
 *
 * Обычные операции склада — список позиций, назначение места, маркировка — живут
 * в `entities/MarketplaceInventory`: ими пользуется не только эта страница.
 */

/** Позиция обезличенного остатка склада КУ — то же представление, что у инвентаря. */
export type { MarketplaceInventoryItemView };

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

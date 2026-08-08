import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Эпик 16: управление списком категорий кооператива (chairman-only).
 *
 * Модель: общие baseline-категории + собственные категории кооператива.
 * Видимость (доступность для публикации предложений) задаётся whitelist'ом:
 * пустой whitelist = открыт весь каталог (все категории доступны); непустой —
 * доступны только перечисленные. Включение/выключение категории = правка
 * whitelist'а через replace/clear. Собственные категории создаются и удаляются.
 */

export type MarketplaceCoopCategoryView =
  Queries.Marketplace.ListCoopCategories.IOutput['marketplaceListCoopCategories'][number];

export type MarketplaceAvailableCategoryView =
  Queries.Marketplace.GetAvailableCategories.IOutput['marketplaceGetAvailableCategories'][number];

export type ICreateCustomCategoryInput =
  Mutations.Marketplace.CreateCustomCategory.IInput['input'];
export type IReplaceAvailableItemsInput =
  Mutations.Marketplace.ReplaceAvailableItems.IInput['input'];

export async function fetchCoopCategories(): Promise<MarketplaceCoopCategoryView[]> {
  const { [Queries.Marketplace.ListCoopCategories.name]: result } = await client.Query(
    Queries.Marketplace.ListCoopCategories.query,
    {},
  );
  return result;
}

export async function fetchAvailableCategories(): Promise<MarketplaceAvailableCategoryView[]> {
  const { [Queries.Marketplace.GetAvailableCategories.name]: result } = await client.Query(
    Queries.Marketplace.GetAvailableCategories.query,
    {},
  );
  return result;
}

export async function createCustomCategory(
  input: ICreateCustomCategoryInput,
): Promise<MarketplaceCoopCategoryView> {
  const { [Mutations.Marketplace.CreateCustomCategory.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateCustomCategory.mutation,
    { variables: { input } },
  );
  return result;
}

export async function deleteCustomCategory(categoryId: number): Promise<boolean> {
  const { [Mutations.Marketplace.DeleteCustomCategory.name]: result } = await client.Mutation(
    Mutations.Marketplace.DeleteCustomCategory.mutation,
    { variables: { categoryId } },
  );
  return result;
}

export async function replaceAvailableItems(
  input: IReplaceAvailableItemsInput,
): Promise<void> {
  await client.Mutation(Mutations.Marketplace.ReplaceAvailableItems.mutation, {
    variables: { input },
  });
}

export async function clearAvailableCategories(): Promise<void> {
  await client.Mutation(Mutations.Marketplace.ClearAvailableCategories.mutation, {});
}

import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Реестр поставщиков на столе администратора: список, прямое добавление
 * (путь 2, сразу одобрен), одобрение/отклонение заявок (председатель).
 */

export type MarketplaceSupplierView =
  Queries.Marketplace.ListSuppliers.IOutput['marketplaceListSuppliers'][number];

export type IAddSupplierInput = Mutations.Marketplace.AddSupplier.IInput['input'];
export type ISupplierMemberInput = Mutations.Marketplace.ApproveSupplier.IInput['input'];

export async function fetchSuppliers(): Promise<MarketplaceSupplierView[]> {
  const { [Queries.Marketplace.ListSuppliers.name]: result } = await client.Query(
    Queries.Marketplace.ListSuppliers.query,
    {},
  );
  return result;
}

export async function addSupplier(input: IAddSupplierInput): Promise<MarketplaceSupplierView> {
  const { [Mutations.Marketplace.AddSupplier.name]: result } = await client.Mutation(
    Mutations.Marketplace.AddSupplier.mutation,
    { variables: { input } },
  );
  return result;
}

export async function approveSupplier(
  input: ISupplierMemberInput,
): Promise<MarketplaceSupplierView> {
  const { [Mutations.Marketplace.ApproveSupplier.name]: result } = await client.Mutation(
    Mutations.Marketplace.ApproveSupplier.mutation,
    { variables: { input } },
  );
  return result;
}

export async function rejectSupplier(
  input: ISupplierMemberInput,
): Promise<MarketplaceSupplierView> {
  const { [Mutations.Marketplace.RejectSupplier.name]: result } = await client.Mutation(
    Mutations.Marketplace.RejectSupplier.mutation,
    { variables: { input } },
  );
  return result;
}

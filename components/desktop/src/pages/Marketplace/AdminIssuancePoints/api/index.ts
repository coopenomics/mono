import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

// ─── Инициатор участка (коэффициент экономического участия, 99D-23) ───
// Получатель доли экономии месяца. Пусто — председатель участка.

export type MarketplaceBranchInitiatorView =
  Queries.Marketplace.GetBranchInitiator.IOutput['marketplaceGetBranchInitiator'];

export async function getBranchInitiator(braname: string): Promise<MarketplaceBranchInitiatorView> {
  const { [Queries.Marketplace.GetBranchInitiator.name]: result } = await client.Query(
    Queries.Marketplace.GetBranchInitiator.query,
    { variables: { braname } },
  );
  return result;
}

export type ISetBranchInitiatorInput = Mutations.Marketplace.SetBranchInitiator.IInput['data'];

export async function setBranchInitiator(data: ISetBranchInitiatorInput): Promise<MarketplaceBranchInitiatorView> {
  const { [Mutations.Marketplace.SetBranchInitiator.name]: result } = await client.Mutation(
    Mutations.Marketplace.SetBranchInitiator.mutation,
    { variables: { data } },
  );
  return result;
}

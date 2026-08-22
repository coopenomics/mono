import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceEconomyConfigView =
  Queries.Marketplace.GetEconomyConfig.IOutput['marketplaceGetEconomyConfig'];

export async function getEconomyConfig(): Promise<MarketplaceEconomyConfigView> {
  const { [Queries.Marketplace.GetEconomyConfig.name]: result } = await client.Query(
    Queries.Marketplace.GetEconomyConfig.query,
  );
  return result;
}

export type ISetMembershipFeeInput = Mutations.Marketplace.SetMembershipFee.IInput['data'];

export async function setMembershipFee(
  data: ISetMembershipFeeInput,
): Promise<MarketplaceEconomyConfigView> {
  const { [Mutations.Marketplace.SetMembershipFee.name]: result } = await client.Mutation(
    Mutations.Marketplace.SetMembershipFee.mutation,
    { variables: { data } },
  );
  return result;
}

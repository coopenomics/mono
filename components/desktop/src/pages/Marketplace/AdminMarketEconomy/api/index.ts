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

// ─── Настройки модели коэффициента экономического участия (99D-23) ───

export type MarketplaceEconomySettingsView =
  Queries.Marketplace.GetEconomySettings.IOutput['marketplaceGetEconomySettings'];

export async function getEconomySettings(): Promise<MarketplaceEconomySettingsView> {
  const { [Queries.Marketplace.GetEconomySettings.name]: result } = await client.Query(
    Queries.Marketplace.GetEconomySettings.query,
  );
  return result;
}

export type ISetInitiatorShareInput = Mutations.Marketplace.SetInitiatorShare.IInput['data'];

export async function setInitiatorShare(data: ISetInitiatorShareInput): Promise<MarketplaceEconomySettingsView> {
  const { [Mutations.Marketplace.SetInitiatorShare.name]: result } = await client.Mutation(
    Mutations.Marketplace.SetInitiatorShare.mutation,
    { variables: { data } },
  );
  return result;
}

export type ISetAidLimitInput = Mutations.Marketplace.SetAidLimit.IInput['data'];

export async function setAidLimit(data: ISetAidLimitInput): Promise<MarketplaceEconomySettingsView> {
  const { [Mutations.Marketplace.SetAidLimit.name]: result } = await client.Mutation(
    Mutations.Marketplace.SetAidLimit.mutation,
    { variables: { data } },
  );
  return result;
}

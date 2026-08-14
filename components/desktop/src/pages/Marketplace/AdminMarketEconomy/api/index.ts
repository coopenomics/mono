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

export type MarketplaceTaxStateView =
  Queries.Marketplace.GetTaxState.IOutput['marketplaceGetTaxState'];

/** Удержанный с материальной помощи НДФЛ: долг перед бюджетом и то, что можно отправить кассиру. */
export async function getTaxState(): Promise<MarketplaceTaxStateView> {
  const { [Queries.Marketplace.GetTaxState.name]: result } = await client.Query(
    Queries.Marketplace.GetTaxState.query,
  );
  return result;
}

export type IPayTaxInput = Mutations.Marketplace.PayTax.IInput['data'];

/** Отправить удержанный налог на оплату в бюджет; возвращает отправленную сумму. */
export async function payTax(data: IPayTaxInput): Promise<string> {
  const { [Mutations.Marketplace.PayTax.name]: result } = await client.Mutation(
    Mutations.Marketplace.PayTax.mutation,
    { variables: { data } },
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

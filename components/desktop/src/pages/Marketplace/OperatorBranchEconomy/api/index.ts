import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

// ─── Чтение экономики ───

export type MarketplaceEconomyConfigView =
  Queries.Marketplace.GetEconomyConfig.IOutput['marketplaceGetEconomyConfig'];

export type MarketplaceBranchEconomyView =
  Queries.Marketplace.GetBranchEconomy.IOutput['marketplaceGetBranchEconomy'];

export type MarketplacePersonalEconomyView =
  Queries.Marketplace.GetPersonalEconomy.IOutput['marketplaceGetPersonalEconomy'];

export type MarketplaceAidView =
  Queries.Marketplace.ListAids.IOutput['marketplaceListAids'][number];

export type AidStatementDocumentView =
  Queries.Marketplace.AidStatementSignablePayload.IOutput['marketplaceAidStatementSignablePayload'];

export async function getEconomyConfig(): Promise<MarketplaceEconomyConfigView> {
  const { [Queries.Marketplace.GetEconomyConfig.name]: result } = await client.Query(
    Queries.Marketplace.GetEconomyConfig.query,
  );
  return result;
}

export async function getBranchEconomy(braname: string): Promise<MarketplaceBranchEconomyView> {
  const { [Queries.Marketplace.GetBranchEconomy.name]: result } = await client.Query(
    Queries.Marketplace.GetBranchEconomy.query,
    { variables: { braname } },
  );
  return result;
}

export async function getPersonalEconomy(): Promise<MarketplacePersonalEconomyView> {
  const { [Queries.Marketplace.GetPersonalEconomy.name]: result } = await client.Query(
    Queries.Marketplace.GetPersonalEconomy.query,
  );
  return result;
}

export type IListAidsInput = Queries.Marketplace.ListAids.IInput['data'];

export async function listAids(data?: IListAidsInput): Promise<MarketplaceAidView[]> {
  const { [Queries.Marketplace.ListAids.name]: result } = await client.Query(
    Queries.Marketplace.ListAids.query,
    { variables: { data } },
  );
  return result;
}

// ─── Настройка распределения (председатель КУ) ───

export type ISetBranchSplitInput = Mutations.Marketplace.SetBranchSplit.IInput['data'];

export async function setBranchSplit(data: ISetBranchSplitInput): Promise<boolean> {
  const { [Mutations.Marketplace.SetBranchSplit.name]: result } = await client.Mutation(
    Mutations.Marketplace.SetBranchSplit.mutation,
    { variables: { data } },
  );
  return Boolean(result);
}

export type ISetTrusteeWeightInput = Mutations.Marketplace.SetTrusteeWeight.IInput['data'];

export async function setTrusteeWeight(data: ISetTrusteeWeightInput): Promise<boolean> {
  const { [Mutations.Marketplace.SetTrusteeWeight.name]: result } = await client.Mutation(
    Mutations.Marketplace.SetTrusteeWeight.mutation,
    { variables: { data } },
  );
  return Boolean(result);
}

export type IDeleteTrusteeWeightInput = Mutations.Marketplace.DeleteTrusteeWeight.IInput['data'];

export async function deleteTrusteeWeight(data: IDeleteTrusteeWeightInput): Promise<boolean> {
  const { [Mutations.Marketplace.DeleteTrusteeWeight.name]: result } = await client.Mutation(
    Mutations.Marketplace.DeleteTrusteeWeight.mutation,
    { variables: { data } },
  );
  return Boolean(result);
}

// ─── Персональные средства ───

export type IConvertBranchFundsInput = Mutations.Marketplace.ConvertBranchFunds.IInput['data'];

export async function convertBranchFunds(data: IConvertBranchFundsInput): Promise<boolean> {
  const { [Mutations.Marketplace.ConvertBranchFunds.name]: result } = await client.Mutation(
    Mutations.Marketplace.ConvertBranchFunds.mutation,
    { variables: { data } },
  );
  return Boolean(result);
}

export type IAidStatementPayloadInput =
  Queries.Marketplace.AidStatementSignablePayload.IInput['data'];

export async function getAidStatementSignablePayload(
  data: IAidStatementPayloadInput,
): Promise<AidStatementDocumentView> {
  const { [Queries.Marketplace.AidStatementSignablePayload.name]: result } = await client.Query(
    Queries.Marketplace.AidStatementSignablePayload.query,
    { variables: { data } },
  );
  return result;
}

export type ICreateAidInput = Mutations.Marketplace.CreateAid.IInput['data'];

export async function createAid(data: ICreateAidInput): Promise<boolean> {
  const { [Mutations.Marketplace.CreateAid.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateAid.mutation,
    { variables: { data } },
  );
  return Boolean(result);
}

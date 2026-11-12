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

export type MarketplaceBranchWalletHistoryView =
  Queries.Marketplace.GetBranchWalletHistory.IOutput['marketplaceGetBranchWalletHistory'];

export async function getBranchWalletHistory(
  braname: string,
  options?: Queries.Marketplace.GetBranchWalletHistory.IInput['options'],
): Promise<MarketplaceBranchWalletHistoryView> {
  const { [Queries.Marketplace.GetBranchWalletHistory.name]: result } = await client.Query(
    Queries.Marketplace.GetBranchWalletHistory.query,
    { variables: { braname, options } },
  );
  return result;
}

export type MarketplaceBranchMovementPartsView =
  Queries.Marketplace.GetBranchMovementParts.IOutput['marketplaceGetBranchMovementParts'];

/** Движения участка в одном процессе — получатели распределения, взнос по заказу. */
export async function getBranchMovementParts(
  data: Queries.Marketplace.GetBranchMovementParts.IInput,
): Promise<MarketplaceBranchMovementPartsView> {
  const { [Queries.Marketplace.GetBranchMovementParts.name]: result } = await client.Query(
    Queries.Marketplace.GetBranchMovementParts.query,
    { variables: data },
  );
  return result;
}

export async function getPersonalEconomy(): Promise<MarketplacePersonalEconomyView> {
  const { [Queries.Marketplace.GetPersonalEconomy.name]: result } = await client.Query(
    Queries.Marketplace.GetPersonalEconomy.query,
  );
  return result;
}

export type MarketplacePersonalWalletHistoryView =
  Queries.Marketplace.GetPersonalWalletHistory.IOutput['marketplaceGetPersonalWalletHistory'];

export async function getPersonalWalletHistory(
  options?: Queries.Marketplace.GetPersonalWalletHistory.IInput['options'],
): Promise<MarketplacePersonalWalletHistoryView> {
  const { [Queries.Marketplace.GetPersonalWalletHistory.name]: result } = await client.Query(
    Queries.Marketplace.GetPersonalWalletHistory.query,
    { variables: { options } },
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

// ─── Распределение (председатель КУ) ───

export type IDistributeBranchFundsInput = Mutations.Marketplace.DistributeBranchFunds.IInput['data'];

export async function distributeBranchFunds(data: IDistributeBranchFundsInput): Promise<boolean> {
  const { [Mutations.Marketplace.DistributeBranchFunds.name]: result } = await client.Mutation(
    Mutations.Marketplace.DistributeBranchFunds.mutation,
    { variables: { data } },
  );
  return Boolean(result);
}

// ─── Плановые расходы — общесистемный реестр (Expenses) ───

export type ExpensePlanView = Queries.Expenses.ListExpensePlans.IOutput['listExpensePlans'][number];

export async function listExpensePlans(braname: string): Promise<ExpensePlanView[]> {
  const { [Queries.Expenses.ListExpensePlans.name]: result } = await client.Query(
    Queries.Expenses.ListExpensePlans.query,
    { variables: { data: { braname } } },
  );
  return result;
}

export type IDeleteExpensePlanInput = Mutations.Expenses.DeleteExpensePlan.IInput['data'];

export async function deleteExpensePlan(data: IDeleteExpensePlanInput): Promise<boolean> {
  const { [Mutations.Expenses.DeleteExpensePlan.name]: result } = await client.Mutation(
    Mutations.Expenses.DeleteExpensePlan.mutation,
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

export type ICreateBranchExpenseInput = Mutations.Marketplace.CreateBranchExpense.IInput['data'];

export async function createBranchExpense(data: ICreateBranchExpenseInput): Promise<string> {
  const { [Mutations.Marketplace.CreateBranchExpense.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateBranchExpense.mutation,
    { variables: { data } },
  );
  return String(result);
}

// ─── Коэффициент экономического участия (99D-23): резерв, инициатор, итоги месяцев ───

export type MarketplaceBranchReservesView =
  Queries.Marketplace.GetBranchReserves.IOutput['marketplaceGetBranchReserves'];
export type MarketplaceBranchReserveRow = MarketplaceBranchReservesView['rows'][number];

export async function getBranchReserves(braname: string): Promise<MarketplaceBranchReservesView> {
  const { [Queries.Marketplace.GetBranchReserves.name]: result } = await client.Query(
    Queries.Marketplace.GetBranchReserves.query,
    { variables: { braname } },
  );
  return result;
}

export type ISetBranchReserveInput = Mutations.Marketplace.SetBranchReserve.IInput['data'];

export async function setBranchReserve(data: ISetBranchReserveInput): Promise<MarketplaceBranchReservesView> {
  const { [Mutations.Marketplace.SetBranchReserve.name]: result } = await client.Mutation(
    Mutations.Marketplace.SetBranchReserve.mutation,
    { variables: { data } },
  );
  return result;
}

export type IDeleteBranchReserveInput = Mutations.Marketplace.DeleteBranchReserve.IInput['data'];

export async function deleteBranchReserve(data: IDeleteBranchReserveInput): Promise<MarketplaceBranchReservesView> {
  const { [Mutations.Marketplace.DeleteBranchReserve.name]: result } = await client.Mutation(
    Mutations.Marketplace.DeleteBranchReserve.mutation,
    { variables: { data } },
  );
  return result;
}

export type MarketplaceBranchInitiatorView =
  Queries.Marketplace.GetBranchInitiator.IOutput['marketplaceGetBranchInitiator'];

export async function getBranchInitiator(braname: string): Promise<MarketplaceBranchInitiatorView> {
  const { [Queries.Marketplace.GetBranchInitiator.name]: result } = await client.Query(
    Queries.Marketplace.GetBranchInitiator.query,
    { variables: { braname } },
  );
  return result;
}

export type MarketplaceBranchPeriodsView =
  Queries.Marketplace.ListBranchPeriods.IOutput['marketplaceListBranchPeriods'];
export type MarketplaceBranchPeriodRow = MarketplaceBranchPeriodsView['items'][number];

export async function listBranchPeriods(
  braname: string,
  options?: Queries.Marketplace.ListBranchPeriods.IInput['options'],
): Promise<MarketplaceBranchPeriodsView> {
  const { [Queries.Marketplace.ListBranchPeriods.name]: result } = await client.Query(
    Queries.Marketplace.ListBranchPeriods.query,
    { variables: { braname, options } },
  );
  return result;
}

export type MarketplaceBranchCurrentPeriodView =
  Queries.Marketplace.GetBranchCurrentPeriod.IOutput['marketplaceGetBranchCurrentPeriod'];

export async function getBranchCurrentPeriod(braname: string): Promise<MarketplaceBranchCurrentPeriodView> {
  const { [Queries.Marketplace.GetBranchCurrentPeriod.name]: result } = await client.Query(
    Queries.Marketplace.GetBranchCurrentPeriod.query,
    { variables: { braname } },
  );
  return result;
}


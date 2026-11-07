import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

// Инвестиционный этап кооперативного участка (задачи 99D-30, 99D-31):
// договор участия, вложения деньгами и имуществом, решение председателя
// участка и акт, возврат. Суммы к возврату считает контракт; запросы отдают
// предварительный расчёт.

export type MarketplaceInvestAgreementView = NonNullable<
  Queries.Marketplace.MyInvestAgreement.IOutput['marketplaceMyInvestAgreement']
>;
export type MarketplaceInvestorView = Queries.Marketplace.MyInvestments.IOutput['marketplaceMyInvestments'][number];
export type MarketplaceBranchInvestmentView = Queries.Marketplace.BranchInvestment.IOutput['marketplaceBranchInvestment'];
export type MarketplaceInvestPropertyView = MarketplaceBranchInvestmentView['properties'][number];
export type MarketplaceInvestHistoryView = Queries.Marketplace.MyInvestHistory.IOutput['marketplaceMyInvestHistory'];
export type MarketplaceInvestHistoryEntry = MarketplaceInvestHistoryView['items'][number];
export type InvestDocumentView = Queries.Marketplace.InvestAgreementSignablePayload.IOutput['marketplaceInvestAgreementSignablePayload'];

export type IInvestStatementInput = Queries.Marketplace.InvestStatementSignablePayload.IInput['data'];
export type IInvestPropertyStatementInput = Queries.Marketplace.InvestPropertyStatementSignablePayload.IInput['data'];
export type IInvestPropertyRefInput = Queries.Marketplace.InvestPropertyActSignablePayload.IInput['data'];
export type ISignInvestAgreementInput = Mutations.Marketplace.SignInvestAgreement.IInput['data'];
export type IInvestMoneyInput = Mutations.Marketplace.InvestMoney.IInput['data'];
export type ICreateInvestPropertyInput = Mutations.Marketplace.CreateInvestProperty.IInput['data'];
export type ISignInvestPropertyInput = Mutations.Marketplace.SignInvestPropertyAct.IInput['data'];
export type IDeclineInvestPropertyInput = Mutations.Marketplace.DeclineInvestProperty.IInput['data'];
export type IClaimInvestmentInput = Mutations.Marketplace.ClaimInvestment.IInput['data'];
export type IPaginationInput = NonNullable<Queries.Marketplace.MyInvestHistory.IInput['options']>;

// ─── Чтение ───

export async function getMyAgreement(): Promise<MarketplaceInvestAgreementView | null> {
  const { [Queries.Marketplace.MyInvestAgreement.name]: result } = await client.Query(Queries.Marketplace.MyInvestAgreement.query);
  return result ?? null;
}

export async function listMyInvestments(): Promise<MarketplaceInvestorView[]> {
  const { [Queries.Marketplace.MyInvestments.name]: result } = await client.Query(Queries.Marketplace.MyInvestments.query);
  return result;
}

export async function getBranchInvestment(braname: string): Promise<MarketplaceBranchInvestmentView> {
  const { [Queries.Marketplace.BranchInvestment.name]: result } = await client.Query(Queries.Marketplace.BranchInvestment.query, {
    variables: { braname },
  });
  return result;
}

export async function getMyInvestHistory(options: IPaginationInput): Promise<MarketplaceInvestHistoryView> {
  const { [Queries.Marketplace.MyInvestHistory.name]: result } = await client.Query(Queries.Marketplace.MyInvestHistory.query, {
    variables: { options },
  });
  return result;
}

// ─── Документы к подписи ───

export async function getAgreementPayload(): Promise<InvestDocumentView> {
  const { [Queries.Marketplace.InvestAgreementSignablePayload.name]: result } = await client.Query(
    Queries.Marketplace.InvestAgreementSignablePayload.query,
  );
  return result;
}

export async function getInvestStatementPayload(data: IInvestStatementInput): Promise<InvestDocumentView> {
  const { [Queries.Marketplace.InvestStatementSignablePayload.name]: result } = await client.Query(
    Queries.Marketplace.InvestStatementSignablePayload.query,
    { variables: { data } },
  );
  return result;
}

export async function getPropertyStatementPayload(data: IInvestPropertyStatementInput): Promise<InvestDocumentView> {
  const { [Queries.Marketplace.InvestPropertyStatementSignablePayload.name]: result } = await client.Query(
    Queries.Marketplace.InvestPropertyStatementSignablePayload.query,
    { variables: { data } },
  );
  return result;
}

export async function getPropertyApprovalPayload(data: IInvestPropertyRefInput): Promise<InvestDocumentView> {
  const { [Queries.Marketplace.InvestPropertyApprovalSignablePayload.name]: result } = await client.Query(
    Queries.Marketplace.InvestPropertyApprovalSignablePayload.query,
    { variables: { data } },
  );
  return result;
}

export async function getPropertyActPayload(data: IInvestPropertyRefInput): Promise<InvestDocumentView> {
  const { [Queries.Marketplace.InvestPropertyActSignablePayload.name]: result } = await client.Query(
    Queries.Marketplace.InvestPropertyActSignablePayload.query,
    { variables: { data } },
  );
  return result;
}

export async function getClaimPayload(braname: string): Promise<InvestDocumentView> {
  const { [Queries.Marketplace.InvestClaimSignablePayload.name]: result } = await client.Query(
    Queries.Marketplace.InvestClaimSignablePayload.query,
    { variables: { braname } },
  );
  return result;
}

// ─── Действия ───

export async function signAgreement(data: ISignInvestAgreementInput): Promise<void> {
  await client.Mutation(Mutations.Marketplace.SignInvestAgreement.mutation, { variables: { data } });
}

export async function investMoney(data: IInvestMoneyInput): Promise<void> {
  await client.Mutation(Mutations.Marketplace.InvestMoney.mutation, { variables: { data } });
}

export async function createProperty(data: ICreateInvestPropertyInput): Promise<void> {
  await client.Mutation(Mutations.Marketplace.CreateInvestProperty.mutation, { variables: { data } });
}

export async function approveProperty(data: ISignInvestPropertyInput): Promise<void> {
  await client.Mutation(Mutations.Marketplace.ApproveInvestProperty.mutation, { variables: { data } });
}

export async function declineProperty(data: IDeclineInvestPropertyInput): Promise<void> {
  await client.Mutation(Mutations.Marketplace.DeclineInvestProperty.mutation, { variables: { data } });
}

export async function signPropertyAct(data: ISignInvestPropertyInput): Promise<void> {
  await client.Mutation(Mutations.Marketplace.SignInvestPropertyAct.mutation, { variables: { data } });
}

export async function acceptProperty(data: ISignInvestPropertyInput): Promise<void> {
  await client.Mutation(Mutations.Marketplace.AcceptInvestProperty.mutation, { variables: { data } });
}

export async function claimInvestment(data: IClaimInvestmentInput): Promise<void> {
  await client.Mutation(Mutations.Marketplace.ClaimInvestment.mutation, { variables: { data } });
}

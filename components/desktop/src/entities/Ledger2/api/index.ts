import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
import type {
  ILedger2Account,
  ILedger2Wallet,
  ILedger2HistoryResponse,
  ILedger2HistoryFilterInput,
  ILedger2PostingsResponse,
  ILedger2PostingsFilterInput,
  ILedger2AdjustmentResult,
  IWalmoveInput,
} from '../types';

async function getAccounts(coopname: string): Promise<ILedger2Account[]> {
  const { [Queries.Ledger2.GetLedger2Accounts.name]: output } = await client.Query(
    Queries.Ledger2.GetLedger2Accounts.query,
    { variables: { coopname } },
  );
  return output ?? [];
}

async function getWallets(coopname: string): Promise<ILedger2Wallet[]> {
  const { [Queries.Ledger2.GetLedger2Wallets.name]: output } = await client.Query(
    Queries.Ledger2.GetLedger2Wallets.query,
    { variables: { coopname } },
  );
  return output ?? [];
}

async function getHistory(
  input: ILedger2HistoryFilterInput,
): Promise<ILedger2HistoryResponse | undefined> {
  const { [Queries.Ledger2.GetLedger2History.name]: output } = await client.Query(
    Queries.Ledger2.GetLedger2History.query,
    { variables: { input } },
  );
  return output;
}

async function getPostings(
  input: ILedger2PostingsFilterInput,
): Promise<ILedger2PostingsResponse | undefined> {
  const { [Queries.Ledger2.GetLedger2Postings.name]: output } = await client.Query(
    Queries.Ledger2.GetLedger2Postings.query,
    { variables: { input } },
  );
  return output;
}

async function walmoveWallets(input: IWalmoveInput): Promise<ILedger2AdjustmentResult> {
  const { [Mutations.Ledger2.WalmoveWallets.name]: output } = await client.Mutation(
    Mutations.Ledger2.WalmoveWallets.mutation,
    { variables: { input } },
  );
  return output as ILedger2AdjustmentResult;
}

export const ledger2Api = {
  getAccounts,
  getWallets,
  getHistory,
  getPostings,
  walmoveWallets,
};

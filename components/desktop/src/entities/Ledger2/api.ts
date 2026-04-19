import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import type {
  ILedger2Account,
  ILedger2Wallet,
  ILedger2HistoryResponse,
  ILedger2HistoryFilterInput,
} from './types';

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

export const ledger2Api = { getAccounts, getWallets, getHistory };

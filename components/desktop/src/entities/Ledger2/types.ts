import type { Mutations, Queries, Zeus } from '@coopenomics/sdk';

export type ILedger2Account =
  Queries.Ledger2.GetLedger2Accounts.IOutput[typeof Queries.Ledger2.GetLedger2Accounts.name][number];

export type ILedger2Wallet =
  Queries.Ledger2.GetLedger2Wallets.IOutput[typeof Queries.Ledger2.GetLedger2Wallets.name][number];

export type ILedger2HistoryResponse =
  Queries.Ledger2.GetLedger2History.IOutput[typeof Queries.Ledger2.GetLedger2History.name];

export type ILedger2Operation = ILedger2HistoryResponse['items'][number];

export type ILedger2HistoryFilterInput = Zeus.ModelTypes['GetLedger2HistoryInput'];

export type ILedger2PostingsResponse =
  Queries.Ledger2.GetLedger2Postings.IOutput[typeof Queries.Ledger2.GetLedger2Postings.name];

export type ILedger2Posting = ILedger2PostingsResponse['items'][number];

export type ILedger2PostingsFilterInput = Zeus.ModelTypes['GetLedger2PostingsInput'];

export type IWalmoveInput = Zeus.ModelTypes['WalmoveInput'];

export type ILedger2AdjustmentResult =
  Mutations.Ledger2.WalmoveWallets.IOutput[typeof Mutations.Ledger2.WalmoveWallets.name];

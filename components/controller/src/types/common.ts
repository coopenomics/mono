import { IEntrepreneurData, IGeneratedDocument, IIndividualData, IOrganizationData } from '@coopenomics/factory';
import { Cooperative, SovietContract } from 'cooptypes';

export type IGetResponse<T> = Cooperative.Document.IGetResponse<T>;

export interface IGetActions<T> {
  results: IAction[];
  page: number;
  limit: number;
}

export interface IGetTables<T> {
  results: IDelta[];
  page: number;
  limit: number;
}

export interface IDelta {
  chain_id: string;
  block_num: number;
  block_id: string;
  /** ISO-8601 время блока (UTC) из SHiP-трейса. parser2 отдаёт, parser1 не отдавал. */
  block_time?: string;
  present: boolean;
  code: string;
  scope: string;
  table: string;
  primary_key: string;
  value?: any;
}

export interface IAction {
  transaction_id: string;
  account: string;
  block_num: number;
  block_id: string;
  /** ISO-8601 время блока (UTC) из SHiP-трейса. parser2 отдаёт, parser1 не отдавал. */
  block_time?: string;
  chain_id: string;
  name: string;
  receiver: string;
  authorization: Array<{
    actor: string;
    permission: string;
  }>;
  data: any;
  action_ordinal: number;
  global_sequence: string;
  account_ram_deltas: Array<{
    account: string;
    delta: number;
  }>;
  console: string;
  receipt: {
    receiver: string;
    act_digest: string;
    global_sequence: string;
    recv_sequence: string;
    auth_sequence: Array<{
      account: string;
      sequence: string;
    }>;
    code_sequence: number;
    abi_sequence: number;
  };
  creator_action_ordinal: number;
  context_free: boolean;
  elapsed: number;
}

export type IExtendedTable = IDelta;

export interface IExtendedAction extends IAction {
  user: IIndividualData | IEntrepreneurData | IOrganizationData | null;
}

export interface IComplexStatement {
  action: IExtendedAction;
  document: IGeneratedDocument;
}

export interface IComplexDecision {
  action: IExtendedAction;
  document: IGeneratedDocument;
  votes_for: IExtendedAction[];
  votes_against: IExtendedAction[];
}

export interface IComplexAct {
  action?: IExtendedAction;
  document?: IGeneratedDocument;
}

export interface IComplexDocument {
  statement: IComplexStatement;
  decision: IComplexDecision;
  acts: IComplexAct[];
}

export interface IGetComplexDocuments {
  results: IComplexDocument[];
  page: number;
  limit: number;
}

export interface IAgenda {
  row: SovietContract.Tables.Decisions.IDecision;
  action: IAction;
}

export interface IComplexAgenda extends IAgenda {
  document: IComplexDocument;
}

export interface IBCAction<T> {
  account: string;
  name: string;
  authorization: [
    {
      actor: string;
      permission: string;
    }
  ];
  data: T;
}

/**
 * Доменные интерфейсы аккаунтов — порты для доступа к данным аккаунтов из расширений
 */

export interface IMonoAccountDomain {
  username: string;
  role: string;
  type?: string;
  status?: string;
  is_registered?: boolean;
  has_account?: boolean;
  referer?: string;
  registrator?: string;
}

export interface IAccountDataPort {
  getAccount(username: string): Promise<IMonoAccountDomain | null>;
  getAccounts(filter?: any, pagination?: any): Promise<{ items: IMonoAccountDomain[]; totalCount: number }>;
}

export const ACCOUNT_DATA_PORT = Symbol('AccountDataPort');

export interface ICandidateRepository {
  findByUsername(username: string): Promise<any | null>;
  save(candidate: any): Promise<void>;
}

export const CANDIDATE_REPOSITORY = Symbol('CandidateRepository');

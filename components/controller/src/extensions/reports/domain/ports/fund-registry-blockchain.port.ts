import type { FundContract } from 'cooptypes';
import type { InnerTransactResult } from '@coopenomics/innercoop';

/**
 * Доступ стола бухгалтера к реестру фондов кооператива в цепи (контракт fund,
 * таблица `funds`; задачи 99D-25, 99D-24).
 *
 * Пять стандартных фондов — настройки без остатков: вид, название, описание,
 * процент отчислений и кошелёк ledger2. Остатки и движения фондов живут на
 * кошельках (кошелёк и есть субсчёт фонда), их читает учётная книга.
 */
export interface FundRegistryBlockchainPort {
  /** Пять строк реестра фондов кооператива. */
  listFunds(coopname: string): Promise<FundContract.Tables.Funds.IFund[]>;
  /**
   * Правка описания и процента фонда. Подписывает кооператив: право
   * председателя проверено столом до вызова, его имя — в `username`, контракт
   * сверяет его с председателем совета.
   */
  editFund(data: FundContract.Actions.EditFund.IEditFund): Promise<InnerTransactResult>;
}

export const FUND_REGISTRY_BLOCKCHAIN_PORT = Symbol('FUND_REGISTRY_BLOCKCHAIN_PORT');

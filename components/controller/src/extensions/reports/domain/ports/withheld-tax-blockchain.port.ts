import type { SovietContract } from 'cooptypes';
import type { InnerTransactResult } from '@coopenomics/innercoop';

/**
 * Цепь глазами стола бухгалтера в части удержанного налога.
 *
 * Долг перед бюджетом живёт в общекооперативном кошельке `w.sov.ndfl`: его
 * пополняет любая программа, которая выплатила доход физлицу и удержала
 * налог, а гасит бухгалтерия единым налоговым платежом. Поэтому и читает
 * остаток, и создаёт заявку тот, кто платит, — стол бухгалтера, а не
 * программа-источник.
 */
export interface WithheldTaxBlockchainPort {
  /**
   * Остаток кошелька удержанного налога — он же долг кооператива перед
   * бюджетом. `null`, если кошелька ещё нет: удержаний не было.
   */
  getWithheldTaxWalletBalance(coopname: string): Promise<string | null>;

  /**
   * Заявки на перечисление, ещё не подтверждённые кассиром. Их суммы уже
   * сидят в остатке кошелька, поэтому без них бухгалтер отправил бы те же
   * деньги дважды.
   */
  listPendingTaxRequests(coopname: string): Promise<SovietContract.Tables.Taxes.ISovietTax[]>;

  /** Завести заявку на перечисление: подпись — ключ кооператива. */
  createTaxRequest(data: SovietContract.Actions.Tax.CreateTax.ICreatetax): Promise<InnerTransactResult>;
}

export const WITHHELD_TAX_BLOCKCHAIN_PORT = Symbol('WITHHELD_TAX_BLOCKCHAIN_PORT');

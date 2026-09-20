import type { EdubridgeContract } from 'cooptypes';
import type { InnerTransactResult } from '@coopenomics/innercoop';

/**
 * Действия контракта `edubridge` от имени кооператива. Пакет из нескольких
 * действий проходит одной транзакцией — либо целиком, либо никак.
 */
export interface EdubridgeChainPort {
  /**
   * Конвертация паевого в членский, подписка и списание взноса в фонд
   * программы — одной транзакцией. Взнос уходит в распоряжение кооператива
   * сразу при подключении подписки (Положение ЦПП, п. 4.2.2), поэтому три
   * действия проходят вместе либо не проходят вовсе.
   */
  /**
   * Подписка одной транзакцией: конвертация (когда есть недостача), открытие
   * или продление подписки, списание взноса в фонд. `convert` пуст, если взнос
   * покрыт остатком кошелька программы целиком.
   */
  convertAndSubscribe(
    convert: EdubridgeContract.Actions.Convert.IConvert | null,
    subscribe:
      | { kind: 'open'; data: EdubridgeContract.Actions.Opensub.IOpensub }
      | { kind: 'extend'; data: EdubridgeContract.Actions.Extendsub.IExtendsub },
    charge: EdubridgeContract.Actions.Chargefee.IChargefee
  ): Promise<InnerTransactResult>;
  expireSubscription(data: EdubridgeContract.Actions.Expiresub.IExpiresub): Promise<InnerTransactResult>;
  /** Отмена подписки с возвратом взноса; `to_share` — возврат сразу в паевой. */
  cancelSubscription(data: EdubridgeContract.Actions.Cancelsub.ICancelsub): Promise<InnerTransactResult>;
  /** Возврат остатка кошелька программы в паевой по заявлению ученика. */
  returnToShare(data: EdubridgeContract.Actions.Retshare.IRetshare): Promise<InnerTransactResult>;
  /** Приём материалов занятия на ответственное хранение на срок гарантии курса. */
  holdRid(data: EdubridgeContract.Actions.Holdrid.IHoldrid): Promise<InnerTransactResult>;
  submitRid(data: EdubridgeContract.Actions.Submitrid.ISubmitrid): Promise<InnerTransactResult>;
  acceptRid(data: EdubridgeContract.Actions.Acceptrid.IAcceptrid): Promise<InnerTransactResult>;
  declineRid(data: EdubridgeContract.Actions.Declinerid.IDeclinerid): Promise<InnerTransactResult>;
  /** Снятие материалов с ответственного хранения по рекламации внутри срока. */
  recallRid(data: EdubridgeContract.Actions.Recallrid.IRecallrid): Promise<InnerTransactResult>;
  /** Договор УХД преподавателя (первая подпись) — уходит председателю на одобрение. */
  signContract(data: EdubridgeContract.Actions.Signcontract.ISigncontract): Promise<InnerTransactResult>;
  /** Приложение к договору на курс (первая подпись) — уходит председателю на одобрение. */
  signAnnex(data: EdubridgeContract.Actions.Signannex.ISignannex): Promise<InnerTransactResult>;
  /** Расход программы: средства фонда уходят в пул расходов, записка — в шасси. */
  createExpense(data: EdubridgeContract.Actions.CreateExp.ICreateexp): Promise<InnerTransactResult>;
}

export const EDUBRIDGE_CHAIN_PORT = Symbol('EDUBRIDGE_CHAIN_PORT');

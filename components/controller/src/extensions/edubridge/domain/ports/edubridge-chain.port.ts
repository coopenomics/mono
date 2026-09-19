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
  convertAndSubscribe(
    convert: EdubridgeContract.Actions.Convert.IConvert,
    subscribe:
      | { kind: 'open'; data: EdubridgeContract.Actions.Opensub.IOpensub }
      | { kind: 'extend'; data: EdubridgeContract.Actions.Extendsub.IExtendsub },
    charge: EdubridgeContract.Actions.Chargefee.IChargefee
  ): Promise<InnerTransactResult>;
  expireSubscription(data: EdubridgeContract.Actions.Expiresub.IExpiresub): Promise<InnerTransactResult>;
  submitRid(data: EdubridgeContract.Actions.Submitrid.ISubmitrid): Promise<InnerTransactResult>;
  acceptRid(data: EdubridgeContract.Actions.Acceptrid.IAcceptrid): Promise<InnerTransactResult>;
  declineRid(data: EdubridgeContract.Actions.Declinerid.IDeclinerid): Promise<InnerTransactResult>;
  /** Договор УХД преподавателя (первая подпись) — уходит председателю на одобрение. */
  signContract(data: EdubridgeContract.Actions.Signcontract.ISigncontract): Promise<InnerTransactResult>;
  /** Приложение к договору на курс (первая подпись) — уходит председателю на одобрение. */
  signAnnex(data: EdubridgeContract.Actions.Signannex.ISignannex): Promise<InnerTransactResult>;
}

export const EDUBRIDGE_CHAIN_PORT = Symbol('EDUBRIDGE_CHAIN_PORT');

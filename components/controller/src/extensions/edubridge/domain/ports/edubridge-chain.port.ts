import type { EdubridgeContract } from 'cooptypes';
import type { InnerTransactResult } from '@coopenomics/innercoop';

/**
 * Действия контракта `edubridge` от имени кооператива. Пакет из нескольких
 * действий проходит одной транзакцией — либо целиком, либо никак.
 */
export interface EdubridgeChainPort {
  /** Конвертация паевого в членский + открытие/продление подписки — одной транзакцией. */
  convertAndSubscribe(
    convert: EdubridgeContract.Actions.Convert.IConvert,
    subscribe:
      | { kind: 'open'; data: EdubridgeContract.Actions.Opensub.IOpensub }
      | { kind: 'extend'; data: EdubridgeContract.Actions.Extendsub.IExtendsub }
  ): Promise<InnerTransactResult>;
  expireSubscription(data: EdubridgeContract.Actions.Expiresub.IExpiresub): Promise<InnerTransactResult>;
  submitRid(data: EdubridgeContract.Actions.Submitrid.ISubmitrid): Promise<InnerTransactResult>;
  acceptRid(data: EdubridgeContract.Actions.Acceptrid.IAcceptrid): Promise<InnerTransactResult>;
  declineRid(data: EdubridgeContract.Actions.Declinerid.IDeclinerid): Promise<InnerTransactResult>;
}

export const EDUBRIDGE_CHAIN_PORT = Symbol('EDUBRIDGE_CHAIN_PORT');

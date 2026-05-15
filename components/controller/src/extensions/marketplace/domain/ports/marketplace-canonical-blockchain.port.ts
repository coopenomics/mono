import type { MarketContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';

/**
 * Story 4.1: canonical blockchain port для marketplace процессов
 * p.mkt.supply / p.mkt.return / p.mkt.wroff (Story 11.1 / PR #375 +
 * PR #385 TS-foundation).
 *
 * Каждый метод оборачивает один canonical action; авторизация
 * каждого action идёт от кооператива (`require_auth(coopname)`),
 * пайщик аутентифицируется на уровне application service через
 * core-сессию.
 *
 * Stories Эпика 4 расширяют этот port по мере подключения actions:
 *  - Story 4.1 → createOrder
 *  - Story 4.4 → cancelOrder
 *  - Story 4.3 → expireOrder (cron-driven)
 *  - Story 4.5 → acceptOrder / declineOrder
 *
 * Stories Эпика 5/6 → signSupp / signChair / signIss1 / signIss2.
 * Stories Эпика 7 → submRetrn / aprRetRem / rejRetRem / accRetrn / rejRetrn.
 * Stories Эпика 8 → propWroff / execWroff / declWroff.
 */
export interface MarketplaceCanonicalBlockchainPort {
  createOrder(data: MarketContract.Actions.CreateOrder.ICreateOrder): Promise<TransactResult>;
}

export const MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT = Symbol('MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT');

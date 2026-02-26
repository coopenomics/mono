import { Injectable, Inject, Logger } from '@nestjs/common';
import { COOPLACE_BLOCKCHAIN_PORT, type CooplaceBlockchainPort } from '~/domain/cooplace/interfaces/cooplace-blockchain.port';
import { config } from '~/config';

/**
 * MatchService — при каждой встречной заявке сразу публикует в блокчейн.
 *
 * Логика:
 * - Карточка (offer/order) живёт в БД: draft → moderation → published
 * - Любая встречная заявка → немедленная публикация в блокчейн → блокировка средств
 * - min_units/cycle_deadline НЕ влияют на match — это пороги для запуска поставки
 */
@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    @Inject(COOPLACE_BLOCKCHAIN_PORT)
    private readonly blockchainPort: CooplaceBlockchainPort,
  ) {}

  /**
   * Направление OFFER→ORDER: поставщик создал offer, заказчик делает order.
   * Каждый order сразу уходит в блокчейн (orderoffer action).
   */
  async matchOrderToOffer(params: {
    customerUsername: string;
    receiverBraname: string;
    hash: string;
    units: number;
    unitCost: string;
    productLifecycleSecs: number;
    warrantyPeriodSecs: number;
    membershipFeeAmount: string;
    cancellationFeeAmount: string;
    convertInDocument: Record<string, unknown>;
    deliveryType: string;
    contributionType: string;
    meta: string;
  }): Promise<{ transactionId: string }> {
    this.logger.log(`Match ORDER→OFFER: заказчик ${params.customerUsername}, ${params.units} ед. по ${params.unitCost}`);

    const result = await this.blockchainPort.createChildOrder({
      params: {
        coopname: config.coopname,
        username: params.customerUsername,
        braname: params.receiverBraname,
      },
      document: params.convertInDocument as any,
    } as any);

    return { transactionId: result?.response?.transaction_id || '' };
  }

  /**
   * Направление ORDER→OFFER: заказчик создал order, поставщик делает offer.
   * Каждый offer сразу уходит в блокчейн (respondoffer action).
   */
  async matchOfferToOrder(params: {
    supplierUsername: string;
    supplierBraname: string;
    orderHash: string;
    offerHash: string;
    units: number;
    productLifecycleSecs: number;
    contributionStatement: Record<string, unknown>;
    convertOutDocument: Record<string, unknown>;
  }): Promise<{ transactionId: string }> {
    this.logger.log(`Match OFFER→ORDER: поставщик ${params.supplierUsername}, ${params.units} ед.`);

    const result = await (this.blockchainPort as any).respondoffer?.({
      coopname: config.coopname,
      supplier_braname: params.supplierBraname,
      username: params.supplierUsername,
      order_hash: params.orderHash,
      offer_hash: params.offerHash,
      units: params.units,
      product_lifecycle_secs: params.productLifecycleSecs,
      contribution_statement: params.contributionStatement,
      convert_out: params.convertOutDocument,
    });

    return { transactionId: result?.response?.transaction_id || '' };
  }
}

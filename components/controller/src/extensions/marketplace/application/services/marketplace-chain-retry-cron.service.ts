import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import type { MarketContract } from 'cooptypes';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY,
  type MarketplaceOutgoingPaymentRequestDomainRepository,
} from '../../domain/repositories/marketplace-outgoing-payment-request.repository';
import { MarketplaceOutgoingPaymentRequestStatuses } from '../../domain/entities/marketplace-outgoing-payment-request.types';
import type { MarketplaceOutgoingPaymentRequestDomainEntity } from '../../domain/entities/marketplace-outgoing-payment-request.entity';
import { MarketplaceOrderPayoutStatuses } from '../../domain/entities/marketplace-order.types';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import { MARKETPLACE_ASSET_CONFIG, type MarketplaceAssetConfig } from './marketplace-asset.config';
import { MARKETPLACE_APL_RECEPTION_SERVICE, type MarketplaceAplReceptionService } from './marketplace-apl-reception.service';
import {
  MARKETPLACE_RETURN_CLAIM_REPOSITORY,
  type MarketplaceReturnClaimDomainRepository,
} from '../../domain/repositories/marketplace-return-claim.repository';
import { MARKETPLACE_RETURN_CLAIM_SERVICE, type MarketplaceReturnClaimService } from './marketplace-return-claim.service';

/** Сколько заказов с недоведённой уценкой берём за прогон — защита от лавины сабмитов. */
const MARKDOWN_BATCH_LIMIT = 100;

/** Сколько заявлений с ожидающим взносом берём за прогон. */
const RETURN_FEE_BATCH_LIMIT = 50;

/** Контракт отвечает так, когда заявка уже стёрта или взнос по ней уже доведён. */
const RETURN_FEE_NOT_PENDING_RE = /не ожидает довнесения|не найдено по хэшу/;

/**
 * Повтор денежных действий, которые бэкенд отправляет в цепь после
 * закрывающих подписей (задача 99D-15). Сами подписи цепь уже приняла, и
 * ронять их из-за сбоя второго шага нельзя, поэтому уценка и инициация
 * выплаты идут best-effort — а недошедшее раньше только писалось в журнал:
 * уценка навсегда оставалась на счёте 10, выплату кассир не видел.
 *
 * Раз в час:
 *  - уценка: заказы с рассчитанной `markdown_due`, у которых цепь ещё не
 *    отзеркалила `markdown_cost`, получают повторный `markdown`; контракт
 *    идемпотентен (уценка по заказу списывается один раз), а закрытие таких
 *    заказов крон закрытия откладывает;
 *  - выплата: проекции выплат в PENDING, у которых на цепи выплата не
 *    инициирована (зеркало заказа не в pending/completed) либо нет платежа в
 *    общем реестре кооператива, довозятся недостающим шагом.
 *
 *  - взнос по гарантийному возврату: заявления, у которых совет отменил
 *    сделку, а общий кошелёк участка был распределён, получают повторный
 *    `payretfee`; контракт отказывает, пока участок не пополнил кошелёк, и
 *    снимает ожидание сам, когда взнос доведён (слушатель `payretfee`).
 *
 * Выплата по заказу, у которого проекции нет вовсе (сбой до её создания),
 * крону не видна — такой случай виден инварианту I7 и разбирается вручную.
 */
@Injectable()
export class MarketplaceChainRetryCronService {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY)
    private readonly paymentRepo: MarketplaceOutgoingPaymentRequestDomainRepository,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_APL_RECEPTION_SERVICE)
    private readonly receptionService: MarketplaceAplReceptionService,
    @Inject(MARKETPLACE_RETURN_CLAIM_REPOSITORY)
    private readonly claimRepo: MarketplaceReturnClaimDomainRepository,
    @Inject(MARKETPLACE_RETURN_CLAIM_SERVICE)
    private readonly returnService: MarketplaceReturnClaimService,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceChainRetryCronService.name);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async triggerHourlyRetry(): Promise<void> {
    const coopname = platformSettings().coopname;
    if (!coopname) return;
    await this.retryMarkdowns(coopname);
    await this.retryPayouts(coopname);
    await this.retryReturnFees(coopname);
  }

  /**
   * Взнос по гарантийному возврату ждёт пополнения общего кошелька участка:
   * повторный `payretfee` проходит, как только средства появились. Отказ
   * «не ожидает довнесения» значит, что заявка на цепи уже закрыта — ожидание
   * в проекции снимается, чтобы не слать повтор по закрытой заявке.
   */
  async retryReturnFees(coopname: string): Promise<{ sent: number; failed: number }> {
    let pending;
    try {
      pending = await this.claimRepo.listFeeRefundPending(coopname, RETURN_FEE_BATCH_LIMIT);
    } catch (e) {
      this.logger.warn(`[CHAIN_RETRY] выборка заявлений с ожидающим взносом упала: ${(e as Error).message}`);
      return { sent: 0, failed: 0 };
    }
    let sent = 0;
    let failed = 0;
    for (const claim of pending) {
      try {
        await this.chainPort.payRetFee({
          coopname,
          request_hash: claim.request_hash as MarketContract.Actions.PayRetFee.IPayRetFee['request_hash'],
        });
        sent++;
      } catch (e) {
        const message = (e as Error).message ?? '';
        if (RETURN_FEE_NOT_PENDING_RE.test(message)) {
          await this.returnService.onFeeRefundSettled({
            coopname,
            request_hash: claim.request_hash,
            tx_hash: '',
            comment: 'По данным цепи взнос по заявлению уже доведён либо заявка закрыта.',
          });
          continue;
        }
        failed++;
        this.logger.warn(`[CHAIN_RETRY] взнос ${claim.fee_refund} по возврату ${claim.request_hash} не доведён: ${message}`);
      }
    }
    if (pending.length > 0) {
      this.logger.info(`[CHAIN_RETRY] взносы по возвратам: отправлено ${sent}, ждут пополнения ${failed} из ${pending.length} (coopname=${coopname})`);
    }
    return { sent, failed };
  }

  async retryMarkdowns(coopname: string): Promise<{ sent: number; failed: number }> {
    let candidates: MarketplaceOrderDomainEntity[];
    try {
      candidates = await this.orderRepo.listMarkdownPending(coopname, MARKDOWN_BATCH_LIMIT);
    } catch (e) {
      this.logger.warn(`[CHAIN_RETRY] выборка заказов с недоведённой уценкой упала: ${(e as Error).message}`);
      return { sent: 0, failed: 0 };
    }
    let sent = 0;
    let failed = 0;
    for (const order of candidates) {
      const amount = `${Number.parseFloat(order.markdown_due ?? '0').toFixed(this.assetConfig.decimals)} ${this.assetConfig.symbol}`;
      try {
        await this.chainPort.markdown({
          coopname,
          order_hash: order.order_hash as MarketContract.Actions.Markdown.IMarkdown['order_hash'],
          amount,
        });
        sent++;
      } catch (e) {
        failed++;
        this.logger.warn(`[CHAIN_RETRY] уценка ${amount} по заказу ${order.order_hash} не проведена: ${(e as Error).message}`);
      }
    }
    if (candidates.length > 0) {
      this.logger.info(`[CHAIN_RETRY] уценки: отправлено ${sent}, не прошло ${failed} из ${candidates.length} (coopname=${coopname})`);
    }
    return { sent, failed };
  }

  async retryPayouts(coopname: string): Promise<{ redelivered: number }> {
    let pending: MarketplaceOutgoingPaymentRequestDomainEntity[];
    try {
      pending = await this.paymentRepo.listAll(coopname, { statuses: [MarketplaceOutgoingPaymentRequestStatuses.PENDING] });
    } catch (e) {
      this.logger.warn(`[CHAIN_RETRY] выборка ожидающих выплат упала: ${(e as Error).message}`);
      return { redelivered: 0 };
    }
    let redelivered = 0;
    for (const projection of pending) {
      const order = await this.orderRepo.findByOrderHash(coopname, projection.order_hash);
      // Заказа на цепи уже нет — выплату он закрыл сам (полное удержание при
      // отказе) либо разбор ручной; повторять нечего.
      if (!order || !order.on_chain_present) continue;
      const nothingToPay = Number.parseFloat(projection.amount) <= 0;
      const chainHasPayout =
        order.payout_status === MarketplaceOrderPayoutStatuses.PENDING ||
        order.payout_status === MarketplaceOrderPayoutStatuses.COMPLETED;
      const steps = {
        createCorePayment: !projection.core_payment_id && !nothingToPay,
        submitChain: !chainHasPayout,
      };
      if (!steps.createCorePayment && !steps.submitChain) continue;
      await this.receptionService.redeliverPayout(projection, steps);
      redelivered++;
    }
    if (redelivered > 0) {
      this.logger.info(`[CHAIN_RETRY] выплаты: довезено шагов по ${redelivered} из ${pending.length} ожидающих (coopname=${coopname})`);
    }
    return { redelivered };
  }
}

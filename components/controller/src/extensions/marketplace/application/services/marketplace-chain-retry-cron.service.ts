import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import type { MarketContract } from 'cooptypes';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import { MARKETPLACE_ASSET_CONFIG, type MarketplaceAssetConfig } from './marketplace-asset.config';

/** Сколько заказов с недоведённой уценкой берём за прогон — защита от лавины сабмитов. */
const MARKDOWN_BATCH_LIMIT = 100;

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
 *
 * Выплату поставщику довозит обход пакетов выплаты
 * (`MarketplaceSupplierPayoutService`, решение владельца 19.11.2026).
 */
@Injectable()
export class MarketplaceChainRetryCronService {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
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
}

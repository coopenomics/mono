import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import config from '~/config/config';
import type { MarketContract } from 'cooptypes';
import { MarketplaceOrderEntity } from '../../infrastructure/entities/marketplace-order.entity';
import { MarketplaceOrderStatuses } from '../../domain/entities/marketplace-order.types';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';

/** Сколько кандидатов закрываем за один прогон — защита от лавины сабмитов. */
const CLOSE_BATCH_LIMIT = 200;

/**
 * Крон-закрытие выданных заказов после выхода гарантийного срока (принцип
 * конечного жизненного цикла RAM-записей: ничего не висит на цепи навсегда).
 *
 * Ежедневно выбирает из PG заказы в RECEIVED, у которых гарантийный срок
 * вышел (или гарантия не была предусмотрена) и on-chain запись ещё
 * существует, и для каждого вызывает `marketplace::closeorder`. Контракт —
 * финальный судья: до выхода гарантийного срока, при незавершённой выплате
 * поставщику или открытом возврате закрытие отклоняется — такой заказ
 * остаётся кандидатом следующего прогона. После успешного закрытия дельта
 * парсера (present=false) снимает `on_chain_present`, и заказ выпадает из
 * выборки; история заказа остаётся в PG и журнале действий.
 */
@Injectable()
export class MarketplaceOrderCloseCronService implements OnModuleInit {
  constructor(
    @InjectRepository(MarketplaceOrderEntity, 'marketplace')
    private readonly orderRepo: Repository<MarketplaceOrderEntity>,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceOrderCloseCronService.name);
  }

  onModuleInit(): void {
    this.logger.info(
      `[ORDER_CLOSE_CRON] планировщик закрытия выданных заказов активирован для coopname=${config.coopname}`
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async triggerDailyClose(): Promise<void> {
    const coopname = config.coopname;
    if (!coopname) return;

    const now = new Date();
    const base = {
      coopname,
      status: MarketplaceOrderStatuses.RECEIVED,
      on_chain_present: true,
    };
    const candidates = await this.orderRepo.find({
      where: [
        { ...base, warranty_until: IsNull() },
        { ...base, warranty_until: LessThanOrEqual(now) },
      ],
      take: CLOSE_BATCH_LIMIT,
      order: { warranty_until: 'ASC' },
    });

    if (candidates.length === 0) return;

    let closed = 0;
    let skipped = 0;
    for (const order of candidates) {
      try {
        await this.chainPort.closeOrder({
          coopname,
          order_hash: order.order_hash as MarketContract.Actions.CloseOrder.ICloseOrder['order_hash'],
        });
        closed++;
      } catch (e) {
        // Контракт отклоняет закрытие, пока не выполнены все условия
        // (выплата поставщику, открытый возврат) — заказ останется
        // кандидатом следующего прогона.
        skipped++;
        this.logger.warn(
          `[ORDER_CLOSE_CRON] заказ ${order.order_hash} не закрыт: ${(e as Error).message}`
        );
      }
    }

    this.logger.info(
      `[ORDER_CLOSE_CRON] прогон завершён: закрыто ${closed}, отложено ${skipped} из ${candidates.length} кандидатов (coopname=${coopname})`
    );
  }
}

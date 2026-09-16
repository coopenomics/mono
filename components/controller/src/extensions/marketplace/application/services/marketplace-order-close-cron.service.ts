import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import type { MarketContract } from 'cooptypes';
import { MarketplaceOrderEntity } from '../../infrastructure/entities/marketplace-order.entity';
import { MarketplaceOrderStatuses } from '../../domain/entities/marketplace-order.types';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';

/** Сколько кандидатов закрываем за один прогон — защита от лавины сабмитов. */
const CLOSE_BATCH_LIMIT = 200;

/** Уценка рассчитана бэкендом, а цепь её ещё не отзеркалила. */
export function isMarkdownPending(order: { markdown_due: string | null; markdown_cost: string | null }): boolean {
  const due = Number.parseFloat(order.markdown_due ?? '0');
  const done = Number.parseFloat(order.markdown_cost ?? '0');
  return due > 0 && !(done > 0);
}

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
 *
 * Заказ с рассчитанной, но не проведённой на цепи уценкой (`markdown_due`
 * без `markdown_cost`) не закрывается: после закрытия запись стёрта и
 * уценку уже не провести — разница навсегда осталась бы на счёте 10
 * (задача 99D-15). Такой заказ ждёт крон повтора уценки.
 */
@Injectable()
export class MarketplaceOrderCloseCronService implements OnModuleInit {
  constructor(
    @InjectRepository(MarketplaceOrderEntity, 'marketplace')
    private readonly orderRepo: Repository<MarketplaceOrderEntity>,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceOrderCloseCronService.name);
  }

  onModuleInit(): void {
    this.logger.info(
      `[ORDER_CLOSE_CRON] планировщик закрытия выданных заказов активирован для coopname=${platformSettings().coopname}`
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async triggerDailyClose(): Promise<void> {
    const coopname = platformSettings().coopname;
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
      if (isMarkdownPending(order)) {
        skipped++;
        this.logger.warn(
          `[ORDER_CLOSE_CRON] заказ ${order.order_hash} не закрыт: уценка ${order.markdown_due} ещё не проведена на цепи`
        );
        continue;
      }
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

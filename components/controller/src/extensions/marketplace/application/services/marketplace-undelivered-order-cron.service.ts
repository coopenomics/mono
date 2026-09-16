import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import { MarketplaceOrderSupplierActionService } from './marketplace-order-supplier-action.service';

/** Срок поставки после принятия заказа поставщиком — решение владельца 10.09.2026. */
export const MARKETPLACE_UNDELIVERED_ORDER_HOURS = 48;

/** Сколько заказов закрываем за прогон — защита от лавины сабмитов. */
const UNDELIVERED_BATCH_LIMIT = 100;

/**
 * Закрытие непоставленных заказов (задача 99D-16). Поставщик принял заказ, а
 * имущество за 48 часов от принятия так и не привёз (подписи поставщика на
 * акте приёмки нет). Без этого крона резерв заказчика стоял бы бессрочно, а
 * единственным выходом у заказчика был бы отказ с удержанием половины — за
 * вину поставщика.
 *
 * Раз в час выбирает заказы в ACCEPTED с `accepted_at` старше срока и по
 * каждому зовёт закрытие по сроку. Контракт — финальный судья: если поставщик
 * успел подписать акт приёмки, а проекция отстала, цепь откажет, и заказ
 * выпадет из выборки после синхронизации. Отказ по одному заказу не
 * останавливает остальные.
 */
@Injectable()
export class MarketplaceUndeliveredOrderCronService {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    private readonly supplierActions: MarketplaceOrderSupplierActionService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceUndeliveredOrderCronService.name);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async triggerHourlyExpire(): Promise<void> {
    const coopname = platformSettings().coopname;
    if (!coopname) return;
    await this.expireUndelivered(coopname, new Date());
  }

  async expireUndelivered(coopname: string, now: Date): Promise<{ expired: number; failed: number }> {
    const acceptedBefore = new Date(now.getTime() - MARKETPLACE_UNDELIVERED_ORDER_HOURS * 60 * 60 * 1000);
    let candidates: MarketplaceOrderDomainEntity[];
    try {
      candidates = await this.orderRepo.listUndelivered(coopname, acceptedBefore, UNDELIVERED_BATCH_LIMIT);
    } catch (e) {
      this.logger.warn(`[UNDELIVERED] выборка непоставленных заказов упала: ${(e as Error).message}`);
      return { expired: 0, failed: 0 };
    }
    let expired = 0;
    let failed = 0;
    for (const order of candidates) {
      try {
        await this.supplierActions.expireUndeliveredOrder(order);
        expired++;
      } catch (e) {
        failed++;
        this.logger.warn(`[UNDELIVERED] заказ ${order.order_hash} не закрыт по сроку поставки: ${(e as Error).message}`);
      }
    }
    if (candidates.length > 0) {
      this.logger.info(
        `[UNDELIVERED] закрыто по сроку поставки ${expired}, не прошло ${failed} из ${candidates.length} (coopname=${coopname})`
      );
    }
    return { expired, failed };
  }
}

import { Inject, Injectable, Optional, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import config from '~/config/config';
import { ExtensionDomainService } from '~/domain/extension/services/extension-domain.service';
import { MarketplaceInventoryEntity } from '../../infrastructure/entities/marketplace-inventory.entity';
import { MarketplaceInventoryOnWarehouseStatuses } from '../../domain/entities/marketplace-inventory.types';
import { MarketplaceWriteoffProposalTriggers } from '../../domain/entities/marketplace-writeoff-proposal.types';
import { MarketplaceWriteoffService } from './marketplace-writeoff.service';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';
import type { IConfig } from '../../types';
import { MARKETPLACE_WRITEOFF_DRAFT_BUILT_EVENT } from '../events/marketplace-notification.events';

/**
 * Story 8.3 (Эпик 8): крон-сканер скоропорта.
 *
 * Раз в месяц проходит по `marketplace_inventory.expiry_date`. Если в
 * настройках расширения `writeoff.auto_proposal_enabled = true` —
 * формирует DRAFT-проект списания со всеми позициями, у которых срок
 * годности истёк уже как минимум `writeoff.post_expiry_grace_days` дней
 * назад (`expiry_date <= now - grace`). Иначе — только эмитит напоминание
 * председателю, чтобы тот собрал корзину вручную.
 *
 * Списываем по факту порчи, а не заранее, и с отступом: свежепросроченное
 * ещё может быть забрано получателем — в кандидаты идёт только то, что
 * пролежало просроченным достаточно долго и окончательно испортилось.
 */
@Injectable()
export class MarketplaceWriteoffCronService implements OnModuleInit {
  constructor(
    @InjectRepository(MarketplaceInventoryEntity, 'marketplace')
    private readonly inventoryRepo: Repository<MarketplaceInventoryEntity>,
    private readonly writeoffService: MarketplaceWriteoffService,
    @Optional()
    private readonly extensionDomainService: ExtensionDomainService | null,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    private readonly eventBus: EventEmitter2,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceWriteoffCronService.name);
  }

  onModuleInit(): void {
    this.logger.info(
      `[WRITEOFF_CRON] планировщик ежемесячных списаний активирован для coopname=${config.coopname}`
    );
  }

  /**
   * Раз в месяц — на первое число в полдень UTC. CronExpression выбран
   * из стандартных значений `@nestjs/schedule`, точную дату согласовывает
   * бухгалтер через настройки кооператива (Phase 2).
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_NOON)
  async triggerMonthlyCycle(): Promise<void> {
    const coopname = config.coopname;
    if (!coopname) return;

    const existingDraft = await this.writeoffService.getOpenDraft(coopname);
    if (existingDraft) {
      this.logger.info(
        `[WRITEOFF_CRON] DRAFT id=${existingDraft.id} уже существует — пропускаю цикл`
      );
      return;
    }

    const extension = this.extensionDomainService ? await this.extensionDomainService.getAppByName('market') : null;
    const cfg = extension?.config as IConfig | undefined;
    const auto = cfg?.writeoff?.auto_proposal_enabled ?? true;
    const graceDays = cfg?.writeoff?.post_expiry_grace_days ?? 7;

    if (!auto) {
      this.logger.info(
        `[WRITEOFF_CRON] auto-proposal=OFF — председателю отправлено только напоминание (coopname=${coopname})`
      );
      this.eventBus.emit('marketplace.writeoff.cron.reminder', {
        coopname,
        fired_at: new Date().toISOString(),
      });
      return;
    }

    // Сейчас крон-сборка покрывает ОДИН тип кандидата из AC Story 8.1
    // (expiry_date истекает). Три других категории (RETURNED_TO_WAREHOUSE,
    // EXCESS_RETURNED_TO_WAREHOUSE, items «без юр. оформления» старше
    // threshold writeoff_returned_age_days) — Phase 2: требуется
    // расширение marketplace_inventory.status + поля returned_at / age_days.
    const cutoff = new Date(Date.now() - graceDays * 86_400_000);
    const candidates = await this.inventoryRepo.find({
      where: {
        coopname,
        // Скоропорт сканируем по всем позициям на складе — промаркированным и нет
        // (штрих-код опционален, срок годности задаётся на приёмке).
        status: In([...MarketplaceInventoryOnWarehouseStatuses]),
        expiry_date: LessThanOrEqual(cutoff),
      },
      take: 200,
      order: { expiry_date: 'ASC' },
    });

    if (candidates.length === 0) {
      this.logger.info(
        `[WRITEOFF_CRON] не найдено позиций, просроченных более чем на ${graceDays} дн. (coopname=${coopname})`
      );
      return;
    }

    // Фильтруем позиции без unit_cost — без суммы validateAndNormalizeItems
    // отобьёт весь draft. До появления attached unit_cost (Phase 2) такие
    // позиции крон не включает; председатель добавит их вручную.
    const itemsWithCost = candidates.filter((inv) => {
      const cost = this.resolveUnitCost(inv);
      return cost !== null && cost > 0;
    });

    if (itemsWithCost.length === 0) {
      this.logger.info(
        `[WRITEOFF_CRON] найдено ${candidates.length} кандидатов, но ни у одного нет unit_cost — DRAFT не создан, председателю отправлено напоминание (coopname=${coopname})`
      );
      this.eventBus.emit('marketplace.writeoff.cron.reminder', {
        coopname,
        fired_at: new Date().toISOString(),
        candidates_count: candidates.length,
      });
      return;
    }

    const items: Parameters<typeof this.writeoffService.createDraft>[0]['items'] = itemsWithCost.map(
      (inv) => {
        const unitCost = this.resolveUnitCost(inv) as number;
        const total = unitCost * Number(inv.quantity_per_label);
        return {
          braname: inv.braname,
          asset_title: inv.product_name_snapshot,
          quantity: String(inv.quantity_per_label),
          amount: total.toFixed(this.assetConfig.decimals),
          reason: this.deriveReason(inv.expiry_date),
          inventory_id: inv.id,
        };
      }
    );

    const created = await this.writeoffService.createDraft({
      coopname,
      trigger: MarketplaceWriteoffProposalTriggers.CRON,
      proposed_by_account: null,
      items,
    });

    this.logger.info(
      `[WRITEOFF_CRON] сгенерирован DRAFT id=${created.id} c ${items.length} позициями (coopname=${coopname})`
    );

    this.eventBus.emit(MARKETPLACE_WRITEOFF_DRAFT_BUILT_EVENT, {
      coopname,
      proposal_id: created.id,
      trigger: 'cron',
      items_count: items.length,
      total_amount: created.total_amount,
    });
  }

  private deriveReason(expiry: Date | null): string {
    if (!expiry) return 'Срок годности не задан';
    return 'Истёк срок годности';
  }

  private resolveUnitCost(inv: MarketplaceInventoryEntity): number | null {
    const candidates: Array<string | number | null | undefined> = [
      (inv as unknown as { unit_cost?: string | number }).unit_cost,
      (inv as unknown as { unit_price?: string | number }).unit_price,
      (inv as unknown as { price_per_unit?: string | number }).price_per_unit,
    ];
    for (const v of candidates) {
      if (v === null || v === undefined) continue;
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }
}

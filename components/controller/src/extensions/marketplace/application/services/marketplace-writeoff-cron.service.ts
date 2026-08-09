import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import config from '~/config/config';
import { MarketplaceExtensionConfigService } from './marketplace-extension-config.service';
import { MarketplaceInventoryEntity } from '../../infrastructure/entities/marketplace-inventory.entity';
import { MarketplaceInventoryOnWarehouseStatuses } from '../../domain/entities/marketplace-inventory.types';
import { MarketplaceWriteoffProposalTriggers } from '../../domain/entities/marketplace-writeoff-proposal.types';
import { MarketplaceWriteoffService } from './marketplace-writeoff.service';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';
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
  private static readonly EXPIRED_REASON = 'Истёк срок годности';

  constructor(
    @InjectRepository(MarketplaceInventoryEntity, 'marketplace')
    private readonly inventoryRepo: Repository<MarketplaceInventoryEntity>,
    private readonly writeoffService: MarketplaceWriteoffService,
    private readonly extensionConfig: MarketplaceExtensionConfigService,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    private readonly eventBus: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
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

    const cfg = await this.extensionConfig.get();
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
    const rawCandidates = await this.inventoryRepo.find({
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

    // `expiry_date <= cutoff` в Postgres/TypeORM уже отсекает NULL (сравнение
    // NULL <= x недостоверно → строка не проходит WHERE), но эта защита
    // неявная и завязана на конкретный SQL-оператор — если запрос когда-нибудь
    // поменяют (например, добавят "IS NULL OR <="), автоматическое списание
    // молча захватит имущество без указанного срока годности. Юридический
    // документ (Заявление 1108) не имеет права нести причину «не задан» — либо
    // «Истёк срок годности» (детерминировано крон-сканером), либо причина,
    // которую вписал председатель вручную. Третьего не дано, поэтому здесь —
    // явный, не полагающийся на СУБД, гвард с алертом на аномалию.
    const candidates = rawCandidates.filter((inv) => {
      if (inv.expiry_date === null) {
        this.logger.error(
          `[WRITEOFF_CRON] аномалия: позиция ${inv.id} без expiry_date прошла фильтр LessThanOrEqual — исключена из автосписания (coopname=${coopname})`
        );
        return false;
      }
      return true;
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
          // Единственный кандидат крона — просроченный скоропорт (см. гвард
          // expiry_date !== null выше), причина всегда детерминирована.
          reason: MarketplaceWriteoffCronService.EXPIRED_REASON,
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

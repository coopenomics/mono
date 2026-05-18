import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import config from '~/config/config';
import { ExtensionDomainService } from '~/domain/extension/services/extension-domain.service';
import { MarketplaceInventoryEntity } from '../../infrastructure/entities/marketplace-inventory.entity';
import {
  MarketplaceWriteoffProposalTriggers,
  type MarketplaceWriteoffProposalItem,
} from '../../domain/entities/marketplace-writeoff-proposal.types';
import { MarketplaceWriteoffService } from './marketplace-writeoff.service';
import type { IConfig } from '../../types';
import { MARKETPLACE_WRITEOFF_DRAFT_BUILT_EVENT } from '../events/marketplace-notification.events';

const ASSET_DECIMALS = 4;

/**
 * Story 8.3 (Эпик 8): крон-сканер скоропорта.
 *
 * Раз в месяц проходит по `marketplace_inventory.expiry_date`. Если в
 * настройках расширения `writeoff.auto_proposal_enabled = true` —
 * формирует DRAFT-проект списания со всеми позициями, попавшими в окно
 * `expiry_date <= now + expiry_grace_days`. Иначе — только эмитит
 * напоминание председателю, чтобы тот собрал корзину вручную.
 */
@Injectable()
export class MarketplaceWriteoffCronService implements OnModuleInit {
  constructor(
    @InjectRepository(MarketplaceInventoryEntity, 'marketplace')
    private readonly inventoryRepo: Repository<MarketplaceInventoryEntity>,
    private readonly writeoffService: MarketplaceWriteoffService,
    private readonly extensionDomainService: ExtensionDomainService,
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

    const extension = await this.extensionDomainService.getAppByName('market');
    const cfg = extension?.config as IConfig | undefined;
    const auto = cfg?.writeoff?.auto_proposal_enabled ?? false;
    const graceDays = cfg?.writeoff?.expiry_grace_days ?? 7;

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

    const horizon = new Date(Date.now() + graceDays * 86_400_000);
    const candidates = await this.inventoryRepo.find({
      where: {
        coopname,
        status: 'LABELED',
        expiry_date: LessThanOrEqual(horizon),
      },
      take: 200,
      order: { expiry_date: 'ASC' },
    });

    if (candidates.length === 0) {
      this.logger.info(
        `[WRITEOFF_CRON] не найдено позиций для списания в окне +${graceDays} дней (coopname=${coopname})`
      );
      return;
    }

    const items: Parameters<typeof this.writeoffService.createDraft>[0]['items'] = candidates.map(
      (inv) => ({
        braname: inv.braname,
        asset_title: inv.product_name_snapshot,
        quantity: String(inv.quantity_per_label),
        // Stub: до Phase 2 нет attached unit cost — крон ставит 0 placeholder,
        // председатель руками поправит при ревью drafts'а. Это даёт UX —
        // позиции уже видны, остаётся только проставить суммы.
        amount: (0).toFixed(ASSET_DECIMALS),
        reason: this.deriveReason(inv.expiry_date, horizon),
        inventory_id: inv.id,
      })
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

  private deriveReason(expiry: Date | null, horizon: Date): string {
    if (!expiry) return 'Срок годности не задан';
    if (expiry.getTime() <= Date.now()) return 'Истёк срок годности';
    if (expiry.getTime() <= horizon.getTime())
      return 'Срок годности истекает в ближайшее время';
    return 'Скоропорт';
  }
}

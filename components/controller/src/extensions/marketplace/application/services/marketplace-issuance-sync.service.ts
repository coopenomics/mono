import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { MarketContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, type InnerChainActionRecord, type ISignedDocument } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { MARKETPLACE_ISSUANCE_SERVICE, MarketplaceIssuanceService } from './marketplace-issuance.service';

/**
 * Слушатель обратных вызовов совета по выдаче имущества (паевая модель) и
 * сторож саги.
 *
 * Заявление уходит в совет через `marketplace::issuestmt` (инлайн повестка
 * `mktissue`). После решения `soviet::exec` вызывает `marketplace::onmktisauth`
 * (протокол в заказе) либо `onmktisdecl` (отказ / просрочка). Слушатель
 * переводит сагу дальше и формирует акт; сторож раз в 15 секунд дожимает
 * саги, застрявшие между этапами (не дочитан номер решения, робот не
 * ответил, акт не сформирован).
 */
@Injectable()
export class MarketplaceIssuanceSyncService {
  private static readonly WATCHDOG_MS = 15_000;
  private ticking = false;

  constructor(
    @Inject(MARKETPLACE_ISSUANCE_SERVICE)
    private readonly issuanceService: MarketplaceIssuanceService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceIssuanceSyncService.name);
  }

  @OnEvent(`action::${MarketContract.contractName.production}::${MarketContract.Actions.OnMktIsAuth.actionName}`)
  async handleAuthorized(action: InnerChainActionRecord): Promise<void> {
    try {
      const data = action.data as MarketContract.Actions.OnMktIsAuth.IOnMktIsAuth;
      if (!data?.coopname || !data?.hash) return;
      await this.issuanceService.onCouncilAuthorized({
        coopname: data.coopname,
        // On-chain hash приходит в верхнем регистре, order_hash в проекции — в нижнем.
        order_hash: String(data.hash).toLowerCase(),
        protocol: (data.authorization as unknown as ISignedDocument) ?? null,
      });
    } catch (err: any) {
      this.logger.error(`onmktisauth listener упал: ${err.message}`, err.stack);
    }
  }

  @OnEvent(`action::${MarketContract.contractName.production}::${MarketContract.Actions.OnMktIsDecl.actionName}`)
  async handleDeclined(action: InnerChainActionRecord): Promise<void> {
    try {
      const data = action.data as MarketContract.Actions.OnMktIsDecl.IOnMktIsDecl;
      if (!data?.coopname || !data?.hash) return;
      await this.issuanceService.onCouncilDeclined({
        coopname: data.coopname,
        order_hash: String(data.hash).toLowerCase(),
        reason: data.reason ?? 'причина не указана',
      });
    } catch (err: any) {
      this.logger.error(`onmktisdecl listener упал: ${err.message}`, err.stack);
    }
  }

  @Interval(MarketplaceIssuanceSyncService.WATCHDOG_MS)
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const olderThan = new Date(Date.now() - MarketplaceIssuanceSyncService.WATCHDOG_MS);
      await this.issuanceService.watchdogTick(platformSettings().coopname, olderThan);
    } catch (err: any) {
      this.logger.warn(`Сторож выдачи: проход упал (${err.message}).`);
    } finally {
      this.ticking = false;
    }
  }
}

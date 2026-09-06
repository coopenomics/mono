import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { MarketContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, type InnerChainActionRecord, type ISignedDocument } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { MARKETPLACE_RETURN_CLAIM_SERVICE, MarketplaceReturnClaimService } from './marketplace-return-claim.service';

/**
 * Слушатель обратных вызовов совета по гарантийному возврату (паевая модель)
 * и сторож ожидания решения.
 *
 * Заявление уходит в совет через `marketplace::accretrn` (инлайн повестка
 * `mktretrn`). После решения `soviet::exec` вызывает `marketplace::onmktrtauth`
 * (все движения по заказу откачены) либо `onmktrtdecl` (отказ / просрочка).
 * Слушатель переводит заявление дальше; сторож раз в 30 секунд дочитывает
 * номер решения и зовёт робота там, где это не удалось у стойки. Решение
 * людей сторож не торопит — оно может идти сколь угодно долго.
 */
@Injectable()
export class MarketplaceReturnClaimSyncService {
  private static readonly WATCHDOG_MS = 30_000;
  private ticking = false;

  constructor(
    @Inject(MARKETPLACE_RETURN_CLAIM_SERVICE)
    private readonly returnService: MarketplaceReturnClaimService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceReturnClaimSyncService.name);
  }

  @OnEvent(`action::${MarketContract.contractName.production}::${MarketContract.Actions.OnMktRtAuth.actionName}`)
  async handleAuthorized(action: InnerChainActionRecord): Promise<void> {
    try {
      const data = action.data as MarketContract.Actions.OnMktRtAuth.IOnMktRtAuth;
      if (!data?.coopname || !data?.hash) return;
      await this.returnService.onCouncilAuthorized({
        coopname: data.coopname,
        // On-chain hash приходит в верхнем регистре, request_hash в проекции — в нижнем.
        request_hash: String(data.hash).toLowerCase(),
        protocol: (data.authorization as unknown as ISignedDocument) ?? null,
        tx_hash: this.txHash(action),
      });
    } catch (err: any) {
      this.logger.error(`onmktrtauth listener упал: ${err.message}`, err.stack);
    }
  }

  @OnEvent(`action::${MarketContract.contractName.production}::${MarketContract.Actions.OnMktRtDecl.actionName}`)
  async handleDeclined(action: InnerChainActionRecord): Promise<void> {
    try {
      const data = action.data as MarketContract.Actions.OnMktRtDecl.IOnMktRtDecl;
      if (!data?.coopname || !data?.hash) return;
      await this.returnService.onCouncilDeclined({
        coopname: data.coopname,
        request_hash: String(data.hash).toLowerCase(),
        reason: data.reason ?? 'причина не указана',
        tx_hash: this.txHash(action),
      });
    } catch (err: any) {
      this.logger.error(`onmktrtdecl listener упал: ${err.message}`, err.stack);
    }
  }

  @Interval(MarketplaceReturnClaimSyncService.WATCHDOG_MS)
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.returnService.watchdogTick(platformSettings().coopname);
    } catch (err: any) {
      this.logger.warn(`Сторож возврата: проход упал (${err.message}).`);
    } finally {
      this.ticking = false;
    }
  }

  private txHash(action: InnerChainActionRecord): string {
    return action.transaction_id ?? '';
  }
}

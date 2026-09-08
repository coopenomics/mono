import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { MarketContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, type InnerChainActionRecord } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { MARKETPLACE_SUPPLIER_CLAIM_SERVICE, MarketplaceSupplierClaimService } from './marketplace-supplier-claim.service';

/**
 * Зеркало ответов поставщика по гарантийным претензиям из цепи и сторож
 * автоприёма (задача 99D-13).
 *
 * Ответы обычно проходят через мутации стола поставщика и уже отражены в PG;
 * слушатели доводят состояние, если транзакция ушла иным путём или PG отстал.
 * Сторож раз в 10 минут признаёт за поставщика претензии, срок ответа по
 * которым истёк — только при включённом автоприёме в настройках расширения.
 */
@Injectable()
export class MarketplaceSupplierClaimSyncService {
  private static readonly WATCHDOG_MS = 10 * 60_000;
  private ticking = false;

  constructor(
    @Inject(MARKETPLACE_SUPPLIER_CLAIM_SERVICE)
    private readonly service: MarketplaceSupplierClaimService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceSupplierClaimSyncService.name);
  }

  @OnEvent(`action::${MarketContract.contractName.production}::${MarketContract.Actions.AdmitClaim.actionName}`)
  async handleAdmitted(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as MarketContract.Actions.AdmitClaim.IAdmitClaim;
    if (!data?.coopname || !data?.claim_hash) return;
    await this.mirror({ coopname: data.coopname, claim_hash: String(data.claim_hash), status: 'ADMITTED', tx_hash: this.txHash(action) });
  }

  @OnEvent(`action::${MarketContract.contractName.production}::${MarketContract.Actions.RefuseClaim.actionName}`)
  async handleRefused(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as MarketContract.Actions.RefuseClaim.IRefuseClaim;
    if (!data?.coopname || !data?.claim_hash) return;
    await this.mirror({ coopname: data.coopname, claim_hash: String(data.claim_hash), status: 'REFUSED', reason: data.reason, tx_hash: this.txHash(action) });
  }

  @OnEvent(`action::${MarketContract.contractName.production}::${MarketContract.Actions.AutoClaim.actionName}`)
  async handleAutoAdmitted(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as MarketContract.Actions.AutoClaim.IAutoClaim;
    if (!data?.coopname || !data?.claim_hash) return;
    await this.mirror({ coopname: data.coopname, claim_hash: String(data.claim_hash), status: 'ADMITTED', auto: true, tx_hash: this.txHash(action) });
  }

  @Interval(MarketplaceSupplierClaimSyncService.WATCHDOG_MS)
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.service.autoAdmitTick(platformSettings().coopname);
    } catch (err: any) {
      this.logger.error(`сторож автоприёма претензий упал: ${err.message}`, err.stack);
    } finally {
      this.ticking = false;
    }
  }

  private async mirror(input: Parameters<MarketplaceSupplierClaimService['mirrorDecision']>[0]): Promise<void> {
    try {
      await this.service.mirrorDecision(input);
    } catch (err: any) {
      this.logger.error(`зеркало ответа по претензии упало: ${err.message}`, err.stack);
    }
  }

  private txHash(action: InnerChainActionRecord): string {
    return (action as { transaction_id?: string }).transaction_id ?? '';
  }
}

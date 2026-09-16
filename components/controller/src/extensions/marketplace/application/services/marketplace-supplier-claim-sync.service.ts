import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MarketContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, type InnerChainActionRecord } from '@coopenomics/innercoop';
import { MARKETPLACE_SUPPLIER_CLAIM_SERVICE, MarketplaceSupplierClaimService } from './marketplace-supplier-claim.service';

/**
 * Зеркало признания гарантийной претензии из цепи (задача 99D-13). Признание
 * обычно проходит через мутацию стола поставщика и уже отражено в PG;
 * слушатель доводит состояние, если транзакция ушла иным путём или PG отстал.
 * Несогласие в цепь не пишется, автоприёма нет — претензия без признания
 * лежит на кошельке непризнанных сколько угодно.
 */
@Injectable()
export class MarketplaceSupplierClaimSyncService {
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
    try {
      await this.service.mirrorAdmitted({
        coopname: data.coopname,
        claim_hash: String(data.claim_hash),
        tx_hash: (action as { transaction_id?: string }).transaction_id ?? '',
      });
    } catch (err: any) {
      this.logger.error(`зеркало признания претензии упало: ${err.message}`, err.stack);
    }
  }
}

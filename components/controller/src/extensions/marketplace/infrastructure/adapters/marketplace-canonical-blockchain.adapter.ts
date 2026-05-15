import { Inject, Injectable } from '@nestjs/common';
import { MarketContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import {
  VaultDomainService,
  VAULT_DOMAIN_SERVICE,
} from '~/domain/vault/services/vault-domain.service';
import httpStatus from 'http-status';
import { HttpApiError } from '~/utils/httpApiError';
import type { MarketplaceCanonicalBlockchainPort } from '../../domain/ports/marketplace-canonical-blockchain.port';

/**
 * Story 4.1: canonical-adapter для marketplace процессов. Параллелен
 * legacy `marketplace-blockchain.adapter.ts` (который под удаление в
 * отдельном refactor-PR после PR #385 — на Story 4.1 не трогаем).
 *
 * Подпись tx — ключ кооператива (`require_auth(coopname)` в C++); ключ
 * берётся из VaultDomainService по `data.coopname`.
 */
@Injectable()
export class MarketplaceCanonicalBlockchainAdapter implements MarketplaceCanonicalBlockchainPort {
  constructor(
    private readonly blockchainService: BlockchainService,
    @Inject(VAULT_DOMAIN_SERVICE)
    private readonly vaultDomainService: VaultDomainService
  ) {}

  async createOrder(data: MarketContract.Actions.CreateOrder.ICreateOrder): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit createorder');
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.CreateOrder.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async expireOrder(data: MarketContract.Actions.ExpireOrder.IExpireOrder): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit expireorder');
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.ExpireOrder.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async cancelOrder(data: MarketContract.Actions.CancelOrder.ICancelOrder): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit cancelorder');
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.CancelOrder.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }
}

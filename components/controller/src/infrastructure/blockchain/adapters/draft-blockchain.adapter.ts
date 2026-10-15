import { Inject, Injectable } from '@nestjs/common';
import { DraftContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';
import httpStatus from 'http-status';
import { DomainError } from '@coopenomics/extension-kit';
import { BlockchainService } from '../blockchain.service';
import { VAULT_DOMAIN_SERVICE, VaultDomainService } from '~/domain/vault/services/vault-domain.service';
import type { DraftBlockchainPort } from '~/domain/common/ports/draft-blockchain.port';

@Injectable()
export class DraftBlockchainAdapter implements DraftBlockchainPort {
  constructor(
    private readonly blockchainService: BlockchainService,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService
  ) {}

  async approveDraft(data: DraftContract.Actions.Approve.IApprove): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new DomainError('BLOCKCHAIN_PRIVATE_KEY_NOT_FOUND', {}, httpStatus.BAD_GATEWAY);

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: DraftContract.contractName.production,
      name: DraftContract.Actions.Approve.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }
}

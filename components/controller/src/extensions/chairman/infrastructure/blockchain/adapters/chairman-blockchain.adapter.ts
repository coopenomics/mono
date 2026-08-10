import { Injectable, Inject } from '@nestjs/common';
import { SovietContract } from 'cooptypes';
import { ChairmanBlockchainPort } from '../../../domain/interfaces/chairman-blockchain.port';
import { type TransactResult } from '@wharfkit/session';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import httpStatus from 'http-status';
import { ConfirmApproveDomainInput } from '../../../domain/actions/confirm-approve-domain-input.interface';
import { DeclineApproveDomainInput } from '../../../domain/actions/decline-approve-domain-input.interface';
import { DomainToBlockchainUtils, HttpApiError } from '@coopenomics/extension-kit';
import { VAULT_PORT, type IVaultPort } from '@coopenomics/innercoop';

/**
 * Инфраструктурный сервис для реализации блокчейн порта CHAIRMAN
 * Осуществляет взаимодействие с блокчейном через BlockchainService
 */
@Injectable()
export class ChairmanBlockchainAdapter implements ChairmanBlockchainPort {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    @Inject(VAULT_PORT) private readonly vaultDomainService: IVaultPort
  ) {}

  /**
   * Подтвердить одобрение документа
   */
  async confirmApprove(data: ConfirmApproveDomainInput): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    // Преобразуем данные для блокчейна
    const blockchainData: SovietContract.Actions.Approves.ConfirmApprove.IConfirmApprove = {
      coopname: data.coopname,
      username: data.username,
      approval_hash: data.approval_hash,
      approved_document: data.approved_document
        ? this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.approved_document)
        : undefined,
    };
    console.log('blockchainData', blockchainData);

    return await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Approves.ConfirmApprove.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: blockchainData,
    });
  }

  /**
   * Отклонить одобрение документа
   */
  async declineApprove(data: DeclineApproveDomainInput): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    // Преобразуем данные для блокчейна
    const blockchainData: SovietContract.Actions.Approves.DeclineApprove.IDeclineApprove = {
      coopname: data.coopname,
      username: data.username,
      approval_hash: data.approval_hash,
      reason: data.reason,
    };

    return await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Approves.DeclineApprove.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: blockchainData,
    });
  }
}
